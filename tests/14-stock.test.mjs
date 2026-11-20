// v7.2.0 #2: 📦 Stock / Inventory — Low Stock limit, auto decrease on sale, auto increase on purchase,
// Dashboard warning, Modules On/Off.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, loggedIn, J } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const EXISTING = { pk3_data_version: '5', pk3_settings: J({ companyName: 'Test Traders', phone1: '9800000000' }), pk3_business: J({ type: 'retail', setupDone: true }), pk3_v7_migrated: '1' };
const STOCK = [
  { id: 'k1', name: 'Cement Bag', cat: 'Cement', qty: 20, unit: 'bag', purchase: 700, selling: 800, minQty: 5, history: [] },
  { id: 'k2', name: 'Paint 4L', cat: 'Paint', qty: 3, unit: 'pcs', purchase: 2000, selling: 2500, minQty: 4, history: [] },
  { id: 'k3', name: 'Old Item', qty: 0, unit: 'pcs', minQty: 0, history: [] },
];
const CUST = [{ id: 'c1', name: 'Ram Bahadur', phone: '9811111111' }];
const OLD_INV = { id: 'old1', invNum: 'INV-2025-001', custId: 'c1', custName: 'Ram Bahadur', items: [{ name: 'Cement Bag', qty: 10, unit: 'bag', rate: 800, amount: 8000 }], amount: 8000, paid: 0, balance: 8000, status: 'Pending', date: '2025-01-01' };

const boot = (extra) => loggedIn({ base, browser, storage: { ...EXISTING, pk3_stock: J(STOCK), pk3_customers: J(CUST), ...(extra || {}) } });
const qty = (page, id) => page.evaluate((i) => Stock.find(i).qty, id);

