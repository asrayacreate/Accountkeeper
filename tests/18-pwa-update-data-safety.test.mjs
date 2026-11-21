// v7.3.0 item 3 — smart PWA update notice + data safety:
//  • a new sw.js waits; the app shows "नयाँ अपडेट उपलब्ध छ — रिफ्रेश गर्नुहोस्" and activates it only on tap
//  • localStorage nearly full → Dashboard warning (75% warn / 90% critical) + Backup page meter;
//    a failed save is reported at once (and the auto-save duplicate is dropped to make room)
//  • Backup Restore: summary confirmation, safety copy (IndexedDB), rollback on failure, Undo
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, loggedIn, J, LICENSED, SESSION_OLD } from './helpers.mjs';

let srv, base, browser;
let swVersion = null;   // when set, the server serves sw.js with this APP_VERSION (a "new release")
before(async () => {
  ({ srv, base } = await startServer({
    transform: (p, text) => (p === '/sw.js' && swVersion ? text.replace(/var APP_VERSION = '[\d.]+';/, `var APP_VERSION = '${swVersion}';`) + '\n// test build ' + swVersion : undefined),
  }));
  browser = await launch();
});
after(async () => { await browser.close(); srv.close(); });

const customers = (n) => J(Array.from({ length: n }, (_, i) => ({ id: 'c' + i, name: 'Customer ' + i, phone: '98000000' + String(i).padStart(2, '0') })));
const shown = (page, id) => page.evaluate((id) => { const b = document.getElementById(id); return !!(b && b.style.display !== 'none' && b.innerHTML.trim()); }, id);

// ── 1. PWA update banner (real service worker) ──
async function swApp() {
  const ctx = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  page.on('dialog', (d) => d.accept());
  await page.route((url) => !url.href.startsWith(base), (r) => r.abort());
  await page.goto(base + '/manifest.json');
  await page.evaluate((st) => { localStorage.clear(); for (const k in st) localStorage.setItem(k, st[k]); }, { ...LICENSED, ...SESSION_OLD, pk3_customers: customers(2) });
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 });
  await page.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser);
  return { ctx, page, errors };
}
const controllerVersion = (page) => page.evaluate(() => new Promise((res) => {
  const ch = new MessageChannel();
  ch.port1.onmessage = (e) => res(e.data.version);
  navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [ch.port2]);
  setTimeout(() => res(null), 3000);
}));

test('PWA: first install activates at once; a new version waits and shows the refresh banner', async () => {
  swVersion = null;
  const { ctx, page, errors } = await swApp();
  const appVer = await page.evaluate(() => APP_VERSION);
  assert.equal(await controllerVersion(page), appVer, 'first install controls the page right away');
  assert.equal(await page.isVisible('#sw-update-banner'), false, 'no banner without an update');

  swVersion = '99.0.0';
  await page.evaluate(() => SwUpdate.check());
  await page.waitForSelector('#sw-update-banner', { state: 'visible', timeout: 15000 });
  const txt = await page.innerText('#sw-update-banner');
  assert.match(txt, /नयाँ अपडेट उपलब्ध छ/);
  assert.match(txt, /रिफ्रेश गर्नुहोस्/);
  assert.match(txt, /v99\.0\.0/);
  assert.equal(await controllerVersion(page), appVer, 'the new version waits — no surprise reload');
  assert.equal(await page.evaluate(() => !!SwUpdate._reg.waiting), true);

  // "✕" hides it for now
  await page.click('#sw-update-later');
  assert.equal(await page.isVisible('#sw-update-banner'), false);
  await page.evaluate(() => { SwUpdate._dismissed = false; SwUpdate.show('99.0.0'); });

  // tap "रिफ्रेश" → the new worker takes over and the page reloads once; data untouched
  await Promise.all([page.waitForEvent('load', { timeout: 15000 }), page.click('#sw-update-refresh')]);
  await page.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && navigator.serviceWorker.controller);
  assert.equal(await controllerVersion(page), '99.0.0');
  assert.equal(await page.evaluate(() => STORE.get('pk3_customers', []).length), 2, 'data is safe after the update');
  assert.equal(await page.isVisible('#sw-update-banner').catch(() => false), false);
  assert.deepEqual(errors, []);
  swVersion = null;
  await ctx.close();
});

