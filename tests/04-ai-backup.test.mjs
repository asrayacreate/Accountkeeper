// Item 7: Backup Gemini key — automatic switch on 429 / quota, never synced to Dropbox.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, loggedIn, J } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const QUOTA = { status: 429, contentType: 'application/json', body: J({ error: { code: 429, message: 'You exceeded your current quota', status: 'RESOURCE_EXHAUSTED' } }) };
const OK = (t) => ({ status: 200, contentType: 'application/json', body: J({ candidates: [{ content: { parts: [{ text: t }] } }] }) });

function gemini(page, byKey, calls) {
  return page.route(/generativelanguage\.googleapis\.com/, (rt) => {
    const key = new URL(rt.request().url()).searchParams.get('key');
    calls.push(key);
    rt.fulfill(byKey[key] || QUOTA);
  });
}
const cust = { pk3_customers: J([{ id: 'c1', name: 'Hari', phone: '9811111111' }]) };

test('Settings has a Backup Gemini key field that saves locally', async () => {
  const { page, ctx } = await loggedIn({ base, browser });
  await page.evaluate(() => App.navigate('settings'));
  await page.fill('#set-gem-key2', '  AIza-backup  ');
  await page.dispatchEvent('#set-gem-key2', 'input');
  assert.equal(await page.evaluate(() => STORE.get('pk3_gem_key2')), 'AIza-backup');
  await page.reload();
  await page.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser);
  await page.evaluate(() => App.navigate('settings'));
  assert.equal(await page.inputValue('#set-gem-key2'), 'AIza-backup');
  // never part of the Dropbox payload
  assert.equal(await page.evaluate(() => DBX.SKIP.test('pk3_gem_key2')), true);
  assert.equal(await page.evaluate(() => 'pk3_gem_key2' in DBX.collect()), false);
  await ctx.close();
});

test('main key 429 → backup key answers automatically', async () => {
  const calls = [];
  const { page, ctx } = await loggedIn({
    base, browser, storage: { ...cust, pk3_gem_key: J('MAIN'), pk3_gem_key2: J('BACKUP') },
    mock: (p) => gemini(p, { BACKUP: OK('Backup key बाट AI सन्देश') }, calls),
  });
  await page.evaluate(() => AIWA.open({ type: 'fu', custId: 'c1', name: 'Hari', phone: '9811111111' }));
  await page.waitForFunction(() => /Backup key बाट/.test(document.getElementById('aiwa-text').value));
  assert.deepEqual(calls, ['MAIN', 'BACKUP']);
  assert.match(await page.innerText('#aiwa-status'), /Backup Key/);
  await ctx.close();
});

test('main key fine → backup key is never touched', async () => {
  const calls = [];
  const { page, ctx } = await loggedIn({
    base, browser, storage: { ...cust, pk3_gem_key: J('MAIN'), pk3_gem_key2: J('BACKUP') },
    mock: (p) => gemini(p, { MAIN: OK('मुख्य key सन्देश') }, calls),
  });
  await page.evaluate(() => AIWA.open({ type: 'fu', custId: 'c1', name: 'Hari', phone: '9811111111' }));
  await page.waitForFunction(() => /मुख्य key सन्देश/.test(document.getElementById('aiwa-text').value));
  assert.deepEqual(calls, ['MAIN']);
  await ctx.close();
});

test('both keys over limit → clear message and the Nepali template stays', async () => {
  const calls = [];
  const { page, ctx } = await loggedIn({
    base, browser, storage: { ...cust, pk3_gem_key: J('MAIN'), pk3_gem_key2: J('BACKUP') },
    mock: (p) => gemini(p, {}, calls),
  });
  await page.evaluate(() => AIWA.open({ type: 'bday', custId: 'c1', name: 'Hari', phone: '9811111111' }));
  await page.waitForFunction(() => /दुवै Gemini key/.test(document.getElementById('aiwa-status').innerText));
  assert.match(await page.inputValue('#aiwa-text'), /जन्मदिन/);
  assert.deepEqual(calls, ['MAIN', 'BACKUP']);
  await ctx.close();
});

test('only a backup key saved → it is used as the Gemini key', async () => {
  const calls = [];
  const { page, ctx } = await loggedIn({
    base, browser, storage: { ...cust, pk3_gem_key2: J('BACKUP') },
    mock: (p) => gemini(p, { BACKUP: OK('एक्लो backup') }, calls),
  });
  const pick = await page.evaluate(() => AIAssistant._pickProvider());
  assert.equal(pick.provider, 'gemini');
  assert.equal(pick.key, 'BACKUP');
  await ctx.close();
});

test('main key over limit with no backup → hint to add a backup key', async () => {
  const { page, ctx } = await loggedIn({
    base, browser, storage: { ...cust, pk3_gem_key: J('MAIN') },
    mock: (p) => gemini(p, {}, []),
  });
  const r = await page.evaluate(() => AIAssistant._callAI(AIAssistant._pickProvider(), 'sys', 'hi'));
  assert.equal(r.quota, true);
  assert.match(r.error, /Backup Gemini API Key/);
  await ctx.close();
});
