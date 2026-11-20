// Item 6: Project / Site progress & profit tracker.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launch, loggedIn, J } from './helpers.mjs';

let srv, base, browser;
before(async () => { ({ srv, base } = await startServer()); browser = await launch(); });
after(async () => { await browser.close(); srv.close(); });

const storage = { pk3_customers: J([{ id: 'c1', name: 'Sita Devi', phone: '9800000002' }]) };

test('create a project from the form with stage, progress and budget', async () => {
  const { page, errors, ctx } = await loggedIn({ base, browser, storage });
  await page.evaluate(() => App.navigate('projects'));
  assert.match(await page.innerText('#proj-list'), /कुनै Project/);
  await page.evaluate(() => Projects.openForm());
  await page.fill('#pj-name', 'Sita Niwas — Interior');
  await page.selectOption('#pj-cust', 'c1');
  await page.fill('#pj-site', 'Hetauda-5');
  await page.selectOption('#pj-stage', 'Work Running');      // auto-raises progress to 50%
  assert.equal(await page.inputValue('#pj-prog'), '50');
  await page.fill('#pj-budget', '500000');
  await page.click('#pj-save');
  const p = await page.evaluate(() => Projects.getData()[0]);
  assert.equal(p.name, 'Sita Niwas — Interior');
  assert.equal(p.custName, 'Sita Devi');
  assert.equal(p.stage, 'Work Running');
  assert.equal(p.progress, 50);
  assert.equal(p.budget, 500000);
  assert.equal(await page.locator('.proj-card').count(), 1);
  assert.match(await page.innerText('.proj-card'), /प्रगति 50%/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('site expenses and payments give estimated profit / loss and flow into Day Book', async () => {
  const proj = [{ id: 'p1', name: 'Ram Bhawan', stage: 'Material Order', progress: 30, budget: 300000 }];
  const { page, ctx } = await loggedIn({ base, browser, storage: { ...storage, pk3_projects: J(proj) } });
  await page.evaluate(() => {
    Projects.addEntry('p1', 'income', 100000, 'First installment');
    Projects.addEntry('p1', 'expense', 120000, 'Plywood & hardware');
    Projects.addEntry('p1', 'expense', 30000, 'Labour');
  });
  const s = await page.evaluate(() => Projects.stats(Projects.get('p1')));
  assert.equal(s.received, 100000);
  assert.equal(s.expense, 150000);
  assert.equal(s.profit, 150000);     // budget − expense
  assert.equal(s.cash, -50000);       // received − expense
  assert.equal(s.due, 200000);        // budget − received
  // Day Book has real, project-tagged entries with voucher numbers
  const db = await page.evaluate(() => STORE.get('pk3_daybook', []).filter((e) => e.projectId === 'p1'));
  assert.equal(db.length, 3);
  assert.ok(db.every((e) => e.voucherNo));
  await page.evaluate(() => App.navigate('projects'));
  assert.match(await page.innerText('.proj-card [data-profit]'), /Rs\. 1,50,000/);
  // detail view
  await page.evaluate(() => Projects.view('p1'));
  assert.match(await page.innerText('#view-modal-body'), /अनुमानित नाफा/);
  // overspend → shows loss
  await page.evaluate(() => Projects.addEntry('p1', 'expense', 200000, 'Extra'));
  await page.evaluate(() => App.navigate('projects'));
  assert.match(await page.innerText('.proj-card'), /अनुमानित घाटा/);
  await ctx.close();
});

test('Day Book entry can be tagged to a project and edit keeps the tag', async () => {
  const proj = [{ id: 'p1', name: 'Ram Bhawan', stage: 'Design', progress: 15, budget: 100000 }];
  const { page, ctx } = await loggedIn({ base, browser, storage: { ...storage, pk3_projects: J(proj) } });
  await page.evaluate(() => { App.navigate('expenses'); Expenses.openAdd(); });
  assert.equal(await page.isVisible('#db-project-grp'), true);
  await page.fill('#db-amount', '25000');
  await page.fill('#db-desc', 'Cement');
  await page.selectOption('#db-project', 'p1');
  await page.evaluate(() => DayBook.save());
  const e = await page.evaluate(() => STORE.get('pk3_daybook', [])[0]);
  assert.equal(e.projectId, 'p1');
  await page.evaluate((id) => DayBook.edit(id), e.id);
  assert.equal(await page.inputValue('#db-project'), 'p1');
  await page.evaluate(() => DayBook.save());
  assert.equal(await page.evaluate(() => STORE.get('pk3_daybook', [])[0].projectId), 'p1');
  assert.equal(await page.evaluate(() => Projects.stats(Projects.get('p1')).expense), 25000);
  await ctx.close();
});

test('filters, completed stage and delete', async () => {
  const proj = [
    { id: 'p1', name: 'Active One', stage: 'Design', progress: 15, budget: 1 },
    { id: 'p2', name: 'Done One', stage: 'Completed', progress: 100, budget: 1 },
  ];
  const { page, ctx } = await loggedIn({ base, browser, storage: { ...storage, pk3_projects: J(proj) } });
  await page.evaluate(() => App.navigate('projects'));
  assert.equal(await page.locator('.proj-card').count(), 1);
  await page.click('#proj-f-completed');
  assert.match(await page.innerText('#proj-list'), /Done One/);
  await page.click('#proj-f-all');
  assert.equal(await page.locator('.proj-card').count(), 2);
  await page.evaluate(() => Projects.del('p2'));
  assert.equal(await page.evaluate(() => Projects.getData().length), 1);
  await ctx.close();
});

test('projects are included in backups and Dropbox sync; staff cannot open them', async () => {
  const { page, ctx } = await loggedIn({ base, browser, storage: { ...storage, pk3_projects: J([{ id: 'p1', name: 'X', stage: 'Design' }]) } });
  assert.ok(await page.evaluate(() => Backup.ALL_KEYS.includes('pk3_projects')));
  assert.ok(await page.evaluate(() => 'pk3_projects' in DBX.collect()));
  const blocked = await page.evaluate(() => { currentUser = { user: 's', role: 'staff', name: 'Staff' }; App.navigate('projects'); return App.currentPage !== 'projects'; });
  assert.equal(blocked, true);
  await ctx.close();
});
