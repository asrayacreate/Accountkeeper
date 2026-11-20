// v7.1.0: 👷 Staff हाजिरी + तलब/पेश्की (Payroll) and ⚖ Invoice Cancel with reason / Credit Note.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, loggedIn, J } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const EXISTING = { pk3_data_version: '5', pk3_settings: J({ companyName: 'Test Builders Pvt Ltd', phone1: '9800000000' }), pk3_business: J({ type: 'construction', setupDone: true }), pk3_v7_migrated: '1' };

test('old v7.0 staff + attendance (pk3_tracker) migrate safely into pk3_attendance', async () => {
  const tracker = { '2026-11-18': { s1: 'present', s2: 'absent' }, '2026-11-19': { s1: 'absent' }, gps: [{ user: 'x', lat: 1, lng: 2 }] };
  const staff = [{ id: 's1', name: 'Ram', role: 'Carpenter', wage: 1000, peshki: [{ id: 'p1', amount: 500, date: '2026-11-18' }] }, { id: 's2', name: 'Hari', wage: 800 }];
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: { ...EXISTING, pk3_tracker: J(tracker), pk3_staff: J(staff) } });
  const r = await page.evaluate(() => ({ att: Staff.attendance(), tracker: STORE.get('pk3_tracker'), st: Staff.statusOn('s1', '2026-11-18'), staff: STORE.get('pk3_staff') }));
  assert.deepEqual(r.att, { '2026-11-18': { s1: 'present', s2: 'absent' }, '2026-11-19': { s1: 'absent' } });
  assert.deepEqual(r.tracker, tracker, 'old pk3_tracker left untouched');
  assert.equal(r.st, 'present');
  assert.deepEqual(r.staff, staff, 'staff records unchanged');
  // The UI shows them with the old wage as a daily wage
  await page.evaluate(() => App.navigate('staff'));
  assert.equal(await page.locator('.stf-att-row').count(), 2);
  assert.match(await page.textContent('#stf-full-list'), /1,000\/दिन/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('payroll: daily wage, monthly salary, half days, पेश्की and salary payment → Net Payable', async () => {
  const staff = [{ id: 'd1', name: 'Daily Dai', wage: 1200, payType: 'daily', peshki: [] }, { id: 'm1', name: 'Monthly Didi', salary: 30000, payType: 'monthly', peshki: [] }];
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: { ...EXISTING, pk3_staff: J(staff) } });
  const r = await page.evaluate(() => {
    const ym = Staff.curYm(), md = Staff.monthDays(ym), d = md.days;
    for (let i = 0; i < 10; i++) Staff.mark('d1', 'present', d[i]);
    Staff.mark('d1', 'half', d[10]); Staff.mark('d1', 'half', d[11]); Staff.mark('d1', 'absent', d[12]);
    Staff.mark('m1', 'absent', d[0]); Staff.mark('m1', 'absent', d[1]); Staff.mark('m1', 'half', d[2]); Staff.mark('m1', 'present', d[3]);
    // पेश्की: one inside the month, one outside (must not be deducted)
    const list = STORE.get('pk3_staff');
    list[0].peshki = [{ id: 'a1', amount: 2000, date: d[5] }, { id: 'a2', amount: 999, date: '2001-01-01' }];
    STORE.set('pk3_staff', list);
    const before = { d: Staff.payroll('d1', ym), m: Staff.payroll('m1', ym), dim: d.length };
    const pay = Staff.pay('d1', ym, 5000, 'Cash');
    const after = Staff.payroll('d1', ym);
    const db = STORE.get('pk3_daybook');
    let zeroErr = ''; try { Staff.pay('d1', ym, 0); } catch (e) { zeroErr = e.message; }
    Staff.delPayment('d1', pay.id);
    return { before, after, db0: db[0], dbLen: db.length, zeroErr, afterDel: Staff.payroll('d1', ym), dbAfterDel: STORE.get('pk3_daybook').length };
  });
  assert.equal(r.before.d.present, 10); assert.equal(r.before.d.half, 2); assert.equal(r.before.d.absent, 1);
  assert.equal(r.before.d.earned, 1200 * 11, 'daily: wage × (present + ½ half)');
  assert.equal(r.before.d.advance, 2000, 'only this month’s पेश्की is deducted');
  assert.equal(r.before.d.net, 13200 - 2000);
  const perDay = 30000 / r.before.dim;
  assert.equal(r.before.m.earned, Math.round((30000 - perDay * 2.5) * 100) / 100, 'monthly: salary − absent − ½ half');
  assert.equal(r.before.m.net, r.before.m.earned);
  assert.equal(r.after.paid, 5000);
  assert.equal(r.after.net, 13200 - 2000 - 5000);
  assert.equal(r.dbLen, 1);
  assert.equal(r.db0.type, 'expense'); assert.equal(r.db0.cat, 'Staff Salary'); assert.equal(r.db0.amount, 5000);
  assert.ok(r.zeroErr);
  assert.equal(r.afterDel.net, 11200, 'removing a payment restores the balance');
  assert.equal(r.dbAfterDel, 0, '…and its Day Book entry');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Staff UI: mark Half Day, see तलब tab, pay salary; Modules Off hides Staff without deleting data', async () => {
  const staff = [{ id: 's1', name: 'Ram', role: 'Carpenter', wage: 1000, payType: 'daily', peshki: [] }];
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: { ...EXISTING, pk3_staff: J(staff) } });
  await page.evaluate(() => App.navigate('staff'));
  await page.click('[data-staff="s1"] [data-att="half"]');
  await page.click('[data-staff="s1"] [data-att="present"]');
  const st = await page.evaluate(() => Staff.statusOn('s1', Staff._today()));
  assert.equal(st, 'present');
  await page.evaluate(() => Staff.tab('talab'));
  assert.match(await page.textContent('[data-payroll="s1"] .stf-net'), /1,000/);
  await page.click('[data-payroll="s1"] >> text=तलब दिनुस्');
  await page.waitForSelector('#stf-pay-modal.open');
  assert.equal(await page.inputValue('#stf-pay-amt'), '1000');
  await page.click('#stf-pay-save');
  assert.match(await page.textContent('[data-payroll="s1"] .stf-net'), /Rs\. 0/);
  // Monthly staff via the form
  await page.evaluate(() => Staff.addModal());
  await page.fill('#stf-name', 'Sita');
  await page.selectOption('#stf-paytype', 'monthly');
  assert.ok(await page.isVisible('#stf-salary'));
  assert.ok(!(await page.isVisible('#stf-wage')));
  await page.fill('#stf-salary', '25000');
  await page.click('#staff-modal >> text=Save');
  const sita = await page.evaluate(() => Staff.getData().find((s) => s.name === 'Sita'));
  assert.equal(sita.payType, 'monthly'); assert.equal(sita.salary, 25000);
  // Edit keeps payments + पेश्की
  await page.evaluate(() => Staff.edit('s1'));
  await page.fill('#stf-wage', '1100');
  await page.click('#staff-modal >> text=Save');
  const ram = await page.evaluate(() => Staff.get('s1'));
  assert.equal(ram.wage, 1100); assert.equal(ram.payments.length, 1);
  // Modules On/Off
  assert.ok(await page.evaluate(() => Modules.LIST.some((m) => m.id === 'staff')));
  await page.evaluate(() => Modules.set('staff', false));
  assert.ok(!(await page.isVisible('.nav-item[data-page="staff"]')));
  assert.equal(await page.evaluate(() => Modules.pageAllowed('staff')), false);
  assert.equal(await page.evaluate(() => App.currentPage), 'dashboard');
  assert.equal(await page.evaluate(() => STORE.get('pk3_staff').length), 2, 'data kept while Off');
  await page.evaluate(() => Modules.set('staff', true));
  assert.equal(await page.evaluate(() => Modules.pageAllowed('staff')), true);
  assert.deepEqual(errors, []);
  await ctx.close();
});

