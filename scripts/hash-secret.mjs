#!/usr/bin/env node
// Make the SHA-256 hash that index.html stores instead of a real secret.
//
//   npm run hash-secret -- password "MyNewStrongPass"   → paste into _RAW_USERS
//   npm run hash-secret -- master   "MY-NEW-MASTER-KEY" → paste into License.MASTER_HASH
//
// The secret itself never goes into the public file — only this hash.
import { createHash } from 'node:crypto';

const LICENSE_SALT = 'PRK-2083-MKWNPR'; // must match License._SALT in index.html
const PW_PREFIX = 'SWG-PW-v1|';         // must match _pwHash() in index.html

const [kind, secret] = process.argv.slice(2);
if (!secret || !['password', 'master'].includes(kind)) {
  console.error('Usage: npm run hash-secret -- password "NewPass"\n       npm run hash-secret -- master "NEW-KEY"');
  process.exit(1);
}
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const clean = (k) => String(k).toUpperCase().replace(/\s+/g, '').trim();
const hash = kind === 'password' ? sha(PW_PREFIX + secret) : sha(LICENSE_SALT + '|MASTER|' + clean(secret));
if (secret.length < 10) console.warn('⚠️  Short secrets can be guessed from the hash. Use 10+ characters.');
console.log(hash);
