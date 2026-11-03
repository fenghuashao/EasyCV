/**
 * Local MV3 regression using an isolated temporary profile, never a personal profile.
 * Requires PLAYWRIGHT_PATH, CHROMIUM_PATH and the local static server.
 * EASYCV_EXT_PATH may point to the preserved 1.1.1 build or extracted release ZIP.
 * Native toolbar popup/context-menu clicks and real-site acceptance remain manual.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { acceptPrivacyConsent } from './helpers/privacy-consent.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH);
const extensionPath = path.resolve(process.env.EASYCV_EXT_PATH || 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json')));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'easycv-permission-'));
const url = `${process.env.TEST_ORIGIN || 'http://easycv.localhost:8931'}/test/fixtures/permission-fix.html`;
const results = [];
const diagnostics = {};
let context;
async function installationLog(ctx, workerUrl) {
  // Runtime.enable replays this isolated worker's buffered console messages.
  const client = await ctx.browser().newBrowserCDPSession();
  const entries = [];
  client.on('Target.receivedMessageFromTarget', ({ message }) => {
    const event = JSON.parse(message);
    if (event.method === 'Runtime.consoleAPICalled' &&
        event.params.args[0]?.value === 'EasyCV installed:') entries.push(event.params.args);
  });
  try {
    const { targetInfos } = await client.send('Target.getTargets');
    const target = targetInfos.find(info => info.url === workerUrl && info.type === 'service_worker');
    const { sessionId } = await client.send('Target.attachToTarget', { targetId: target.targetId, flatten: false });
    await client.send('Target.sendMessageToTarget', { sessionId,
      message: JSON.stringify({ id: 1, method: 'Runtime.enable' }) });
    await new Promise(resolve => setTimeout(resolve, 300));
    return entries;
  } catch (error) { return { unavailable: error.message }; }
  finally { await client.detach(); }
}
async function check(name, fn) {
  try { await fn(); results.push({ name, pass: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, pass: false, error: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
}
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROMIUM_PATH, headless: process.env.EASYCV_HEADLESS === '1', locale: 'zh-CN',
    args: [`--load-extension=${extensionPath}`, `--disable-extensions-except=${extensionPath}`]
  });
  context.setDefaultTimeout(8000);
  const sw = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(sw.url()).host;
  await acceptPrivacyConsent(context, `chrome-extension://${extensionId}`);
  diagnostics.initialInstallLog = await installationLog(context, sw.url());
  const page = await context.newPage();
  const popup = await context.newPage();
  const options = await context.newPage();
  const stored = key => sw.evaluate(async key => (await chrome.storage.sync.get(key))[key], key);
  const waitStore = async (key, expected) => {
    for (let i = 0; i < 80; i++) {
      if (JSON.stringify(await stored(key)) === JSON.stringify(expected)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.deepEqual(await stored(key), expected);
  };
  const set = data => sw.evaluate(data => chrome.storage.sync.set(data), data);
  const injected = () => page.waitForFunction(() => window.EasyCVInjected === true);
  const popupOpen = async () => {
    await page.bringToFront();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup.waitForFunction(() => document.querySelector('#mainUnlockBtn') &&
      !document.querySelector('#loadingOverlay')?.classList.contains('show'));
    await popup.waitForTimeout(800);
  };
  const events = () => page.evaluate(() => Object.fromEntries(['copy', 'paste', 'selectstart'].map(type => {
    const target = document.querySelector(type === 'paste' ? '#pasteTarget' : '#restricted');
    const event = new Event(type, { bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return [type, event.defaultPrevented];
  })));
  await check('installed manifest and permissions', async () => {
    assert.equal(await sw.evaluate(() => chrome.runtime.getManifest().version), manifest.version);
    assert.deepEqual((await sw.evaluate(() => chrome.permissions.getAll())).permissions.sort(), [...manifest.permissions].sort());
  });
  await set({ plugin_enabled: false, force_mode: false, auto_enable_list: [], excluded_list: [] });
  await page.goto(url);
  await page.waitForTimeout(800);
  await check('negative control: restrictions effective when disabled', async () => {
    assert.deepEqual(await events(), { copy: true, paste: true, selectstart: true });
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#restricted')).userSelect), 'none');
  });
  await check('Popup main button enables via real runtime/storage path', async () => {
    await set({ plugin_enabled: true, user_settings: { copyEnabled: false, pasteEnabled: false } });
    await page.waitForTimeout(350); await page.reload();
    await popupOpen();
    assert.match(await popup.locator('#currentUrl').innerText(), /easycv\.localhost/);
    await popup.locator('#mainUnlockBtn').click();
    for (let i = 0; i < 80 && (await stored('user_settings'))?.copyEnabled !== true; i++) await page.waitForTimeout(100);
    assert.equal((await stored('user_settings')).copyEnabled, true);
    await injected();
    await page.waitForTimeout(600);
  });
  await check('copy/paste/selectstart cancellation neutralized', async () => {
    diagnostics.afterPopupToggle = {
      storage: await sw.evaluate(() => chrome.storage.sync.get(['plugin_enabled', 'user_settings'])),
      page: await page.evaluate(() => ({ textarea: document.querySelector('textarea').outerHTML,
        handler: String(document.querySelector('textarea').onpaste) }))
    };
    assert.deepEqual(await events(), { copy: false, paste: false, selectstart: false });
  });
  await check('CSS selection and DOM range', async () => {
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.querySelector('#restricted')).userSelect), 'none');
    assert.equal(await page.evaluate(() => {
      const range = document.createRange(); range.selectNodeContents(document.querySelector('#restricted'));
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); return selection.toString();
    }), 'EASYCV_PERMISSION_TEST_TEXT');
  });
  await check('trusted keyboard copy (test text only)', async () => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
    await page.bringToFront();
    await page.evaluate(() => navigator.clipboard.writeText('EASYCV_EMPTY_TEST'));
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+c' : 'Control+c');
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'EASYCV_PERMISSION_TEST_TEXT');
  });
  await check('trusted keyboard paste (test text only)', async () => {
    await page.locator('#pasteTarget').focus();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+v' : 'Control+v');
    await page.waitForFunction(() => document.querySelector('#pasteTarget').value === 'EASYCV_PERMISSION_TEST_TEXT');
  });
  await check('Popup force mode persists; main-world injector runs', async () => {
    await popupOpen(); await popup.locator('#advancedSection').evaluate(el => { el.open = true; });
    await popup.locator('label.toggle-switch').filter({ has: popup.locator('#forceMode') }).click();
    await waitStore('force_mode', true);
    assert.equal(await page.evaluate(() => window.EasyCVInjected), true);
    assert.equal(await page.evaluate(() => Event.prototype.preventDefault.toString().includes('originalFunctions')), true);
  });
  await check('dynamic restricted content is processed', async () => {
    await page.evaluate(() => {
      const p = document.createElement('p'); p.id = 'dynamic'; p.textContent = 'dynamic';
      p.style.userSelect = 'none'; p.setAttribute('oncopy', 'return false'); document.body.append(p);
    });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#dynamic')).userSelect !== 'none' &&
      !document.querySelector('#dynamic').hasAttribute('oncopy'));
  });
  await check('repeat page-script load keeps same wrappers', async () => {
    assert.equal(await page.evaluate(async id => {
      const before = Event.prototype.preventDefault;
      const script = document.createElement('script'); script.src = `chrome-extension://${id}/content/injector.js`;
      await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; document.head.append(script); });
      script.remove(); return before === Event.prototype.preventDefault;
    }, extensionId), true);
  });
  await check('refresh reinjects and retains force mode', async () => {
    await page.reload(); await injected(); assert.equal(await stored('force_mode'), true);
    await page.waitForTimeout(600);
    diagnostics.afterRefresh = { storage: await stored('user_settings'),
      page: await page.evaluate(() => ({ textarea: document.querySelector('textarea').outerHTML,
        handler: String(document.querySelector('textarea').onpaste) })) };
    assert.deepEqual(await events(), { copy: false, paste: false, selectstart: false });
  });
  await check('trusted keyboard paste after refresh (test text only)', async () => {
    await page.bringToFront();
    await page.evaluate(() => navigator.clipboard.writeText('EASYCV_REFRESH_PASTE'));
    await page.locator('#pasteTarget').focus();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+v' : 'Control+v');
    await page.waitForFunction(() => document.querySelector('#pasteTarget').value === 'EASYCV_REFRESH_PASTE');
  });
  await check('second tab, activation and URL visibility without activeTab', async () => {
    const second = await context.newPage(); await second.goto(url + '?tab=2');
    await second.waitForFunction(() => window.EasyCVInjected === true);
    await page.bringToFront(); await second.bringToFront();
    const tabs = await sw.evaluate(() => chrome.tabs.query({}));
    assert.ok(tabs.filter(tab => tab.url?.includes('/test/fixtures/permission-fix.html')).length >= 2);
    assert.equal(await second.evaluate(() => getComputedStyle(document.querySelector('#restricted')).userSelect !== 'none'), true);
    await second.close();
  });
  await check('native context menu IDs registered (not native click)', async () => {
    for (const id of ['easycv-toggle', 'easycv-force-mode', 'easycv-add-to-auto']) {
      const error = await sw.evaluate(id => new Promise(resolve => chrome.contextMenus.update(id, {}, () => resolve(chrome.runtime.lastError?.message || null))), id);
      assert.equal(error, null);
    }
  });
  await check('context menu handler dispatch: add to auto list (synthetic)', async () => {
    await sw.evaluate(async url => {
      const [tab] = await chrome.tabs.query({ url: url + '*' });
      await backgroundManager.handleContextMenuClick({ menuItemId: 'easycv-add-to-auto' }, tab);
    }, url);
    assert.ok((await stored('auto_enable_list')).some(item => item.domain === 'easycv.localhost'));
  });
  await check('auto-enable list settings applied on a fresh domain navigation', async () => {
    // Fresh hostname avoids the existing five-minute negative domain cache.
    await set({ plugin_enabled: true, force_mode: false,
      auto_enable_list: [{ domain: 'auto.localhost', copyEnabled: true, pasteEnabled: true }],
      user_settings: { copyEnabled: false, pasteEnabled: false } });
    await page.waitForTimeout(350);
    await page.goto(url.replace('easycv.localhost', 'auto.localhost') + '?auto=1'); await injected();
    for (let i = 0; i < 80 && (await stored('user_settings'))?.copyEnabled !== true; i++) await page.waitForTimeout(100);
    assert.equal((await stored('user_settings')).copyEnabled, true);
    await page.goto(url); await injected();
  });
  await check('Options add exclusion writes storage', async () => {
    await options.goto(`chrome-extension://${extensionId}/options/options.html`);
    await options.locator('[data-tab="excluded"]').click();
    await options.locator('#excludedInput').fill('easycv.localhost'); await options.locator('#addExcludedBtn').click();
    await waitStore('excluded_list', ['easycv.localhost']);
  });
  await check('excluded site dormant after reload despite auto/force', async () => {
    await set({ force_mode: true }); await page.waitForTimeout(350); await page.reload(); await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => !!window.EasyCVInjected), false);
    assert.deepEqual(await events(), { copy: true, paste: true, selectstart: true });
  });
  await check('remove exclusion restores unlock after reload', async () => {
    await set({ excluded_list: [] }); await page.waitForTimeout(350); await page.reload(); await injected();
  });
  await check('Popup copy setting persists across UI reopen', async () => {
    await popupOpen(); await popup.locator('#advancedSection').evaluate(el => { el.open = true; });
    await popup.locator('label.toggle-switch').filter({ has: popup.locator('#copyToggle') }).click();
    for (let i = 0; i < 80 && (await stored('user_settings'))?.copyEnabled !== false; i++) await page.waitForTimeout(100);
    assert.equal((await stored('user_settings')).copyEnabled, false);
    await popupOpen(); assert.equal(await popup.locator('#copyToggle').isChecked(), false);
  });
  // Reopen the same temporary browser profile to check disk persistence, not just a cache.
  const expected = await sw.evaluate(() => chrome.storage.sync.get(['user_settings', 'excluded_list', 'auto_enable_list']));
  diagnostics.beforeRestart = expected;
  await context.close(); context = null;
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROMIUM_PATH, headless: process.env.EASYCV_HEADLESS === '1',
    args: [`--load-extension=${extensionPath}`, `--disable-extensions-except=${extensionPath}`]
  });
  const reopened = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  diagnostics.restartInstallLog = await installationLog(context, reopened.url());
  await check('settings/lists survive full isolated browser restart', async () => {
    diagnostics.afterRestart = await reopened.evaluate(() => chrome.storage.sync.get(['user_settings', 'excluded_list', 'auto_enable_list']));
    diagnostics.sameExtensionId = new URL(reopened.url()).host === extensionId;
    assert.deepEqual(diagnostics.afterRestart, expected);
  });
} catch (error) {
  results.push({ name: 'harness setup/execution', pass: false, error: error.stack });
  console.error(error);
} finally {
  if (context) await context.close();
  const resolvedProfile = path.resolve(profile);
  if (path.dirname(resolvedProfile) !== path.resolve(os.tmpdir()) || !path.basename(resolvedProfile).startsWith('easycv-permission-')) {
    throw new Error('Unsafe browser profile cleanup target');
  }
  fs.rmSync(resolvedProfile, { recursive: true, force: true });
  const output = { version: manifest.version, extensionPath, browser: process.env.CHROMIUM_PATH, results, diagnostics,
    manualNotRun: ['native toolbar popup', 'native context menu clicks', 'real sites/CSP', 'store update installation'] };
  if (process.env.RESULT_PATH) fs.writeFileSync(process.env.RESULT_PATH, JSON.stringify(output, null, 2) + '\n');
}
console.log(`${results.filter(r => r.pass).length}/${results.length} passed`);
process.exitCode = results.some(r => !r.pass) ? 1 : 0;
