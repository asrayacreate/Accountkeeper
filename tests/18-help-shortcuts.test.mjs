// v7.3.0 item 4 — in-app "❓ मद्दत" (short Nepali module guide) + laptop keyboard shortcuts.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch, loggedIn, openApp, J, ROOT } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const EXISTING = { pk3_settings: J({ companyName: 'Test Traders', phone1: '9800000000' }), pk3_business: J({ type: 'retail', setupDone: true }), pk3_v7_migrated: '1' };
const helpOpen = (page) => page.evaluate(() => HelpGuide.isOpen());
const openModals = (page) => page.evaluate(() => [...document.querySelectorAll('.modal-overlay.open')].map((m) => m.id));

test('❓ topbar button + F1 + ? open the help on the current page’s section; Esc closes it', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: EXISTING });
  await page.evaluate(() => App.navigate('invoices'));
  await page.click('#help-btn');
  assert.equal(await helpOpen(page), true);
  assert.equal(await page.getAttribute('.help-sec.open', 'data-help'), 'invoices', 'opens on the section for this page');
  const txt = await page.innerText('#help-list');
  assert.match(txt, /बिक्री बिल/);
  await page.keyboard.press('Escape');
  assert.equal(await helpOpen(page), false);

  await page.evaluate(() => App.navigate('stocklist'));
  await page.keyboard.press('F1');
  assert.equal(await helpOpen(page), true);
  assert.equal(await page.getAttribute('.help-sec.open', 'data-help'), 'stock');
  await page.keyboard.press('F1');
  assert.equal(await helpOpen(page), false, 'F1 toggles');

  await page.keyboard.press('Shift+Slash'); // "?"
  assert.equal(await helpOpen(page), true);
  // search filters sections; "खोल्नुहोस्" navigates
  await page.fill('#help-search', 'backup');
  const secs = await page.$$eval('.help-sec', (els) => els.map((e) => e.dataset.help));
  assert.ok(secs.includes('backup'));
  assert.ok(!secs.includes('stock'));
  await page.click('.help-sec[data-help="backup"] .help-sec-body button');
  assert.equal(await helpOpen(page), false);
  assert.equal(await page.evaluate(() => App.currentPage), 'backup');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Esc closes help first when it sits on top of another popup', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: EXISTING });
  await page.evaluate(() => { App.navigate('invoices'); Invoices.create(); });
  await page.keyboard.press('F1');
  assert.deepEqual(await openModals(page), ['inv-edit-modal', 'help-modal']);
  await page.keyboard.press('Escape');
  assert.deepEqual(await openModals(page), ['inv-edit-modal'], 'invoice form stays open');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Alt+N / Alt+Q / Alt+C / Alt+P / Alt+D navigate; never while typing or with a form open', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: EXISTING });
  await page.evaluate(() => App.navigate('dashboard'));
  await page.keyboard.press('Alt+KeyN');
  assert.deepEqual(await openModals(page), ['inv-edit-modal'], 'new invoice form');
  assert.equal(await page.evaluate(() => App.currentPage), 'invoices');

  // A form is open → navigation shortcuts do nothing (no lost work)
  await page.keyboard.press('Alt+KeyD');
  assert.equal(await page.evaluate(() => App.currentPage), 'invoices');
  await page.evaluate(() => document.getElementById('inv-edit-modal').classList.remove('open'));

  await page.keyboard.press('Alt+KeyQ');
  assert.equal(await page.evaluate(() => App.currentPage), 'add-quotation');
  await page.keyboard.press('Alt+KeyC');
  assert.equal(await page.evaluate(() => App.currentPage), 'add-customer');

  // typing in a field: Alt+D and "/" and "?" are ignored, the text is kept
  await page.click('#page-add-customer input[type="text"]');
  await page.keyboard.type('Ram/?');
  await page.keyboard.press('Alt+KeyD');
  assert.equal(await page.evaluate(() => App.currentPage), 'add-customer');
  assert.equal(await helpOpen(page), false);
  assert.equal(await page.evaluate(() => document.activeElement.value), 'Ram/?');
  await page.evaluate(() => document.activeElement.blur());

  await page.keyboard.press('Alt+KeyP');
  assert.equal(await page.evaluate(() => App.currentPage), 'purchases');
  assert.deepEqual(await openModals(page), ['pur-modal']);
  await page.evaluate(() => Purchases.close());
  await page.keyboard.press('Alt+KeyD');
  assert.equal(await page.evaluate(() => App.currentPage), 'dashboard');

  // "/" focuses the search box
  await page.keyboard.press('Slash');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'global-search');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Ctrl+S saves the open form even while typing, once per press; the browser save dialog is blocked', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: EXISTING });
  await page.evaluate(() => { App.navigate('stocklist'); });
  await page.evaluate(() => { document.getElementById('stk-modal').classList.add('open'); });
  await page.fill('#stk-name', 'Kb Item');
  await page.fill('#stk-qty', '4');
  await page.focus('#stk-qty');
  const prevented = await page.evaluate(() => {
    const e = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(e);
    return e.defaultPrevented;
  });
  assert.equal(prevented, true);
  await page.waitForTimeout(200);
  const items = await page.evaluate(() => (STORE.get('pk3_stock', []) || []).filter((x) => x.name === 'Kb Item'));
  assert.equal(items.length, 1, 'saved exactly once');
  assert.equal(Number(items[0].qty), 4);

  // pressing again immediately does not double save
  await page.waitForTimeout(800);
  await page.evaluate(() => { document.getElementById('stk-modal').classList.add('open'); document.getElementById('stk-name').value = 'Second'; });
  await page.keyboard.press('Control+KeyS');
  await page.keyboard.press('Control+KeyS');
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => (STORE.get('pk3_stock', []) || []).filter((x) => x.name === 'Second').length), 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Ctrl+S picks the save button nearest the focused field; asks when unclear; nothing to save → toast', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: EXISTING });
  await page.evaluate(() => App.navigate('settings'));
  const r = await page.evaluate(() => {
    document.activeElement && document.activeElement.blur();
    const none = KeyShort.findSave().why;
    const cn = document.getElementById('set-company') || document.querySelector('#page-settings input[type="text"]');
    cn.focus();
    const f = KeyShort.findSave();
    return { none, why: f.why, txt: f.btn && f.btn.textContent };
  });
  assert.equal(r.none, 'many', 'Settings has many forms: no blind save');
  assert.equal(r.why, 'focus');
  assert.match(r.txt, /Save|सेभ/);
  await page.evaluate(() => { document.activeElement.blur(); App.navigate('dashboard'); });
  assert.equal(await page.evaluate(() => KeyShort.findSave().why), 'none');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('no shortcut fires on the login screen', async () => {
  const { page, errors, ctx } = await openApp({ base, browser, storage: { pk3_sample_seeded: '1' } });
  // licence or login screen is showing; nobody is logged in
  assert.equal(await page.evaluate(() => KeyShort.ready()), false);
  await page.keyboard.press('F1');
  assert.equal(await page.evaluate(() => !!document.getElementById('help-modal') && HelpGuide.isOpen()), false);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('staff only see guide sections they may open; switched-off modules are hidden', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: EXISTING });
  const r = await page.evaluate(() => {
    const all = HelpGuide.visibleSections().map((s) => s.id);
    const real = currentUser;
    currentUser = Object.assign({}, real, { role: 'staff' });
    const staff = HelpGuide.visibleSections().map((s) => s.id);
    currentUser = real;
    return { all, staff };
  });
  assert.ok(r.all.includes('invoices') && r.all.includes('backup'));
  assert.ok(r.staff.includes('customers') && r.staff.includes('quotations'));
  assert.ok(!r.staff.includes('invoices') && !r.staff.includes('backup') && !r.staff.includes('purchases'), 'admin pages hidden from staff');
  const off = await page.evaluate(() => {
    const orig = Modules.pageAllowed;
    Modules.pageAllowed = (p) => p !== 'stocklist';
    const ids = HelpGuide.visibleSections().map((s) => s.id);
    Modules.pageAllowed = orig;
    return ids;
  });
  assert.ok(!off.includes('stock'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Help / About page lists the shortcuts; help text has no company data', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: EXISTING });
  await page.evaluate(() => App.navigate('help'));
  const t = await page.innerText('#help-page-keys');
  assert.match(t, /Ctrl/);
  assert.match(t, /नयाँ बिक्री बिल/);
  const src = fs.readFileSync(path.join(ROOT, 'js/ui/help-keys.js'), 'utf8');
  assert.doesNotMatch(src, /prerak|test traders|98\d{8}/i);
  assert.deepEqual(errors, []);
  await ctx.close();
});
