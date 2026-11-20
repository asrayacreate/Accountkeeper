// v7.0.0 stages 2 + 3: Payables, Sq.ft measurement, CA/VAT export, compressed photos,
// cloud-sync adapters (Google Drive) and the commercial license hook.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startServer, launch, loggedIn, openApp, J, LICENSED } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const EXISTING = { pk3_data_version: '5', pk3_settings: J({ companyName: 'Test Builders Pvt Ltd', phone1: '9800000000', pan: '601234567' }), pk3_business: J({ type: 'construction', setupDone: true }), pk3_v7_migrated: '1' };

test('Supplier / मिस्त्री payables: bills, payments, balance, project cost (no double count)', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: { ...EXISTING, pk3_projects: J([{ id: 'pj1', name: 'Ram ko Ghar', budget: 100000, stage: 'Work Running', progress: 50 }]) } });
  const r = await page.evaluate(() => {
    const sup = Payables.saveParty({ name: 'Shiva Plywood', kind: 'supplier', work: 'Plywood' });
    const mis = Payables.saveParty({ name: 'Hari Mistri', kind: 'mistri', work: 'Carpentry' });
    Payables.addTxn({ partyId: sup.id, type: 'bill', amount: 10000, projectId: 'pj1', billNo: 'B-1', vat: 1150 });
    const pay = Payables.addTxn({ partyId: sup.id, type: 'payment', amount: 4000, projectId: 'pj1' });
    Payables.addTxn({ partyId: mis.id, type: 'payment', amount: 2500 }, { toDayBook: false });
    const st = Projects.stats(Projects.get('pj1'));
    const db = STORE.get('pk3_daybook');
    const out = { bal: Payables.balance(sup.id), misBal: Payables.balance(mis.id), tot: Payables.totals(), expense: st.expense, supplierBills: st.supplierBills, dbLen: db.length, db0: db[0] };
    Payables.delTxn(pay.id);
    out.afterDel = { bal: Payables.balance(sup.id).due, dbLen: STORE.get('pk3_daybook').length };
    try { Payables.addTxn({ partyId: sup.id, type: 'bill', amount: 0 }); } catch (e) { out.zeroErr = e.message; }
    return out;
  });
  assert.deepEqual(r.bal, { bills: 10000, paid: 4000, due: 6000 });
  assert.equal(r.misBal.due, -2500, 'advance to मिस्त्री shows as negative due');
  assert.equal(r.tot.due, 3500);
  assert.equal(r.expense, 10000, 'bill counted once, its payment is not counted again');
  assert.equal(r.supplierBills, 10000);
  assert.equal(r.dbLen, 1, 'only the payment that asked for Day Book was posted');
  assert.equal(r.db0.type, 'expense');
  assert.equal(r.db0.amount, 4000);
  assert.ok(r.db0._payable && r.db0.voucherNo);
  assert.deepEqual(r.afterDel, { bal: 10000, dbLen: 0 });
  assert.ok(r.zeroErr);
  // UI
  await page.evaluate(() => App.navigate('payables'));
  assert.equal(await page.locator('#pay-list .pay-card').count(), 2);
  await page.click('[data-party] >> nth=0');
  await page.waitForSelector('#pay-modal.open');
  await page.fill('#pay-t-amount', '1500');
  await page.selectOption('#pay-t-type', 'payment');
  await page.click('#pay-t-save');
  assert.match(await page.textContent('#pay-v-due'), /8,500|1,000/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('📏 Sq.ft measurement adds a quotation item from the Rate List', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: { ...EXISTING, pk3_rates: J({ Windows: [{ name: 'UPVC Window', rate: 1200, unit: 'sqft' }] }) } });
  const ft = await page.evaluate(() => [Measure.toFeet("5'6"), Measure.toFeet('5 6'), Measure.toFeet('66', 'in'), Measure.toFeet('66in'), Measure.toFeet('4'), Measure.toFeet('abc')]);
  assert.deepEqual(ft, [5.5, 5.5, 5.5, 5.5, 4, 0]);
  await page.evaluate(() => App.navigate('add-quotation'));
  assert.ok(await page.isVisible('#q-measure-btn'));
  await page.click('#q-measure-btn');
  await page.selectOption('#ms-item', '0');
  await page.fill('[data-ms="l-0"]', "5'6");
  await page.fill('[data-ms="w-0"]', '4');
  await page.fill('[data-ms="qty-0"]', '3');
  await page.evaluate(() => Measure.addLine());
  await page.fill('[data-ms="l-1"]', '48');
  await page.fill('[data-ms="w-1"]', '36');
  await page.selectOption('[data-ms="unit-1"]', 'in');
  assert.equal(await page.textContent('#ms-total'), '78');          // 5.5×4×3=66 + 4×3=12
  await page.click('#ms-add');
  const rows = await page.evaluate(() => Quotations._rows);
  const row = rows[rows.length - 1];
  assert.equal(row.qty, 78);
  assert.equal(row.unit, 'sqft');
  assert.equal(row.rate, 1200);
  assert.equal(row.amount, 93600);
  assert.match(row.name, /^UPVC Window \(/);
  // Module Off → button hidden
  await page.evaluate(() => Modules.set('measurement', false));
  assert.equal(await page.isVisible('#q-measure-btn'), false);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('📊 CA / VAT export: month + fiscal year, BS & AD dates, PAN, UTF-8 BOM CSV and Excel', async () => {
  const inv = [
    { id: 'i1', invNum: 'INV-1', custId: 'c1', custName: 'राम बहादुर', date: '2025-08-20', dateBs: '2082-05-04', subtotal: 10000, discAmt: 0, taxP: 13, taxAmt: 1300, amount: 11300, paid: 5000, balance: 6300, status: 'Pending' },
    { id: 'i2', invNum: 'INV-2', custId: 'c1', custName: 'राम बहादुर', date: '2025-06-10', dateBs: '2082-02-27', subtotal: 5000, taxP: 0, taxAmt: 0, amount: 5000, paid: 5000, balance: 0, status: 'Paid' },
  ];
  const db = [{ id: 'd1', type: 'expense', amount: 2000, desc: 'सिमेन्ट', cat: 'Material', date: '2025-08-25', dateBs: '2082-05-09', voucherNo: 'PV-1' },
    { id: 'd2', type: 'income', amount: 999, desc: 'x', date: '2025-08-25', dateBs: '2082-05-09' }];
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: { ...EXISTING, pk3_invoices: J(inv), pk3_daybook: J(db), pk3_customers: J([{ id: 'c1', name: 'राम बहादुर', pan: '301122334' }]) } });
  const r = await page.evaluate(() => ({
    month: CAExport.salesRegister({ kind: 'month', y: 2082, m: 5 }),
    fy: CAExport.salesRegister({ kind: 'fy', y: 2082 }),
    fyPrev: CAExport.salesRegister({ kind: 'fy', y: 2081 }),
    exp: CAExport.expenseRegister({ kind: 'month', y: 2082, m: 5 }),
    vat: CAExport.vatSummary({ kind: 'month', y: 2082, m: 5 }),
    csv: CAExport.toCSV(CAExport.salesRegister({ kind: 'month', y: 2082, m: 5 }), 'Sales Register'),
    xls: CAExport.toExcel([{ name: 'A', rows: [['x', 1]] }, { name: 'B', rows: [['y']] }]),
  }));
  assert.equal(r.month.length, 2, 'only Bhadra 2082 invoice');
  assert.deepEqual(r.month[1].slice(0, 5), ['2082-05-04', '2025-08-20', 'INV-1', 'राम बहादुर', '301122334']);
  assert.equal(r.month[1][10], 1300);
  assert.equal(r.fy.length, 2, 'Jestha 2082 belongs to FY 2081/082');
  assert.equal(r.fyPrev.length, 2);
  assert.equal(r.exp.length, 2);
  assert.equal(r.exp[1][9], 2000);
  assert.ok(r.vat.some((x) => x[0].startsWith('Output VAT') && x[1] === 1300));
  assert.ok(r.vat.some((x) => x[0] === 'PAN / VAT No.' && x[1] === '601234567'));
  assert.equal(r.csv.charCodeAt(0), 0xfeff, 'UTF-8 BOM');
  assert.match(r.csv, /Test Builders Pvt Ltd — PAN\/VAT: 601234567/);
  assert.equal((r.xls.match(/<Worksheet /g) || []).length, 2);
  // real download from the Reports page
  await page.evaluate(() => App.navigate('dailyreport'));
  await page.waitForSelector('#ca-kind');
  await page.selectOption('#ca-year', '2082');
  await page.selectOption('#ca-month', '5');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=🧾 Sales Register')]);
  const buf = fs.readFileSync(await dl.path());
  assert.deepEqual([...buf.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'file starts with UTF-8 BOM bytes');
  assert.match(buf.toString('utf8'), /राम बहादुर/);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('text=📗 सबै — Excel (.xls)')]);
  const x = fs.readFileSync(await dl2.path(), 'utf8');
  assert.equal((x.match(/<Worksheet /g) || []).length, 4);
  assert.match(dl2.suggestedFilename(), /\.xls$/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('📸 photos are compressed (≤800px, small), stored outside localStorage and included in backup', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: { ...EXISTING, pk3_projects: J([{ id: 'pj1', name: 'Site A', budget: 1000, stage: 'Design' }]) } });
  const r = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 3000; c.height = 2000;
    const x = c.getContext('2d');
    for (let i = 0; i < 4000; i++) { x.fillStyle = `hsl(${i % 360},70%,${30 + (i % 40)}%)`; x.fillRect(Math.random() * 3000, Math.random() * 2000, 60, 60); }
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    const file = new File([blob], 'site.png', { type: 'image/png' });
    const rec = await Media.addFile(file, { kind: 'site-before', owner: 'pj1' });
    Projects.attachPhotos('pj1', 'before', [rec]);
    const back = await Media.get(rec.id);
    let captured = null; const orig = window.downloadFile; window.downloadFile = (n, d) => { captured = JSON.parse(d); };
    Backup.exportJSON();
    for (let i = 0; i < 40 && !captured; i++) await new Promise((res) => setTimeout(res, 50));
    window.downloadFile = orig;
    const lsSize = JSON.stringify(localStorage).length;
    return { orig: blob.size, w: rec.w, h: rec.h, bytes: rec.bytes, type: rec.type, same: back && back.dataUrl === rec.dataUrl, proj: Projects.get('pj1').photos, inBackup: !!(captured && captured._media && captured._media[rec.id]), meta: captured && captured._meta, lsSize };
  });
  assert.equal(r.w, 800);
  assert.equal(r.h, 533);
  assert.ok(r.bytes <= 125 * 1024, 'compressed to ~120KB or less, got ' + r.bytes);
  assert.ok(r.bytes < r.orig / 3);
  assert.match(r.type, /image\/(webp|jpeg)/);
  assert.ok(r.same);
  assert.equal(r.proj[0].kind, 'before');
  assert.ok(r.inBackup, 'photo inside backup .json');
  assert.equal(r.meta.version, '7.0.0');
  assert.ok(r.lsSize < 60000, 'photo not stored in localStorage');
  // the project view shows the thumbnail
  await page.evaluate(() => Projects.view('pj1'));
  await page.waitForFunction(() => { const i = document.querySelector('#view-modal-body img[data-media-id]'); return i && i.src.startsWith('data:image'); });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('☁️ Google Drive adapter: PKCE connect, upload to appDataFolder, restore; Dropbox untouched', async () => {
  const calls = [];
  let stored = null, version = 0;
  const mock = async (page) => {
    await page.route('https://oauth2.googleapis.com/**', (r) => { calls.push(['token', r.request().postData()]); r.fulfill({ json: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 } }); });
    await page.route('https://www.googleapis.com/**', (r) => {
      const u = new URL(r.request().url()), m = r.request().method();
      calls.push([m, u.pathname + u.search]);
      if (u.pathname === '/drive/v3/files' && m === 'GET') return r.fulfill({ json: { files: stored ? [{ id: 'F1', version: String(version) }] : [] } });
      if (u.pathname.startsWith('/upload/drive/v3/files')) { const body = r.request().postData(); stored = body.slice(body.indexOf('{"app":"swagatik"'), body.lastIndexOf('}') + 1); version++; return r.fulfill({ json: { id: 'F1', version: String(version) } }); }
      if (u.pathname === '/drive/v3/files/F1' && u.searchParams.get('alt') === 'media') return r.fulfill({ body: stored, contentType: 'application/json' });
      r.fulfill({ status: 404, body: '' });
    });
  };
  const { page, errors, ctx } = await loggedIn({ base, browser, mock, storage: { ...EXISTING, pk3_customers: J([{ id: 'c1', name: 'Gita' }]), pk3_dbx_auth: J({ refresh: 'DBX' }) } });
  await page.evaluate(() => App.navigate('settings'));
  await page.fill('#gdrive-client-id', '123-abc.apps.googleusercontent.com');
  await page.evaluate(() => GDrive.saveConfig());
  assert.ok(await page.isVisible('#gdrive-btn-connect'));
  const url = await page.evaluate(() => GDriveProvider.authUrl());
  assert.match(url, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
  assert.match(url, /code_challenge_method=S256/);
  assert.match(url, /drive\.appdata/);
  assert.match(url, /state=gdrive/);
  // Google sends the user back with ?code=…&state=gdrive
  await page.goto(base + '/index.html?code=XYZ&state=gdrive');
  await page.waitForFunction(() => typeof GDriveProvider !== 'undefined' && GDriveProvider.isConnected(), null, { timeout: 8000 });
  await page.waitForFunction(() => GDrive.meta().rev, null, { timeout: 8000 });
  assert.match(calls.find((c) => c[0] === 'token')[1], /code_verifier=/);
  assert.ok(calls.some((c) => c[0] === 'POST' && /uploadType=multipart/.test(c[1])), 'first backup created in Drive');
  const payload = JSON.parse(stored);
  assert.ok(payload.data.pk3_customers.includes('Gita'));
  assert.ok(!Object.keys(payload.data).some((k) => /pk3_gdrive_|pk3_dbx_|pk3_session/.test(k)), 'tokens never uploaded');
  assert.equal(await page.evaluate(() => !!(STORE.get('pk3_dbx_auth') || {}).refresh), true, 'Dropbox connection untouched');
  assert.equal(await page.evaluate(() => Object.keys(DBX.collect()).some((k) => k.startsWith('pk3_gdrive_'))), false, 'Drive tokens not sent to Dropbox');
  // restore from Drive
  await page.evaluate(() => { STORE.set('pk3_customers', []); GDrive._reload = () => {}; });
  assert.equal(await page.evaluate(() => GDrive.pull()), true);
  assert.equal(await page.evaluate(() => STORE.get('pk3_customers')[0].name), 'Gita');
  assert.ok(await page.evaluate(() => SyncHub.list().map((x) => x.id).join(',')).then((s) => /gdrive/.test(s) && /dropbox/.test(s) && /supa/.test(s)));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('🔐 commercial license hook: server keys activate, refusals explained, offline keys unchanged', async () => {
  let reply = { ok: true, reason: null, plan: 'PRO', company: 'Ram Traders', expires_at: '2099-01-01T00:00:00Z', device_limit: 2, devices_used: 1 };
  const rpc = [];
  const mock = async (page) => {
    await page.route('https://lic.example.supabase.co/**', (r) => { rpc.push([new URL(r.request().url()).pathname, JSON.parse(r.request().postData())]); r.fulfill({ json: [reply] }); });
    await page.addInitScript(() => { window.__licCloud = true; });
  };
  const { page, errors, ctx } = await openApp({ base, browser, mock, storage: { pk3_sample_seeded: '1' } });
  assert.equal(await page.evaluate(() => LicenseCloud.enabled()), false, 'off by default');
  await page.evaluate(() => { LICENSE_CLOUD.enabled = true; LICENSE_CLOUD.url = 'https://lic.example.supabase.co'; LICENSE_CLOUD.anonKey = 'anon'; });
  await page.waitForSelector('#license-screen', { state: 'visible' });
  // refused: device limit
  reply = { ok: false, reason: 'device_limit' };
  await page.fill('#license-company', 'Ram Traders');
  await page.fill('#license-key', 'SWG-AAAA-BBBB-CCCC');
  await page.evaluate(() => License.activate());
  await page.waitForFunction(() => /Device सीमा/.test(document.getElementById('license-err').textContent));
  assert.equal(await page.evaluate(() => License.isActivated()), false);
  // accepted
  reply = { ok: true, reason: null, plan: 'PRO', company: 'Ram Traders', expires_at: '2099-01-01T00:00:00Z', device_limit: 2, devices_used: 1 };
  await page.evaluate(() => License.activate());
  await page.waitForFunction(() => License.isActivated());
  const st = await page.evaluate(() => ({ s: License.status(), co: STORE.get('pk3_settings').companyName, dev: localStorage.getItem('pk3_device_id') }));
  assert.equal(st.s.plan, 'PRO');
  assert.equal(st.s.company, 'Ram Traders');
  assert.equal(st.co, 'Ram Traders');
  assert.match(st.dev, /^dev_[0-9a-f]{32}$/);
  assert.equal(rpc[0][0], '/rest/v1/rpc/activate_license');
  assert.equal(rpc[0][1].p_key, 'SWG-AAAA-BBBB-CCCC');
  assert.equal(rpc[0][1].p_device_id, st.dev);
  // a tampered stored record is not trusted
  assert.equal(await page.evaluate(() => { const r = License._load(); r.expiry = null; localStorage.setItem('pk3_license', JSON.stringify(r)); localStorage.removeItem('pk3_lic_backup'); localStorage.removeItem('prerak_activation'); sessionStorage.clear(); return License.isActivated(); }), false);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('existing master-key devices still activate offline with the cloud hook present', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage: LICENSED });
  assert.equal(await page.evaluate(() => License.isActivated() && License.status().plan), 'MASTER');
  await ctx.close();
});
