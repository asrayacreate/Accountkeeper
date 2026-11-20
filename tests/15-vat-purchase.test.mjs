// v7.2.0 item 1: Abbreviated / Tax Invoice, 13% VAT, amount in words (Nepali + English),
// Purchase Bill + Input VAT + TDS, Sales Book + Purchase Book + Net VAT export.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, launch, loggedIn, J, appSource } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const EXISTING = { pk3_data_version: '5', pk3_settings: J({ companyName: 'Test Traders', phone1: '9800000000', pan: '601234567', address: 'Test Address' }), pk3_business: J({ type: 'retail', setupDone: true }), pk3_v7_migrated: '1' };

test('amount in words: Nepali + English with paisa', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: EXISTING });
  const r = await page.evaluate(() => ({
    a: numToWordsNe(123456), b: numToWordsNe(11300), c: numToWordsNe(99.5), d: numToWordsNe(0), e: numToWordsNe(25000000), f: numToWordsNe(1999999999),
    en1: numToWordsEn(1130.5), en2: numToWordsEn(11300), old: numToWords(11300),
  }));
  assert.equal(r.a, 'एक लाख तेइस हजार चार सय छपन्न रुपैयाँ मात्र');
  assert.equal(r.b, 'एघार हजार तीन सय रुपैयाँ मात्र');
  assert.equal(r.c, 'उनान्सय रुपैयाँ पचास पैसा मात्र');
  assert.equal(r.d, 'शून्य रुपैयाँ मात्र');
  assert.equal(r.e, 'दुई करोड पचास लाख रुपैयाँ मात्र');
  assert.equal(r.f, 'एक अर्ब उनान्सय करोड उनान्सय लाख उनान्सय हजार नौ सय उनान्सय रुपैयाँ मात्र');
  assert.equal(r.en1, 'One Thousand One Hundred Thirty Rupees and Fifty Paisa Only');
  assert.equal(r.en2, 'Eleven Thousand Three Hundred Rupees Only');
  assert.equal(r.old, r.en2, 'old numToWords unchanged');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('🧾 Tax Invoice + Abbreviated: form, 13% VAT taxable line, buyer PAN, words, print', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: { ...EXISTING, pk3_customers: J([{ id: 'c1', name: 'Ram Hardware', phone: '9811111111', pan: '302222333' }, { id: 'c2', name: 'Sita', phone: '9822222222' }]) } });
  await page.evaluate(() => { App.navigate('invoices'); Invoices.create(); });
  await page.waitForSelector('#inv-edit-modal.open');
  assert.equal(await page.inputValue('#inv-billtype'), 'tax', 'Tax Invoice is the default');
  await page.selectOption('#inv-cust-sel', 'c1');
  assert.equal(await page.inputValue('#inv-cust-pan'), '302222333', 'buyer PAN comes from the customer');
  await page.evaluate(() => { Invoices.addRow('Plywood 18mm', 10, 'pcs', 1000); Invoices.calc(); });
  assert.equal(await page.textContent('#inv-sum-taxable'), 'Rs. 10,000');
  assert.equal(await page.textContent('#inv-sum-grand'), 'Rs. 11,300');
  assert.equal(await page.textContent('#inv-sum-words-ne'), 'एघार हजार तीन सय रुपैयाँ मात्र');
  await page.evaluate(() => Invoices.saveNew());
  const inv = await page.evaluate(() => Invoices.getData()[0]);
  assert.equal(inv.billType, 'tax');
  assert.equal(inv.custPan, '302222333');
  assert.equal(inv.taxAmt, 1300);
  const html = await page.evaluate((id) => DocPrint.build(DocPrint.fromInvoice(Invoices.getData().find((x) => x.id === id))), inv.id);
  assert.match(html, /data-doc-kind="TAX INVOICE"/);
  assert.match(html, /कर बिजक/);
  assert.match(html, /data-buyer-pan><b>PAN \/ VAT No:<\/b> 302222333/);
  assert.match(html, /Taxable Amount \/ करयोग्य<\/td><td class="r">Rs\. 10,000/);
  assert.match(html, /VAT \(13%\)/);
  assert.match(html, /Eleven Thousand Three Hundred Rupees Only/);
  assert.match(html, /अक्षरमा: <b>एघार हजार तीन सय रुपैयाँ मात्र/);
  assert.match(html, /601234567/, 'seller PAN from Company Settings');
  assert.doesNotMatch(html, /IRD|CBMS/i);
  // Abbreviated (customer without PAN), remembered as next default; big amount → soft hint
  await page.evaluate(() => Invoices.create());
  await page.selectOption('#inv-cust-sel', 'c2');
  await page.selectOption('#inv-billtype', 'abbr');
  await page.evaluate(() => { Invoices.addRow('Glue', 2, 'pcs', 250); Invoices.calc(); });
  assert.equal(await page.isVisible('#inv-abbr-hint'), false);
  await page.evaluate(() => { Invoices.saveNew(); });
  const abbr = await page.evaluate(() => Invoices.getData()[0]);
  assert.equal(abbr.billType, 'abbr');
  const r = await page.evaluate((id) => { const d = DocPrint.fromInvoice(Invoices.getData().find((x) => x.id === id)); return { kind: d.kind, ne: d.kindNe, rc: DocPrint.buildReceipt(d, 80) }; }, abbr.id);
  assert.equal(r.kind, 'ABBREVIATED TAX INVOICE');
  assert.equal(r.ne, 'संक्षिप्त कर बिजक');
  assert.match(r.rc, /ABBREVIATED TAX INVOICE/);
  assert.match(r.rc, /पाँच सय पचास|पाँच सय पैंसट्ठी/);
  await page.evaluate(() => Invoices.create());
  assert.equal(await page.inputValue('#inv-billtype'), 'abbr', 'last picked type is the next default');
  await page.evaluate(() => { Invoices.addRow('Big', 1, 'pcs', 20000); Invoices.calc(); });
  assert.equal(await page.isVisible('#inv-abbr-hint'), true);
  // legacy invoice (no billType) still prints as before
  const legacy = await page.evaluate(() => DocPrint.fromInvoice({ id: 'x', invNum: 'OLD-1', custName: 'A', amount: 500, taxP: 0, items: [{ name: 'a', qty: 1, rate: 500 }] }).kind);
  assert.equal(legacy, 'INVOICE');
  // PNG renderer copes with the long title
  const png = await page.evaluate(async (id) => { const b = await DocShare.toBlob(DocPrint.fromInvoice(Invoices.getData().find((x) => x.id === id))); return b && b.size; }, abbr.id).catch((e) => String(e));
  assert.ok(typeof png === 'number' && png > 1000, 'PNG blob: ' + png);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('🛒 Purchase Bill: Input VAT, TDS, Supplier खाता, edit/delete, stock hook', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: { ...EXISTING, pk3_stock: J([{ id: 's1', name: 'Plywood 18mm', qty: 5, unit: 'pcs' }]) } });
  const r = await page.evaluate(() => {
    const events = [], dom = [];
    Purchases.onChange((e) => events.push(e.action + ':' + (e.purchase && e.purchase.items[0].stockId)));
    window.addEventListener('swagatik:purchase', (e) => dom.push(e.detail.action));
    const p = Purchases.save({ supplierName: 'Shiva Plywood', supplierPan: '609988776', billNo: 'SP-101', date: '2025-08-20', items: [{ name: 'Plywood 18mm', qty: 10, unit: 'pcs', rate: 1000 }], vatP: 13, tdsType: 'service', tdsP: 1.5, paid: 5000 });
    const party = Payables.party(p.partyId);
    const out = { p, party, bal: Payables.balance(p.partyId), db: STORE.get('pk3_daybook').length };
    const p2 = Purchases.save({ id: p.id, supplierName: 'Shiva Plywood', billNo: 'SP-101', date: '2025-08-20', items: [{ name: 'Plywood 18mm', qty: 12, unit: 'pcs', rate: 1000 }], vatP: 13, tdsType: 'none', tdsP: 0, paid: 0 });
    out.p2 = p2; out.bal2 = Payables.balance(p.partyId); out.db2 = STORE.get('pk3_daybook').length; out.parties = Payables.parties().length;
    out.tagged = STORE.get('pk3_payable_txns').every((t) => t.purchaseId === p.id);
    const nv = Purchases.save({ supplierName: 'Local Shop', billNo: 'L-1', date: '2025-08-21', items: [{ name: 'Nails', qty: 1, rate: 300 }], vatP: 0 });
    out.nv = nv;
    Purchases.del(nv.id);
    out.afterDel = { n: Purchases.getData().length, txns: STORE.get('pk3_payable_txns').length };
    out.events = events; out.dom = dom;
    try { Purchases.save({ supplierName: 'X', billNo: '1', items: [] }); } catch (e) { out.emptyErr = e.message; }
    try { Purchases.save({ supplierName: '', billNo: '1', items: [{ name: 'a', qty: 1, rate: 1 }] }); } catch (e) { out.noSup = e.message; }
    return out;
  });
  assert.equal(r.p.taxable, 10000);
  assert.equal(r.p.vatAmt, 1300);
  assert.equal(r.p.total, 11300);
  assert.equal(r.p.tdsAmt, 150, 'TDS on the amount before VAT');
  assert.equal(r.p.netPayable, 11150);
  assert.equal(r.p.dateBs, '2082-05-04');
  assert.equal(r.p.items[0].stockId, 's1', 'item linked to the Stock item with the same name');
  assert.equal(r.party.name, 'Shiva Plywood');
  assert.equal(r.party.pan, '609988776', 'new Supplier खाता opened with PAN');
  assert.deepEqual(r.bal, { bills: 11150, paid: 5000, due: 6150 });
  assert.equal(r.db, 1, 'payment posted to Day Book');
  assert.equal(r.p2.total, 13560);
  assert.deepEqual(r.bal2, { bills: 13560, paid: 0, due: 13560 }, 'edit replaces the old Supplier entries');
  assert.equal(r.db2, 0, 'old payment removed from Day Book');
  assert.equal(r.parties, 1, 'same supplier is reused');
  assert.ok(r.tagged);
  assert.equal(r.nv.vatAmt, 0);
  assert.equal(r.nv.nonTaxable, 300);
  assert.equal(r.nv.taxable, 0);
  assert.deepEqual(r.afterDel, { n: 1, txns: 1 });
  assert.deepEqual(r.events, ['create:s1', 'update:s1', 'create:', 'delete:']);
  assert.deepEqual(r.dom, ['create', 'update', 'create', 'delete']);
  assert.ok(r.emptyErr && r.noSup);

  // UI: page, form, live sums, save
  await page.evaluate(() => App.navigate('purchases'));
  assert.equal(await page.locator('#pur-list [data-pur]').count(), 1);
  await page.click('#pur-new');
  await page.waitForSelector('#pur-modal.open');
  await page.fill('#pur-sup', 'Shiva Plywood');
  await page.dispatchEvent('#pur-sup', 'change');
  assert.equal(await page.inputValue('#pur-pan'), '609988776', 'PAN filled from Supplier खाता');
  await page.fill('#pur-billno', 'SP-102');
  await page.fill('[data-pr="name-0"]', 'Hinges');
  await page.fill('[data-pr="qty-0"]', '4');
  await page.fill('[data-pr="rate-0"]', '500');
  await page.selectOption('#pur-tds-type', 'contract');
  assert.equal(await page.inputValue('#pur-tdsp'), '1.5');
  assert.equal(await page.textContent('[data-pur-vat]'), 'Rs. 260');
  assert.equal(await page.textContent('[data-pur-total]'), 'Rs. 2,260');
  assert.equal(await page.textContent('[data-pur-tds]'), 'Rs. 30');
  await page.click('#pur-save');
  await page.waitForSelector('#pur-modal.open', { state: 'hidden' });
  assert.equal(await page.locator('#pur-list [data-pur]').count(), 2);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('📒 Sales Book + Purchase Book + Net VAT export (CSV + Excel), no double count', async () => {
  const inv = [
    { id: 'i1', invNum: 'INV-1', billType: 'tax', custId: 'c1', custName: 'राम बहादुर', custPan: '301122334', date: '2025-08-20', dateBs: '2082-05-04', subtotal: 10000, discAmt: 0, taxP: 13, taxAmt: 1300, amount: 11300, paid: 0, balance: 11300, status: 'Pending' },
    { id: 'i2', invNum: 'INV-2', billType: 'abbr', custName: 'Walk-in', date: '2025-08-21', dateBs: '2082-05-05', subtotal: 500, taxP: 13, taxAmt: 65, amount: 565, paid: 565, balance: 0, status: 'Paid' },
    { id: 'i3', invNum: 'INV-3', custName: 'Hari', date: '2025-08-22', dateBs: '2082-05-06', subtotal: 2000, taxP: 0, taxAmt: 0, amount: 2000, paid: 0, balance: 0, status: 'Cancelled', cancelled: { reason: 'गल्ती' } },
    { id: 'i4', invNum: 'INV-4', custName: 'Gita', date: '2025-08-23', dateBs: '2082-05-07', subtotal: 1000, taxP: 0, taxAmt: 0, amount: 1000, paid: 1000, balance: 0, status: 'Paid' },
  ];
  // an old supplier bill entered straight in Payables (v7.0) + one Purchase Bill
  const parties = [{ id: 'py1', name: 'Old Supplier', kind: 'supplier', pan: '600000001' }];
  const txns = [{ id: 'pt1', partyId: 'py1', type: 'bill', amount: 2260, vat: 260, billNo: 'OS-9', date: '2025-08-25', dateBs: '2082-05-09' }];
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: { ...EXISTING, pk3_invoices: J(inv), pk3_payables: J(parties), pk3_payable_txns: J(txns), pk3_customers: J([{ id: 'c1', name: 'राम बहादुर' }]) } });
  const r = await page.evaluate(() => {
    Purchases.save({ supplierName: 'Shiva Plywood', supplierPan: '609988776', billNo: 'SP-1', date: '2025-08-20', items: [{ name: 'Ply', qty: 10, rate: 1000 }], vatP: 13, tdsP: 1.5, tdsType: 'service' });
    const p = { kind: 'month', y: 2082, m: 5 };
    return { sb: CAExport.salesBook(p), pb: CAExport.purchaseBook(p), nv: CAExport.netVat(p), vs: CAExport.vatSummary(p), csv: CAExport.toCSV(CAExport.salesBook(p), 'Sales Book') };
  });
  assert.equal(r.sb.length, 6, 'header + 4 invoices + total');
  assert.deepEqual(r.sb[1].slice(2, 11), ['INV-1', 'Tax Invoice', 'राम बहादुर', '301122334', 11300, 0, 10000, 13, 1300]);
  assert.equal(r.sb[2][3], 'Abbreviated');
  assert.match(r.sb[3][11], /^CANCELLED/);
  assert.equal(r.sb[3][6], 0);
  assert.deepEqual(r.sb[4].slice(6, 9), [1000, 1000, 0], 'non-VAT sale goes to the non-taxable column');
  assert.deepEqual(r.sb[5].slice(4, 11), ['जम्मा / TOTAL', '', 12865, 1000, 10500, '', 1365]);
  assert.equal(r.pb.length, 4, 'header + purchase bill + old supplier bill + total');
  const pbill = r.pb.find((x) => x[2] === 'SP-1'), old = r.pb.find((x) => x[2] === 'OS-9');
  assert.deepEqual(pbill.slice(3, 13), ['Shiva Plywood', '609988776', 11300, 0, 10000, 13, 1300, 1.5, 150, 11150]);
  assert.deepEqual(old.slice(5, 10), [2260, 0, 2000, 13, 260]);
  assert.deepEqual(r.pb[3].slice(5, 13), [13560, 0, 12000, '', 1560, '', 150, 13410]);
  const nv = Object.fromEntries(r.nv);
  assert.equal(nv['Output VAT (बिक्रीमा VAT)'], 1365);
  assert.equal(nv['Input VAT (खरिदमा VAT)'], 1560);
  assert.equal(nv['Net VAT (Output − Input)'], -195);
  assert.equal(nv['मिलान गर्न बाँकी VAT (Credit) / VAT credit'], 195);
  assert.equal(nv['TDS कट्टी (खरिदमा) / TDS withheld'], 150);
  assert.equal(nv['PAN / VAT No.'], '601234567');
  const vs = Object.fromEntries(r.vs);
  assert.equal(vs['Input VAT (खरिदमा VAT — बिलमा लेखिएको)'], 1560, 'VAT Summary: purchase bill counted once');
  assert.equal(r.csv.charCodeAt(0), 0xfeff);
  // real downloads from the Reports page
  await page.evaluate(() => App.navigate('dailyreport'));
  await page.waitForSelector('#ca-vat-books');
  await page.selectOption('#ca-year', '2082');
  await page.selectOption('#ca-month', '5');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=📘 Purchase Book CSV')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  assert.match(csv, /Shiva Plywood,609988776,11300,0,10000,13,1300,1\.5,150,11150,Purchase Bill/);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('text=📗 Sales + Purchase Book + Net VAT (Excel)')]);
  const x = fs.readFileSync(await dl2.path(), 'utf8');
  assert.equal((x.match(/<Worksheet /g) || []).length, 3);
  assert.match(x, /ss:Name="Sales Book"/);
  assert.match(x, /ss:Name="Net VAT"/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('VAT work never claims IRD certification / CBMS', () => {
  const src = ['js/modules/tax-invoice.js', 'js/modules/purchase.js', 'js/modules/ca-export.js', 'js/modules/doc-print.js'].map((f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(src, /IRD|CBMS|certified/i);
  assert.ok(appSource().includes('js/modules/purchase.js'));
});
