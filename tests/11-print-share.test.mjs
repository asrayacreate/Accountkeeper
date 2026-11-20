// v7.1.0: bill photo (PNG) download / Web Share + A4 / A5 / 58mm / 80mm thermal print sizes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, loggedIn, J } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
// A made-up business — nothing here may come from code, only from Company Settings.
const settings = { companyName: 'Sagarmatha Hardware Traders', address: 'Butwal-6, Rupandehi', phone1: '9811122233', pan: '301234567', esewa: '9811122233', bankName: 'Test Bank', bankAcc: '0011223344' };
const storage = {
  pk3_settings: J(settings),
  pk3_pay_qr: J('data:image/png;base64,' + PNG),
  pk3_customers: J([{ id: 'c1', name: 'Sita Kumari', phone: '9800000002', address: 'Butwal-9' }]),
  pk3_quotations: J([{ id: 'q1', custId: 'c1', custName: 'Sita Kumari', custPhone: '9800000002', work: 'Plumbing material', status: 'Pending',
    items: [{ name: 'PPR pipe 25mm — a long item name that has to wrap onto more than one line in the photo and receipt', qty: 40, unit: 'pcs', rate: 350 }, { name: 'Ball valve', qty: 6, unit: 'pcs', rate: 520 }],
    discount: 0, tax: 13, advance: 2000, amount: 19345.6, date: '2026-11-20', dateBs: '2083-08-04' }]),
};

async function pngInfo(page, fn) {
  return page.evaluate(async (src) => {
    const blob = await (0, eval)(src);
    const buf = new Uint8Array(await blob.arrayBuffer());
    const dv = new DataView(buf.buffer);
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
    const px = x.getImageData(0, 0, c.width, c.height).data;
    let ink = 0, orange = 0;
    for (let i = 0; i < px.length; i += 4) { if (px[i] < 200 || px[i + 1] < 200 || px[i + 2] < 200) ink++; if (px[i] > 230 && px[i + 1] > 100 && px[i + 1] < 140 && px[i + 2] < 60) orange++; }
    return { type: blob.type, sig: Array.from(buf.slice(1, 4)).map((b) => String.fromCharCode(b)).join(''), w: dv.getUint32(16), h: dv.getUint32(20), ink, orange };
  }, fn);
}