test('PWA: when the page is already the new version, the waiting worker activates silently (no banner)', async () => {
  swVersion = null;
  const { ctx, page, errors } = await swApp();
  const appVer = await page.evaluate(() => APP_VERSION);
  swVersion = appVer;   // same version, different file (e.g. after a normal reload the page is already new)
  await page.evaluate(() => SwUpdate.check());
  await page.waitForFunction(() => SwUpdate._reg && !SwUpdate._reg.waiting && !SwUpdate._reg.installing, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  assert.equal(await page.isVisible('#sw-update-banner'), false, 'no banner');
  assert.equal(await page.evaluate(() => SwUpdate._reloaded), false, 'no reload');
  assert.equal(await page.evaluate(() => document.getElementById('page-dashboard') !== null && typeof currentUser !== 'undefined' && !!currentUser), true);
  assert.deepEqual(errors, []);
  swVersion = null;
  await ctx.close();
});

test('PWA: sw.js keeps first-install skipWaiting and accepts SKIP_WAITING / GET_VERSION', async () => {
  const fs = await import('node:fs');
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /if \(!self\.registration\.active\) self\.skipWaiting\(\);/);
  assert.match(sw, /SKIP_WAITING/);
  assert.match(sw, /GET_VERSION/);
  assert.doesNotMatch(sw.replace(/if \(!self\.registration\.active\) self\.skipWaiting\(\);/, ''), /^\s*self\.skipWaiting\(\);/m, 'no unconditional skipWaiting on install');
});

// ── 2. Storage warning ──

test('Storage: 80% full → warning banner with backup + snooze; 95% → critical, cannot snooze; meter on Backup page', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: { pk3_customers: customers(3), lastBackup: J(new Date().toISOString()) } });
  await page.evaluate(() => App.navigate('dashboard'));
  assert.equal(await shown(page, 'storage-alert-dash'), false, 'plenty of room → no banner');

  // pretend this browser only holds a little more than the data → ~80% used
  await page.evaluate(() => {
    const used = StorageGuard.used(StorageGuard.QUOTA_KEY);
    localStorage.setItem(StorageGuard.QUOTA_KEY, JSON.stringify({ chars: Math.round(used / 0.8), at: Date.now() }));
    BackupAlert.render();
  });
  assert.equal(await page.evaluate(() => StorageGuard.status().level), 'warn');
  assert.equal(await shown(page, 'storage-alert-dash'), true);
  assert.match(await page.innerText('#storage-alert-msg'), /[०-९]+% भरिसक्यो.*Backup/);
  assert.ok(await page.$('#storage-alert-later'), 'warning can be snoozed');
  const dl = page.waitForEvent('download');
  await page.click('#storage-alert-backup');
  assert.match((await dl).suggestedFilename(), /^swagatik-backup-/);
  await page.click('#storage-alert-later');
  assert.equal(await shown(page, 'storage-alert-dash'), false, 'snoozed for a day');

  // 95% → critical: shows even while snoozed, no snooze button
  await page.evaluate(() => {
    const used = StorageGuard.used(StorageGuard.QUOTA_KEY);
    localStorage.setItem(StorageGuard.QUOTA_KEY, JSON.stringify({ chars: Math.round(used / 0.95), at: Date.now() }));
    BackupAlert.render();
  });
  assert.equal(await shown(page, 'storage-alert-dash'), true);
  assert.match(await page.innerText('#storage-alert-msg'), /भरियो!/);
  assert.equal(await page.isVisible('#storage-alert-later'), false);
  assert.equal(await page.evaluate(() => document.querySelector('.storage-alert').classList.contains('storage-crit')), true);

  // Backup page meter lists usage and the biggest parts
  await page.evaluate(() => App.navigate('backup'));
  assert.match(await page.innerText('#storage-sum'), /% प्रयोग भयो — [\d.]+ MB \/ [\d.]+ MB/);
  assert.match(await page.innerText('#storage-meter'), /ग्राहक|Auto-save/);
  // the settings are device-only, never synced / backed up
  assert.equal(await page.evaluate(() => Object.keys(SyncData.collect()).some((k) => /ls_quota|storage_snooze/.test(k))), false);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Storage: real quota is measured once; auto-save copy is skipped when space is short', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage: { pk3_customers: customers(3) } });
  const q = await page.evaluate(() => { localStorage.removeItem(StorageGuard.QUOTA_KEY); return StorageGuard.measure(true); });
  assert.ok(q > 1000000, 'measured quota looks real: ' + q);
  assert.equal(await page.evaluate(() => localStorage.getItem('__swagatik_quota_probe__')), null, 'probe removed');
  assert.equal(await page.evaluate(() => StorageGuard.quota()), q);

  // plenty of room → auto-save copy kept
  await page.evaluate(() => Backup.autoSave());
  assert.notEqual(await page.evaluate(() => localStorage.getItem('pk3_autosave_snapshot')), null);
  // tiny quota → the duplicate copy is dropped instead of eating the space
  await page.evaluate(() => { localStorage.setItem(StorageGuard.QUOTA_KEY, JSON.stringify({ chars: StorageGuard.used('pk3_autosave_snapshot') + 2000, at: Date.now() })); Backup.autoSave(); });
  assert.equal(await page.evaluate(() => localStorage.getItem('pk3_autosave_snapshot')), null);
  await ctx.close();
});

