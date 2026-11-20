// Regression tests for features that already worked in v6.8.1 and must keep working.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openApp, loggedIn, J, TEST_MASTER, TEST_PASS } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

test('fresh device: master key activates, Super Admin logs in', async () => {
  const { page, errors, ctx } = await openApp({ base, browser, storage: { pk3_sample_seeded: '1' } });
  await page.waitForSelector('#license-screen', { state: 'visible' });
  await page.fill('#license-key', TEST_MASTER);
  await page.evaluate(() => License.activate());
  assert.equal(await page.evaluate(() => License.isActivated()), true);
  assert.equal(await page.evaluate(() => License.status().plan), 'MASTER');
  // wrong key is refused
  assert.equal(await page.evaluate(() => License.validate('X', '1234').ok), false);
  await page.waitForSelector('#login-screen', { state: 'visible' });
  await page.fill('#login-user', 'punya');
  await page.fill('#login-pass', 'wrong');
  await page.evaluate(() => Auth.login());
  assert.equal(await page.evaluate(() => !!currentUser), false);
  await page.fill('#login-pass', TEST_PASS);
  await page.check('#remember-me');
  await page.evaluate(() => Auth.login());
  assert.equal(await page.evaluate(() => currentUser.role), 'superadmin');
  // remembered session survives a reload
  await page.reload();
  await page.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && currentUser.user === 'punya');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('already-activated device with old remembered session opens straight in', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser });
  assert.equal(await page.evaluate(() => License.isActivated()), true);
  assert.equal(await page.isVisible('#license-screen'), false);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Bikram Sambat calendar conversion and picker', async () => {
  const { page, ctx } = await loggedIn({ base, browser });
  const r = await page.evaluate(() => {
    const a = adToBs(2025, 4, 14), b = adToBs(2026, 11, 20);
    const back = bsToAd(2082, 1, 1);
    return { a, b, back: back.getFullYear() + '-' + (back.getMonth() + 1) + '-' + back.getDate(), today: todayBs() };
  });
  assert.deepEqual(r.a, { y: 2082, m: 1, d: 1 });
  assert.deepEqual(r.b, { y: 2083, m: 8, d: 4 });
  assert.equal(r.back, '2025-4-14');
  assert.match(r.today, /^\d{4}-\d{2}-\d{2}$/);
  await ctx.close();
});

