// Item 4: 1-click Quotation / Estimate → Invoice (Sale) with Customer Ledger posting, no duplicates.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, loggedIn, J } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const cust = [{ id: 'c1', name: 'Ram Bahadur', phone: '9800000001', address: 'Hetauda-4' }];
const quote = {
  id: 'q1', custId: 'c1', custName: 'Ram Bahadur', custPhone: '9800000001', work: 'Modular Kitchen', status: 'Pending',
  items: [{ name: 'Kitchen cabinet', qty: 10, unit: 'sqft', rate: 2000 }, { name: 'Granite top', qty: 2, unit: 'pcs', rate: 5000 }],
  discount: 1000, tax: 13, advance: 5000, amount: 33900, balance: 28900, date: '2026-11-10', dateBs: '2083-07-24',
};
const storage = { pk3_customers: J(cust), pk3_quotations: J([quote]) };

test('Convert button creates the invoice with all items, customer, VAT and advance', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  await page.evaluate(() => App.navigate('quotations'));
  await page.click('[data-convert="q1"]');            // confirm() auto-accepted by the test
  const inv = await page.evaluate(() => STORE.get('pk3_invoices', [])[0]);
  assert.equal(inv.custId, 'c1');
  assert.equal(inv.items.length, 2);
  assert.deepEqual(inv.items.map((r) => r.amount), [20000, 10000]);
  assert.equal(inv.subtotal, 30000);
  assert.equal(inv.discAmt, 1000);
  assert.equal(inv.taxP, 13);
  assert.equal(Math.round(inv.taxAmt), 3770);
  assert.equal(inv.amount, 33900);                // same grand total as the quotation
  assert.equal(inv.paid, 5000);
  assert.equal(inv.balance, 28900);
  assert.equal(inv.status, 'Partial');
  assert.match(inv.invNum, /^INV-\d{4}-\d{3}$/);
  assert.deepEqual(inv.fromQuote.type, 'quotation');
  // Ledger: sale debit + advance credit, linked to the invoice
  const led = await page.evaluate(() => STORE.get('pk3_ledger', []));
  assert.equal(led.length, 2);
  assert.equal(led.filter((t) => t._inv === inv.id).length, 2);
  assert.equal(led.reduce((s, t) => s + (t.debit || 0) - (t.credit || 0), 0), 28900);
  // Dues are not double counted (invoice balance only)
  assert.equal(await page.evaluate(() => SmartRem.dueFor('c1').total), 28900);
  // Quotation shows Converted badge, convert button gone, status moved off Pending
  const q = await page.evaluate(() => STORE.get('pk3_quotations', [])[0]);
  assert.equal(q.convertedInvId, inv.id);
  assert.equal(q.status, 'Approved');
  await page.evaluate(() => Quotations.render());
  assert.equal(await page.locator('#quot-table [data-converted]').count(), 1);
  assert.equal(await page.locator('[data-convert="q1"]').count(), 0);
  // Ledger page shows the posted entries
  await page.evaluate(() => { App.navigate('ledger'); Ledger.select('c1'); });
  assert.match(await page.innerText('#ledger-content'), /Balance: Rs\. 28,900 \(Dr\)/);
  // Invoice list shows where it came from
  await page.evaluate(() => App.navigate('invoices'));
  assert.match(await page.innerText('#inv-table'), /Quotation बाट/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Converting twice is blocked — no duplicate invoice or ledger lines', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage });
  await page.evaluate(() => QuoteConvert.fromQuotation('q1', true));
  const again = await page.evaluate(() => QuoteConvert.fromQuotation('q1', true));
  assert.equal(again, null);
  assert.equal(await page.evaluate(() => STORE.get('pk3_invoices', []).length), 1);
  assert.equal(await page.evaluate(() => STORE.get('pk3_ledger', []).length), 2);
  // Preview shows "Converted" instead of the convert button
  await page.evaluate(() => Quotations.preview('q1'));
  assert.match(await page.innerText('#q-conv-btn'), /Converted/);
  await ctx.close();
});

test('Deleting the invoice removes its ledger lines and allows converting again', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage });
  const inv = await page.evaluate(() => QuoteConvert.fromQuotation('q1', true));
  await page.evaluate((id) => Invoices.del(id), inv.id);
  assert.equal(await page.evaluate(() => STORE.get('pk3_ledger', []).length), 0);
  assert.equal(await page.evaluate(() => QuoteConvert.isConverted(STORE.get('pk3_quotations', [])[0])), false);
  assert.ok(await page.evaluate(() => QuoteConvert.fromQuotation('q1', true)));
  await ctx.close();
});

test('Quotation without advance → Pending invoice, single ledger debit', async () => {
  const q2 = { ...quote, id: 'q2', advance: 0, balance: 33900 };
  const { page, ctx } = await loggedIn({ base, browser, storage: { pk3_customers: J(cust), pk3_quotations: J([q2]) } });
  const inv = await page.evaluate(() => QuoteConvert.fromQuotation('q2', true));
  assert.equal(inv.status, 'Pending');
  assert.equal(inv.balance, 33900);
  assert.equal(await page.evaluate(() => STORE.get('pk3_ledger', []).length), 1);
  await ctx.close();
});

test('Saved Estimate converts too; customer is matched by phone or created', async () => {
  const est = [
    { id: 'e1', custName: 'Ram B.', phone: '980-0000001', items: [{ name: 'Gypsum ceiling', qty: 100, unit: 'sqft', rate: 150 }], disc: 0, tax: 13, taxAmt: 1950, total: 16950, advance: 0, status: 'Draft', estNo: 'EST-001', date: '2026-11-01' },
    { id: 'e2', custName: 'New Client', phone: '9844444444', addr: 'Birgunj', items: [{ name: 'UPVC window', qty: 4, unit: 'pcs', rate: 9000 }], disc: 0, tax: 0, total: 36000, advance: 6000, status: 'Draft', estNo: 'EST-002' },
  ];
  const { page, ctx } = await loggedIn({ base, browser, storage: { pk3_customers: J(cust), pk3_estimates: J(est) } });
  await page.evaluate(() => App.navigate('estimates-list'));
  await page.click('[data-convert="e1"]');
  let inv = await page.evaluate(() => STORE.get('pk3_invoices', [])[0]);
  assert.equal(inv.custId, 'c1');                 // matched by phone digits
  assert.equal(inv.amount, 16950);
  assert.equal(inv.fromQuote.type, 'estimate');
  inv = await page.evaluate(() => QuoteConvert.fromEstimate('e2', true));
  const custs = await page.evaluate(() => STORE.get('pk3_customers', []));
  assert.equal(custs.length, 2);
  assert.equal(custs.find((c) => c.id === inv.custId).name, 'New Client');
  assert.equal(inv.paid, 6000);
  await page.evaluate(() => Bakauta.renderList());
  assert.equal(await page.locator('#est-table [data-converted]').count(), 2);
  await ctx.close();
});
