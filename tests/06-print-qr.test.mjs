// Item 5: professional Quotation / Invoice print & PDF with Payment QR from Settings.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, loggedIn, J } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

// 1x1 red PNG
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const settings = { companyName: 'PRERAK MULTIPURPOSE PVT LTD', address: 'Hetauda-2, Makwanpur', phone1: '9855069733', pan: '609876543', esewa: '9855069733', bankName: 'NIC Asia', bankAcc: '1234567890' };
const storage = {
  pk3_settings: J(settings),
  pk3_customers: J([{ id: 'c1', name: 'Ram Bahadur', phone: '9800000001', address: 'Hetauda-4' }]),
  pk3_quotations: J([{ id: 'q1', custId: 'c1', custName: 'Ram Bahadur', custPhone: '9800000001', work: 'Modular Kitchen', status: 'Pending', items: [{ name: 'Kitchen cabinet', qty: 10, unit: 'sqft', rate: 2000 }], discount: 0, tax: 13, advance: 0, amount: 22600, date: '2026-11-20', dateBs: '2083-08-04' }]),
};

test('Settings: upload Payment QR image, it is saved and previewed; Terms saved', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  await page.evaluate(() => App.navigate('settings'));
  await page.setInputFiles('#set-payqr-file', { name: 'qr.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') });
  await page.waitForFunction(() => (STORE.get('pk3_pay_qr', '') || '').startsWith('data:image/png'));
  assert.equal(await page.isVisible('#set-payqr-img'), true);
  assert.equal(await page.isVisible('#set-payqr-del'), true);
  await page.fill('#set-doc-terms', '५०% अग्रिम, बाँकी काम सकिएपछि।');
  await page.dispatchEvent('#set-doc-terms', 'input');
  assert.equal(await page.evaluate(() => STORE.get('pk3_doc_terms')), '५०% अग्रिम, बाँकी काम सकिएपछि।');
  // QR + terms are business settings → they DO sync to Dropbox (not secrets)
  assert.equal(await page.evaluate(() => 'pk3_pay_qr' in DBX.collect() && 'pk3_doc_terms' in DBX.collect()), true);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Quotation print/PDF: header, PAN, BS + AD date, items, total, terms and QR', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage: { ...storage, pk3_pay_qr: J('data:image/png;base64,' + PNG), pk3_doc_terms: J('Quotation १५ दिन मान्य।') } });
  await page.evaluate(() => Quotations.preview('q1'));
  const body = page.locator('#view-modal-body .swg-doc');
  const text = await body.innerText();
  for (const want of ['PRERAK MULTIPURPOSE PVT LTD', 'Hetauda-2, Makwanpur', '609876543', 'QUOTATION', '2083-08-04', '2026-11-20', 'Ram Bahadur', 'Kitchen cabinet', 'Rs. 22,600', 'Quotation १५ दिन मान्य।', 'Scan to Pay', 'NIC Asia', 'Authorised Signature']) {
    assert.ok(text.includes(want), 'missing: ' + want);
  }
  assert.equal(await body.locator('img[data-pay-qr]').count(), 1);
  // Print button opens a clean A4 window with the same document
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.click('#view-modal-body button:has-text("Print / PDF")')]);
  await popup.waitForLoadState();
  assert.ok((await popup.content()).includes('@page{size:A4'));
  assert.equal(await popup.locator('.swg-doc img[data-pay-qr]').count(), 1);
  await ctx.close();
});

test('Invoice print shows TAX INVOICE, paid/balance and QR; no QR section when none saved', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage: { ...storage, pk3_pay_qr: J('data:image/png;base64,' + PNG) } });
  const inv = await page.evaluate(() => QuoteConvert.fromQuotation('q1', true));
  await page.evaluate((id) => Invoices.preview(id), inv.id);
  const text = await page.locator('#view-modal-body .swg-doc').innerText();
  assert.match(text, /TAX INVOICE/);
  assert.match(text, /Balance \/ बाँकी\s+Rs\. 22,600/);
  assert.match(text, new RegExp(inv.invNum));
  assert.equal(await page.locator('#view-modal-body img[data-pay-qr]').count(), 1);
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.evaluate((id) => Invoices.print(id), inv.id)]);
  await popup.waitForLoadState();
  assert.match(await popup.locator('.swg-doc').innerText(), /TAX INVOICE/);
  await ctx.close();

  const r = await loggedIn({ base, browser, storage: { ...storage, pk3_settings: J({ companyName: 'X' }) } });
  await r.page.evaluate(() => Quotations.preview('q1'));
  assert.equal(await r.page.locator('#view-modal-body .pay').count(), 0);
  await r.ctx.close();
});

test('Print layout fits a phone screen without horizontal cut-off', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage: { ...storage, pk3_pay_qr: J('data:image/png;base64,' + PNG) }, viewport: { width: 375, height: 740 } });
  await page.evaluate(() => Quotations.preview('q1'));
  const over = await page.evaluate(() => { const d = document.querySelector('#view-modal-body .swg-doc'); return d.scrollWidth - d.clientWidth; });
  assert.ok(over <= 1, 'document overflows by ' + over + 'px');
  await ctx.close();
});