test('Smart Reminders collect follow-ups, birthdays, pending quotes and dues', async () => {
  const today = new Date();
  const storage = {
    pk3_customers: J([
      { id: 'c1', name: 'Ram Bahadur', phone: '9800000001', birthday: '1990-' + iso(today).slice(5) },
      { id: 'c2', name: 'Sita Devi', phone: '9800000002' },
    ]),
    pk3_quotations: J([{ id: 'q1', custId: 'c2', custName: 'Sita Devi', custPhone: '9800000002', status: 'Pending', amount: 50000, date: daysAgo(6), items: [] }]),
    pk3_invoices: J([{ id: 'i1', custId: 'c2', custName: 'Sita Devi', amount: 20000, paid: 5000, balance: 15000, status: 'Partial', date: daysAgo(2) }]),
  };
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  await page.evaluate(() => {
    const fu = [{ id: 'f1', custId: 'c1', custName: 'Ram Bahadur', custPhone: '9800000001', fuDateBs: todayBs(), status: 'Pending', note: 'site visit' }];
    STORE.set('pk3_followups', fu);
  });
  const items = await page.evaluate(() => SmartRem.items().map((x) => x.type + ':' + x.name));
  assert.ok(items.includes('fu:Ram Bahadur'), items.join());
  assert.ok(items.includes('bday:Ram Bahadur'), items.join());
  assert.ok(items.includes('quote:Sita Devi'), items.join());
  assert.ok(items.includes('due:Sita Devi'), items.join());
  assert.equal(await page.evaluate(() => SmartRem.dueFor('c2').total), 15000);
  await page.evaluate(() => { App.navigate('dashboard'); SmartRem.render(); });
  const html = await page.innerHTML('#smart-rem-dash');
  assert.match(html, /स्मार्ट रिमाइन्डर/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('AI WhatsApp: ready-made Nepali template without key, AI text with Gemini key', async () => {
  const storage = { pk3_customers: J([{ id: 'c1', name: 'Hari', phone: '9811111111' }]) };
  let r = await loggedIn({ base, browser, storage });
  await r.page.evaluate(() => AIWA.open({ type: 'bday', custId: 'c1', name: 'Hari', phone: '9811111111' }));
  await r.page.waitForTimeout(200);
  assert.match(await r.page.inputValue('#aiwa-text'), /जन्मदिन/);
  await r.ctx.close();

  r = await loggedIn({
    base, browser, storage: { ...storage, pk3_gem_key: J('AIza-main') },
    mock: (page) => page.route(/generativelanguage\.googleapis\.com/, (rt) => rt.fulfill({
      status: 200, contentType: 'application/json',
      body: J({ candidates: [{ content: { parts: [{ text: 'नमस्ते Hari जी — AI सन्देश' }] } }] }),
    })),
  });
  await r.page.evaluate(() => AIWA.open({ type: 'fu', custId: 'c1', name: 'Hari', phone: '9811111111' }));
  await r.page.waitForFunction(() => /AI सन्देश/.test(document.getElementById('aiwa-text').value));
  await r.ctx.close();
});

test('Dropbox Auto-Sync pushes data (never API keys) and restores it', async () => {
  let uploaded = null;
  const mock = async (page) => {
    await page.route(/api\.dropboxapi\.com\/2\/files\/get_metadata/, (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: J({ rev: uploaded ? 'r2' : 'r1' }) }));
    await page.route(/content\.dropboxapi\.com\/2\/files\/upload/, (rt) => { const arg = JSON.parse(rt.request().headers()['dropbox-api-arg']); if (arg.path === '/swagatik-backup.json') uploaded = rt.request().postData(); rt.fulfill({ status: 200, contentType: 'application/json', body: J({ rev: 'r2' }) }); });
    await page.route(/content\.dropboxapi\.com\/2\/files\/download/, (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: uploaded }));
  };
  const auth = J({ access: 'tok', refresh: 'ref', exp: Date.now() + 3600e3 });
  const storage = { pk3_dbx_auth: auth, pk3_customers: J([{ id: 'c9', name: 'Dropbox Customer', phone: '9822222222' }]), pk3_gem_key: J('AIza-secret'), pk3_ai_key: J('sk-ant-secret') };
  const { page, ctx } = await loggedIn({ base, browser, storage, mock });
  assert.equal(await page.evaluate(() => DBX.push(true)), true);
  assert.ok(uploaded, 'backup uploaded');
  const data = JSON.parse(uploaded).data;
  assert.ok(data.pk3_customers.includes('Dropbox Customer'));
  assert.equal(data.pk3_gem_key, undefined);
  assert.equal(data.pk3_ai_key, undefined);
  assert.equal(data.pk3_session, undefined);
  // wipe local customers then restore from Dropbox
  await page.evaluate(() => { DBX._reload = () => {}; localStorage.setItem('pk3_customers', '[]'); });
  assert.equal(await page.evaluate(() => DBX.pull()), true);
  assert.match(await page.evaluate(() => localStorage.getItem('pk3_customers')), /Dropbox Customer/);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pk3_gem_key'))), 'AIza-secret');
  await ctx.close();
});

test('Walk-in Greeting, Rate List and Customer Ledger pages work', async () => {
  const storage = { pk3_customers: J([{ id: 'c1', name: 'Gita', phone: '9833333333' }]) };
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  await page.evaluate(() => App.navigate('walkin'));
  assert.ok(await page.locator('#wi-chips .chip-item').count() > 0);
  await page.evaluate(() => App.navigate('ratelist'));
  assert.ok((await page.evaluate(() => Object.keys(STORE.get('pk3_rates', {})).length)) > 0);
  await page.evaluate(() => App.navigate('ledger'));
  await page.selectOption('#ledger-cust-select', 'c1');
  await page.evaluate(() => { Ledger.select('c1'); Ledger.addTransaction(); });
  await page.fill('#ltx-amount', '12000'); await page.fill('#ltx-desc', 'Work bill');
  await page.evaluate(() => Ledger.saveTx());
  await page.evaluate(() => { Ledger.addTransaction(); });
  await page.selectOption('#ltx-type', 'credit'); await page.fill('#ltx-amount', '2000'); await page.fill('#ltx-desc', 'Paid');
  await page.evaluate(() => Ledger.saveTx());
  assert.match(await page.innerText('#ledger-content'), /Balance: Rs\. 10,000 \(Dr\)/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Money is shown as "Rs. 0", never "Rs Rs.0"', async () => {
  const { page, ctx } = await loggedIn({ base, browser });
  await page.evaluate(() => App.navigate('dashboard'));
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => fmtRs(0)), 'Rs. 0');
  assert.equal(await page.evaluate(() => fmtRs(125000)), 'Rs. 1,25,000');
  const text = await page.innerText('body');
  assert.doesNotMatch(text, /Rs\.?\s*Rs/);
  assert.equal((await page.innerText('#snap-income')).trim(), 'Rs. 0');
  await ctx.close();
});
