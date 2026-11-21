// v7.3.0 audit: edge-case bugs found in the v7.2.0 modules (Tax Invoice, Purchase Bill + TDS, Stock,
// Payment Receipt, Cancel / edit Invoice, Staff पेश्की, CSV export, QR, Nepal-time dates).
// Each test pins one fix; the 1×1 PNG stands in for the user's Payment QR.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, loggedIn, J } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const CUST = [{ id: 'c1', name: 'Ram Bahadur', phone: '9811111111' }, { id: 'c2', name: 'Sita, "Kumari"', phone: '9822222222', address: 'Pokhara, Kaski' }];
const STOCK = [
  { id: 'k1', name: 'Cement Bag', qty: 20, unit: 'bag', purchase: 700, selling: 800, minQty: 5, history: [] },
  { id: 'k2', name: 'Paint 4L', qty: 3, unit: 'pcs', purchase: 2000, selling: 2500, minQty: 1, history: [] },
];
const EXISTING = {
  pk3_data_version: '5', pk3_v7_migrated: '1', pk3_business: J({ type: 'retail', setupDone: true }),
  pk3_settings: J({ companyName: 'Test Traders', phone1: '9800000000', esewa: '9800000000' }), pk3_pay_qr: J('data:image/png;base64,' + PNG),
  pk3_customers: J(CUST), pk3_stock: J(STOCK),
};
const boot = (extra, o) => loggedIn({ base, browser, storage: { ...EXISTING, ...(extra || {}) }, ...(o || {}) });