test('low stock limit: per-item minQty (0 allowed, blank → 5), dashboard card + warning list', async () => {
  const { page, errors, ctx } = await boot();
  const r = await page.evaluate(() => ({
    low: Stock.lowItems().map((s) => s.id),
    min0: Stock.minOf({ minQty: 0 }), minBlank: Stock.minOf({}), minEmpty: Stock.minOf({ minQty: '' }),
  }));
  assert.deepEqual(r.low.sort(), ['k2', 'k3'], 'qty ≤ limit → low (k3: 0 ≤ 0 = out of stock)');
  assert.equal(r.min0, 0); assert.equal(r.minBlank, 5); assert.equal(r.minEmpty, 5);
  await page.evaluate(() => App.navigate('dashboard'));
  await page.waitForTimeout(200);
  assert.equal(await page.textContent('#s-lowstock'), '2');
  assert.ok(await page.isVisible('#dash-lowstock'));
  const txt = await page.textContent('#dash-lowstock');
  assert.match(txt, /Low Stock — 2/);
  assert.match(txt, /Paint 4L: 3 pcs/);
  assert.doesNotMatch(txt, /Cement Bag/);
  // Saving a 0 limit from the form keeps 0 (old code turned 0 into 5)
  await page.evaluate(() => { App.navigate('stocklist'); Stock.editModal('k1'); setVal('stk-min', '0'); Stock.save(); });
  assert.equal(await page.evaluate(() => Stock.find('k1').minQty), 0);
  assert.equal(await page.evaluate(() => Stock.find('k1').history.length), 0, 'history kept on edit');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('sale: new invoice decreases stock; edit applies only the difference; cancel restores', async () => {
  const { page, errors, ctx } = await boot();
  await page.evaluate(() => {
    App.navigate('invoices'); Invoices.create();
    setVal('inv-cust-sel', 'c1');
    Invoices._rows = [{ name: 'cement bag', qty: 4, unit: 'bag', rate: 800 }, { name: 'Paint 4L', qty: 1, unit: 'pcs', rate: 2500 }, { name: 'Labour (service)', qty: 1, unit: 'job', rate: 500 }];
    Invoices.saveNew();
  });
  assert.equal(await qty(page, 'k1'), 16, 'case-insensitive name match');
  assert.equal(await qty(page, 'k2'), 2);
  const inv = await page.evaluate(() => Invoices.getData()[0]);
  assert.equal(inv.stockTracked, true);
  const h = await page.evaluate(() => Stock.find('k1').history[0]);
  assert.equal(h.type, 'out'); assert.equal(h.qty, 4); assert.equal(h.ref, 'inv:' + inv.id); assert.equal(h.auto, true);

  // Edit: 4 → 6 cement, paint removed
  await page.evaluate((id) => {
    Invoices.edit(id);
    Invoices._rows = [{ name: 'Cement Bag', qty: 6, unit: 'bag', rate: 800 }];
    Invoices.saveNew();
  }, inv.id);
  assert.equal(await qty(page, 'k1'), 14);
  assert.equal(await qty(page, 'k2'), 3, 'removed line goes back to stock');
  // Saving the same bill again does nothing (idempotent)
  await page.evaluate((id) => { Invoices.edit(id); Invoices.saveNew(); }, inv.id);
  assert.equal(await qty(page, 'k1'), 14);

  // Cancel → stock back to start
  await page.evaluate((id) => Invoices.cancel(id, 'ग्राहकले फिर्ता गर्यो'), inv.id);
  assert.equal(await qty(page, 'k1'), 20);
  assert.equal(await qty(page, 'k2'), 3);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('old (v7.1 and earlier) invoices never touch stock, even when edited', async () => {
  const { page, errors, ctx } = await boot({ pk3_invoices: J([OLD_INV]) });
  assert.equal(await qty(page, 'k1'), 20, 'no back-dated deduction on load');
  await page.evaluate(() => { Invoices.edit('old1'); Invoices.saveNew(); });
  assert.equal(await qty(page, 'k1'), 20);
  assert.equal(await page.evaluate(() => !!Invoices.getData().find((i) => i.id === 'old1').stockTracked), false);
  await page.evaluate(() => Invoices.cancel('old1', 'test cancel'));
  assert.equal(await qty(page, 'k1'), 20);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Quotation → Invoice conversion decreases stock', async () => {
  const { page, errors, ctx } = await boot();
  await page.evaluate(() => {
    const inv = QuoteConvert._build({ items: [{ name: 'Cement Bag', qty: 2, unit: 'bag', rate: 800 }], total: 1600, sub: 1600, disc: 0, taxP: 0, taxAmt: 0, paid: 0 }, { id: 'c1', name: 'Ram Bahadur' }, { type: 'quotation', id: 'q1', no: 'Q-1' });
    QuoteConvert._finish(inv, 'Quotation');
  });
  assert.equal(await qty(page, 'k1'), 18);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('purchase: supplier bill with stock items increases stock; deleting the entry reverses it; API for Purchase Bill', async () => {
  const { page, errors, ctx } = await boot({ pk3_payables: J([{ id: 'py1', name: 'Hardware Supplier', kind: 'supplier' }]) });
  // Through the real UI
  await page.evaluate(() => { App.navigate('payables'); Payables.view('py1'); });
  await page.waitForSelector('#pay-t-stock');
  await page.selectOption('#pay-t-stk-item', 'k2');
  await page.fill('#pay-t-stk-qty', '10');
  await page.click('#pay-t-stk-add');
  await page.fill('#pay-t-amount', '20000');
  await page.fill('#pay-t-bill', 'B-77');
  await page.click('#pay-t-save');
  assert.equal(await qty(page, 'k2'), 13);
  const t = await page.evaluate(() => Payables.txns()[0]);
  assert.deepEqual(t.stockItems.map((l) => [l.stockId, l.qty]), [['k2', 10]]);
  assert.match(await page.evaluate(() => Stock.find('k2').history[0].note), /खरिद #B-77/);
  await page.evaluate((id) => Payables.delTxn(id), t.id);
  assert.equal(await qty(page, 'k2'), 3);

  // Public hook for the Purchase Bill module (idempotent per ref)
  const r = await page.evaluate(() => {
    Stock.purchaseIn('pur:x1', [{ name: 'Cement Bag', qty: 50 }, { name: 'Unknown thing', qty: 1 }]);
    const a = Stock.find('k1').qty;
    const res = Stock.purchaseIn('pur:x1', [{ name: 'Cement Bag', qty: 40 }]);
    const b = Stock.find('k1').qty;
    Stock.reverse('pur:x1');
    return { a, b, c: Stock.find('k1').qty, changed: res.changed.length };
  });
  assert.deepEqual([r.a, r.b, r.c], [70, 60, 20]);
  assert.equal(r.changed, 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Modules: Stock Off → no auto change, dashboard warning hidden; turning On again shows it', async () => {
  const { page, errors, ctx } = await boot();
  await page.evaluate(() => Modules.set('stock', false));
  await page.evaluate(() => {
    App.navigate('invoices'); Invoices.create(); setVal('inv-cust-sel', 'c1');
    Invoices._rows = [{ name: 'Cement Bag', qty: 5, unit: 'bag', rate: 800 }]; Invoices.saveNew();
    App.navigate('dashboard');
  });
  assert.equal(await qty(page, 'k1'), 20);
  assert.equal(await page.isVisible('#dash-lowstock'), false);
  await page.evaluate(() => { Modules.set('stock', true); App.navigate('dashboard'); });
  await page.waitForTimeout(200);
  assert.equal(await page.isVisible('#dash-lowstock'), true);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('invoice item list suggests stock items and fills their selling rate', async () => {
  const { page, errors, ctx } = await boot();
  const r = await page.evaluate(() => {
    App.navigate('invoices'); Invoices.create();
    Invoices._rows = [{ name: 'Paint 4L', qty: 1, unit: 'pcs', rate: 0 }];
    Invoices.renderRows(); Invoices.autofillRate(0);
    return { rate: Invoices._rows[0].rate, opts: [...document.querySelectorAll('#inv-items-dl option')].map((o) => o.value) };
  });
  assert.equal(r.rate, 2500);
  assert.ok(r.opts.includes('Cement Bag'));
  assert.deepEqual(errors, []);
  await ctx.close();
});
