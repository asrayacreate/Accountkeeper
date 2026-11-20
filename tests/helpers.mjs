// Shared test helpers: tiny static server + Playwright browser + app boot.
// Run: npm install && npx playwright install chromium && npm test
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch (e) { playwright = createRequire(path.join(process.execPath, '..', '..', 'lib', 'node_modules', '/'))('playwright'); }

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };

// The real master key / password are never written in this public repo.
// The test server swaps the stored hashes for hashes of these test-only secrets,
// so every test exercises the exact same code path a real login uses.
export const TEST_MASTER = 'TEST-MASTER-0001';
export const TEST_PASS = 'test-pass-123';
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
// v7: app code lives in index.html + js/**. The secret hashes sit in js/core/*.js.
function swapSecrets(src) {
  return src
    .replace(/MASTER_HASH: '[0-9a-f]{64}'/, "MASTER_HASH: '" + sha('PRK-2083-MKWNPR|MASTER|' + TEST_MASTER) + "'")
    .replace(/\['punya', '[0-9a-f]{64}'/, "['punya', '" + sha('SWG-PW-v1|' + TEST_PASS) + "'");
}
export function appFiles() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map((m) => m[1]);
}
/** All app source (index.html + every loaded js file), as stored in the repo. */
export function appSource() {
  return [fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), ...appFiles().map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'))].join('\n');
}
/** The same source as the test server serves it (test-only secret hashes). */
export function testHtml() { return swapSecrets(appSource()); }

export function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
      if (/^\/(index\.html|js\/core\/(license|security)\.js)$/.test(p)) { res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] }); return res.end(swapSecrets(fs.readFileSync(f, 'utf8'))); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}

export async function launch() {
  return playwright.chromium.launch();
}

// A licensed + logged-in session, the way a real activated device looks.
export const LICENSED = {
  pk3_sample_seeded: '1',
  pk3_license: JSON.stringify({ company: 'PRERAK MULTIPURPOSE PVT LTD', key: TEST_MASTER, plan: 'MASTER', expiry: null, activatedAt: '2025-01-01T00:00:00.000Z' }),
};
export const SESSION_OLD = { pk3_session: JSON.stringify({ user: 'punya', pass: TEST_PASS }) };

/**
 * Open the app in a fresh context.
 * @param {object} o  { base, browser, storage: {key: rawString}, viewport, mock: (page)=>Promise }
 */
export async function openApp(o) {
  const ctx = await o.browser.newContext({ serviceWorkers: 'block', viewport: o.viewport || { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  // No real internet in tests: everything off-origin is aborted unless a test mocks it.
  await page.route((url) => !url.href.startsWith(o.base), (r) => r.abort());
  if (o.mock) await o.mock(page);
  await page.goto(o.base + '/manifest.json');
  await page.evaluate((st) => { localStorage.clear(); for (const k in st) localStorage.setItem(k, st[k]); }, o.storage || {});
  page.on('dialog', (d) => d.accept(o.promptAnswer));
  await page.goto(o.base + '/index.html');
  await page.waitForFunction(() => typeof App !== 'undefined' && typeof STORE !== 'undefined');
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

export async function loggedIn(o) {
  const r = await openApp({ ...o, storage: { ...LICENSED, ...SESSION_OLD, ...(o.storage || {}) } });
  await r.page.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && currentUser.user === 'punya');
  return r;
}

export const J = (v) => JSON.stringify(v);
