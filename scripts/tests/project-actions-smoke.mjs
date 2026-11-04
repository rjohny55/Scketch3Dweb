import { _electron as electron } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';

const executablePath = path.resolve(process.argv[2] || 'dist/desktop-1.0.14/linux-unpacked/scketch3dweb');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'scketch-project-actions-'));
const base = 'http://127.0.0.1:62174';
const env = { ...process.env, XDG_CONFIG_HOME: profile, SCKETCH3DWEB_DESKTOP_PORT: '62174' };
delete env.ELECTRON_RUN_AS_NODE;
const args = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'];
const password = randomBytes(24).toString('hex');
let app;
const launch = async () => {
  app = await electron.launch({ executablePath, args, env, timeout: 60000 });
  const page = await app.firstWindow(); page.setDefaultTimeout(90000);
  await page.addInitScript(() => localStorage.setItem('scketch3dweb.language', 'en'));
  return page;
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  let page = await launch(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.waitForLoadState('domcontentloaded');
  const setup = await page.request.post(base + '/api/auth', { data: { action: 'setup', username: 'project-actions', displayName: 'Project Actions', password } }); assert(setup.ok());
  await page.reload();
  await page.locator('[data-open-demo="cmp170-fan-adapter"]').click();
  await page.waitForFunction(() => window.scketch3dwebReadRulerMeasurements?.().segmentCount === 12);
  const before = await page.evaluate(() => ({ faces: window.scketch3dwebReadFaceAnnotations(), rulers: window.scketch3dwebReadRulerMeasurements() }));
  await page.getByRole('button', { name: 'Home dashboard', exact: true }).click();
  await page.locator('.project-menu-trigger').first().waitFor();
  let projects = (await (await page.request.get(base + '/api/shared-projects?scope=mine')).json()).projects;
  assert.equal(projects.length, 1); const original = projects[0];
  const originalHash = digest(await (await page.request.get(base + '/api/shared-projects?fileName=' + encodeURIComponent(original.fileName))).body());
  await page.locator('.project-menu-trigger').first().click();
  await page.getByRole('menuitem', { name: 'Create a copy', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.project-card').length === 2);
  projects = (await (await page.request.get(base + '/api/shared-projects?scope=mine')).json()).projects;
  assert.equal(projects.length, 2); const copy = projects.find(p => p.fileName !== original.fileName); assert(copy); assert.equal(copy.shared, false); assert(copy.name.includes('(copy)'));
  assert.equal(digest(await (await page.request.get(base + '/api/shared-projects?fileName=' + encodeURIComponent(original.fileName))).body()), originalHash);
  const copyCard = page.locator('.project-card').filter({ has: page.locator('.project-card-title', { hasText: copy.name }) });
  await copyCard.locator('.project-menu-trigger').click(); await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename project', exact: true });
  await dialog.getByRole('textbox', { name: 'Project name' }).fill('Independent flange');
  let failed = false;
  await page.route('**/api/shared-projects?fileName=*', async route => {
    if (!failed && route.request().method() === 'PATCH') { failed = true; await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Simulated save error' }) }); }
    else await route.continue();
  });
  await dialog.getByRole('button', { name: 'Save', exact: true }).click(); await dialog.getByRole('alert').waitFor();
  assert.equal(await dialog.getByRole('textbox', { name: 'Project name' }).inputValue(), 'Independent flange');
  await page.unroute('**/api/shared-projects?fileName=*');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  await page.reload();
  const renamed = page.locator('.project-card').filter({ has: page.locator('.project-card-title', { hasText: 'Independent flange' }) });
  await renamed.locator('.project-card-open').click();
  await page.waitForFunction(() => window.scketch3dwebReadRulerMeasurements?.().segmentCount === 12);
  const after = await page.evaluate(() => ({ faces: window.scketch3dwebReadFaceAnnotations(), rulers: window.scketch3dwebReadRulerMeasurements() }));
  assert.equal(after.faces.annotations.length, before.faces.annotations.length); assert(after.faces.annotations.every(f => f.status === 'valid'));
  assert.equal(after.rulers.segmentCount, before.rulers.segmentCount);
  assert.equal(after.rulers.segments[0].lengthMm, before.rulers.segments[0].lengthMm);
  assert.equal(digest(await (await page.request.get(base + '/api/shared-projects?fileName=' + encodeURIComponent(original.fileName))).body()), originalHash);
  await app.close(); app = undefined;
  page = await launch(); await page.waitForLoadState('domcontentloaded');
  const login = await page.request.post(base + '/api/auth', { data: { action: 'login', username: 'project-actions', password } }); assert(login.ok());
  await page.reload(); await page.locator('.project-card-title', { hasText: 'Independent flange' }).waitFor();
  // Simulate a second installation with no local dashboard cache. Account
  // projects must remain copyable without opening the original in the editor.
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.project-card').length === 2);
  const remoteCard = page.locator('.project-card').filter({ has: page.locator('.project-card-title', { hasText: 'Independent flange' }) });
  await remoteCard.locator('.project-menu-trigger').click(); await page.getByRole('menuitem', { name: 'Create a copy', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.project-card').length === 3);
  const remoteCopies = (await (await page.request.get(base + '/api/shared-projects?scope=mine')).json()).projects;
  assert.equal(remoteCopies.length, 3); assert(remoteCopies.some(p => p.name === 'Independent flange (copy)'));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ version: await app.evaluate(({ app }) => app.getVersion()), duplicate: true, independentAccountFile: true, originalUnchanged: true, rulerSegments: after.rulers.segmentCount, faceLabels: after.faces.annotations.length, renameFailureRetainsInput: true, renameAfterReload: true, serverOnlyCopy: true, restartAndLogin: true, browserErrors: 0 }));
} finally { await app?.close(); fs.rmSync(profile, { recursive: true, force: true }); }