test('dates follow the Nepal calendar day, not UTC (00:30 NPT is still "today")', async () => {
  // 2026-11-21 00:30 in Kathmandu = 2026-11-20 18:45 UTC
  const { page, errors, ctx } = await boot({}, {
    contextOptions: { timezoneId: 'Asia/Kathmandu' },
    mock: (p) => p.clock.setFixedTime(new Date('2026-11-20T18:45:00Z')),
  });
  const r = await page.evaluate(() => {
    App.navigate('daybook'); DayBook.addModal();
    setVal('db-type', 'expense'); setVal('db-amount', '500'); setVal('db-desc', 'Tea'); setVal('db-date-inp', '2083-01-01');
    DayBook.save();
    const e = DayBook.getData().find((x) => x.desc === 'Tea');
    App.navigate('invoices'); Invoices.create();
    return { today: todayISO(), bs: todayBs(), anchor: isoLocal(bsToAd(2083, 1, 1)), dbDate: e.date, dbBs: e.dateBs, invDate: getVal('inv-date-inp') };
  });
  assert.equal(r.today, '2026-11-21', 'UTC would say 2026-11-20');
  assert.equal(r.anchor, '2026-04-14', 'BS 2083-01-01 = 2026-04-14 (UTC conversion gave 04-13)');
  assert.equal(r.dbDate, '2026-04-14', 'Day Book AD date matches the BS date the user picked');
  assert.equal(r.dbBs, '2083-01-01');
  assert.equal(r.invDate, '2026-11-21', 'new invoice defaults to the local date');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('purchase bill: negative qty/rate ignored, TDS capped at 100%, failed edit keeps Supplier entries, renamed row moves the right stock', async () => {
  const { page, errors, ctx } = await boot();
  const r = await page.evaluate(() => {
    const out = {};
    const neg = Purchases.compute({ items: [{ name: 'A', qty: -5, rate: 100 }, { name: 'B', qty: 10, rate: -100 }, { name: 'C', qty: 10, rate: 100 }], vatP: 13 });
    out.negSub = neg.subtotal; out.negVat = neg.vatAmt;
    out.tdsCap = Purchases.compute({ items: [{ name: 'X', qty: 1, rate: 1000 }], vatP: 13, tdsP: 500 }).tdsP;
    // a bill with VAT 0 and TDS 100% leaves nothing to pay — must fail BEFORE the old entries are removed
    const p = Purchases.save({ supplierName: 'Shiva Supplier', billNo: 'S-1', date: '2026-11-01', items: [{ name: 'Cement Bag', qty: 5, unit: 'bag', rate: 700 }], vatP: 0, paid: 1000 });
    const txBefore = Payables.txns().filter((t) => t.purchaseId === p.id).length;
    try { Purchases.save({ id: p.id, supplierName: 'Shiva Supplier', billNo: 'S-1', date: '2026-11-01', items: [{ name: 'Cement Bag', qty: 5, unit: 'bag', rate: 700 }], vatP: 0, tdsP: 100, paid: 0 }); }
    catch (e) { out.err = e.message; }
    out.txBefore = txBefore; out.txAfter = Payables.txns().filter((t) => t.purchaseId === p.id).length;
    out.due = Payables.balance(p.partyId).due; out.netPayable = Purchases.get(p.id).netPayable;
    out.k1AfterBuy = Stock.find('k1').qty;
    // edit: row renamed from Cement Bag → Paint 4L but the row still carries Cement's stockId (UI keeps it)
    const prevRow = Purchases.get(p.id).items[0];
    Purchases.save({ id: p.id, supplierName: 'Shiva Supplier', billNo: 'S-1', date: '2026-11-01', items: [{ name: 'Paint 4L', qty: 5, unit: 'pcs', rate: 700, stockId: prevRow.stockId }], vatP: 0, paid: 0 });
    out.k1 = Stock.find('k1').qty; out.k2 = Stock.find('k2').qty;
    // the form clears stockId as soon as the item name is typed over
    Purchases.open(p.id);
    const inp = document.querySelector('[data-pr="name-0"]'); inp.value = 'Cement Bag'; inp.dispatchEvent(new Event('input'));
    out.rowStockId = Purchases._rows[0].stockId; Purchases.close();
    return out;
  });
  assert.equal(r.negSub, 1000); assert.equal(r.negVat, 130);
  assert.equal(r.tdsCap, 100);
  assert.match(r.err || '', /० भन्दा बढी/);
  assert.equal(r.txBefore, 2); assert.equal(r.txAfter, 2, 'bill + payment still in the Supplier account');
  assert.equal(r.due, 2500); assert.equal(r.netPayable, 3500);
  assert.equal(r.k1AfterBuy, 25);
  assert.equal(r.k1, 20, 'Cement back to where it was'); assert.equal(r.k2, 8, 'Paint got the 5');
  assert.equal(r.rowStockId, '');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Supplier ledger: an entry made by a Purchase Bill opens the bill instead of being deleted on its own', async () => {
  const { page, errors, ctx } = await boot();
  const r = await page.evaluate(() => {
    const p = Purchases.save({ supplierName: 'Hari Hardware', billNo: 'H-9', date: '2026-11-02', items: [{ name: 'Nails', qty: 2, rate: 500 }], vatP: 13, paid: 500 });
    const party = Payables.party(p.partyId);
    Payables.addTxn({ partyId: party.id, type: 'payment', amount: 100, note: 'manual' }, { toDayBook: false });
    App.navigate('payables'); Payables.view(party.id);
    const links = [...document.querySelectorAll('#pay-modal [data-pur-link]')].map((b) => b.dataset.purLink);
    const del = document.querySelectorAll('#pay-modal tbody .btn-danger').length;
    document.querySelector('#pay-modal [data-pur-link]').click();
    return { id: p.id, links, del, purOpen: document.getElementById('pur-modal').classList.contains('open') };
  });
  assert.deepEqual(r.links, [r.id, r.id], 'bill + payment of the purchase');
  assert.equal(r.del, 1, 'only the manual entry can be deleted here');
  assert.ok(r.purOpen);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('invoice: Rs 0 bill is Paid; print total stays 0; no "Scan to Pay" on paid / cancelled bills', async () => {
  const INV = [
    { id: 'p1', invNum: 'INV-2026-001', custId: 'c1', custName: 'Ram Bahadur', items: [{ name: 'Job', qty: 1, rate: 1000 }], subtotal: 1000, amount: 1000, paid: 1000, balance: 0, status: 'Paid', date: '2026-11-01' },
    { id: 'p2', invNum: 'INV-2026-002', custId: 'c1', custName: 'Ram Bahadur', items: [{ name: 'Job', qty: 1, rate: 1000 }], subtotal: 1000, amount: 1000, paid: 0, balance: 1000, status: 'Pending', date: '2026-11-01' },
  ];
  const { page, errors, ctx } = await boot({ pk3_invoices: J(INV) });
  const r = await page.evaluate(() => {
    App.navigate('invoices'); Invoices.create();
    setVal('inv-cust-sel', 'c1');
    Invoices._rows = [{ name: 'Free service', qty: 1, unit: 'job', rate: 500 }];
    setVal('inv-disc', '100'); Invoices.calc(); Invoices.saveNew();
    const z = Invoices.getData()[0];
    const dz = DocPrint.fromInvoice(z), d1 = DocPrint.fromInvoice(Invoices.getData().find((x) => x.id === 'p1'));
    const d2 = DocPrint.fromInvoice(Invoices.getData().find((x) => x.id === 'p2'));
    const out = { zStatus: z.status, zAmt: z.amount, zTotal: dz.total, zNoPay: dz.noPay, p1NoPay: d1.noPay, p2NoPay: d2.noPay,
      p1Qr: DocPrint.build(d1).includes('data-pay-qr'), p2Qr: DocPrint.build(d2).includes('data-pay-qr') };
    Invoices.cancel('p2', 'गलत बिल');
    const dc = DocPrint.fromInvoice(Invoices.getData().find((x) => x.id === 'p2'));
    out.cxlNoPay = dc.noPay; out.cxlQr = DocPrint.build(dc).includes('data-pay-qr');
    return out;
  });
  assert.equal(r.zAmt, 0); assert.equal(r.zStatus, 'Paid', 'not "Pending" forever');
  assert.equal(r.zTotal, 0, 'old code printed the subtotal (500)');
  assert.equal(r.zNoPay, true);
  assert.equal(r.p1NoPay, true); assert.equal(r.p1Qr, false, 'fully paid → no Scan to Pay');
  assert.equal(r.p2NoPay, false); assert.equal(r.p2Qr, true, 'balance due → QR shown');
  assert.equal(r.cxlNoPay, true); assert.equal(r.cxlQr, false, 'cancelled → no QR');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('payment receipt after a Sales Return: (total − return) received → Paid, nothing left to collect', async () => {
  const INV = [{ id: 'r1', invNum: 'INV-2026-010', custId: 'c1', custName: 'Ram Bahadur', custPhone: '9811111111', items: [{ name: 'Tiles', qty: 10, rate: 1000 }],
    subtotal: 10000, amount: 10000, paid: 0, balance: 10000, status: 'Pending', date: '2026-11-01', dateBs: '2083-07-15', _returned: true, _returnedAmt: 2000 }];
  const { page, errors, ctx } = await boot({ pk3_invoices: J(INV) });
  const r = await page.evaluate(() => {
    const before = Receivables.balanceOf(Invoices.getData()[0]);
    const { inv, pay } = Receivables.receive('r1', { amount: 8000, mode: 'Cash' });
    App.navigate('invoices'); Invoices.render();
    const row = document.querySelector('#inv-table tr');
    const d = Receivables.receiptDoc('r1', pay.id);
    return { before, status: inv.status, bal: Receivables.balanceOf(inv), due: SmartRem.dueFor('c1').total, list: Receivables.dueList().length,
      rowText: row.textContent, payBtn: !!row.querySelector('[data-inv-pay]'), rcptBal: d.balance, rcptNoPay: d.noPay, printBal: DocPrint.fromInvoice(inv).balance };
  });
  assert.equal(r.before, 8000);
  assert.equal(r.status, 'Paid', 'old code left it "Partial" with Rs 2,000 showing as due');
  assert.equal(r.bal, 0); assert.equal(r.due, 0); assert.equal(r.list, 0);
  assert.match(r.rowText, /Paid/); assert.equal(r.payBtn, false);
  assert.equal(r.rcptBal, 0); assert.equal(r.rcptNoPay, true); assert.equal(r.printBal, 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('editing a quote-converted invoice keeps its Customer Ledger lines, quote link and return flag in step', async () => {
  const INV = [{ id: 'q1', invNum: 'INV-2026-020', custId: 'c1', custName: 'Ram Bahadur', items: [{ name: 'Cabinet', qty: 1, unit: 'set', rate: 10000 }],
    subtotal: 10000, discP: 0, discAmt: 0, taxP: 0, taxAmt: 0, amount: 10000, paid: 2000, balance: 8000, status: 'Partial', date: '2026-11-01', dateBs: '2083-07-15',
    fromQuote: { type: 'quotation', id: 'qt1', no: 'Q-7' }, stockTracked: true }];
  const LED = [
    { id: 'l1', customerId: 'c1', custName: 'Ram Bahadur', date: '2083-07-15', debit: 10000, credit: 0, narration: 'Sale', _inv: 'q1' },
    { id: 'l2', customerId: 'c1', custName: 'Ram Bahadur', date: '2083-07-15', debit: 0, credit: 2000, narration: 'Advance', _inv: 'q1' },
    { id: 'l3', customerId: 'c1', custName: 'Ram Bahadur', date: '2083-07-10', debit: 700, credit: 0, narration: 'Old manual' },
  ];
  const { page, errors, ctx } = await boot({ pk3_invoices: J(INV), pk3_ledger: J(LED) });
  const r = await page.evaluate(() => {
    App.navigate('invoices'); Invoices.edit('q1');
    Invoices._rows[0].rate = 12000; setVal('inv-tax', '0'); Invoices.calc(); Invoices.saveNew();
    const inv = Invoices.getData().find((x) => x.id === 'q1'), led = STORE.get('pk3_ledger', []);
    const net = led.filter((t) => t.customerId === 'c1').reduce((s, t) => s + (t.debit || 0) - (t.credit || 0), 0);
    return { amount: inv.amount, fromQuote: inv.fromQuote, sale: led.find((t) => t.id === 'l1').debit, adv: led.find((t) => t.id === 'l2').credit, manual: led.find((t) => t.id === 'l3').debit, n: led.length, net };
  });
  assert.equal(r.amount, 12000);
  assert.deepEqual(r.fromQuote, { type: 'quotation', id: 'qt1', no: 'Q-7' }, 'edit used to drop the quote link');
  assert.equal(r.sale, 12000, 'ledger Sale follows the bill');
  assert.equal(r.adv, 2000); assert.equal(r.manual, 700); assert.equal(r.n, 3);
  assert.equal(r.net, 10700, 'ledger balance = bill balance (10,000) + old manual (700)');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('stock adjust: negative qty rejected, "out" never below 0 and history adds up, "= set" to 0 allowed', async () => {
  const { page, errors, ctx } = await boot();
  const r = await page.evaluate(() => {
    App.navigate('stocklist'); Stock.history('k2');
    setVal('stk-adj-type', 'in'); setVal('stk-adj-qty', '-5'); Stock.adjustStock();
    const afterNeg = Stock.find('k2').qty;
    setVal('stk-adj-type', 'out'); setVal('stk-adj-qty', '5'); Stock.adjustStock();
    const s = Stock.find('k2');
    const out = { afterNeg, qty: s.qty, hist: s.history[0] };
    setVal('stk-adj-type', 'in'); setVal('stk-adj-qty', '4'); Stock.adjustStock();
    setVal('stk-adj-type', 'adj'); setVal('stk-adj-qty', '0'); Stock.adjustStock();
    out.afterSet = Stock.find('k2').qty; out.n = Stock.find('k2').history.length;
    return out;
  });
  assert.equal(r.afterNeg, 3, 'negative "in" no longer lowers stock');
  assert.equal(r.qty, 0); assert.equal(r.hist.type, 'out'); assert.equal(r.hist.qty, 3, 'records the 3 actually taken out, not 5');
  assert.equal(r.afterSet, 0); assert.equal(r.n, 3);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('staff पेश्की: no negative amount; deleting it removes its Day Book expense (new and old entries)', async () => {
  const STAFF = [
    { id: 's1', name: 'Hari', payType: 'daily', wage: 1000, peshki: [{ id: 'old1', amount: 700, note: '', date: '2026-10-05' }], payments: [] },
    { id: 's2', name: 'Shyam', payType: 'daily', wage: 900, peshki: [{ id: 'old2', amount: 700, note: '', date: '2026-10-05' }], payments: [] },
  ];
  const DB = [
    { id: 'd1', type: 'expense', amount: 700, desc: 'पेश्की - Hari', cat: 'पेश्की', date: '2026-10-05', dateBs: '2083-06-19' },
    { id: 'd2', type: 'expense', amount: 700, desc: 'पेश्की - Shyam', cat: 'पेश्की', date: '2026-10-05', dateBs: '2083-06-19' },
  ];
  const { page, errors, ctx } = await boot({ pk3_staff: J(STAFF), pk3_daybook: J(DB) });
  const r = await page.evaluate(() => {
    App.navigate('staff'); Staff.render();
    setVal('peshki-staff', 's1'); setVal('peshki-amt', '-300'); Staff.addPeshki();
    const negCount = Staff.get('s1').peshki.length;
    setVal('peshki-amt', '1500'); setVal('peshki-note', 'चाड'); Staff.addPeshki();
    const p = Staff.get('s1').peshki[0], dbHas = DayBook.getData().some((e) => e.id === p.dbId && e.amount === 1500);
    Staff.delPeshki('s1', p.id);
    const afterNew = DayBook.getData().map((e) => e.id);
    Staff.delPeshki('s1', 'old1');
    return { negCount, dbHas, newGone: !afterNew.includes(p.dbId), left: DayBook.getData().map((e) => e.id), s2: Staff.get('s2').peshki.length,
      net: Staff.payroll('s1', Staff.curYm()).advance };
  });
  assert.equal(r.negCount, 1, 'negative पेश्की refused');
  assert.ok(r.dbHas); assert.ok(r.newGone);
  assert.deepEqual(r.left, ['d2'], "old Hari entry removed, Shyam's identical-amount entry kept");
  assert.equal(r.s2, 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('CSV: UTF-8 BOM + quoting for customer / ledger export, formula-looking text neutralised, numbers untouched', async () => {
  const LED = [{ id: 'l1', customerId: 'c2', custName: 'Sita, "Kumari"', date: '2083-07-01', debit: 500, credit: 0, narration: 'नेपाली =SUM(A1)' }];
  const { page, errors, ctx } = await boot({ pk3_ledger: J(LED) });
  const r = await page.evaluate(() => {
    const c = (v) => CAExport._cell(v);
    const cells = { f: c('=1+1'), at: c('@SUM(A1)'), plusText: c('+cmd'), minusNum: c(-500), minusStr: c('-500'), phone: c('+977 9800000000'), ne: c('राम, श्याम'), n0: c(0) };
    Backup.exportCSV(); const cust = CAExport._last.text;
    Ledger.exportCSV(); const led = CAExport._last.text;
    return { cells, cust, led };
  });
  assert.equal(r.cells.f, "'=1+1"); assert.equal(r.cells.at, "'@SUM(A1)"); assert.equal(r.cells.plusText, "'+cmd");
  assert.equal(r.cells.minusNum, '-500'); assert.equal(r.cells.minusStr, '-500'); assert.equal(r.cells.phone, '+977 9800000000');
  assert.equal(r.cells.ne, '"राम, श्याम"'); assert.equal(r.cells.n0, '0');
  assert.equal(r.cust.charCodeAt(0), 0xFEFF, 'customer CSV starts with BOM');
  const lines = r.cust.slice(1).trim().split(/\r\n/);
  assert.equal(lines[0], 'Name,Phone,Address,Service,Sub-Service,Advance,Salesperson,Issue Date,FU Date,Created');
  const sita = lines.find((l) => l.startsWith('"Sita'));
  assert.ok(sita.startsWith('"Sita, ""Kumari""",9822222222,"Pokhara, Kaski",'), sita);
  assert.equal(r.led.charCodeAt(0), 0xFEFF, 'ledger CSV starts with BOM');
  assert.match(r.led, /नेपाली =SUM\(A1\)/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('QR page: WhatsApp link only from the saved company phone (no dead "wa.me/977" link)', async () => {
  const { page, errors, ctx } = await boot({ pk3_settings: J({ companyName: 'No Phone Co' }) });
  const r = await page.evaluate(() => {
    setVal('qr-url', ''); QR.render(); const empty = getVal('qr-url');
    const s = STORE.get('pk3_settings', {}); s.phone1 = '9812345678'; STORE.set('pk3_settings', s);
    setVal('qr-url', ''); QR.render(); const withPhone = getVal('qr-url');
    return { empty, withPhone };
  });
  assert.equal(r.empty, '');
  assert.equal(r.withPhone, 'https://wa.me/9779812345678');
  assert.deepEqual(errors, []);
  await ctx.close();
});
