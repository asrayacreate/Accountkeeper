// v7.3.1 — safe move to a new web address (GitHub Pages → Cloudflare Pages):
//  • old address shows "📦 डाटा नयाँ ठेगानामा सार्नुहोस्" and sends the full backup to the new address
//  • the new address accepts data only from the configured old addresses, restores it safely,
//    never receives license / session; old data is never deleted
//  • service worker opens the cached app when the old server answers 404 (hosting switched off)
//  • Cloudflare build copies only app files (no docs/tests/scripts)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startServer, launch, loggedIn, appFiles, J, LICENSED, SESSION_OLD } from './helpers.mjs';
import { pageFiles } from '../scripts/build-pages.mjs';

let oldS, newS, evilS, plainS, browser;
const deployFor = (primary, legacy) => (p, text) => (p === '/js/core/deploy.js'
  ? text.replace("primaryOrigin: ''", `primaryOrigin: '${primary()}'`).replace(/legacyOrigins: \[[^\]]*\]/, `legacyOrigins: ['${legacy()}']`)
  : undefined);
before(async () => {
  const P = () => newS.base, L = () => oldS.base;
  oldS = await startServer({ transform: deployFor(P, L) });
  newS = await startServer({ transform: deployFor(P, L) });
  evilS = await startServer({ transform: deployFor(P, L) });
  plainS = await startServer();
  browser = await launch();
});
after(async () => { await browser.close(); [oldS, newS, evilS, plainS].forEach((s) => s.srv.close()); });

const customers = (n, tag = 'Customer') => J(Array.from({ length: n }, (_, i) => ({ id: 'c' + i, name: tag + ' ' + i, phone: '98000000' + String(i).padStart(2, '0') })));
const ls = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);

test('old address: banner → one click moves all data to the new address; license/session stay behind', async () => {
  const { ctx, page, errors } = await loggedIn({ base: oldS.base, browser, storage: { pk3_customers: customers(3), pk3_ai_key: J('sk-secret') } });
  ctx.on('page', (p) => p.on('dialog', (d) => d.accept()));
  await page.evaluate(() => App.navigate('dashboard'));
  await page.waitForSelector('#move-start', { state: 'visible' });
  assert.match(await page.innerText('#move-alert-dash'), /नयाँ ठेगानामा सर्दैछ/);
  assert.match(await page.innerText('#move-alert-dash'), new RegExp(newS.base.replace(/[.:/]/g, '\\$&')));

  const [popup] = await Promise.all([ctx.waitForEvent('page'), page.click('#move-start')]);
  await page.waitForSelector('#move-open-new', { state: 'visible', timeout: 20000 });
  assert.match(await page.innerText('#move-alert-dash'), /सारियो/);
  assert.ok(await ls(page, 'swagatik_moved_at'), 'old address remembers the move');
  assert.equal(JSON.parse(await ls(page, 'pk3_customers')).length, 3, 'old data is never deleted');

  await popup.waitForURL((u) => !u.search.includes('swg-transfer'), { timeout: 10000 });
  await popup.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('pk3_customers') || '[]').some((c) => c.name === 'Customer 2'); } catch (e) { return false; } }, null, { timeout: 15000 });
  assert.equal(new URL(popup.url()).origin, newS.base);
  assert.equal(await ls(popup, 'pk3_license'), null, 'license is not transferred');
  assert.equal(await ls(popup, 'pk3_session'), null, 'login session is not transferred');
  assert.equal(await ls(popup, 'pk3_ai_key'), null, 'AI key is not transferred');
  assert.equal(await ls(popup, 'swagatik_moved_at'), null);
  await popup.waitForSelector('#license-screen', { state: 'visible' });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('new address ignores data from any other site', async () => {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(evilS.base + '/manifest.json');
  const [popup] = await Promise.all([ctx.waitForEvent('page'), page.evaluate((u) => { window._w = window.open(u + '/?swg-transfer=1'); }, newS.base)]);
  popup.on('dialog', (d) => d.accept());
  await popup.waitForLoadState('load');
  await page.evaluate(() => new Promise((res) => {
    let n = 0; const t = setInterval(() => { window._w.postMessage({ type: 'swg-move-data', v: 1, data: { pk3_customers: [{ id: 'x', name: 'EVIL' }], pk3_quotations: [] } }, '*'); if (++n > 10) { clearInterval(t); res(); } }, 200);
  }));
  await popup.waitForTimeout(1500);
  const names = await popup.evaluate(() => JSON.parse(localStorage.getItem('pk3_customers') || '[]').map((c) => c.name));
  assert.ok(!names.includes('EVIL'), 'data from an unknown origin must be ignored');
  await ctx.close();
});

test('no banner when no new address is set, or on the new address itself', async () => {
  const a = await loggedIn({ base: plainS.base, browser });
  await a.page.evaluate(() => App.navigate('dashboard'));
  assert.equal(await a.page.isVisible('#move-alert-dash'), false);
  assert.equal(await a.page.evaluate(() => MoveOrigin.isOld()), false);
  await a.ctx.close();
  const b = await loggedIn({ base: newS.base, browser });
  await b.page.evaluate(() => App.navigate('dashboard'));
  assert.equal(await b.page.isVisible('#move-alert-dash'), false);
  await b.ctx.close();
});

test('service worker: old hosting answers 404 → cached app still opens with the data', async () => {
  let dead = false;
  const proxy = http.createServer(async (req, res) => {
    if (dead && !/\/sw\.js$/.test(req.url)) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end('<h1>404 Site not found</h1>'); }
    const r = await fetch(plainS.base + req.url);
    res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/octet-stream' });
    res.end(Buffer.from(await r.arrayBuffer()));
  });
  await new Promise((r) => proxy.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + proxy.address().port;
  const ctx = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await ctx.newPage();
  await page.goto(base + '/manifest.json');
  await page.evaluate((st) => { localStorage.clear(); for (const k in st) localStorage.setItem(k, st[k]); }, { ...LICENSED, ...SESSION_OLD, pk3_customers: customers(2, 'Kept') });
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 });
  await page.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser);
  await page.waitForTimeout(1500);   // let the pre-cache finish
  dead = true;
  await page.reload();
  await page.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser, null, { timeout: 15000 });
  assert.doesNotMatch(await page.content(), /Site not found/);
  assert.equal(await page.evaluate(() => Customers.getData().length), 2);
  await ctx.close();
  proxy.close();
});

test('Cloudflare build publishes only app files', () => {
  const files = pageFiles();
  for (const f of ['index.html', 'sw.js', 'manifest.json', '_headers', '_redirects', ...appFiles()]) assert.ok(files.includes(f), 'missing ' + f);
  for (const f of files) assert.doesNotMatch(f, /^(tests|scripts|supabase|node_modules)\/|\.md$|^package|^CNAME$/, 'should not publish ' + f);
});
