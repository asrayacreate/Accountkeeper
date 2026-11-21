// v7.3.0: ग्राहक / सप्लायर खाता विवरण (Party Ledger / Khata Statement)
// Opening, every bill / receipt / payment with a running balance, Closing; period filter; Print, PNG, WhatsApp, CSV.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, loggedIn, J } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

// A made-up business: every company detail must come from these settings, never from code.
const settings = { companyName: 'Himal Test Traders', address: 'Pokhara-8, Kaski', phone1: '9812345678', pan: '609876543' };
const inv = (o) => ({ items: [{ name: 'Item', qty: 1, unit: '', rate: o.amount }], subtotal: o.amount, taxP: 0, taxAmt: 0, discAmt: 0, paid: 0, balance: o.amount,
  status: 'Pending', custId: 'c1', custName: 'Ram Bahadur', custPhone: '9800000001', created: '2026-01-01T00:00:00.000Z', ...o });
const invoices = [
  // Rs 2,000 paid while billing + one installment of Rs 3,000
  inv({ id: 'i1', invNum: 'INV-001', amount: 10000, paid: 5000, balance: 5000, status: 'Partial', date: '2026-05-01', dateBs: '2083-01-18',
    payments: [{ id: 'p1', rcptNo: 'RCPT-2083-0001', amount: 3000, date: '2026-08-10', dateBs: '2083-04-25', mode: 'eSewa' }] }),
  // Rs 1,000 returned
  inv({ id: 'i2', invNum: 'INV-002', amount: 5000, date: '2026-09-01', dateBs: '2083-05-16', _returned: true, _returnedAmt: 1000 }),
  // cancelled → listed, never counted
  inv({ id: 'i3', invNum: 'INV-003', amount: 7000, date: '2026-09-10', status: 'Cancelled', cancelled: { reason: 'गलत बिल' } }),
  // another customer + a demo bill: never in Ram's statement
  inv({ id: 'i4', invNum: 'INV-004', amount: 999, custId: 'c2', custName: 'Sita Kumari', date: '2026-09-02' }),
  inv({ id: 'i5', invNum: 'INV-005', amount: 888, _demo: true, date: '2026-09-03' }),
];
const customers = [{ id: 'c1', name: 'Ram Bahadur', phone: '9800000001', address: 'Lakeside' }, { id: 'c2', name: 'Sita Kumari', phone: '9800000002' }, { id: 'c9', name: 'Nobody Yet' }];
const ledger = [
  { id: 'l1', customerId: 'c1', custName: 'Ram Bahadur', date: '2083-01-05', narration: 'पुरानो बाँकी', debit: 1500, credit: 0 },   // BS date only
  { id: 'l2', customerId: 'c1', custName: 'Ram Bahadur', date: '2083-06-15', dateAd: '2026-10-01', narration: 'नगद प्राप्त', debit: 0, credit: 500 },
  { id: 'l3', customerId: 'c1', custName: 'Ram Bahadur', date: '2083-01-18', narration: 'Sale', debit: 10000, credit: 0, _inv: 'i1' },          // auto-posted → skipped
  { id: 'l4', customerId: 'c1', custName: 'Ram Bahadur', date: '2083-05-20', narration: 'Return', debit: 0, credit: 1000, _return: true },     // auto return → skipped
];
const returns = [{ id: 'rt1', srcType: 'invoice', srcId: 'i2', num: 'INV-002', customerId: 'c1', amount: 1000, reason: 'टुटेको सामान', date: '2026-09-05', dateBs: '2083-05-20' }];
const payables = [{ id: 'py1', name: 'Everest Hardware', kind: 'supplier', phone: '9811111111', pan: '301234567' }];
const ptx = [
  { id: 't1', partyId: 'py1', type: 'bill', amount: 20000, date: '2026-07-20', billNo: 'EH-11', note: 'Plywood' },
  { id: 't2', partyId: 'py1', type: 'payment', amount: 8000, date: '2026-08-15' },
  { id: 't3', partyId: 'py1', type: 'bill', amount: 5000, date: '2026-10-02', billNo: 'EH-12' },
];
const storage = {
  pk3_data_version: '5', pk3_v7_migrated: '1', pk3_business: J({ type: 'construction', setupDone: true }),
  pk3_settings: J(settings), pk3_customers: J(customers), pk3_invoices: J(invoices), pk3_ledger: J(ledger), pk3_returns: J(returns),
  pk3_payables: J(payables), pk3_payable_txns: J(ptx),
};
const captureWA = (page) => page.evaluate(() => { window.__wa = []; AIWA._launch = (u) => window.__wa.push(u); });
const KEYS = ['pk3_invoices', 'pk3_ledger', 'pk3_payable_txns', 'pk3_customers', 'pk3_payables', 'pk3_daybook'];
const snap = (page) => page.evaluate((ks) => ks.map((k) => localStorage.getItem(k)), KEYS);

