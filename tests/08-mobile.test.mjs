// Item 8: on a phone (360px) no page, popup, table or button is cut off at the edge.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, loggedIn, J } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const W = 360;
// Elements sticking out past `edge` that are not inside a horizontally scrollable/clipped box
const OVERFLOW = ({ root, edge }) => {
  const host = typeof root === 'string' ? document.querySelector(root) : root;
  if (!host) return [];
  const lim = edge != null ? edge : host.getBoundingClientRect().right;
  const out = [];
  host.querySelectorAll('*').forEach((e) => {
    const r = e.getBoundingClientRect();
    if (r.width <= 0 || r.right <= lim + 2) return;
    for (let p = e.parentElement; p && p !== host; p = p.parentElement) if (/auto|scroll|hidden/.test(getComputedStyle(p).overflowX)) return;
    out.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 30)) + ' +' + Math.round(r.right - lim) + 'px');
  });
  return out;
};

test('every page fits the phone width', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, viewport: { width: W, height: 740 },
    storage: { pk3_projects: J([{ id: 'p1', name: 'A very long project name for a big site in Hetauda', stage: 'Design', progress: 15, budget: 2500000 }]) } });
  await page.evaluate(() => SampleData.load(true));
  const pages = await page.evaluate(() => [...document.querySelectorAll('.page')].map((p) => p.id.replace('page-', '')).filter((p) => p !== 'admin-dashboard'));
  const bad = {};
  for (const pg of pages) {
    await page.evaluate((p) => App.navigate(p), pg);
    const o = await page.evaluate(OVERFLOW, { root: '.page.active', edge: W });
    const docW = await page.evaluate(() => document.scrollingElement.scrollWidth);
    if (o.length || docW > W) bad[pg] = o.slice(0, 4).concat(docW > W ? ['document ' + docW] : []);
  }
  assert.deepEqual(bad, {});
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('every popup fits inside the phone screen', async () => {
  const { page, ctx } = await loggedIn({ base, browser, viewport: { width: W, height: 740 } });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;}' });
  const ids = await page.evaluate(() => [...document.querySelectorAll('.modal-overlay')].map((m) => m.id));
  const bad = {};
  for (const id of ids) {
    const r = await page.evaluate(({ id, fn }) => {
      const OV = eval('(' + fn + ')');
      document.querySelectorAll('.modal-overlay.open').forEach((m) => m.classList.remove('open'));
      const m = document.getElementById(id); m.classList.add('open');
      const md = m.querySelector('.modal') || m.firstElementChild;
      if (!md) return null;
      const rr = md.getBoundingClientRect();
      const res = { right: rr.right, bottom: rr.bottom, inner: OV({ root: md }) };
      m.classList.remove('open');
      return res;
    }, { id, fn: OVERFLOW.toString() });
    if (r && (r.right > W + 1 || r.bottom > 741 || r.inner.length)) bad[id] = r;
  }
  assert.deepEqual(bad, {});
  await ctx.close();
});

test('menu button no longer pushes the app off-screen', async () => {
  const { page, ctx } = await loggedIn({ base, browser, viewport: { width: W, height: 740 } });
  const m = await page.evaluate(() => { const r = document.getElementById('main').getBoundingClientRect(); return [r.left, r.right]; });
  assert.deepEqual(m, [0, W]);
  await page.click('#hamburger');
  assert.equal(await page.evaluate(() => document.getElementById('sidebar').classList.contains('open')), true);
  await ctx.close();
});
