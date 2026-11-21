// v7.3.2 — a fresh install: License screen first; after login the auto-seeded demo (sample) records
// must not be counted anywhere on the Dashboard (stat cards and the Business Overview Round Chart agree).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, openApp, loggedIn } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

test('fresh device: License screen, no auto login', async () => {
  const { ctx, page } = await openApp({ base, browser, storage: {} });
  assert.equal(await page.isVisible('#license-screen'), true);
  assert.equal(await page.evaluate(() => typeof currentUser !== 'undefined' && !!currentUser), false);
  assert.equal(await page.evaluate(() => localStorage.getItem('pk3_session')), null);
  await ctx.close();
});

test('demo records are left out of the Round Chart, like the stat cards', async () => {
  // LICENSED without pk3_sample_seeded → first login seeds the demo data, as on a new device
  const { ctx, page, errors } = await loggedIn({ base, browser, storage: { pk3_sample_seeded: null } });
  await page.evaluate(() => { localStorage.removeItem('pk3_sample_seeded'); SampleData.maybeAutoSeed(); App.navigate('dashboard'); Dashboard.render(); });
  assert.equal(await page.evaluate(() => SampleData.hasDemo()), true, 'demo data present');
  assert.equal(await page.innerText('#s-cust'), '0');
  const rc = await page.innerText('#dash-round-chart');
  assert.match(rc, /Data छैन/, 'round chart has no real data to show');
  assert.doesNotMatch(rc, /15,000/);

  await page.evaluate(() => { const c = STORE.get('pk3_customers', []); c.push({ id: 'r1', name: 'Real One', phone: '9800000001', advance: 2500, created: new Date().toISOString() }); STORE.set('pk3_customers', c); Dashboard.render(); });
  assert.equal(await page.innerText('#s-cust'), '1');
  assert.match(await page.innerText('#dash-round-chart'), /2,500/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
