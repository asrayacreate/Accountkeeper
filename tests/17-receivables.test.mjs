// v7.2.0: बाँकी रकम (Receivables) 1-click WhatsApp reminder + किस्ता / आंशिक भुक्तानी and Payment Receipt.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, loggedIn, J } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
// A made-up business: every company detail must come from these settings, never from code.
const settings = { companyName: 'Himal Test Traders', address: 'Pokhara-8, Kaski', phone1: '9812345678', esewa: '9812345678', bankName: 'Test Bank', bankAcc: '5566778899' };
const inv = (o) => ({ items: [{ name: 'Item', qty: 1, unit: '', rate: o.amount }], subtotal: o.amount, taxP: 0, taxAmt: 0, discAmt: 0, paid: 0, balance: o.amount,
  status: 'Pending', date: '2026-09-01', dateBs: '2083-05-16', created: '2026-09-01T00:00:00.000Z', ...o });
const invoices = [
  inv({ id: 'i1', invNum: 'INV-2026-001', custId: 'c1', custName: 'Ram Bahadur', custPhone: '9800000001', amount: 10000, dueDate: '2026-09-15' }),
  inv({ id: 'i2', invNum: 'INV-2026-002', custId: 'c2', custName: 'Sita Kumari', custPhone: '9800000002', amount: 5000, paid: 1000, balance: 4000, status: 'Partial', dueDate: '2099-01-01' }),
  inv({ id: 'i3', invNum: 'INV-2026-003', custId: 'c3', custName: 'Hari Prasad', custPhone: '9800000003', amount: 7000, status: 'Cancelled', cancelled: { reason: 'wrong bill' } }),
  inv({ id: 'i4', invNum: 'INV-2026-004', custId: 'c4', custName: 'Gita Devi', custPhone: '9800000004', amount: 3000, paid: 3000, balance: 0, status: 'Paid' }),
  inv({ id: 'i5', invNum: 'INV-2026-005', custId: 'c1', custName: 'Ram Bahadur', custPhone: '9800000001', amount: 2000, dueDate: '2099-01-01', date: '2026-10-01', dateBs: '2083-06-15' }),
];
const customers = [
  { id: 'c1', name: 'Ram Bahadur', phone: '9800000001', address: 'Lakeside' }, { id: 'c2', name: 'Sita Kumari', phone: '9800000002' },
  { id: 'c3', name: 'Hari Prasad', phone: '9800000003' }, { id: 'c4', name: 'Gita Devi', phone: '9800000004' },
];
// i2 was converted from a quotation, so it already posts Customer Ledger lines (_inv)
const ledger = [{ id: 'l1', customerId: 'c2', custName: 'Sita Kumari', date: '2083-05-16', debit: 5000, credit: 0, narration: 'Sale', _inv: 'i2' },
  { id: 'l2', customerId: 'c2', custName: 'Sita Kumari', date: '2083-05-16', debit: 0, credit: 1000, narration: 'Advance', _inv: 'i2' }];
const storage = {
  pk3_data_version: '5', pk3_v7_migrated: '1', pk3_business: J({ type: 'retail', setupDone: true }),
  pk3_settings: J(settings), pk3_pay_qr: J('data:image/png;base64,' + PNG),
  pk3_customers: J(customers), pk3_invoices: J(invoices), pk3_ledger: J(ledger),
};
const captureWA = (page) => page.evaluate(() => { window.__wa = []; AIWA._launch = (u) => window.__wa.push(u); });

