// Item 1: secrets are not readable in the public source, but existing access keeps working.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { startServer, launch, loggedIn, ROOT, LICENSED, TEST_MASTER, TEST_PASS, testHtml, appSource } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const html = appSource();

test('public source holds no plaintext master key or password', () => {
  assert.doesNotMatch(html, /^\s*MASTER:\s*'/m);          // old plaintext field is gone
  assert.match(html, /MASTER_HASH: '[0-9a-f]{64}'/);
  assert.match(html, /\['punya', '[0-9a-f]{64}'/);
  assert.doesNotMatch(html, /atob\(r\[1\]\)/);
  assert.doesNotMatch(html, /FOUNDER:\s*'/);
});

test('optional: the real master key / password still match (set SWG_REAL_MASTER / SWG_REAL_PASS)', { skip: !process.env.SWG_REAL_MASTER && !process.env.SWG_REAL_PASS }, () => {
  const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
  if (process.env.SWG_REAL_MASTER) assert.ok(html.includes(sha('PRK-2083-MKWNPR|MASTER|' + process.env.SWG_REAL_MASTER.toUpperCase())));
  if (process.env.SWG_REAL_PASS) assert.ok(html.includes(sha('SWG-PW-v1|' + process.env.SWG_REAL_PASS)));
});

test('in-app SHA-256 matches Node crypto (incl. Nepali text)', async () => {
  const { page, ctx } = await loggedIn({ base, browser });
  for (const s of ['', 'abc', 'नमस्ते स्वागतिक', 'x'.repeat(200)]) {
    const want = createHash('sha256').update(s, 'utf8').digest('hex');
    assert.equal(await page.evaluate((v) => _sha256(v), s), want, s);
  }
  await ctx.close();
});

test('master key still validates in all accepted forms; others fail', async () => {
  const { page, ctx } = await loggedIn({ base, browser });
  const r = await page.evaluate((M) => [M, ' ' + M + ' ', 'PRERAK-' + M, ('prerak-master-' + M).toLowerCase(), M + 'X', 'PRERAK-0000', ''].map((k) => License.validate('Any Co', k).ok), TEST_MASTER);
  assert.deepEqual(r, [true, true, true, true, false, false, false]);
  await ctx.close();
});

test('old remembered session is upgraded to a hash-only session', async () => {
  const { page, ctx } = await loggedIn({ base, browser });
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('pk3_session')));
  assert.equal(s.user, 'punya');
  assert.equal(s.pass, undefined);
  assert.match(s.ph, /^[0-9a-f]{64}$/);
  await page.reload();
  await page.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser && currentUser.user === 'punya');
  await ctx.close();
});

test('Super Admin gate and danger-zone confirm use the hashed password', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage: LICENSED });
  await page.evaluate(() => { Auth.openSuperAdminGate && Auth.openSuperAdminGate(); });
  await page.fill('#superadmin-pass', 'wrong-pass');
  await page.evaluate(() => Auth.verifySuperAdminPassword());
  assert.equal(await page.evaluate(() => !!Auth.superAdminUnlocked), false);
  await page.fill('#superadmin-pass', TEST_PASS);
  await page.evaluate(() => Auth.verifySuperAdminPassword());
  assert.equal(await page.evaluate(() => !!Auth.superAdminUnlocked), true);
  const ok = await page.evaluate((P) => { window.prompt = () => P; let hit = false; AdminDash._dangerConfirm('test', () => { hit = true; }); return hit; }, TEST_PASS);
  assert.equal(ok, true);
  const bad = await page.evaluate(() => { window.prompt = () => 'nope'; let hit = false; AdminDash._dangerConfirm('test', () => { hit = true; }); return hit; });
  assert.equal(bad, false);
  await ctx.close();
});

test('hash-secret script produces hashes the app accepts', async () => {
  const { execFileSync } = await import('node:child_process');
  const run = (...a) => execFileSync(process.execPath, [path.join(ROOT, 'scripts/hash-secret.mjs'), ...a], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  const served = testHtml();
  assert.ok(served.includes(run('master', TEST_MASTER.toLowerCase())));
  assert.ok(served.includes(run('password', TEST_PASS)));
});
