// v7.1.0 bug fix: Payment QR in Settings → Print Settings shows an instant preview on pick
// (big photos are compressed), has a clear "💾 QR सेभ गर्नुहोस्" button, and the saved QR
// reaches Quotation / Invoice print and the PNG bill.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, loggedIn, J } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

// A made-up business — nothing here may come from code, only from Company Settings.
const settings = { companyName: 'Kanchan Kirana Pasal', address: 'Dharan-8, Sunsari', phone1: '9822233344', pan: '402345678', esewa: '9822233344' };
const storage = {
  pk3_settings: J(settings),
  pk3_customers: J([{ id: 'c1', name: 'Gita Rai', phone: '9800000003', address: 'Dharan-2' }]),
  pk3_quotations: J([{ id: 'q1', custId: 'c1', custName: 'Gita Rai', custPhone: '9800000003', work: 'Groceries', status: 'Pending',
    items: [{ name: 'Rice 25kg', qty: 2, unit: 'bag', rate: 2400 }], discount: 0, tax: 0, advance: 0, amount: 4800, date: '2026-11-20', dateBs: '2083-08-04' }]),
};

// A big (2400×1800) "camera photo" of a QR: noisy border (so a PNG would be huge) and a
// solid pure-green centre that must survive compression and show up in print / PNG.
async function bigPhoto(page) {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 2400; c.height = 1800;
    const x = c.getContext('2d'), d = x.createImageData(c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = v; d.data[i + 1] = 255 - v; d.data[i + 2] = (v * 7) % 255; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    x.fillStyle = '#00ff00'; x.fillRect(500, 300, 1400, 1200);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95));
    const buf = new Uint8Array(await blob.arrayBuffer()); let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  return Buffer.from(b64, 'base64');
}

const greenPixels = (page, expr) => page.evaluate(async (src) => {
  const blob = await (0, eval)(src);
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
  const px = x.getImageData(0, 0, c.width, c.height).data; let n = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i] < 90 && px[i + 1] > 200 && px[i + 2] < 90) n++;
  return n;
}, expr);

