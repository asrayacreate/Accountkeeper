// v7.3.2 — security regression: a brand-new web address (fresh browser storage) must ALWAYS ask for the
// License Key and then the password. Runs the real published build (dist files, REAL secret hashes,
// service worker on, phone profile) so nothing test-only can hide an auto-login path.
// Also: Audit Log times are shown in Nepal time (NPT), activation + login leave an audit trail.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, launch, loggedIn, startServer, TEST_MASTER, TEST_PASS, openApp } from './helpers.mjs';
import { pageFiles } from '../scripts/build-pages.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
let real, realBase, srv, base, browser;
before(async () => {
  const allowed = new Set(pageFiles());   // exactly what Cloudflare publishes — served unchanged
  real = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\//, '') || 'index.html';
    if (!allowed.has(p)) p = 'index.html';  // like _redirects: unknown path → app
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(fs.readFileSync(path.join(ROOT, p)));
  });
  await new Promise((r) => real.listen(0, '127.0.0.1', r));
  realBase = 'http://127.0.0.1:' + real.address().port;
  ({ srv, base } = await startServer());
  browser = await launch();
});
after(async () => { await browser.close(); real.close(); srv.close(); });

const state = (page) => page.evaluate(() => ({
  licenseScreen: getComputedStyle(document.getElementById('license-screen')).display !== 'none',
  user: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.user : null,
  session: localStorage.getItem('pk3_session'),
  license: localStorage.getItem('pk3_license') || localStorage.getItem('pk3_lic_backup') || localStorage.getItem('prerak_activation'),
  audit: JSON.parse(localStorage.getItem('pk3_audit') || '[]').map((a) => a.action),
  seeded: localStorage.getItem('pk3_sample_seeded'),
  appVisible: !!document.getElementById('main') && getComputedStyle(document.getElementById('main')).display !== 'none' && document.getElementById('login-screen').classList.contains('hide'),
}));

test('fresh address (real build, real hashes, service worker, phone): License screen every time, never logged in', async () => {
  const ctx = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  for (const u of ['/', '/?swg-transfer=1', '/index.html#dashboard', '/dashboard']) {
    await page.goto(realBase + u);
    await page.waitForFunction(() => typeof License !== 'undefined' && typeof Auth !== 'undefined');
    await page.waitForTimeout(800);
    const s = await state(page);
    assert.equal(s.licenseScreen, true, u + ': License screen must show');
    assert.equal(s.user, null, u + ': nobody logged in');
    assert.equal(s.appVisible, false, u + ': app must stay hidden');
    assert.equal(s.session, null); assert.equal(s.license, null); assert.equal(s.seeded, null);
    assert.ok(!s.audit.includes('LOGIN'), u + ': no LOGIN audit');
  }
  await page.reload(); await page.waitForTimeout(800);
  assert.equal((await state(page)).user, null, 'still locked after reload (service worker copy)');
  // calling the boot steps again by hand must not log in either
  await page.evaluate(() => { License.check(); Auth.init(); });
  assert.equal((await state(page)).user, null);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('real build: a wrong or empty key never activates, a wrong password never logs in', async () => {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(realBase + '/');
  await page.waitForFunction(() => typeof License !== 'undefined');
  for (const k of ['', 'PRERAK-', 'TEST-MASTER-0001', 'PRERAK-MASTER-', '0000-0000-0000-0000']) {
    await page.fill('#license-company', 'Any Co'); await page.fill('#license-key', k);
    await page.click('#license-screen button');
    assert.equal(await page.evaluate(() => License.isActivated()), false, 'key "' + k + '" must not activate');
  }
  // even with a license record, the login form needs the right password
  await page.evaluate(() => { localStorage.setItem('pk3_license', JSON.stringify({ company: 'X', key: 'NOT-THE-KEY', plan: 'MASTER' })); });
  await page.reload(); await page.waitForTimeout(500);
  assert.equal((await state(page)).licenseScreen, true, 'a forged record with a wrong key is rejected');
  for (const pw of ['', 'test-pass-123', 'punya', 'admin', '123456']) {
    assert.equal(await page.evaluate((pw) => USERS_CONFIG.some((u) => u.passHash === _pwHash(pw)), pw), false, 'password "' + pw + '" must not match');
  }
  await ctx.close();
});

test('activation and login leave an audit trail; Audit Log shows Nepal time (NPT)', async () => {
  const { ctx, page } = await openApp({ base, browser, storage: {} });
  await page.fill('#license-company', 'Demo Co'); await page.fill('#license-key', TEST_MASTER);
  await page.click('#license-screen button');
  await page.waitForSelector('#login-screen', { state: 'visible' });
  await page.fill('#login-user', 'punya'); await page.fill('#login-pass', TEST_PASS);
  await page.click('.login-submit');
  await page.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser);
  const audit = await page.evaluate(() => STORE.get('pk3_audit', []));
  const lic = audit.find((a) => a.action === 'LICENSE'), login = audit.find((a) => a.action === 'LOGIN');
  assert.ok(lic && /License activated \(MASTER\)/.test(lic.details) && lic.details.includes('@ 127.0.0.1'), 'activation is audited');
  assert.ok(login && /password form/.test(login.details), 'login says it came from the password form');

  await page.evaluate(() => { STORE.set('pk3_audit', [{ id: 'a1', time: '2026-11-21T05:28:00.000Z', user: 'Punya', action: 'LOGIN', details: 'x' }]); App.navigate('audit'); Audit.render(); });
  const row = await page.innerText('#audit-table');
  assert.match(row, /21 Nov 2026/);
  assert.match(row, /11:13 NPT/, 'UTC 05:28 is shown as 11:13 Nepal time');
  assert.equal(await page.evaluate(() => Audit.npt('2026-11-21T20:30:00.000Z').date), '22 Nov 2026', 'date rolls over in NPT');
  await ctx.close();
});