test('PNG: quotation and invoice render to a clean, non-blank 1080px PNG offline', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  const q = await pngInfo(page, `DocShare.toBlob(DocPrint.fromQuotation(STORE.get('pk3_quotations')[0]))`);
  assert.equal(q.type, 'image/png'); assert.equal(q.sig, 'PNG');
  assert.equal(q.w, 1080);
  assert.ok(q.h > 900 && q.h < 4000, 'height ' + q.h);
  assert.ok(q.ink > 20000, 'image looks blank: ' + q.ink);
  assert.ok(q.orange > 3000, 'brand header bar missing: ' + q.orange);
  const inv = await page.evaluate(() => QuoteConvert.fromQuotation('q1', true));
  const i = await pngInfo(page, `DocShare.toBlob(DocPrint.fromInvoice(Invoices.getData().find(x => x.id === '${inv.id}')))`);
  assert.equal(i.w, 1080); assert.ok(i.ink > 20000);
  // file name comes from the document, never a hard-coded company
  assert.equal(await page.evaluate((id) => DocShare.fileName(DocPrint.fromInvoice(Invoices.getData().find((x) => x.id === id))), inv.id),
    'Tax-Invoice-' + inv.invNum.replace(/[^A-Za-z0-9_-]+/g, '-') + '-Sita-Kumari.png');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('PNG button: shares a PNG file through the Web Share API (WhatsApp) on mobile', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage, viewport: { width: 390, height: 800 } });
  await page.evaluate(() => {
    window.__shared = null;
    navigator.canShare = (o) => !!(o && o.files && o.files.length);
    navigator.share = async (o) => { const f = o.files[0]; window.__shared = { name: f.name, type: f.type, size: f.size, text: o.text }; };
  });
  await page.evaluate(() => Quotations.preview('q1'));
  await page.waitForFunction(() => DocShare._ready && DocShare._ready.blob);
  await page.click('#doc-share-png');
  await page.waitForFunction(() => window.__shared);
  const s = await page.evaluate(() => window.__shared);
  assert.match(s.name, /^Quotation-.*Sita-Kumari\.png$/);
  assert.equal(s.type, 'image/png');
  assert.ok(s.size > 5000);
  assert.ok(s.text.includes('Sagarmatha Hardware Traders'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('PNG button: falls back to a download when Web Share is not available (desktop)', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  await page.evaluate(() => { try { delete Navigator.prototype.share; delete Navigator.prototype.canShare; } catch (e) {} navigator.share = undefined; });
  await page.evaluate(() => Quotations.preview('q1'));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#doc-share-png')]);
  assert.match(dl.suggestedFilename(), /^Quotation-.*\.png$/);
  // share cancelled by the user → no download, no error
  await page.evaluate(() => { navigator.canShare = () => true; navigator.share = () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })); });
  assert.equal(await page.evaluate(() => DocShare.share(DocPrint.fromQuotation(STORE.get('pk3_quotations')[0]))), 'cancelled');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Print Settings: choose A4 / A5 / 80mm / 58mm, saved and used by Print', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  await page.evaluate(() => App.navigate('settings'));
  assert.equal(await page.inputValue('#set-print-size'), 'A4');
  assert.equal(await page.locator('#set-print-size option').count(), 4);
  await page.selectOption('#set-print-size', 'T80');
  assert.deepEqual(await page.evaluate(() => STORE.get('pk3_print_fmt')), { size: 'T80' });
  // business setting → synced & backed up like other pk3_ data
  assert.equal(await page.evaluate(() => 'pk3_print_fmt' in DBX.collect()), true);

  await page.evaluate(() => Quotations.preview('q1'));
  assert.equal(await page.inputValue('#doc-print-size'), 'T80');
  let [popup] = await Promise.all([page.waitForEvent('popup'), page.click('#view-modal-body button:has-text("Print / PDF")')]);
  await popup.waitForLoadState();
  let html = await popup.content();
  assert.ok(html.includes('@page{size:80mm auto'));
  const r = popup.locator('.swg-rcpt[data-receipt="80"]');
  const t = await r.innerText();
  for (const want of ['Sagarmatha Hardware Traders', 'Butwal-6, Rupandehi', '301234567', 'QUOTATION', 'Sita Kumari', 'Ball valve', 'TOTAL', 'Rs. 19,345.6', 'धन्यवाद']) assert.ok(t.includes(want), 'receipt missing: ' + want);
  assert.equal(await r.locator('img[data-pay-qr]').count(), 1);
  await popup.close();

  // one-off override in the preview: A5 (does not change the saved setting)
  await page.selectOption('#doc-print-size', 'A5');
  [popup] = await Promise.all([page.waitForEvent('popup'), page.click('#view-modal-body button:has-text("Print / PDF")')]);
  await popup.waitForLoadState();
  html = await popup.content();
  assert.ok(html.includes('@page{size:A5'));
  assert.equal(await popup.locator('.swg-doc').count(), 1);
  await popup.close();
  assert.equal(await page.evaluate(() => PrintFmt.get()), 'T80');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('58mm thermal receipt fits the paper; invoice print follows the setting; bad value → A4', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage: { ...storage, pk3_print_fmt: J({ size: 'T58' }) } });
  const inv = await page.evaluate(() => QuoteConvert.fromQuotation('q1', true));
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.evaluate((id) => Invoices.print(id), inv.id)]);
  await popup.waitForLoadState();
  assert.ok((await popup.content()).includes('@page{size:58mm auto'));
  const r = popup.locator('.swg-rcpt[data-receipt="58"]');
  assert.match(await r.innerText(), /TAX INVOICE[\s\S]*Balance \/ बाँकी/);
  const fit = await popup.evaluate(() => { const e = document.querySelector('.swg-rcpt'); return { w: e.getBoundingClientRect().width, over: e.scrollWidth - e.clientWidth }; });
  assert.ok(fit.w <= 54 * 96 / 25.4 + 1, 'receipt wider than 54mm: ' + fit.w);
  assert.ok(fit.over <= 1, 'receipt content overflows by ' + fit.over);
  await popup.close();
  await page.evaluate(() => STORE.set('pk3_print_fmt', { size: 'Letter' }));
  assert.equal(await page.evaluate(() => PrintFmt.get()), 'A4');
  await ctx.close();
});