test('Storage: a save that hits the real quota is reported at once; the auto-save copy is freed first', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: { pk3_customers: customers(2) } });
  const r = await page.evaluate(() => {
    clearInterval(Backup._autoTimer);
    const quota = StorageGuard.measure(true);
    // fill: a big auto-save copy + filler until almost nothing is left
    const free = () => quota - StorageGuard.used();
    localStorage.setItem('pk3_autosave_snapshot', 'x'.repeat(300000));
    localStorage.setItem('pk3_filler', 'y'.repeat(Math.max(0, free() - 50000)));
    // 1) needs ~200k chars → succeeds only because the auto-save copy is dropped
    const ok1 = STORE.set('pk3_notes_big', 'z'.repeat(200000));
    const snapGone = localStorage.getItem('pk3_autosave_snapshot') === null;
    // 2) far too big → fails, user is told, error log records it, existing data untouched
    const ok2 = STORE.set('pk3_customers', [{ id: 'c0', name: 'Too big', note: 'q'.repeat(1500000) }]);
    const toast = [...document.querySelectorAll('#toast-container .toast')].map((t) => t.textContent).join(' | ');
    const log = (ErrorLog.list ? ErrorLog.list() : JSON.parse(localStorage.getItem('swagatik_error_log') || '[]')).map((e) => e.msg || e.message).join(' | ');
    const cust = STORE.get('pk3_customers', []).length;
    localStorage.removeItem('pk3_filler'); localStorage.removeItem('pk3_notes_big');
    return { ok1, snapGone, ok2, toast, log, cust };
  });
  assert.equal(r.ok1, true);
  assert.equal(r.snapGone, true);
  assert.equal(r.ok2, false);
  assert.match(r.toast, /डाटा भण्डार भरियो/);
  assert.match(r.log, /Save असफल \(pk3_customers\)/);
  assert.equal(r.cust, 2, 'old data still there');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// ── 3. Safe Backup Restore ──
