// v7.1.0 (#4, #6): offline SVG dashboard charts, floating ＋ Quick Add, 🎙 voice entry.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, loggedIn, J } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const EXISTING = { pk3_data_version: '5', pk3_settings: J({ companyName: 'Test Traders', phone1: '9800000000' }), pk3_business: J({ type: 'retail', setupDone: true }), pk3_v7_migrated: '1' };

// Seed data relative to "today" inside the page so BS month buckets are stable.
async function seed(page) {
  return page.evaluate(() => {
    const iso = (daysAgo) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0, 10); };
    const t = todayISO();
    STORE.set('pk3_customers', [{ id: 'c1', name: 'Ram' }, { id: 'c2', name: 'Sita' }, { id: 'c3', name: 'Hari' }, { id: 'demo_c', name: 'Demo', _demo: true }]);
    STORE.set('pk3_invoices', [
      { id: 'i1', custId: 'c1', invNum: 'INV-1', date: t, amount: 50000, paid: 20000, balance: 30000, status: 'Partial',
        items: [{ name: 'Plywood 19mm', qty: 10, rate: 3000, amount: 30000 }, { name: 'Labour', qty: 1, rate: 20000, amount: 20000 }] },
      { id: 'i2', custId: 'c2', invNum: 'INV-2', date: t, amount: 12000, paid: 12000, balance: 0, status: 'Paid',
        items: [{ name: 'plywood 19mm', qty: 4, rate: 3000, amount: 12000 }] },
      { id: 'i3', custId: 'c2', invNum: 'INV-3', date: t, amount: 99999, paid: 0, balance: 99999, status: 'Cancelled',
        items: [{ name: 'Cancelled thing', qty: 1, rate: 99999, amount: 99999 }] },
      { id: 'i4', custId: 'demo_c', invNum: 'D-1', date: t, amount: 77777, balance: 77777, status: 'Pending', _demo: true, items: [{ name: 'Demo item', qty: 1, rate: 77777, amount: 77777 }] },
      { id: 'i5', custId: 'c3', invNum: 'INV-5', date: iso(400), amount: 8000, balance: 8000, status: 'Pending', items: [{ name: 'Old Service', qty: 1, rate: 8000, amount: 8000 }] }
    ]);
    STORE.set('pk3_daybook', [
      { id: 'd1', type: 'income', amount: 5000, date: t, desc: 'Cash sale' },
      { id: 'd2', type: 'income', amount: 7000, date: t, cat: 'Advance', desc: 'Advance' },
      { id: 'd3', type: 'expense', amount: 3000, date: t, desc: 'Rent' },
      { id: 'd4', type: 'expense', amount: 4000, date: t, desc: 'Supplier भुक्तानी', _payable: 'pt_x' },
      { id: 'd5', type: 'expense', amount: 999, date: iso(400), desc: 'Too old' }
    ]);
    STORE.set('pk3_ledger', [{ id: 'l1', customerId: 'c3', debit: 2500, credit: 0, date: '2081-01-01' }, { id: 'l2', customerId: 'c2', debit: 0, credit: 1500 }]);
    STORE.set('pk3_payables', [{ id: 'p1', name: 'Shiva Suppliers', kind: 'supplier' }, { id: 'p2', name: 'Hari Mistri', kind: 'mistri' }]);
    STORE.set('pk3_payable_txns', [
      { id: 'pt1', partyId: 'p1', type: 'bill', amount: 10000, date: t },
      { id: 'pt_x', partyId: 'p1', type: 'payment', amount: 4000, date: t },
      { id: 'pt2', partyId: 'p2', type: 'payment', amount: 1000, date: t }
    ]);
    return true;
  });
}

