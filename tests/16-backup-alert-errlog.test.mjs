// v7.2.0 item 4 — real-trial safety:
//  • Backup alert: Dashboard banner when no backup (file download OR Dropbox / Drive sync) for 7+ days.
//  • Error Log: window errors / unhandled rejections / console.error captured locally (size-capped),
//    Settings → "Error Log हेर्नुहोस् / Copy"; never synced, never inside the backup file.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, loggedIn, J } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const DAY = 24 * 60 * 60 * 1000;
const ago = (d) => new Date(Date.now() - d * DAY).toISOString();
const customers = J([{ id: 'c1', name: 'Gita Rai', phone: '9800000003', address: 'Dharan-2' }]);
const bannerShown = (page) => page.evaluate(() => {
  const b = document.getElementById('backup-alert-dash');
  return !!(b && b.style.display !== 'none' && b.querySelector('.backup-alert'));
});

test('no backup for 8 days → Dashboard banner; "अहिले Backup" downloads and hides it', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: { pk3_customers: customers, lastBackup: J(ago(8)) } });
  await page.evaluate(() => App.navigate('dashboard'));
  assert.equal(await bannerShown(page), true);
  const msg = await page.innerText('#backup-alert-msg');
  assert.match(msg, /८ दिनदेखि/);
  assert.match(msg, /Backup फाइल/);
  const dl = page.waitForEvent('download');
  await page.click('#backup-alert-now');
  const file = await dl;
  assert.match(file.suggestedFilename(), /^swagatik-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(await bannerShown(page), false);
  assert.ok(await page.evaluate(() => Date.now() - new Date(STORE.get('lastBackup')).getTime() < 60000));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('recent backup (3 days) → no banner', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: { pk3_customers: customers, lastBackup: J(ago(3)) } });
  await page.evaluate(() => App.navigate('dashboard'));
  assert.equal(await bannerShown(page), false);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Dropbox / Google Drive sync counts as a backup', async () => {
  const storage = { pk3_customers: customers, lastBackup: J(ago(30)), pk3_dbx_meta: J({ rev: 'r1', last: Date.now() - 2 * DAY }) };
  const { page, ctx } = await loggedIn({ base, browser, storage });
  await page.evaluate(() => App.navigate('dashboard'));
  assert.equal(await bannerShown(page), false, 'Dropbox synced 2 days ago');
  assert.equal(await page.evaluate(() => BackupAlert.last().id), 'dropbox');

  // Drive synced recently, Dropbox stale → still fine
  await page.evaluate((d) => {
    localStorage.setItem('pk3_dbx_meta', JSON.stringify({ last: Date.now() - 20 * d }));
    localStorage.setItem('pk3_gdrive_meta', JSON.stringify({ last: Date.now() - 1 * d }));
    BackupAlert.render();
  }, DAY);
  assert.equal(await bannerShown(page), false, 'Google Drive synced yesterday');

  // every source stale → banner names the latest one
  await page.evaluate((d) => { localStorage.setItem('pk3_gdrive_meta', JSON.stringify({ last: Date.now() - 9 * d })); BackupAlert.render(); }, DAY);
  assert.equal(await bannerShown(page), true);
  assert.match(await page.innerText('#backup-alert-msg'), /९ दिनदेखि.*Google Drive sync/);
  // Settings shows the latest backup of any kind
  await page.evaluate(() => App.navigate('settings'));
  assert.match(await page.innerText('#settings-last-backup'), /Google Drive sync/);
  await ctx.close();
});

test('"भोलि सम्झाउनुहोस्" hides the banner for a day on this device only', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage: { pk3_customers: customers, lastBackup: J(ago(10)) } });
  await page.evaluate(() => App.navigate('dashboard'));
  assert.equal(await bannerShown(page), true);
  await page.click('#backup-alert-later');
  assert.equal(await bannerShown(page), false);
  const r = await page.evaluate(() => ({
    hours: (parseInt(localStorage.getItem(BackupAlert.SNOOZE_KEY), 10) - Date.now()) / 3600000,
    inSync: Object.keys(SyncData.collect()).some((k) => /snooze|first_seen|error_log/.test(k)),
    tomorrow: BackupAlert.shouldShow(Date.now() + 25 * 3600000),
  }));
  assert.ok(r.hours > 23 && r.hours <= 24);
  assert.equal(r.inSync, false, 'device-only keys must never sync');
  assert.equal(r.tomorrow, true, 'reminder comes back after the snooze');
  await ctx.close();
});