test('installments: partial payments update paid / balance / status, receipt numbers and ledger; bad input is refused', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  const r = await page.evaluate(() => {
    const err = (f) => { try { f(); return ''; } catch (e) { return e.message; } };
    const a = Receivables.receive('i1', { amount: 4000, mode: 'eSewa', ref: 'TX1', date: '2026-11-01' });
    const b = Receivables.receive('i1', { amount: 2500, mode: 'Cash' });
    const i1 = Invoices.getData().find((x) => x.id === 'i1');
    const c = Receivables.receive('i2', { amount: 4000, mode: 'Bank Transfer' });
    const i2 = Invoices.getData().find((x) => x.id === 'i2');
    return {
      a: a.pay, b: b.pay, i1: { paid: i1.paid, balance: i1.balance, status: i1.status, n: i1.payments.length },
      i2: { paid: i2.paid, balance: i2.balance, status: i2.status }, c: c.pay,
      ledI1: STORE.get('pk3_ledger').filter((t) => t._inv === 'i1').length,
      ledI2: STORE.get('pk3_ledger').filter((t) => t._pay === c.pay.id).map((t) => ({ credit: t.credit, debit: t.debit })),
      due: SmartRem.dueFor('c2').total,
      over: err(() => Receivables.receive('i1', { amount: 99999 })),
      zero: err(() => Receivables.receive('i1', { amount: 0 })),
      cxl: err(() => Receivables.receive('i3', { amount: 10 })),
      paidAlready: err(() => Receivables.receive('i4', { amount: 10 })),
    };
  });
  assert.equal(r.a.amount, 4000); assert.equal(r.a.mode, 'eSewa'); assert.equal(r.a.date, '2026-11-01');
  assert.match(r.a.rcptNo, /^RCPT-\d{4}-0001$/); assert.match(r.b.rcptNo, /^RCPT-\d{4}-0002$/); assert.match(r.c.rcptNo, /-0003$/);
  assert.deepEqual(r.i1, { paid: 6500, balance: 3500, status: 'Partial', n: 2 });
  assert.deepEqual(r.i2, { paid: 5000, balance: 0, status: 'Paid' });
  assert.equal(r.ledI1, 0, 'bills without ledger lines do not get one');
  assert.deepEqual(r.ledI2, [{ credit: 4000, debit: 0 }], 'ledger-posted bill gets a matching credit line');
  assert.equal(r.due, 0);
  assert.ok(r.over); assert.ok(r.zero); assert.match(r.cxl, /रद्द/); assert.ok(r.paidAlready);
  // undo a wrong entry: balance + ledger restored
  const u = await page.evaluate((pid) => { const i = Receivables.removePayment('i2', pid); return { paid: i.paid, bal: i.balance, st: i.status, led: STORE.get('pk3_ledger').filter((t) => t._pay === pid).length }; }, r.c.id);
  assert.deepEqual(u, { paid: 1000, bal: 4000, st: 'Partial', led: 0 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('editing an invoice keeps its installment history', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  const r = await page.evaluate(() => {
    Receivables.receive('i1', { amount: 1000 });
    Invoices.edit('i1');
    const ro = document.getElementById('inv-paid-inp').readOnly;
    Invoices.saveNew();
    const i = Invoices.getData().find((x) => x.id === 'i1');
    return { ro, n: (i.payments || []).length, paid: i.paid };
  });
  assert.equal(r.ro, true, 'paid is managed by the 💵 button once installments exist');
  assert.equal(r.n, 1); assert.equal(r.paid, 1000);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Payment Receipt: installment number, paid before / balance rows, print sizes and PNG — company from settings only', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  const r = await page.evaluate(async () => {
    const p1 = Receivables.receive('i2', { amount: 1500, mode: 'Cash', note: 'दोस्रो किस्ता' }).pay;   // i2 already had Rs 1000 paid at billing
    const p2 = Receivables.receive('i2', { amount: 2500, mode: 'eSewa' }).pay;
    const d1 = Receivables.receiptDoc('i2', p1.id), d2 = Receivables.receiptDoc('i2', p2.id);
    const a4 = DocPrint.build(d1), t58 = DocPrint.buildReceipt(d1, 58), a4Paid = DocPrint.build(d2);
    const blob = await DocShare.toBlob(d1);
    const bmp = await createImageBitmap(blob);
    return { d1: { kind: d1.kind, kista: d1.kista, total: d1.total, bal: d1.balance, after: d1.after, noPay: d1.noPay },
      d2: { kista: d2.kista, bal: d2.balance, noPay: d2.noPay }, a4, t58, a4Paid, w: bmp.width, h: bmp.height, file: DocShare.fileName(d1),
      text: Receivables.receiptText('i2', p1.id) };
  });
  assert.equal(r.d1.kind, 'PAYMENT RECEIPT');
  assert.equal(r.d1.kista, 2, 'amount paid while billing counts as installment #1');
  assert.equal(r.d1.total, 1500); assert.equal(r.d1.bal, 2500);
  assert.deepEqual(r.d1.after.map((x) => x.value), [5000, 1000, 2500, 2500]);
  assert.equal(r.d1.noPay, false);
  assert.equal(r.d2.kista, 3); assert.equal(r.d2.bal, 0); assert.equal(r.d2.noPay, true);
  for (const h of [r.a4, r.t58]) {
    assert.ok(h.includes('PAYMENT RECEIPT')); assert.ok(h.includes('Himal Test Traders')); assert.ok(h.includes('प्राप्त रकम'));
    assert.ok(h.includes('Balance / बाँकी')); assert.ok(!h.includes('Subtotal'), 'receipt has no subtotal line');
  }
  assert.ok(r.a4.includes('Received from')); assert.ok(r.a4.includes('दोस्रो किस्ता')); assert.ok(!r.a4.includes('Terms &amp; Conditions'));
  assert.ok(r.a4.includes('data-pay-qr'), 'balance left → Scan to Pay shown');
  assert.ok(!r.a4Paid.includes('data-pay-qr'), 'fully paid → no Scan to Pay');
  assert.equal(r.w, 1080); assert.ok(r.h > 600);
  assert.match(r.file, /^Payment-Receipt-RCPT-\d{4}-0001-Sita-Kumari\.png$/);
  assert.match(r.text, /नमस्ते Sita Kumari जी/); assert.match(r.text, /Rs\. 1,500/); assert.match(r.text, /बाँकी रकम: Rs\. 2,500/);
  assert.match(r.text, /Himal Test Traders/); assert.match(r.text, /9812345678/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Receivables list + 1-click WhatsApp reminder: excludes cancelled / paid bills, polite Nepali text from Company Settings', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  await captureWA(page);
  const r = await page.evaluate(() => {
    const list = Receivables.dueList();
    const ram = list.find((x) => x.custId === 'c1');
    return { ids: list.map((x) => x.custId), ram: { total: ram.total, bills: ram.bills.map((b) => b.invNum), overdue: ram.overdue }, msg: Receivables.message(ram) };
  });
  assert.deepEqual(r.ids, ['c1', 'c2'], 'overdue customer first; cancelled (c3) and fully paid (c4) never listed');
  assert.deepEqual(r.ram, { total: 12000, bills: ['INV-2026-001', 'INV-2026-005'], overdue: true });
  assert.match(r.msg, /^नमस्ते Ram Bahadur जी 🙏/);
  assert.match(r.msg, /Himal Test Traders बाट विनम्र सम्झना/);
  assert.match(r.msg, /Rs\. 12,000/); assert.match(r.msg, /INV-2026-001.*Rs\. 10,000/); assert.match(r.msg, /eSewa: 9812345678/);
  assert.match(r.msg, /📞 9812345678/);
  assert.ok(!/\{[a-z_]+\}/.test(r.msg), 'no placeholder left');
  assert.ok(!/prerak/i.test(r.msg));
  const s = await page.evaluate(() => { Receivables.remind('c1'); return { wa: window.__wa, sent: STORE.get('pk3_due_reminded'), smart: SmartRem.sorted().find((x) => x.type === 'due' && x.custId === 'c1') }; });
  assert.equal(s.wa.length, 1);
  assert.match(s.wa[0], /phone=9779800000001/);
  assert.ok(decodeURIComponent(s.wa[0]).includes('Ram Bahadur'));
  assert.ok(s.sent.c1, 'last reminder time saved');
  assert.ok(s.smart.sent, 'Smart Reminder card shows it as sent today');
  // a custom template works with the same placeholders
  const t = await page.evaluate(() => { Receivables.saveTemplate('{name} — {amount} — {company} — {days} दिन'); return Receivables.message(Receivables.dueList()[0]); });
  assert.match(t, /^Ram Bahadur — Rs\. 12,000 — Himal Test Traders — \d+ दिन$/);
  await page.evaluate(() => Receivables.saveTemplate(''));
  assert.equal(await page.evaluate(() => localStorage.getItem('pk3_due_wa_tpl')), null, 'empty → back to default');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('UI: Invoices → 💰 बाँकी रकम → WhatsApp, then 💵 receive an installment → receipt preview with Print + PNG', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage, viewport: { width: 390, height: 820 } });
  await captureWA(page);
  await page.evaluate(() => App.navigate('invoices'));
  assert.equal(await page.locator('[data-inv-pay]').count(), 3, '💵 only on bills with balance (not cancelled / paid)');
  await page.click('#inv-rcv-btn');
  await page.waitForSelector('#rcv-modal.open');
  assert.equal(await page.locator('#rcv-modal .rcv-row').count(), 2);
  assert.match(await page.textContent('#rcv-total'), /16,000/);
  await page.click('[data-rcv-wa="c2"]');
  assert.equal(await page.evaluate(() => window.__wa.length), 1);
  await page.waitForSelector('[data-rcv-cust="c2"] >> text=पछिल्लो रिमाइन्डर');
  await page.click('[data-rcv-pay="c1"]');
  await page.waitForSelector('#rcv-pay-modal.open');
  assert.equal(await page.locator('#rcv-pay-inv option').count(), 2, 'customer with 2 open bills can pick one');
  assert.equal(await page.inputValue('#rcv-pay-amt'), '10000');
  await page.fill('#rcv-pay-amt', '3000');
  await page.selectOption('#rcv-pay-mode', 'Khalti');
  await page.click('#rcv-pay-save');
  await page.waitForSelector('#view-modal.open');
  assert.match(await page.textContent('#view-modal-title'), /Payment Receipt RCPT-/);
  assert.match(await page.textContent('#view-modal-body'), /Himal Test Traders/);
  assert.ok(await page.isVisible('#doc-share-png'));
  assert.ok(await page.isVisible('#doc-print-size'));
  await page.click('#rcv-rcpt-wa');
  const last = await page.evaluate(() => decodeURIComponent(window.__wa[window.__wa.length - 1]));
  assert.match(last, /Rs\. 3,000/); assert.match(last, /Khalti/);
  const i1 = await page.evaluate(() => Invoices.getData().find((x) => x.id === 'i1'));
  assert.equal(i1.paid, 3000); assert.equal(i1.status, 'Partial');
  assert.match(await page.textContent('#rcv-total'), /13,000/, 'open list refreshes after payment');
  // invoice preview offers payment + receipts
  await page.evaluate(() => { document.getElementById('rcv-modal').classList.remove('open'); Invoices.preview('i1'); });
  assert.ok(await page.isVisible('#inv-prev-pay'));
  assert.match(await page.textContent('#inv-prev-rcpts'), /\(1\)/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
