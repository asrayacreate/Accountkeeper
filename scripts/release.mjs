#!/usr/bin/env node
// One command to release a new version — keeps every version number in sync so
// phones/tablets never stay stuck on an old cached copy.
//
//   npm run release              → 6.9.0 → 6.9.1  (patch)
//   npm run release -- minor     → 6.9.0 → 6.10.0
//   npm run release -- 7.0.0     → exact version
//   npm run release -- --check   → only verify that all files agree (used by tests)
//
// Updates: index.html (APP_VERSION + every <span data-app-version>),
//          sw.js (APP_VERSION + CACHE_VERSION number +1), package.json "version".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.SWG_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const F = { html: path.join(ROOT, 'index.html'), sw: path.join(ROOT, 'sw.js'), pkg: path.join(ROOT, 'package.json') };
const read = (f) => fs.readFileSync(f, 'utf8');

export function readVersions() {
  const html = read(F.html), sw = read(F.sw), pkg = JSON.parse(read(F.pkg));
  const spans = [...html.matchAll(/<span data-app-version>v([\d.]+)<\/span>/g)].map((m) => m[1]);
  return {
    html: (html.match(/var APP_VERSION = '([\d.]+)';/) || [])[1],
    spans,
    sw: (sw.match(/var APP_VERSION = '([\d.]+)';/) || [])[1],
    cache: Number((sw.match(/var CACHE_VERSION = 'swagatik-cache-v(\d+)';/) || [])[1]),
    pkg: pkg.version,
  };
}

function check() {
  const v = readVersions();
  const all = [v.html, v.sw, v.pkg, ...v.spans];
  const ok = v.html && v.spans.length > 0 && all.every((x) => x === v.html) && Number.isFinite(v.cache);
  return { ok, v };
}

function next(cur, arg) {
  if (/^\d+\.\d+\.\d+$/.test(arg || '')) return arg;
  const [a, b, c] = cur.split('.').map(Number);
  if (arg === 'major') return `${a + 1}.0.0`;
  if (arg === 'minor') return `${a}.${b + 1}.0`;
  return `${a}.${b}.${c + 1}`;
}

const arg = process.argv[2];
if (arg === '--check') {
  const { ok, v } = check();
  console.log(JSON.stringify(v));
  process.exit(ok ? 0 : 1);
}

const before = readVersions();
const ver = next(before.html, arg);
const cacheN = (before.cache || 0) + 1;

let html = read(F.html)
  .replace(/var APP_VERSION = '[\d.]+';/, `var APP_VERSION = '${ver}';`)
  .replace(/<span data-app-version>v[\d.]+<\/span>/g, `<span data-app-version>v${ver}</span>`);
let sw = read(F.sw)
  .replace(/var APP_VERSION = '[\d.]+';/, `var APP_VERSION = '${ver}';`)
  .replace(/var CACHE_VERSION = 'swagatik-cache-v\d+';/, `var CACHE_VERSION = 'swagatik-cache-v${cacheN}';`);
const pkg = JSON.parse(read(F.pkg)); pkg.version = ver;

fs.writeFileSync(F.html, html);
fs.writeFileSync(F.sw, sw);
fs.writeFileSync(F.pkg, JSON.stringify(pkg, null, 2) + '\n');

const { ok, v } = check();
if (!ok) { console.error('❌ Version mismatch after release:', v); process.exit(1); }
console.log(`✅ v${before.html} → v${ver}  (cache swagatik-cache-v${cacheN})`);
console.log('   अब index.html, sw.js (र चाहे package.json) GitHub मा upload/commit गर्नुहोस्।');