test('never backed up: brand-new device is not nagged on day one, but is after 7 days', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage: { pk3_customers: customers } });
  await page.evaluate(() => App.navigate('dashboard'));
  assert.equal(await bannerShown(page), false);
  const r = await page.evaluate((d) => {
    const seen = parseInt(localStorage.getItem(BackupAlert.SEEN_KEY), 10);
    return { seen: Date.now() - seen < 60000, later: BackupAlert.status(seen + 7 * d) };
  }, DAY);
  assert.equal(r.seen, true);
  assert.equal(r.later.due, true);
  assert.equal(r.later.never, true);
  await page.evaluate((d) => { localStorage.setItem(BackupAlert.SEEN_KEY, String(Date.now() - 8 * d)); BackupAlert.render(); }, DAY);
  assert.equal(await bannerShown(page), true);
  assert.match(await page.innerText('#backup-alert-msg'), /अहिलेसम्म कुनै ब्याकअप भएको छैन/);
  await ctx.close();
});

test('staff users (no backup permission) never see the banner', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage: { pk3_customers: customers, lastBackup: J(ago(15)) } });
  const r = await page.evaluate(() => {
    const keep = currentUser.role; currentUser.role = 'staff';
    const s = BackupAlert.shouldShow(); currentUser.role = keep;
    return { staff: s, admin: BackupAlert.shouldShow() };
  });
  assert.deepEqual(r, { staff: false, admin: true });
  await ctx.close();
});

test('Error Log captures window errors, promise rejections and console.error — local only, size-capped', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage: { pk3_customers: customers, lastBackup: J(ago(1)) } });
  await page.evaluate(() => {
    ErrorLog.clear();
    setTimeout(() => { null.boom; }, 0);
    Promise.reject(new Error('promise-fail-xyz'));
    console.error('console-fail-abc', { code: 42 });
    console.warn('Settings render error:', new TypeError('hidden-warn-bug'));
    console.warn('just a harmless warning');
  });
  await page.waitForFunction(() => ErrorLog.count() >= 4);
  const r = await page.evaluate(() => ({ list: ErrorLog.list(), raw: localStorage.getItem(ErrorLog.KEY) }));
  const types = r.list.map((e) => e.type);
  assert.ok(types.includes('error'), 'window error');
  assert.ok(types.includes('promise'), 'unhandled rejection');
  assert.ok(types.includes('console'), 'console.error');
  assert.ok(types.includes('warn'), 'console.warn with Error object');
  assert.ok(r.list.some((e) => /null/.test(e.msg) && e.page === 'dashboard'));
  assert.ok(r.list.some((e) => /promise-fail-xyz/.test(e.msg)));
  assert.ok(r.list.some((e) => /console-fail-abc.*42/.test(e.msg)));
  assert.ok(!r.list.some((e) => /harmless/.test(e.msg)), 'plain warnings are not errors');
  assert.ok(r.list.every((e) => e.v && e.t));

  // never leaves the device: not in cloud sync payload, not in the backup .json
  const leak = await page.evaluate(() => JSON.stringify(SyncData.collect()).includes('promise-fail-xyz'));
  assert.equal(leak, false);
  const dl = page.waitForEvent('download');
  await page.evaluate(() => Backup.exportJSON());
  const fs = await import('node:fs');
  const body = fs.readFileSync(await (await dl).path(), 'utf8');
  assert.equal(body.includes('promise-fail-xyz'), false);

  // repeats collapse, total size stays capped
  await page.evaluate(() => {
    ErrorLog.clear();
    for (let i = 0; i < 5; i++) ErrorLog.add('error', 'same bug');
    for (let i = 0; i < 300; i++) ErrorLog.add('error', 'bug #' + i + ' ' + 'x'.repeat(2000), { stack: 'y'.repeat(5000) });
  });
  const cap = await page.evaluate(() => ({ n: ErrorLog.count(), bytes: localStorage.getItem(ErrorLog.KEY).length, first: ErrorLog.list()[0], last: ErrorLog.list().slice(-1)[0] }));
  assert.ok(cap.n <= 60, 'at most 60 entries, got ' + cap.n);
  assert.ok(cap.bytes <= 60000, 'at most ~60 KB, got ' + cap.bytes);
  assert.match(cap.last.msg, /^bug #299 /, 'newest kept');
  assert.ok(cap.last.msg.length <= 401 && cap.last.stack.length <= 1201, 'long text is cut');
  await page.evaluate(() => { ErrorLog.clear(); for (let i = 0; i < 5; i++) ErrorLog.add('error', 'same bug'); });
  assert.deepEqual(await page.evaluate(() => ErrorLog.list().map((e) => [e.msg, e.n])), [['same bug', 5]]);
  await ctx.close();
});

