/** Actual MV3 runtime and trusted keyboard regression in a disposable profile.
 * Popup HTML uses its actual UI/runtime path; native toolbar is checked on Windows.
 * No simulated update events or restart-by-reinstall checks are used here.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH);
const extensionPath = path.resolve(process.env.EASYCV_EXT_PATH || 'dist');
const origin = process.env.TEST_ORIGIN || 'http://easycv.localhost:18963';
const fixture = '/test/fixtures/state-sync.html';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'easycv-state-'));
const results = [];
const evidence = {};
let context;
async function check(name, run) {
  try { await run(); results.push({ name, pass: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, pass: false, error: error.stack }); console.error(`FAIL ${name}: ${error.message}`); }
}
const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROMIUM_PATH, headless: false,
    args: [`--load-extension=${extensionPath}`, `--disable-extensions-except=${extensionPath}`]
  });
  context.setDefaultTimeout(6000);
  const sw = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(sw.url()).host;
  const set = async data => { await sw.evaluate(data => chrome.storage.sync.set(data), data); await new Promise(r => setTimeout(r, 300)); };
  const get = () => sw.evaluate(() => chrome.storage.sync.get(null));
  const page = await context.newPage();
  const second = await context.newPage();
  const popup = await context.newPage();
  const options = await context.newPage();
  const openPopup = async () => {
    await page.bringToFront();
    await popup.goto(`chrome-extension://${id}/popup/popup.html`);
    await popup.waitForFunction(() => !document.querySelector('#loadingOverlay')?.classList.contains('show') && document.querySelector('#mainUnlockBtn'));
    await popup.waitForTimeout(400);
  };
  const paste = async (target, field, expected, token) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(target.url()).origin });
    await target.bringToFront();
    await target.evaluate(token => navigator.clipboard.writeText(token), token);
    await target.locator(`#${field}`).fill('');
    await target.locator(`#${field}`).click();
    await target.keyboard.press(`${modifier}+v`);
    await target.waitForTimeout(150);
    assert.equal(await target.locator(`#${field}`).inputValue(), expected ? token : '', `${field} on ${target.url()}`);
    if (expected) {
      assert.equal(await target.evaluate(field => window.testEvents.some(e => e.id === field && e.trusted && !e.prevented), field), true);
    }
  };
  const restrictions = async (target, enabled, token) => {
    await paste(target, 'plain', true, token);
    for (const field of ['inline', 'input', 'listener', 'keyboard']) await paste(target, field, enabled, token);
  };
  await page.goto(origin + fixture);
  await check('Options force mode survives refresh and unrelated setting save', async () => {
    await set({ plugin_enabled: true, force_mode: false, user_settings: { forceMode: false, copyEnabled: true, pasteEnabled: true } });
    await options.goto(`chrome-extension://${id}/options/options.html`);
    await options.locator('label').filter({ has: options.locator('#forceMode') }).click();
    await options.waitForTimeout(350);
    assert.equal((await get()).force_mode, true);
    await options.reload();
    assert.equal(await options.locator('#forceMode').isChecked(), true);
    await options.locator('label').filter({ has: options.locator('#showNotifications') }).click();
    await options.waitForTimeout(350);
    assert.equal((await get()).force_mode, true);
    evidence.options = await get();
  });
  await set({ plugin_enabled: true, force_mode: false, auto_enable_list: [], excluded_list: [], user_settings: { copyEnabled: false, pasteEnabled: false } });
  await page.goto(origin + fixture + '?a'); await second.goto(origin + fixture + '?b');
  await page.waitForTimeout(800);
  await check('disabled child switches retain all four paste restrictions', async () => {
    await restrictions(page, false, 'EASYCV_NEGATIVE');
  });
  await check('Popup enables four paste mechanisms in both existing tabs without reload', async () => {
    await openPopup(); await popup.locator('#mainUnlockBtn').click();
    await page.waitForTimeout(800);
    await restrictions(page, true, 'EASYCV_POPUP_A');
    await restrictions(second, true, 'EASYCV_POPUP_B');
    evidence.afterPopup = await get();
  });
  await check('selection and trusted copy work after Popup enable without reload', async () => {
    await page.bringToFront();
    assert.notEqual(await page.locator('#restricted').evaluate(el => getComputedStyle(el).userSelect), 'none');
    await page.locator('#restricted').evaluate(el => {
      const range = document.createRange(); range.selectNodeContents(el);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    });
    await page.keyboard.press(`${modifier}+c`);
    await page.locator('#plain').fill(''); await page.locator('#plain').click();
    await page.keyboard.press(`${modifier}+v`);
    assert.equal(await page.locator('#plain').inputValue(), 'EASYCV_STATE_COPY_TEXT');
  });
  await check('Popup disable and re-enable restore restrictions and unlock without reload', async () => {
    await openPopup(); await popup.locator('#mainUnlockBtn').click();
    await page.waitForTimeout(500);
    await restrictions(page, false, 'EASYCV_OFF_AGAIN');
    await restrictions(second, false, 'EASYCV_OFF_TAB_B');
    await openPopup(); await popup.locator('#mainUnlockBtn').click();
    await page.waitForTimeout(500);
    await restrictions(page, true, 'EASYCV_ON_AGAIN');
  });
  await check('stale Options page cannot overwrite a Popup force-mode change', async () => {
    await options.reload();
    assert.equal(await options.locator('#forceMode').isChecked(), false);
    await openPopup(); await popup.locator('#advancedSection > summary').click();
    await popup.locator('label').filter({ has: popup.locator('#forceMode') }).click();
    await popup.waitForTimeout(500);
    assert.equal((await get()).force_mode, true);
    await options.locator('label').filter({ has: options.locator('#showNotifications') }).click();
    await options.waitForTimeout(350);
    assert.equal((await get()).force_mode, true);
    await options.reload();
    assert.equal(await options.locator('#forceMode').isChecked(), true);
  });
  await check('global toggles do not activate an already excluded tab', async () => {
    await set({ excluded_list: ['blocked.localhost'], auto_enable_list: [{ domain: 'blocked.localhost', copyEnabled: true, pasteEnabled: true }] });
    await second.goto(origin.replace('easycv.localhost', 'blocked.localhost') + fixture);
    await second.waitForTimeout(500);
    await set({ plugin_enabled: false }); await set({ plugin_enabled: true, force_mode: true });
    await second.waitForTimeout(500);
    await restrictions(second, false, 'EASYCV_EXCLUDED');
    assert.equal(await second.evaluate(() => !!window.EasyCVInjected), false);
  });
  await check('auto list first visit unlocks actual inputs without refresh', async () => {
    await set({ plugin_enabled: true, force_mode: false, user_settings: { copyEnabled: false, pasteEnabled: false },
      auto_enable_list: [{ domain: 'fresh.localhost', copyEnabled: true, pasteEnabled: true }] });
    await page.goto(origin.replace('easycv.localhost', 'fresh.localhost') + fixture);
    await page.waitForTimeout(800);
    await restrictions(page, true, 'EASYCV_AUTO_FIRST');
  });
  await check('adding a previously visited domain takes effect on next visit', async () => {
    await set({ user_settings: { copyEnabled: false, pasteEnabled: false }, auto_enable_list: [] });
    const url = origin.replace('easycv.localhost', 'cached.localhost') + fixture;
    await page.goto(url); await page.waitForTimeout(500);
    await set({ auto_enable_list: [{ domain: 'cached.localhost', copyEnabled: true, pasteEnabled: true }] });
    await page.goto(url + '?listed'); await page.waitForTimeout(800);
    await restrictions(page, true, 'EASYCV_AUTO_ADDED');
  });
  await check('removing an auto domain invalidates its positive cache', async () => {
    await set({ user_settings: { copyEnabled: false, pasteEnabled: false }, auto_enable_list: [] });
    await page.goto(origin.replace('easycv.localhost', 'cached.localhost') + fixture + '?removed');
    await page.waitForTimeout(800);
    assert.equal((await get()).user_settings.pasteEnabled, false);
    await paste(page, 'inline', false, 'EASYCV_AUTO_REMOVED');
  });
} catch (error) { results.push({ name: 'harness', pass: false, error: error.stack }); }
finally {
  if (context) await context.close();
  fs.rmSync(profile, { recursive: true, force: true });
  const result = { extensionPath, browser: process.env.CHROMIUM_PATH, results, evidence,
    notCovered: ['native toolbar/menu', 'normal installed-browser restart', 'store upgrade'] };
  if (process.env.RESULT_PATH) fs.writeFileSync(process.env.RESULT_PATH, JSON.stringify(result, null, 2) + '\n');
}
console.log(`${results.filter(r => r.pass).length}/${results.length} passed`);
process.exitCode = results.some(r => !r.pass) ? 1 : 0;
