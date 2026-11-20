// Item 2: one-command release keeps versions in sync; service worker never pins an old app.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { ROOT, launch } from './helpers.mjs';

const script = path.join(ROOT, 'scripts/release.mjs');
const run = (root, ...a) => execFileSync(process.execPath, [script, ...a], { env: { ...process.env, SWG_ROOT: root } }).toString();

function tmpCopy() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'swg-rel-'));
  for (const f of ['index.html', 'sw.js', 'package.json']) fs.copyFileSync(path.join(ROOT, f), path.join(d, f));
  return d;
}

test('repo versions are consistent right now', () => {
  const out = run(ROOT, '--check');
  const v = JSON.parse(out);
  assert.ok(v.spans.length >= 2);
});

test('release bumps index.html, sw.js and package.json together', () => {
  const d = tmpCopy();
  const v0 = JSON.parse(run(d, '--check'));
  run(d);                          // patch
  let v = JSON.parse(run(d, '--check'));
  const [a, b, c] = v0.html.split('.').map(Number);
  assert.equal(v.html, `${a}.${b}.${c + 1}`);
  assert.equal(v.cache, v0.cache + 1);
  run(d, 'minor');
  v = JSON.parse(run(d, '--check'));
  assert.equal(v.html, `${a}.${b + 1}.0`);
  run(d, '9.9.9');
  v = JSON.parse(run(d, '--check'));
  assert.deepEqual([v.html, v.sw, v.pkg, ...v.spans], Array(3 + v.spans.length).fill('9.9.9'));
  assert.equal(v.cache, v0.cache + 3);
  fs.rmSync(d, { recursive: true });
});

test('check fails when someone edits one file by hand', () => {
  const d = tmpCopy();
  fs.writeFileSync(path.join(d, 'sw.js'), fs.readFileSync(path.join(d, 'sw.js'), 'utf8').replace(/var APP_VERSION = '[\d.]+';/, "var APP_VERSION = '0.0.1';"));
  assert.throws(() => run(d, '--check'));
  fs.rmSync(d, { recursive: true });
});

// Real service worker in Chromium: after a new release is deployed, the next load shows it.
let srv, base, browser, served;
before(async () => {
  served = { html: fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), sw: fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8') };
  srv = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/' || p === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'max-age=600' }); return res.end(served.html); }
    if (p === '/sw.js') { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'max-age=600' }); return res.end(served.sw); }
    const f = path.join(ROOT, p);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200); return res.end(fs.readFileSync(f)); }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + srv.address().port;
  browser = await launch();
});
after(async () => { await browser.close(); srv.close(); });

test('service worker serves the newest app after a release (no stuck old version)', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route((u) => !u.href.startsWith(base), (r) => r.abort());
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(async () => { await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller); });
  const v1 = await page.evaluate(() => APP_VERSION);
  // deploy a "new release"
  served.html = served.html.replace(/var APP_VERSION = '[\d.]+';/, "var APP_VERSION = '99.0.0';");
  served.sw = served.sw.replace(/swagatik-cache-v\d+/, 'swagatik-cache-v999');
  assert.notEqual(v1, '99.0.0');
  // The app may also reload itself when the new service worker takes over — tolerate that.
  const until = async (fn) => {
    for (let i = 0; i < 60; i++) {
      try { if (await page.evaluate(fn)) return true; } catch (e) { /* navigating */ }
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  };
  await page.reload().catch(() => {});
  assert.ok(await until(() => typeof APP_VERSION !== 'undefined' && APP_VERSION === '99.0.0'), 'new version shown');
  await new Promise((r) => setTimeout(r, 1500));   // let any self-reload settle
  // offline still works from cache
  await ctx.setOffline(true);
  await page.reload().catch(() => {});
  assert.ok(await until(() => typeof APP_VERSION !== 'undefined' && APP_VERSION === '99.0.0'), 'offline copy is the new version');
  await ctx.close();
});
