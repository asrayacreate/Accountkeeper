// v7.3.4 — Super Admin: make the new Master Key / password hashes on the device itself.
// Same hashes as `npm run hash-secret`, weak / repeated / current secrets refused, inputs cleared, nothing stored.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { startServer, launch, loggedIn, ROOT, TEST_MASTER, TEST_PASS } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const cli = (kind, s) => execFileSync(process.execPath, [path.join(ROOT, 'scripts/hash-secret.mjs'), kind, s], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const make = (page, key, key2, pw, pw2) => page.evaluate(([a, b, c, d]) => {
  const set = (id, v) => { document.getElementById(id).value = v; };
  set('sh-key', a); set('sh-key2', b); set('sh-pw', c); set('sh-pw2', d);
  const r = SecretHash.make();
  return { r, out: document.getElementById('sh-result').innerText, left: ['sh-key', 'sh-key2', 'sh-pw', 'sh-pw2'].map((id) => document.getElementById(id).value) };
}, [key, key2, pw, pw2]);

test('valid new key + password → same hashes as the CLI, inputs cleared, nothing saved', async () => {
  const { ctx, page, errors } = await loggedIn({ base, browser });
  const before = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort()));
  const key = 'Nava Mul Kunji 2083 x9', pw = 'Mero-Naya-Pass-7788';
  const { r, out, left } = await make(page, key, key, pw, pw);
  assert.equal(r.master, sha('PRK-2083-MKWNPR|MASTER|' + key.toUpperCase().replace(/\s+/g, '')));
  assert.equal(r.master, cli('master', key));
  assert.equal(r.password, sha('SWG-PW-v1|' + pw));
  assert.equal(r.password, cli('password', pw));
  assert.match(out, /Hash तयार भयो/);
  assert.ok(await page.evaluate(() => document.getElementById('sh-hashes').value.includes('MASTER_HASH: ')));
  assert.deepEqual(left, ['', '', '', ''], 'secrets are wiped from the form');
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  assert.ok(!stored.includes('Mero-Naya-Pass') && !stored.toUpperCase().includes('NAVAMULKUNJI'), 'secret never written to storage');
  assert.equal(await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort())), before);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('weak, mismatched, equal or current secrets are refused', async () => {
  const { ctx, page } = await loggedIn({ base, browser });
  const cases = [
    ['short1', 'short1', 'Mero-Naya-Pass-7788', 'Mero-Naya-Pass-7788', /12 अक्षर/],
    ['OnlyLettersHere', 'OnlyLettersHere', 'Mero-Naya-Pass-7788', 'Mero-Naya-Pass-7788', /अक्षर र अंक/],
    ['Nava Mul Kunji 2083', 'Nava Mul Kunji 2084', 'Mero-Naya-Pass-7788', 'Mero-Naya-Pass-7788', /Master Key मिलेनन्/],
    ['Nava Mul Kunji 2083', 'Nava Mul Kunji 2083', 'Mero-Naya-Pass-7788', 'Mero-Naya-Pass-7789', /Password मिलेनन्/],
    ['SamePass-123456', 'SamePass-123456', 'SAMEPASS-123456', 'SAMEPASS-123456', /फरक हुनुपर्छ/],
    [TEST_MASTER, TEST_MASTER, 'Mero-Naya-Pass-7788', 'Mero-Naya-Pass-7788', /अहिलेकै Master Key/],
  ];
  for (const [a, b, c, d, re] of cases) {
    const { r, out } = await make(page, a, b, c, d);
    if (re) { assert.equal(r, null, 'refused: ' + a); assert.match(out, re); }
  }
  // the current password is refused (test server: TEST_PASS)
  const cur = await make(page, 'Nava Mul Kunji 2083', 'Nava Mul Kunji 2083', TEST_PASS + 'abcd', TEST_PASS + 'abcd');
  assert.ok(cur.r, 'a different password is fine');
  await page.evaluate((p) => { USERS_CONFIG[0].passHash = _pwHash(p); }, 'Current-Pass-2083');
  const same = await make(page, 'Nava Mul Kunji 2083', 'Nava Mul Kunji 2083', 'Current-Pass-2083', 'Current-Pass-2083');
  assert.equal(same.r, null); assert.match(same.out, /अहिलेकै Password/);
  await ctx.close();
});
