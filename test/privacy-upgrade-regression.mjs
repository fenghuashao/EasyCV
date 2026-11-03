/** Upgrade a disposable unpacked 1.1.1 extension in place; this is not a store upgrade. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || path.join(path.dirname(process.execPath),
  'node_modules/@playwright/cli/node_modules/playwright'));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = path.resolve(process.env.EASYCV_EXTENSION_PATH || root);
const legacyZip = path.resolve(process.env.EASYCV_LEGACY_ZIP || path.join(root, 'releases/EasyCV-v1.1.1-20260831.zip'));
const executablePath = process.env.CHROMIUM_PATH || path.join(process.env.LOCALAPPDATA,
  'ms-playwright/chromium-1228/chrome-win64/chrome.exe');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'easycv-consent-upgrade-'));
const profile = path.join(temp, 'profile');
const installed = path.join(temp, 'extension');
if (path.dirname(path.resolve(temp)) !== path.resolve(os.tmpdir()) ||
    !path.basename(temp).startsWith('easycv-consent-upgrade-') ||
    path.dirname(path.resolve(profile)) !== path.resolve(temp)) {
  throw new Error('Unsafe upgrade fixture root');
}
const result = { kind: 'isolated unpacked same-path upgrade with worker script cache reset; not a Chrome Web Store upgrade', checks: [], passed: false };
const check = async (name, fn) => { await fn(); result.checks.push(name); console.log(`PASS: ${name}`); };
const launch = () => chromium.launchPersistentContext(profile, { executablePath, headless: true,
  args: [`--load-extension=${installed}`, `--disable-extensions-except=${installed}`] });
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end('<!doctype html><p oncopy="return false">Upgrade fixture</p>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let context;
try {
  const extract = spawnSync('python', ['-c', `import pathlib,sys,zipfile
root=pathlib.Path(sys.argv[2]).resolve()
with zipfile.ZipFile(sys.argv[1]) as z:
 for item in z.infolist():
  target=(root/item.filename).resolve()
  if not target.is_relative_to(root): raise ValueError('unsafe ZIP path')
 z.extractall(root)
`, legacyZip, installed], { encoding: 'utf8' });
  if (extract.status !== 0) throw new Error(`Legacy fixture extraction failed: ${extract.stderr}`);
  context = await launch();
  let worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  result.browserVersion = context.browser().version();
  await check('legacy fixture is version 1.1.1', async () => {
    assert.equal(await worker.evaluate(() => chrome.runtime.getManifest().version), '1.1.1');
  });
  const legacy = {
    plugin_enabled: true,
    auto_enable_list: [{ domain: 'legacy.example.com', copyEnabled: true, pasteEnabled: false }],
    excluded_list: ['blocked.example.com'],
    user_settings: { theme: 'dark', copyEnabled: true, pasteEnabled: false },
    statistics: { totalActivations: 4, sitesUnlocked: ['legacy.example.com'] },
    interaction_history: { 'legacy.example.com': 123456789 },
    errorReports: [{ code: 'OLD', url: 'https://legacy.example.com/private', stack: 'old stack' }],
    userFeedback: [{ body: 'old draft' }]
  };
  await worker.evaluate(data => chrome.storage.sync.set(data), legacy);
  await worker.evaluate(() => chrome.storage.local.set({ privacy_notice_ack: '2026-11-03' }));
  await check('legacy fixture contains the intended rules and private data', async () => {
    const sync = await worker.evaluate(keys => chrome.storage.sync.get(keys), Object.keys(legacy));
    assert.deepEqual(sync.auto_enable_list, legacy.auto_enable_list);
    assert.deepEqual(sync.statistics, legacy.statistics);
  });
  await context.close();
  context = null;

  if (path.dirname(path.resolve(installed)) !== path.resolve(temp) || path.basename(installed) !== 'extension') {
    throw new Error('Unsafe upgrade fixture path');
  }
  fs.rmSync(installed, { recursive: true, force: true });
  fs.mkdirSync(installed);
  for (const name of ['manifest.json', 'background', 'content', 'popup', 'options', 'utils', 'icons', '_locales']) {
    fs.cpSync(path.join(extensionPath, name), path.join(installed, name), { recursive: true });
  }
  // Chromium may otherwise start the previous unpacked worker from its script
  // cache even though getManifest() already reports the new manifest version.
  // This reset is confined to the disposable profile; it is not store-upgrade evidence.
  const workerCache = path.resolve(profile, 'Default', 'Service Worker');
  if (workerCache !== path.join(path.resolve(profile), 'Default', 'Service Worker')) {
    throw new Error('Unsafe worker cache path');
  }
  fs.rmSync(workerCache, { recursive: true, force: true });
  context = await launch();
  worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await check('new unpacked version loads at the same extension ID', async () => {
    assert.equal(new URL(worker.url()).host, extensionId);
    assert.equal(await worker.evaluate(() => chrome.runtime.getManifest().version),
      JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8')).version);
    assert.equal(await worker.evaluate(() => typeof StorageUtils.hasPrivacyConsent), 'function',
      'the worker must run the new code, not a cached 1.1.1 worker');
  });
  const site = await context.newPage();
  await site.goto(`http://127.0.0.1:${server.address().port}/`);
  await site.waitForTimeout(1500);
  await check('old informational acknowledgement does not enable page handling or migration', async () => {
    assert.equal(await site.evaluate(() => document.documentElement.dataset.easycvInjected || null), null);
    const sync = await worker.evaluate(keys => chrome.storage.sync.get(keys), Object.keys(legacy));
    assert.deepEqual(sync.statistics, legacy.statistics);
    assert.deepEqual(sync.interaction_history, legacy.interaction_history);
    assert.deepEqual(sync.auto_enable_list, legacy.auto_enable_list);
  });
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await check('upgrade asks for explicit consent', async () => {
    await popup.waitForSelector('#privacyNotice:not([hidden])');
    assert.equal(await popup.locator('.popup-main').isVisible(), false);
  });
  await popup.locator('#privacyNoticeAckBtn').click();
  await check('consent enables existing tab and migrates the old data', async () => {
    await site.waitForFunction(() => document.documentElement.dataset.easycvInjected === 'true');
    await popup.waitForFunction(async () => {
      const sync = await chrome.storage.sync.get(['statistics', 'interaction_history', 'errorReports', 'userFeedback']);
      const local = await chrome.storage.local.get('legacy_private_backup');
      return Object.keys(sync).length === 0 && !!local.legacy_private_backup;
    });
    const local = await worker.evaluate(() => chrome.storage.local.get(['legacy_private_backup', 'errorReports']));
    assert.deepEqual(local.legacy_private_backup.sync_statistics, legacy.statistics);
    assert.deepEqual(local.legacy_private_backup.sync_interaction_history, legacy.interaction_history);
    assert.equal(JSON.stringify(local.errorReports || []).includes('legacy.example.com/private'), false);
  });
  await check('existing user rules and settings are retained', async () => {
    const actual = await worker.evaluate(() => chrome.storage.sync.get(['auto_enable_list', 'excluded_list', 'user_settings']));
    assert.deepEqual(actual.auto_enable_list, legacy.auto_enable_list);
    assert.deepEqual(actual.excluded_list, legacy.excluded_list);
    assert.equal(actual.user_settings.theme, 'dark');
    assert.equal(actual.user_settings.pasteEnabled, false);
  });
  result.passed = true;
} catch (error) {
  result.error = String(error.message || error);
  throw error;
} finally {
  if (context) await context.close();
  await new Promise(resolve => server.close(resolve));
  if (process.env.EASYCV_EVIDENCE_FILE) {
    fs.writeFileSync(path.resolve(process.env.EASYCV_EVIDENCE_FILE), JSON.stringify(result, null, 2) + '\n');
  }
  const resolved = path.resolve(temp);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('easycv-consent-upgrade-')) {
    throw new Error('Unsafe upgrade profile cleanup target');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}
