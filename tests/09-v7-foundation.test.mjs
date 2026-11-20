// v7.0.0 stage 1: modular files, zero-hardcoding, safe migration of existing data,
// Setup Wizard (business type) and Modules On/Off.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch, openApp, loggedIn, ROOT, LICENSED, SESSION_OLD, TEST_MASTER, appFiles, J } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

// What a real v6.9 device of the original owner looks like (settings partly empty,
// templates that v6 seeded with the company name/phone/address written in).
const V6_TEMPLATES = [
  { name: '🏢 Company Introduction', text: 'नमस्ते {name} जी! 🙏\nPRERAK MULTIPURPOSE PVT LTD मा हार्दिक स्वागत छ!\n📞 9855069733 | 9801069733\n📍 Hetauda-2, Kantirajpath, Makwanpur' },
  { name: 'My own template', text: 'Hello {name}, thanks — Prerak Multipurpose Pvt. Ltd.' },
];
const V6_DEVICE = {
  pk3_data_version: '5',
  pk3_settings: J({ companyName: 'PRERAK MULTIPURPOSE PVT LTD', fiscalYear: '2082/083' }),
  pk3_company: J({ name: 'PRERAK MULTIPURPOSE PVT LTD', address: 'Hetauda-2, Makwanpur', phone1: '9801069733' }),
  pk3_customers: J([{ id: 'c1', name: 'Ram Bahadur', phone: '9800000001', work: 'UPVC' }]),
  pk3_rates: J({ 'My Category': [{ name: 'My Item', rate: 777, unit: 'sqft' }] }),
  pk3_templates: J(V6_TEMPLATES),
};

test('modular build: every script/style in index.html exists and sw.js pre-caches it', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const files = [...appFiles(), ...[...html.matchAll(/href="(css\/[^"?]+)/g)].map((m) => m[1])];
  assert.ok(files.length > 50, 'split into many files');
  for (const f of files) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), f + ' exists');
    assert.ok(sw.includes("'./" + f + "'"), f + ' in sw.js');
  }
  assert.ok(fs.statSync(path.join(ROOT, 'index.html')).size < 250000, 'index.html is now small');
  assert.doesNotMatch(html, /type="module"/, 'classic scripts only (works on file:// and with no build step)');
});

test('no company name / phone / address is hardcoded in the app (outside the v6 migration + license)', () => {
  const allowed = new Set(['js/core/migrations.js', 'js/core/license.js', 'js/core/company.js', 'js/core/date-bs.js', 'js/modules/customers.js', 'js/core/data-init.js']);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const bad = /prerak|9801069733|9855069733|kantirajpath|hetauda-2/i;
  assert.doesNotMatch(html, bad, 'index.html');
  for (const f of appFiles()) {
    if (allowed.has(f)) continue;
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.doesNotMatch(src, bad, f);
  }
  assert.doesNotMatch(html, /v3\.9 Final/);
});