const backupFile = (n) => ({
  pk3_customers: Array.from({ length: n }, (_, i) => ({ id: 'b' + i, name: 'Backup Cust ' + i, phone: '98111111' + String(i).padStart(2, '0') })),
  pk3_quotations: [], pk3_invoices: [],
  _meta: { version: '7.2.0', date: '2026-11-01' },
});
async function restoreApp(n) {
  const r = await loggedIn({ base, browser, storage: { pk3_customers: customers(n), pk3_invoices: J([{ id: 'i1', no: 'INV-1', total: 100 }]) } });
  r.dialogs = [];
  r.page.on('dialog', (d) => r.dialogs.push(d.message()));
  await r.page.evaluate(() => { Backup._reload = () => { window.__reloaded = (window.__reloaded || 0) + 1; }; RestoreGuard._reload = Backup._reload; });
  return r;
}

test('Restore: summary confirmation → safety copy in IndexedDB → data replaced; license and login kept', async () => {
  const { page, errors, ctx, dialogs } = await restoreApp(3);
  await page.evaluate(() => App.navigate('backup'));
  const lic = await page.evaluate(() => JSON.parse(localStorage.getItem('pk3_license')).key);
  await page.setInputFiles('#backup-restore-file', { name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backupFile(1))) });
  await page.waitForFunction(() => window.__reloaded === 1, null, { timeout: 5000 });

  const msg = dialogs.find((m) => /Backup Restore गर्ने/.test(m));
  assert.ok(msg, 'restore asks first');
  assert.match(msg, /Backup मिति: 2026-11-01/);
  assert.match(msg, /ग्राहक: Backup मा १ \| अहिले ३/);
  assert.match(msg, /बिल: Backup मा ० \| अहिले १/);
  assert.match(msg, /अहिलेभन्दा कम ग्राहक, बिल/);
  assert.match(msg, /सुरक्षा कपी/);

  const r = await page.evaluate(async () => {
    const s = await RestoreGuard.latest();
    return {
      now: STORE.get('pk3_customers', []).map((c) => c.name),
      snapCust: JSON.parse(s.data.pk3_customers).length, snapInv: JSON.parse(s.data.pk3_invoices).length,
      reason: s.reason, hasSession: 'pk3_session' in s.data, hasLicense: 'pk3_license' in s.data,
      lic: JSON.parse(localStorage.getItem('pk3_license')).key, session: !!localStorage.getItem('pk3_session'),
    };
  });
  assert.deepEqual(r.now, ['Backup Cust 0']);
  assert.equal(r.snapCust, 3);
  assert.equal(r.snapInv, 1);
  assert.match(r.reason, /Backup Restore \(old\.json\)/);
  assert.equal(r.hasSession, false, 'login session is never in a safety copy');
  assert.equal(r.hasLicense, false);
  assert.equal(r.lic, lic, 'license untouched');
  assert.equal(r.session, true);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Restore: "Cancel" changes nothing; backup from a newer app version is flagged', async () => {
  const { page, ctx } = await restoreApp(2);
  const r = await page.evaluate(async (bk) => {
    let asked = '';
    window.confirm = (m) => { asked = m; return false; };
    bk._meta.version = '99.1.0';
    const ok = await Backup.restoreData(bk, 'x.json');
    return { ok, asked, n: STORE.get('pk3_customers', []).length, snap: await RestoreGuard.latest() };
  }, backupFile(5));
  assert.equal(r.ok, false);
  assert.equal(r.n, 2);
  assert.equal(r.snap, null, 'no safety copy needed when cancelled');
  assert.match(r.asked, /नयाँ version \(v99\.1\.0\)/);
  await ctx.close();
});