test('Settings → Error Log: हेर्नुहोस् shows entries, Copy puts a full report on the clipboard, खाली गर्नुहोस् clears', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage: { pk3_customers: customers, lastBackup: J(ago(1)) } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  await page.evaluate(() => { ErrorLog.clear(); App.navigate('settings'); });
  assert.match(await page.innerText('#errlog-count'), /कुनै error छैन/);
  assert.equal(await page.isVisible('#errlog-list'), false);

  await page.evaluate(() => { ErrorLog.add('error', 'Invoice save <b>failed</b>', { src: 'invoices.js:120:5' }); });
  assert.match(await page.innerText('#errlog-count'), /1 वटा error/);
  await page.click('#errlog-view-btn');
  assert.equal(await page.isVisible('#errlog-list'), true);
  assert.match(await page.innerText('#errlog-list'), /Invoice save <b>failed<\/b>/, 'shown as text, not HTML');
  assert.match(await page.innerText('#errlog-list'), /invoices\.js:120:5/);
  assert.match(await page.innerText('#errlog-view-btn'), /लुकाउनुहोस्/);

  await page.click('#errlog-copy-btn');
  await page.waitForFunction(() => navigator.clipboard.readText().then((t) => /Invoice save/.test(t)));
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  const ver = JSON.parse((await import('node:fs')).readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  assert.match(clip, /^Swagatik Error Log/);
  assert.ok(clip.includes('App: v' + ver));
  assert.match(clip, /Device: .+/);
  assert.match(clip, /ERROR · page: settings/);
  assert.match(clip, /@ invoices\.js:120:5/);

  await page.click('#errlog-clear-btn');   // confirm() is auto-accepted by the helper
  assert.equal(await page.evaluate(() => ErrorLog.count()), 0);
  assert.match(await page.innerText('#errlog-count'), /कुनै error छैन/);
  await ctx.close();
});

test('error-log.js loads first, before any other app script', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const first = html.match(/<script src="([^"?]+)/)[1];
  assert.equal(first, 'js/core/error-log.js');
});

test('clean app start logs nothing; a missing JS file is logged, empty <img> placeholders are not', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage: { pk3_customers: customers, lastBackup: J(ago(1)) } });
  for (const p of ['dashboard', 'settings', 'customers', 'invoices', 'daybook']) await page.evaluate((x) => App.navigate(x), p);
  await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(() => ErrorLog.list()), []);
  await page.evaluate(() => {
    const i = document.createElement('img'); i.src = ''; document.body.appendChild(i);
    const s = document.createElement('script'); s.src = 'js/modules/does-not-exist.js'; document.body.appendChild(s);
  });
  await page.waitForFunction(() => ErrorLog.count() > 0);
  const l = await page.evaluate(() => ErrorLog.list());
  assert.equal(l.length, 1);
  assert.equal(l[0].type, 'resource');
  assert.match(l[0].msg, /<script> .*does-not-exist\.js/);
  await ctx.close();
});