test('customer statement: opening, running balance, closing — matches the app\'s own due amount; cancelled / auto lines never double count', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  const before0 = await snap(page);
  const r = await page.evaluate(() => {
    const all = PartyStatement.build({ kind: 'customer', id: 'c1' });
    const part = PartyStatement.build({ kind: 'customer', id: 'c1', from: '2026-08-01', to: '2026-09-30' });
    const empty = PartyStatement.build({ kind: 'customer', id: 'c9' });
    return { all, part, empty, due: SmartRem.dueFor('c1').total, none: PartyStatement.build({ kind: 'customer', id: 'nope' }) };
  });
  const a = r.all;
  assert.equal(a.opening, 0);
  assert.equal(a.totalBill, 16500); assert.equal(a.totalPay, 6500); assert.equal(a.closing, 10000);
  assert.equal(a.closing, r.due, 'all-time closing = SmartRem.dueFor (same number the reminders use)');
  assert.equal(a.count, 7, 'cancelled bill is shown but not counted');
  assert.deepEqual(a.rows.map((x) => [x.date, x.bill, x.pay]), [
    ['2026-04-18', 1500, 0],      // BS-only ledger line converted to AD
    ['2026-05-01', 10000, 0], ['2026-05-01', 0, 2000],
    ['2026-08-10', 0, 3000], ['2026-09-01', 5000, 0], ['2026-09-05', 0, 1000], ['2026-09-10', 0, 0], ['2026-10-01', 0, 500]]);
  assert.deepEqual(a.rows.map((x) => x.balance), [1500, 11500, 9500, 6500, 11500, 10500, 10500, 10000], 'running balance on every line');
  assert.ok(a.rows[6].info && /रद्द/.test(a.rows[6].desc));
  assert.equal(a.rows[3].ref, 'RCPT-2083-0001'); assert.match(a.rows[3].desc, /eSewa/);
  assert.match(a.rows[5].desc, /Sales Return.*टुटेको सामान/);
  assert.ok(!a.rows.some((x) => /999|888/.test(String(x.bill))), 'other customer / demo bills never included');
  // period filter: everything before the start becomes the Opening Balance
  const p = r.part;
  assert.equal(p.opening, 9500);
  assert.equal(p.rows.length, 4); assert.equal(p.count, 3);
  assert.equal(p.totalBill, 5000); assert.equal(p.totalPay, 4000); assert.equal(p.closing, 10500);
  assert.equal(p.closing, p.opening + p.totalBill - p.totalPay);
  assert.equal(p.rows[p.rows.length - 1].balance, p.closing);
  assert.equal(p.fromBs, '2083-04-16'); assert.match(p.toBs, /^2083-06-/);
  assert.deepEqual([r.empty.rows.length, r.empty.closing, r.empty.opening], [0, 0, 0]);
  assert.equal(r.none, null);
  assert.deepEqual(await snap(page), before0, 'building a statement never writes to storage');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('supplier statement: purchase bills / payments with running balance = Payables balance', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  const r = await page.evaluate(() => {
    Payables.addTxn({ partyId: 'py1', type: 'payment', amount: 2000, date: '2026-10-05' }, { toDayBook: false });
    const s = PartyStatement.build({ kind: 'supplier', id: 'py1' });
    const f = PartyStatement.build({ kind: 'supplier', id: 'py1', from: '2026-08-01', to: '2026-08-31' });
    return { s, f, due: Payables.balance('py1').due, closingTxt: PartyStatement.balTxt('supplier', s.closing), L: PartyStatement.L('supplier') };
  });
  assert.equal(r.s.closing, 15000); assert.equal(r.s.closing, r.due);
  assert.deepEqual(r.s.rows.map((x) => x.balance), [20000, 12000, 17000, 15000]);
  assert.match(r.s.rows[0].desc, /खरिद बिल — Plywood/); assert.equal(r.s.rows[0].ref, 'EH-11');
  assert.deepEqual([r.f.opening, r.f.totalPay, r.f.closing, r.f.rows.length], [20000, 8000, 12000, 1]);
  assert.equal(r.closingTxt, 'Rs. 15,000 Cr');
  assert.equal(r.L.pos, 'तिर्नुपर्ने');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('period filter: this month / last month / Nepali fiscal year (Shrawan–Asar) / custom', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  const r = await page.evaluate(() => {
    const P = PartyStatement, nextDay = (iso) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + 1); return P._iso(d); };
    const out = {};
    for (const [k, t] of [['fy', '2083-08-05'], ['fy', '2083-02-10'], ['fy', '2083-04-01'], ['month', '2083-08-05'], ['lastmonth', '2083-01-10'], ['month', '2083-12-30']]) {
      const pr = P.period(k, '', '', t);
      out[k + ':' + t] = { from: P.bsOf(pr.from), to: P.bsOf(pr.to), after: P.bsOf(nextDay(pr.to)), label: pr.label };
    }
    out.custom = P.period('custom', '2026-09-30', '2026-08-01');
    out.all = P.period('all');
    out.adOf = [P.adOf('2083-01-01'), P.adOf('2026-04-14'), P.adOf('2083/1/1'), P.adOf(''), P.adOf('garbage')];
    return out;
  });
  assert.deepEqual([r['fy:2083-08-05'].from, r['fy:2083-08-05'].after], ['2083-04-01', '2084-04-01']);
  assert.match(r['fy:2083-08-05'].to, /^2084-03-3\d$/); assert.equal(r['fy:2083-08-05'].label, 'आर्थिक वर्ष 2083/84');
  assert.equal(r['fy:2083-02-10'].from, '2082-04-01', 'Baisakh–Asar still belongs to last fiscal year');
  assert.equal(r['fy:2083-04-01'].from, '2083-04-01');
  assert.deepEqual([r['month:2083-08-05'].from, r['month:2083-08-05'].after], ['2083-08-01', '2083-09-01']);
  assert.match(r['month:2083-08-05'].label, /यो महिना — Mangsir 2083/);
  assert.deepEqual([r['lastmonth:2083-01-10'].from, r['lastmonth:2083-01-10'].after], ['2082-12-01', '2083-01-01']);
  assert.deepEqual([r['month:2083-12-30'].from, r['month:2083-12-30'].after], ['2083-12-01', '2084-01-01'], 'Chaitra rolls into next year');
  assert.deepEqual([r.custom.from, r.custom.to], ['2026-08-01', '2026-09-30'], 'reversed custom dates are swapped');
  assert.deepEqual([r.all.from, r.all.to], ['', '']);
  assert.deepEqual(r.adOf, ['2026-04-14', '2026-04-14', '2026-04-14', '', '']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('UI: Customer Ledger → 📄 खाता विवरण → period buttons, Print / PDF, PNG photo, WhatsApp, CSV — company from settings only', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage, viewport: { width: 390, height: 820 } });
  await captureWA(page);
  const before0 = await snap(page);
  await page.evaluate(() => App.navigate('ledger'));
  await page.selectOption('#ledger-cust-select', 'c1');
  await page.click('#ledger-statement-btn');
  await page.waitForSelector('#pst-modal.open');
  assert.equal(await page.inputValue('#pst-party'), 'c1');
  assert.equal(await page.inputValue('#pst-kind'), 'customer');
  await page.click('#pst-periods [data-period="all"]');
  assert.match(await page.textContent('#pst-body [data-pst-closing]'), /Rs\. 10,000 Dr/);
  assert.equal(await page.locator('#pst-body tbody tr').count(), 8 + 3, 'opening + 8 lines + total + closing');
  // custom dates
  await page.click('#pst-periods [data-period="custom"]');
  assert.ok(await page.isVisible('#pst-from'));
  await page.fill('#pst-from', '2026-08-01'); await page.dispatchEvent('#pst-from', 'change');
  await page.fill('#pst-to', '2026-09-30'); await page.dispatchEvent('#pst-to', 'change');
  assert.match(await page.textContent('#pst-body [data-pst-closing]'), /Rs\. 10,500 Dr/);
  assert.match(await page.textContent('#pst-body'), /Opening Balance[\s\S]*Rs\. 9,500 Dr/);
  // Print / PDF
  const html = await page.evaluate(() => { let w = ''; window.open = () => ({ document: { write: (h) => { w = h; }, close() {} } }); document.getElementById('pst-size').value = 'A5'; PartyStatement.doPrint(); return w; });
  assert.ok(html.includes('Himal Test Traders')); assert.ok(html.includes('609876543')); assert.ok(html.includes('Pokhara-8, Kaski'));
  assert.ok(html.includes('ACCOUNT STATEMENT')); assert.ok(html.includes('खाता विवरण')); assert.ok(html.includes('Ram Bahadur'));
  assert.ok(html.includes('@page{size:A5'));
  assert.ok(!/prerak/i.test(html), 'no hardcoded company');
  // PNG photo → download when the device cannot share files
  const png = await page.evaluate(async () => {
    Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
    let got = null; DocShare.download = (b, n) => { got = { size: b.size, type: b.type, name: n }; };
    const res = await PartyStatement.doShare();
    const bmp = await createImageBitmap(await PartyStatement.toBlob(PartyStatement._st));
    return { res, got, w: bmp.width, h: bmp.height };
  });
  assert.equal(png.res, 'downloaded'); assert.equal(png.got.type, 'image/png'); assert.ok(png.got.size > 5000);
  assert.match(png.got.name, /^Statement-Ram-Bahadur-2083-06-\d\d\.png$/);
  assert.equal(png.w, 1080); assert.ok(png.h > 900);
  // WhatsApp summary to the customer's own number
  await page.click('#pst-wa');
  const wa = await page.evaluate(() => decodeURIComponent(window.__wa[0] || ''));
  assert.match(wa, /phone=9779800000001/);
  assert.match(wa, /नमस्ते Ram Bahadur जी/); assert.match(wa, /Himal Test Traders को खाता विवरण/);
  assert.match(wa, /Opening Balance: Rs\. 9,500 Dr/); assert.match(wa, /Closing Balance: Rs\. 10,500 Dr\* \(लिनुपर्ने\)/);
  assert.match(wa, /9812345678/); assert.ok(!/\{[a-z_]+\}/.test(wa), 'no placeholder left');
  // CSV (Excel-safe Nepali)
  const csv = await page.evaluate(() => { CAExport._last = null; PartyStatement.doCSV(); return CAExport._last; });
  assert.match(csv.name, /^Statement-Ram-Bahadur-.*\.csv$/);
  assert.ok(csv.text.startsWith('﻿')); assert.ok(csv.text.includes('Opening Balance')); assert.ok(csv.text.includes('Closing Balance'));
  assert.ok(csv.text.includes('RCPT-2083-0001')); assert.ok(csv.text.includes('Himal Test Traders'));
  assert.deepEqual(await snap(page), before0, 'the statement screen never changes data');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('UI: supplier statement from the Supplier/मिस्त्री screen, customer statement from the customer list, party switch', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  await page.evaluate(() => Payables.view('py1'));
  await page.click('#pay-v-statement');
  await page.waitForSelector('#pst-modal.open');
  assert.equal(await page.inputValue('#pst-kind'), 'supplier');
  assert.equal(await page.inputValue('#pst-party'), 'py1');
  await page.click('#pst-periods [data-period="all"]');
  assert.match(await page.textContent('#pst-body [data-pst-closing]'), /Rs\. 17,000 Cr/);
  assert.match(await page.textContent('#pst-body'), /सप्लायर \/ Supplier[\s\S]*Everest Hardware/);
  assert.match(await page.textContent('#pst-body'), /तिर्नुपर्ने/);
  assert.ok(await page.evaluate(() => getComputedStyle(document.getElementById('pst-modal')).zIndex > getComputedStyle(document.getElementById('pay-modal')).zIndex), 'opens on top of the supplier screen');
  // switch to customers: nothing chosen → buttons disabled
  await page.selectOption('#pst-kind', 'customer');
  assert.equal(await page.inputValue('#pst-party'), '');
  assert.ok(await page.isDisabled('#pst-print'));
  await page.selectOption('#pst-party', 'c2');
  assert.match(await page.textContent('#pst-body [data-pst-party]'), /Sita Kumari/);
  assert.ok(!(await page.isDisabled('#pst-print')));
  await page.evaluate(() => { PartyStatement.close(); Payables.close(); App.navigate('customers'); });
  await page.click('button[title="खाता विवरण (Statement)"] >> nth=0');
  await page.waitForSelector('#pst-modal.open');
  assert.ok(await page.inputValue('#pst-party'));
  assert.deepEqual(errors, []);
  await ctx.close();
});
