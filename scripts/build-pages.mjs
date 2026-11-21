#!/usr/bin/env node
// Cloudflare Pages build: copies ONLY the files the app needs into dist/ so that docs, tests,
// scripts and SQL in this repo are never published on the website.
//   Cloudflare → Build command: `node scripts/build-pages.mjs`   Build output directory: `dist`
// The file list is the service worker's own pre-cache list (sw.js CORE_ASSETS, kept in sync by
// `npm run release`), plus sw.js and the Cloudflare _headers / _redirects files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.SWG_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, process.env.SWG_OUT || 'dist');

export function pageFiles(root = ROOT) {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const block = (sw.match(/var CORE_ASSETS = \[([\s\S]*?)\];/) || [])[1] || '';
  const assets = [...block.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  return [...new Set([...assets, 'sw.js', '_headers', '_redirects'])];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = pageFiles();
  fs.rmSync(OUT, { recursive: true, force: true });
  let missing = [];
  for (const f of files) {
    const src = path.join(ROOT, f);
    if (!fs.existsSync(src)) { missing.push(f); continue; }
    fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true });
    fs.copyFileSync(src, path.join(OUT, f));
  }
  if (missing.length) { console.error('❌ Missing files: ' + missing.join(', ')); process.exit(1); }
  console.log(`✅ ${files.length} files → ${path.relative(ROOT, OUT) || '.'}/`);
}