test('existing v6.9 device: data untouched, no wizard, company filled, templates use {company}', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: V6_DEVICE });
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => ({
    biz: STORE.get('pk3_business'),
    wizardOpen: !!document.querySelector('#setup-wizard-modal.open'),
    s: STORE.get('pk3_settings'),
    cust: STORE.get('pk3_customers'),
    rates: STORE.get('pk3_rates'),
    tpl: STORE.get('pk3_templates'),
    backup: STORE.get('pk3_v7_backup_templates'),
    mods: Modules.state(),
    filled: fillTemplate(STORE.get('pk3_templates')[0], { name: 'Sita' }),
  }));
  assert.equal(r.biz.type, 'construction');
  assert.equal(r.biz.setupDone, true);
  assert.equal(r.wizardOpen, false);
  assert.equal(r.cust.length, 1);
  assert.equal(r.cust[0].name, 'Ram Bahadur');
  assert.equal(r.rates['My Category'][0].rate, 777, 'own rates kept');
  assert.equal(r.s.companyName, 'PRERAK MULTIPURPOSE PVT LTD');
  assert.equal(r.s.phone1, '9855069733', 'v6.9 print fallback kept for the original owner');
  assert.equal(r.s.fiscalYear, '2082/083');
  assert.match(r.tpl[0].text, /\{company\} मा हार्दिक/);
  assert.match(r.tpl[0].text, /\{phone1\} \| \{phone2\}/);
  assert.match(r.tpl[0].text, /\{company_address\}/);
  assert.equal(r.tpl[1].name, 'My own template');
  assert.deepEqual(r.backup, V6_TEMPLATES, 'original templates backed up');
  assert.ok(Object.values(r.mods).every(Boolean), 'all modules On for existing users');
  // What the customer receives is the same as before
  assert.match(r.filled, /PRERAK MULTIPURPOSE PVT LTD मा हार्दिक स्वागत छ/);
  assert.match(r.filled, /9855069733 \| 9801069733/);
  assert.match(r.filled, /Hetauda-2, Makwanpur/);
  // migration runs once: reload does not change anything again
  await page.evaluate(() => { const s = STORE.get('pk3_settings'); s.phone2 = ''; STORE.set('pk3_settings', s); });
  await page.reload();
  await page.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser);
  assert.equal(await page.evaluate(() => STORE.get('pk3_settings').phone2), '');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('existing device of another licensed company never gets someone else\'s details', async () => {
  const lic = J({ company: 'RAM TRADERS', key: TEST_MASTER, plan: 'MASTER', expiry: null, activatedAt: '2025-01-01T00:00:00.000Z' });
  const { page, ctx } = await loggedIn({ base, browser, storage: { ...V6_DEVICE, pk3_license: lic, pk3_settings: J({}) } });
  const r = await page.evaluate(() => ({ s: STORE.get('pk3_settings'), doc: DocPrint._co(), msg: fillTemplate({ text: '{company} 📞 {phone1}' }, { name: 'x' }) }));
  assert.equal(r.s.companyName, 'RAM TRADERS');
  assert.ok(!r.s.phone1, 'no phone invented');
  assert.equal(r.doc.name, 'RAM TRADERS');
  assert.equal(r.doc.phone, '');
  assert.doesNotMatch(J(r), /PRERAK|9855069733|Hetauda/i);
  await ctx.close();
});

test('fresh device: Setup Wizard sets company + business type, rates/templates/modules follow it', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: {} });
  await page.waitForSelector('#setup-wizard-modal.open', { timeout: 5000 });
  await page.fill('#wz-co-name', 'Shree Hardware Suppliers');
  await page.fill('#wz-co-phone1', '9811111111');
  await page.fill('#wz-co-address', 'Butwal-5');
  await page.evaluate(() => SetupWizard.next());
  await page.click('[data-wz-type="hardware"]');
  await page.click('#wz-finish');
  const r = await page.evaluate(() => ({
    biz: STORE.get('pk3_business'), rates: Object.keys(STORE.get('pk3_rates')), svcs: STORE.get('pk3_services').map((s) => s.name),
    tpls: STORE.get('pk3_templates').map((t) => t.name), mods: Modules.state(), open: !!document.querySelector('#setup-wizard-modal.open'),
    intro: IntroCard._textVersion(),
    msg: fillTemplate(STORE.get('pk3_templates').find((t) => t.name === '🏢 Company Introduction'), { name: 'Hari' }),
    projNav: getComputedStyle(document.querySelector('.nav-item[data-page="projects"]')).display,
    footer: document.querySelector('footer [data-company-name]').textContent,
  }));
  assert.equal(r.biz.type, 'hardware');
  assert.equal(r.biz.setupDone, true);
  assert.equal(r.open, false);
  assert.ok(r.rates.includes('Cement & Steel'));
  assert.ok(!r.rates.includes('UPVC / Aluminum'), 'construction defaults replaced on a fresh device');
  assert.ok(r.svcs.includes('Plywood & Board'));
  assert.ok(r.tpls.includes('📦 Order Ready'));
  assert.equal(r.mods.projects, false);
  assert.equal(r.mods.measurement, false);
  assert.equal(r.mods.stock, true);
  assert.equal(r.projNav, 'none', 'Projects menu hidden');
  assert.match(r.msg, /Shree Hardware Suppliers मा हार्दिक स्वागत/);
  assert.match(r.msg, /✅ Cement, Rod & Building Material/);
  assert.match(r.msg, /📍 Butwal-5/);
  assert.doesNotMatch(r.msg, /\{|✉️|""/, 'empty placeholders tidied');
  assert.match(r.intro, /Shree Hardware Suppliers/);
  assert.equal(r.footer, 'Shree Hardware Suppliers');
  // Projects page cannot be opened while Off
  await page.evaluate(() => App.navigate('projects'));
  assert.equal(await page.evaluate(() => App.currentPage), 'dashboard');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('wizard on a device with data only ADDS (never overwrites) rates, services, templates', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage: V6_DEVICE });
  const r = await page.evaluate(() => {
    const before = STORE.get('pk3_templates').length;
    const res = SetupWizard.applyProfile('furniture');
    return { res, rates: STORE.get('pk3_rates'), tpls: STORE.get('pk3_templates'), before, mods: Modules.state(), type: Company.businessType() };
  });
  assert.equal(r.res.mode, 'merge');
  assert.equal(r.rates['My Category'][0].rate, 777);
  assert.ok(r.rates['Living Room'], 'new category added');
  assert.equal(r.tpls[1].name, 'My own template');
  assert.ok(r.tpls.length > r.before);
  assert.equal(r.type, 'furniture');
  await ctx.close();
});