test('QR block lives in Print Settings; big photo → instant compressed preview, not saved until "QR सेभ गर्नुहोस्"', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  await page.evaluate(() => App.navigate('settings'));
  assert.equal(await page.locator('#set-print-card #set-payqr-box').count(), 1, 'QR must be inside Print Settings card');
  assert.equal(await page.isVisible('#set-payqr-save'), false);
  const photo = await bigPhoto(page);
  assert.ok(photo.length > 1024 * 1024, 'fixture should be a big photo');
  await page.setInputFiles('#set-payqr-file', { name: 'qr-photo.jpg', mimeType: 'image/jpeg', buffer: photo });

  // instant preview + clear save button, nothing stored yet
  await page.waitForSelector('#set-payqr-save', { state: 'visible' });
  assert.match(await page.innerText('#set-payqr-save'), /QR सेभ गर्नुहोस्/);
  assert.equal(await page.isVisible('#set-payqr-img'), true);
  assert.equal(await page.isVisible('#set-payqr-badge'), true);
  assert.equal(await page.evaluate(() => STORE.get('pk3_pay_qr', '')), '');
  const prev = await page.evaluate(() => { const i = document.getElementById('set-payqr-img'); return { w: i.naturalWidth, h: i.naturalHeight, len: i.src.length, src: i.src.slice(0, 15) }; });
  assert.ok(prev.w <= 600 && prev.h <= 600 && prev.w > 0, 'compressed to ≤600px: ' + JSON.stringify(prev));
  assert.equal(prev.w / prev.h, 4 / 3, 'aspect ratio kept');
  assert.ok(prev.len < 230 * 1024, 'compressed under budget: ' + prev.len);
  assert.match(prev.src, /^data:image\//);

  await page.click('#set-payqr-save');
  const saved = await page.evaluate(() => STORE.get('pk3_pay_qr', ''));
  assert.equal(saved, await page.evaluate(() => document.getElementById('set-payqr-img').src));
  assert.equal(await page.isVisible('#set-payqr-save'), false);
  assert.equal(await page.isVisible('#set-payqr-badge'), false);
  assert.equal(await page.isVisible('#set-payqr-del'), true);
  assert.match(await page.innerText('#set-payqr-status'), /सेभ भएको/);
  assert.match(await page.innerText('#set-payqr-pick'), /अर्को QR/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Saved QR appears in Quotation print, Invoice print and the PNG bill', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  await page.evaluate(() => App.navigate('settings'));
  const noQr = await greenPixels(page, `DocShare.toBlob(DocPrint.fromQuotation(STORE.get('pk3_quotations')[0]))`);
  await page.setInputFiles('#set-payqr-file', { name: 'qr-photo.jpg', mimeType: 'image/jpeg', buffer: await bigPhoto(page) });
  await page.click('#set-payqr-save');
  const qr = await page.evaluate(() => STORE.get('pk3_pay_qr', ''));

  await page.evaluate(() => Quotations.preview('q1'));
  assert.equal(await page.locator('#view-modal-body .swg-doc img[data-pay-qr]').getAttribute('src'), qr);
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.click('#view-modal-body button:has-text("Print / PDF")')]);
  await popup.waitForLoadState();
  assert.equal(await popup.locator('.swg-doc img[data-pay-qr]').getAttribute('src'), qr);
  assert.equal(await popup.locator('.swg-doc img[data-pay-qr]').evaluate((i) => i.complete && i.naturalWidth > 0), true);
  await popup.close();

  const inv = await page.evaluate(() => QuoteConvert.fromQuotation('q1', true));
  const [p2] = await Promise.all([page.waitForEvent('popup'), page.evaluate((id) => Invoices.print(id), inv.id)]);
  await p2.waitForLoadState();
  assert.equal(await p2.locator('img[data-pay-qr]').getAttribute('src'), qr);
  await p2.close();

  const q = await greenPixels(page, `DocShare.toBlob(DocPrint.fromQuotation(STORE.get('pk3_quotations')[0]))`);
  const i = await greenPixels(page, `DocShare.toBlob(DocPrint.fromInvoice(Invoices.getData().find(x => x.id === '${inv.id}')))`);
  assert.equal(noQr, 0);
  assert.ok(q > 5000, 'QR in quotation PNG: ' + q);
  assert.ok(i > 5000, 'QR in invoice PNG: ' + i);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Cancel discards a picked QR; Save Payment Details and leaving Settings save it; storage full is reported', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  await page.evaluate(() => App.navigate('settings'));
  const photo = await bigPhoto(page);
  const pick = async () => { await page.setInputFiles('#set-payqr-file', { name: 'qr.jpg', mimeType: 'image/jpeg', buffer: photo }); await page.waitForSelector('#set-payqr-save', { state: 'visible' }); };

  await pick();
  await page.click('#set-payqr-cancel');
  assert.equal(await page.isVisible('#set-payqr-img'), false);
  assert.equal(await page.evaluate(() => STORE.get('pk3_pay_qr', '')), '');

  // storage full → clear error, picked QR kept so the user can retry
  await pick();
  await page.evaluate(() => { window._set = STORE.set; STORE.set = (k, v) => k === 'pk3_pay_qr' ? false : window._set.call(STORE, k, v); });
  await page.click('#set-payqr-save');
  assert.match(await page.innerText('#set-payqr-status'), /सेभ भएन/);
  assert.equal(await page.isVisible('#set-payqr-save'), true);
  await page.evaluate(() => { STORE.set = window._set; });

  // the general "Save Payment Details" button also saves it
  await page.evaluate(() => Settings.saveManual('payment'));
  assert.ok((await page.evaluate(() => STORE.get('pk3_pay_qr', ''))).startsWith('data:image/'));

  // a picked-but-unsaved QR is not lost when leaving Settings
  await page.evaluate(() => { STORE.del('pk3_pay_qr'); PayQR.render(); });
  await pick();
  await page.evaluate(() => App.navigate('dashboard'));
  assert.ok((await page.evaluate(() => STORE.get('pk3_pay_qr', ''))).startsWith('data:image/'));

  // a file the browser cannot read → clear message, nothing saved
  await page.evaluate(() => { STORE.del('pk3_pay_qr'); App.navigate('settings'); });
  await page.setInputFiles('#set-payqr-file', { name: 'x.heic', mimeType: 'image/heic', buffer: Buffer.from('not an image') });
  await page.waitForFunction(() => /पढ्न सकिएन/.test(document.getElementById('set-payqr-status').textContent));
  assert.equal(await page.isVisible('#set-payqr-save'), false);
  assert.deepEqual(errors, []);
  await ctx.close();
});