test('📈 6-month Sales vs Expense: invoices + cash sales, no double count, BS months', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: EXISTING });
  await seed(page);
  const r = await page.evaluate(() => ({ rows: DashCharts.monthly(6), months: DashCharts.lastMonths(3, '2082-02-15'), wrap: DashCharts.lastMonths(3, '2082-01-03') }));
  assert.equal(r.rows.length, 6);
  const cur = r.rows[5];
  // sales = 50000 + 12000 (invoices; cancelled & demo skipped) + 5000 cash sale (advance skipped)
  assert.equal(cur.sales, 67000);
  // expense = 3000 rent + 10000 supplier bill (its 4000 payment is not counted again)
  assert.equal(cur.expense, 13000);
  assert.equal(cur.net, 54000);
  assert.ok(/^\d{4}-\d{2}$/.test(cur.key));
  assert.equal(r.rows.slice(0, 5).reduce((s, x) => s + x.sales + x.expense, 0), 0, '400-day-old entries are outside the window');
  assert.deepEqual(r.months, ['2081-12', '2082-01', '2082-02']);
  assert.deepEqual(r.wrap, ['2081-11', '2081-12', '2082-01']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('⚖️ Receivables vs Payables and 🏆 Top 5 items', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: EXISTING });
  await seed(page);
  const r = await page.evaluate(() => ({ dues: DashCharts.dues(), top6: DashCharts.topItems(5, 'months'), topAll: DashCharts.topItems(5, 'all'), short: [DashCharts.short(950), DashCharts.short(12500), DashCharts.short(250000), DashCharts.short(12000000)] }));
  // c1 30000 (invoice) + c3 8000 invoice + 2500 ledger; c2 −1500 credit = advance held
  assert.equal(r.dues.receivable, 40500);
  assert.equal(r.dues.recvCount, 2);
  assert.equal(r.dues.advanceHeld, 1500);
  // p1 bill 10000 − payment 4000 = 6000; p2 advance −1000 not counted as payable
  assert.equal(r.dues.payable, 6000);
  assert.equal(r.dues.payCount, 1);
  assert.equal(r.top6.source, 'invoice');
  assert.deepEqual(r.top6.items.map((x) => [x.name, x.amount]), [['Plywood 19mm', 42000], ['Labour', 20000]], 'same item merged case-insensitively; cancelled/demo/old skipped');
  assert.deepEqual(r.topAll.items.map((x) => x.name), ['Plywood 19mm', 'Labour', 'Old Service']);
  assert.deepEqual(r.short, ['950', '12.5K', '2.5L', '1.2Cr']);
  // Fallback to approved quotations when there are no invoices
  const q = await page.evaluate(() => {
    STORE.set('pk3_invoices', []);
    STORE.set('pk3_quotations', [{ id: 'q1', status: 'Approved', date: todayISO(), items: [{ name: 'UPVC Window', qty: 2, rate: 5000, amount: 10000 }] }, { id: 'q2', status: 'Pending', date: todayISO(), items: [{ name: 'Pending only', amount: 99999 }] }]);
    return DashCharts.topItems(5, 'months');
  });
  assert.equal(q.source, 'quotation');
  assert.deepEqual(q.items.map((x) => x.name), ['UPVC Window']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Dashboard shows the SVG charts offline, also on a phone without sideways scroll', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: EXISTING, viewport: { width: 375, height: 800 } });
  await seed(page);
  await page.evaluate(() => { App.navigate('dashboard'); Dashboard.render(); });
  await page.waitForSelector('#dash-insights svg.ins-svg');
  assert.equal(await page.locator('#ins-cash .ins-col').count(), 6);
  assert.ok(await page.locator('#ins-cash .ins-bar-s').count() >= 1);
  assert.match(await page.textContent('#ins-dues'), /40,500/);
  assert.match(await page.textContent('#ins-dues'), /6,000/);
  assert.match(await page.textContent('#ins-top'), /Plywood 19mm/);
  await page.click('#dash-insights .ins-seg button[data-r="all"]');
  assert.match(await page.textContent('#ins-top'), /Old Service/);
  await page.evaluate(() => DashCharts.showMonth(5));
  assert.match(await page.textContent('#ins-month-detail'), /67,000/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, 'no horizontal scroll, got ' + overflow);
  // No CDN / external chart library is loaded
  const ext = await page.evaluate(() => [...document.scripts].map((s) => s.src).filter((s) => s && !s.startsWith(location.origin)));
  assert.deepEqual(ext, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('＋ Quick Add opens New Sale / Expense / Walk-in / Quotation / Follow-up and respects Modules', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: EXISTING });
  await page.click('#fab-btn');
  await page.waitForSelector('#fab-modal.open');
  const ids = await page.$$eval('#qadd-grid [data-qadd]', (b) => b.map((x) => x.getAttribute('data-qadd')));
  for (const id of ['sale', 'expense', 'walkin', 'quotation', 'followup']) assert.ok(ids.includes(id), id + ' missing');
  assert.match(await page.textContent('#fab-btn'), /Quick Add/);
  // Expense → expense modal
  await page.click('[data-qadd="expense"]');
  await page.waitForSelector('#db-modal.open');
  assert.equal(await page.inputValue('#db-type'), 'expense');
  assert.equal(await page.isVisible('#fab-modal.open'), false);
  await page.evaluate(() => document.getElementById('db-modal').classList.remove('open'));
  // New Sale → invoice form
  await page.evaluate(() => QuickAdd.open());
  await page.click('[data-qadd="sale"]');
  await page.waitForSelector('#inv-edit-modal.open');
  assert.equal(await page.evaluate(() => App.currentPage), 'invoices');
  await page.evaluate(() => document.getElementById('inv-edit-modal').classList.remove('open'));
  // Follow-up page
  await page.evaluate(() => QuickAdd.go('followup'));
  assert.equal(await page.evaluate(() => App.currentPage), 'add-followup');
  // Module Off → hidden from Quick Add
  await page.evaluate(() => { Modules.set('walkin', false); Modules.set('quotations', false); QuickAdd.open(); });
  const ids2 = await page.$$eval('#qadd-grid [data-qadd]', (b) => b.map((x) => x.getAttribute('data-qadd')));
  assert.ok(!ids2.includes('walkin') && !ids2.includes('quotation'));
  assert.ok(ids2.includes('sale'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Quick Add on a phone: round ＋ button bottom-right, still opens with a tap', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: EXISTING, viewport: { width: 375, height: 800 } });
  const box = await page.locator('#fab-btn').boundingBox();
  assert.ok(box.x + box.width > 375 - 40 && box.y > 800 / 2, 'bottom-right');
  assert.ok(Math.abs(box.width - box.height) < 2, 'round on mobile');
  await page.tap('#fab-btn').catch(() => page.click('#fab-btn'));
  await page.waitForSelector('#fab-modal.open');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('🎙 Voice entry: mic next to note fields, fills text with ne-NP, graceful fallback', async () => {
  // Fake Web Speech API (real one needs a microphone + Google servers)
  const mock = (page) => page.addInitScript(() => {
    window.__recs = [];
    window.webkitSpeechRecognition = function () { window.__recs.push(this); };
    window.webkitSpeechRecognition.prototype.start = function () {
      const self = this;
      setTimeout(() => {
        const res = (txt, fin) => { const a = [{ transcript: txt }]; a.isFinal = fin; return a; };
        self.onresult({ resultIndex: 0, results: [res('सिमेन्ट', false)] });
        self.onresult({ resultIndex: 0, results: [res('सिमेन्ट ढुवानी खर्च', true)] });
        self.onend();
      }, 20);
    };
    window.webkitSpeechRecognition.prototype.stop = function () {};
    window.SpeechRecognition = window.webkitSpeechRecognition;   // newer Chromium has the unprefixed API
  });
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: EXISTING, mock });
  await page.evaluate(() => Expenses.openAdd());
  await page.waitForSelector('#db-modal.open');
  const mic = page.locator('.voice-btn[data-voice-for="db-desc"]');
  assert.equal(await mic.count(), 1);
  assert.equal(await page.locator('.voice-btn[data-voice-for="db-notes"]').count(), 1);
  await page.fill('#db-desc', 'आज');
  await mic.click();
  await page.waitForFunction(() => document.getElementById('db-desc').value === 'आज सिमेन्ट ढुवानी खर्च');
  assert.equal(await page.evaluate(() => window.__recs[0].lang), 'ne-NP');
  // English switch
  await page.evaluate(() => Voice.setLang('en-US'));
  await mic.click();
  await page.waitForFunction(() => window.__recs.length === 2);
  assert.equal(await page.evaluate(() => window.__recs[1].lang), 'en-US');
  // Dynamic fields opt in with data-voice
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'x-reason'; i.setAttribute('data-voice', ''); document.body.appendChild(i); });
  await page.waitForSelector('.voice-btn[data-voice-for="x-reason"]');
  // Mic is not wired twice
  assert.equal(await page.evaluate(() => Voice.scan()), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('🎙 Voice without browser support: dim mic, helpful toast, nothing breaks', async () => {
  const mock = (page) => page.addInitScript(() => { delete window.webkitSpeechRecognition; delete window.SpeechRecognition; window.webkitSpeechRecognition = undefined; window.SpeechRecognition = undefined; });
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: EXISTING, mock });
  await page.evaluate(() => DayBook.addModal());
  await page.waitForSelector('#db-modal.open');
  const mic = page.locator('.voice-btn[data-voice-for="db-desc"]');
  assert.match(await mic.getAttribute('class'), /\boff\b/);
  await mic.click();
  await page.waitForFunction(() => /कीबोर्ड/.test(document.getElementById('toast-container').textContent));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'db-desc');
  assert.deepEqual(errors, []);
  await ctx.close();
});