test('Modules On/Off hides menus + dashboard cards and comes back with data intact', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage: V6_DEVICE });
  await page.evaluate(() => App.navigate('settings'));
  assert.equal(await page.locator('#set-modules-list input[type=checkbox]').count(), 7);
  const vis = () => page.evaluate(() => ['.nav-item[data-page="stocklist"]', '.stat-card[data-module="stock"]', '.nav-item[data-page="quotations"]', '#bn-quotations', '.nav-item[data-page="walkin"]', '.nav-item[data-page="ai-assistant"]']
    .map((s) => getComputedStyle(document.querySelector(s)).display !== 'none'));
  assert.deepEqual(await vis(), [true, true, true, true, true, true]);
  await page.uncheck('[data-mod-toggle="stock"]');
  await page.uncheck('[data-mod-toggle="quotations"]');
  await page.uncheck('[data-mod-toggle="walkin"]');
  await page.uncheck('[data-mod-toggle="ai"]');
  assert.deepEqual(await vis(), [false, false, false, false, false, false]);
  await page.reload();
  await page.waitForFunction(() => typeof currentUser !== 'undefined' && currentUser);
  assert.deepEqual(await vis(), [false, false, false, false, false, false], 'remembered after reload');
  assert.equal(await page.evaluate(() => { App.navigate('quotations'); return App.currentPage; }), 'dashboard');
  await page.evaluate(() => Modules.setAll({}));
  assert.deepEqual(await vis(), [true, true, true, true, true, true]);
  assert.equal(await page.evaluate(() => STORE.get('pk3_customers').length), 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('print / visiting card / AI prompts use only the user\'s Company Settings', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage: { ...V6_DEVICE, pk3_settings: J({ companyName: 'Sagar Furniture Udhyog', phone1: '9822222222', address: 'Itahari-3' }), pk3_v7_migrated: '1', pk3_business: J({ type: 'furniture', setupDone: true }) } });
  const r = await page.evaluate(() => ({
    co: DocPrint._co(),
    ai: AIAssistant._prompt('reply') + AIAssistant._prompt('competitor'),
    aiwa: AIWA._prompt({ company: Company.name(), coPhone: '9822222222', name: 'Hari', type: 'greet' }, 'Greeting', 'short'),
    tpl: AIWA.template({ company: Company.name(), coPhone: '9822222222', name: 'Hari', type: 'greet' }),
  }));
  assert.equal(r.co.name, 'Sagar Furniture Udhyog');
  assert.equal(r.co.address, 'Itahari-3');
  assert.match(r.ai, /Sagar Furniture Udhyog, a furniture showroom in Nepal/);
  assert.match(r.ai, /Sofa & Living Room/);
  assert.doesNotMatch(J(r), /PRERAK|Prerak|9855069733|Hetauda|UPVC/);
  await ctx.close();
});