const cust = [{ id: 'c1', name: 'Ram Bahadur', phone: '9800000001' }];
const inv = (id, num, extra) => Object.assign({ id, invNum: num, custId: 'c1', custName: 'Ram Bahadur', custPhone: '9800000001', items: [{ name: 'Work', qty: 1, unit: 'job', rate: 10000, amount: 10000 }], subtotal: 10000, taxP: 0, taxAmt: 0, amount: 10000, paid: 3000, balance: 7000, status: 'Partial', date: '2026-11-10', dateBs: '2083-07-24' }, extra || {});
const ledger = [
  { id: 'l1', customerId: 'c1', custName: 'Ram Bahadur', debit: 10000, credit: 0, _inv: 'i2', date: '2083-07-24' },
  { id: 'l2', customerId: 'c1', custName: 'Ram Bahadur', debit: 0, credit: 3000, _inv: 'i2', date: '2083-07-24' },
];

test('Cancel Invoice: reason required, number kept, CANCELLED in history, Credit Note in ledger, dues adjusted', async () => {
  const invoices = [inv('i3', 'INV-2026-003'), inv('i2', 'INV-2026-002', { fromQuote: { type: 'quotation', id: 'q1', no: 'Q-1' } }), inv('i1', 'INV-2026-001')];
  const quotes = [{ id: 'q1', custId: 'c1', custName: 'Ram Bahadur', amount: 10000, convertedInvId: 'i2', convertedInvNum: 'INV-2026-002' }];
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: { ...EXISTING, pk3_customers: J(cust), pk3_invoices: J(invoices), pk3_ledger: J(ledger), pk3_quotations: J(quotes) } });
  const r = await page.evaluate(() => {
    const out = { dueBefore: SmartRem.dueFor('c1').total };
    try { Invoices.cancel('i2', '  '); } catch (e) { out.noReason = e.message; }
    out.stillPartial = Invoices.getData().find((x) => x.id === 'i2').status;
    const c = Invoices.cancel('i2', 'ग्राहकले अर्डर रद्द गर्नुभयो');
    try { Invoices.cancel('i2', 'again please'); } catch (e) { out.twice = e.message; }
    const led = STORE.get('pk3_ledger').filter((t) => t._inv === 'i2');
    out.c = c;
    out.ledNet = led.reduce((s, t) => s + (t.debit || 0) - (t.credit || 0), 0);
    out.ledLen = led.length;
    out.dueAfter = SmartRem.dueFor('c1').total;
    out.next = Invoices.nextNum();
    out.count = Invoices.getData().length;
    out.active = Invoices.active().length;
    out.quote = STORE.get('pk3_quotations')[0];
    Invoices.del('i3');   // a real invoice is never deleted → opens the Cancel dialog
    out.afterDel = Invoices.getData().length;
    out.cxlModalOpen = document.getElementById('inv-cxl-modal').classList.contains('open');
    document.getElementById('inv-cxl-modal').classList.remove('open');
    out.rcpt = DocPrint.buildReceipt(DocPrint.fromInvoice(Invoices.getData().find((x) => x.id === 'i2')), 80);
    out.ca = CAExport.salesRegister({ from: '2083-01-01', to: '2083-12-30' }).find((row) => row[2] === 'INV-2026-002');
    return out;
  });
  assert.equal(r.dueBefore, 21000);
  assert.ok(r.noReason, 'empty reason is refused');
  assert.equal(r.stillPartial, 'Partial');
  assert.equal(r.c.status, 'Cancelled');
  assert.equal(r.c.invNum, 'INV-2026-002', 'number kept');
  assert.equal(r.c.cancelled.reason, 'ग्राहकले अर्डर रद्द गर्नुभयो');
  assert.equal(r.c.cancelled.amount, 10000); assert.equal(r.c.cancelled.balance, 7000); assert.equal(r.c.cancelled.prevStatus, 'Partial');
  assert.ok(r.c.cancelled.at && r.c.cancelled.by);
  assert.ok(r.twice, 'cannot cancel twice');
  assert.equal(r.ledLen, 3, 'Credit Note line added, nothing deleted');
  assert.equal(r.ledNet, -3000, 'sale reversed; paid amount now shows as customer credit');
  assert.equal(r.dueAfter, 14000, 'cancelled bill no longer counted as due');
  assert.equal(r.next, 'INV-' + new Date().getFullYear() + '-004', 'numbering continues past the cancelled bill');
  assert.equal(r.count, 3); assert.equal(r.active, 2);
  assert.equal(r.quote.convertedInvId, undefined, 'source quotation freed to convert again');
  assert.equal(r.afterDel, 3); assert.ok(r.cxlModalOpen);
  assert.match(r.rcpt, /CANCELLED[\s\S]*ग्राहकले/, 'thermal receipt shows CANCELLED too');
  assert.equal(r.ca[11], 0); assert.match(r.ca[14], /^CANCELLED: /);

  // UI: list badge, preview stamp, edit blocked
  await page.evaluate(() => App.navigate('invoices'));
  assert.match(await page.textContent('tr.inv-cancelled[data-inv-id="i2"]'), /CANCELLED/);
  assert.equal(await page.locator('[data-inv-cancel="i2"]').count(), 0);
  await page.click('tr.inv-cancelled[data-inv-id="i2"]');
  assert.match(await page.textContent('.cxl-stamp'), /CANCELLED[\s\S]*ग्राहकले/);
  await page.evaluate(() => { document.getElementById('view-modal').classList.remove('open'); Invoices.edit('i2'); });
  assert.ok(!(await page.evaluate(() => document.getElementById('inv-edit-modal').classList.contains('open'))));

  // UI cancel flow with refund: reason required in the dialog
  await page.click('[data-inv-cancel="i1"]');
  await page.waitForSelector('#inv-cxl-modal.open');
  await page.click('#inv-cxl-confirm');
  assert.equal(await page.evaluate(() => Invoices.getData().find((x) => x.id === 'i1').status), 'Partial', 'no reason → not cancelled');
  await page.fill('#inv-cxl-reason', 'गलत बिल बन्यो');
  await page.check('#inv-cxl-refund');
  await page.click('#inv-cxl-confirm');
  const i1 = await page.evaluate(() => ({ inv: Invoices.getData().find((x) => x.id === 'i1'), db: STORE.get('pk3_daybook') }));
  assert.equal(i1.inv.status, 'Cancelled'); assert.equal(i1.inv.cancelled.refund, true);
  assert.equal(i1.db[0].type, 'return'); assert.equal(i1.db[0].amount, 3000);
  assert.equal(await page.locator('tr.inv-cancelled').count(), 2);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('legacy invoice already marked "Cancelled" (v6/v7.0) shows as cancelled; status menu has no Cancelled', async () => {
  const invoices = [inv('old', 'INV-2025-010', { status: 'Cancelled' }), inv('ok', 'INV-2025-011')];
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: { ...EXISTING, pk3_customers: J(cust), pk3_invoices: J(invoices) } });
  await page.evaluate(() => App.navigate('invoices'));
  assert.equal(await page.locator('tr.inv-cancelled').count(), 1);
  assert.equal(await page.evaluate(() => JSON.stringify(STORE.get('pk3_invoices'))), J(invoices), 'data untouched by rendering');
  await page.evaluate(() => Invoices.edit('ok'));
  const opts = await page.$$eval('#inv-status-inp option', (o) => o.map((x) => x.value));
  assert.ok(!opts.includes('Cancelled'), 'Cancelled only via ❌ Cancel Invoice (with reason)');
  assert.deepEqual(errors, []);
  await ctx.close();
});