test('Restore: a write that fails half-way rolls everything back (no half-restored data)', async () => {
  const { page, errors, ctx } = await restoreApp(3);
  const r = await page.evaluate(async () => {
    clearInterval(Backup._autoTimer);
    const quota = StorageGuard.measure(true);
    const bk = {
      pk3_customers: [{ id: 'n1', name: 'New' }], pk3_quotations: [{ id: 'q1' }],
      pk3_zz_huge: 'h'.repeat(quota + 200000),   // can never fit
      _meta: { date: '2026-11-02' },
    };
    const before = { c: localStorage.getItem('pk3_customers'), q: localStorage.getItem('pk3_quotations') };
    const ok = await Backup.restoreData(bk, 'huge.json');
    const toast = [...document.querySelectorAll('#toast-container .toast')].map((t) => t.textContent).join(' | ');
    return { ok, sameC: localStorage.getItem('pk3_customers') === before.c, sameQ: localStorage.getItem('pk3_quotations') === before.q,
      huge: localStorage.getItem('pk3_zz_huge'), toast, reloaded: window.__reloaded || 0 };
  });
  assert.equal(r.ok, false);
  assert.equal(r.sameC, true, 'customers rolled back');
  assert.equal(r.sameQ, true, 'quotations rolled back');
  assert.equal(r.huge, null);
  assert.match(r.toast, /Restore पूरा हुन सकेन/);
  assert.equal(r.reloaded, 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Restore: "↩️ Restore अघिको डाटा फर्काउनुहोस्" puts the old data back (and can be undone again)', async () => {
  const { page, errors, ctx } = await restoreApp(4);
  await page.evaluate(async (bk) => { await Backup.restoreData(bk, 'one.json'); }, backupFile(1));
  assert.equal(await page.evaluate(() => STORE.get('pk3_customers', []).length), 1);
  await page.evaluate(() => App.navigate('backup'));
  await page.waitForSelector('#restore-undo-btn', { state: 'visible' });
  assert.match(await page.innerText('#restore-undo-info'), /Backup Restore \(one\.json\)/);
  await page.click('#restore-undo-btn');
  await page.waitForFunction(() => window.__reloaded === 2, null, { timeout: 5000 });
  const r = await page.evaluate(async () => {
    const l = await RestoreGuard._all();
    return { n: STORE.get('pk3_customers', []).length, inv: STORE.get('pk3_invoices', []).length, latest: l[0].reason, latestCust: JSON.parse(l[0].data.pk3_customers).length, lic: !!localStorage.getItem('pk3_license') };
  });
  assert.equal(r.n, 4, 'customers back');
  assert.equal(r.inv, 1, 'invoices back');
  assert.equal(r.latest, 'Undo', 'the restored-from-backup state is itself kept, so undo can be undone');
  assert.equal(r.latestCust, 1);
  assert.equal(r.lic, true);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Restore: only the last 3 safety copies are kept; cloud Restore also saves one first', async () => {
  const { page, ctx } = await restoreApp(2);
  const r = await page.evaluate(async () => {
    for (let i = 0; i < 5; i++) await RestoreGuard.snapshot('t' + i);
    const count = (await RestoreGuard._all()).length;
    // cloud restore (fake provider) → snapshot before pull
    const payload = JSON.stringify({ app: 'swagatik', v: 1, data: { pk3_customers: JSON.stringify([{ id: 'x', name: 'Cloud' }]) } });
    const cs = new CloudSync({ id: 'fakecloud', label: 'FakeCloud', isConnected: () => true, isConfigured: () => true, remoteMeta: async () => ({ rev: 'r1' }), download: async () => payload });
    cs._reload = () => {};
    await cs.restoreNow();
    const l = await RestoreGuard._all();
    return { count, latest: l[0].reason, latestCust: JSON.parse(l[0].data.pk3_customers).length, now: STORE.get('pk3_customers', []).map((c) => c.name) };
  });
  assert.equal(r.count, 3);
  assert.equal(r.latest, 'FakeCloud Restore');
  assert.equal(r.latestCust, 2);
  assert.deepEqual(r.now, ['Cloud']);
  await ctx.close();
});
