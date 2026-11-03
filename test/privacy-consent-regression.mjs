/** Exercise consent against the real extension in an isolated Chromium profile. */
import assert from 'node:assert/strict';
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
const executablePath = process.env.CHROMIUM_PATH || path.join(process.env.LOCALAPPDATA,
  'ms-playwright/chromium-1228/chrome-win64/chrome.exe');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'easycv-consent-'));
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end('<!doctype html><html><body><p oncopy="return false" style="user-select:none">Fixture</p></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const fixtureUrl = `http://127.0.0.1:${server.address().port}/`;
const result = { kind: 'isolated Chromium extension consent regression', checks: [], passed: false };
const check = async (name, fn) => {
  await fn();
  result.checks.push(name);
  console.log(`PASS: ${name}`);
};
const launch = () => chromium.launchPersistentContext(profile, {
  executablePath, headless: true, viewport: { width: 380, height: 600 },
  args: [`--load-extension=${extensionPath}`, `--disable-extensions-except=${extensionPath}`]
});
let context;
try {
  context = await launch();
  let worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  result.browserVersion = context.browser().version();
  result.extensionVersion = await worker.evaluate(() => chrome.runtime.getManifest().version);
  const extensionOrigin = `chrome-extension://${new URL(worker.url()).host}`;
  const legacy = {
    plugin_enabled: true,
    auto_enable_list: [{ domain: 'legacy.example.com', copyEnabled: true, pasteEnabled: false }],
    excluded_list: ['blocked.example.com'],
    user_settings: { theme: 'dark' },
    statistics: { totalActivations: 5, sitesUnlocked: ['legacy.example.com'] },
    interaction_history: { 'legacy.example.com': 123456789 }
  };
  await worker.evaluate(data => chrome.storage.sync.set(data), legacy);
  const page = await context.newPage();
  await page.goto(fixtureUrl);
  await page.waitForTimeout(2000);
  await check('fresh profile has no consent and leaves the page untouched', async () => {
    const state = await page.evaluate(() => ({ injected: document.documentElement.dataset.easycvInjected || null,
      originalHandler: document.querySelector('p').getAttribute('oncopy') }));
    const consent = await worker.evaluate(() => chrome.storage.local.get('privacy_notice_ack'));
    assert.equal(consent.privacy_notice_ack, undefined);
    assert.equal(state.injected, null, 'page must not be modified before informed consent');
    assert.equal(state.originalHandler, 'return false');
  });
  await check('legacy private data remains in sync and rules remain unchanged before consent', async () => {
    const sync = await worker.evaluate(keys => chrome.storage.sync.get(keys), Object.keys(legacy));
    assert.deepEqual(sync.statistics, legacy.statistics);
    assert.deepEqual(sync.interaction_history, legacy.interaction_history);
    assert.deepEqual(sync.auto_enable_list, legacy.auto_enable_list);
    assert.deepEqual(sync.excluded_list, legacy.excluded_list);
  });
  const targetTabId = await worker.evaluate(url =>
    chrome.tabs.query({}).then(tabs => tabs.find(tab => tab.url === url).id), fixtureUrl);
  const popup = await context.newPage();
  await popup.addInitScript(tabId => {
    Object.defineProperty(window, 'PopupManager', { configurable: true, set(Manager) {
      Manager.prototype.getCurrentTab = () => chrome.tabs.get(tabId);
      Object.defineProperty(window, 'PopupManager', { value: Manager, configurable: true, writable: true });
    } });
  }, targetTabId);
  await popup.goto(`${extensionOrigin}/popup/popup.html`);
  await check('in-product consent and decide-later controls appear before the main UI', async () => {
    await popup.waitForSelector('#privacyNotice:not([hidden])');
    assert.equal(await popup.locator('#privacyNoticeAckBtn').innerText(),
      await popup.evaluate(() => chrome.i18n.getMessage('privacy_notice_ack')));
    assert.equal(await popup.locator('#privacyNoticeLaterBtn').isVisible(), true);
    assert.equal(await popup.locator('.popup-main').isVisible(), false);
  });
  await check('deciding later does not enable the extension', async () => {
    const later = await context.newPage();
    await later.goto(`${extensionOrigin}/popup/popup.html`);
    await later.locator('#privacyNoticeLaterBtn').click();
    await page.waitForTimeout(250);
    assert.equal((await worker.evaluate(() => chrome.storage.local.get('privacy_notice_ack'))).privacy_notice_ack, undefined);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.easycvInjected || null), null);
    if (!later.isClosed()) await later.close();
  });
  await check('failed consent storage keeps the notice and page disabled', async () => {
    const denied = await context.newPage();
    await denied.addInitScript(() => {
      chrome.storage.local.set = async () => { throw new Error('synthetic storage failure'); };
    });
    await denied.goto(`${extensionOrigin}/popup/popup.html`);
    await denied.locator('#privacyNoticeAckBtn').click();
    await denied.waitForSelector('#privacyNoticeError:not([hidden])');
    assert.equal(await denied.locator('.popup-main').isVisible(), false);
    assert.equal((await worker.evaluate(() => chrome.storage.local.get('privacy_notice_ack'))).privacy_notice_ack, undefined);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.easycvInjected || null), null);
    await denied.close();
  });
  const options = await context.newPage();
  await options.goto(`${extensionOrigin}/options/options.html`);
  await check('settings also require consent', async () => {
    await options.waitForURL(url => url.pathname.endsWith('/popup/popup.html'));
    await options.waitForSelector('#privacyNotice:not([hidden])');
  });
  await options.close();
  await popup.locator('#privacyNoticeAckBtn').click();
  await check('explicit agreement persists locally and opens the main UI', async () => {
    await popup.waitForSelector('.popup-main:not([hidden])');
    const local = await worker.evaluate(() => chrome.storage.local.get('privacy_notice_ack'));
    assert.equal(local.privacy_notice_ack, '2026-11-03-consent-v1');
    assert.equal(await popup.locator('#privacyNotice').isVisible(), false);
  });
  await check('the already open page activates only after consent', async () => {
    await page.waitForFunction(() => document.documentElement.dataset.easycvInjected === 'true');
    await page.waitForFunction(() => document.querySelector('p').getAttribute('oncopy') === null);
  });
  await check('legacy data is backed up and removed from sync after consent', async () => {
    await popup.waitForFunction(async () => {
      const sync = await chrome.storage.sync.get(['statistics', 'interaction_history']);
      const local = await chrome.storage.local.get('legacy_private_backup');
      return !('statistics' in sync) && !('interaction_history' in sync) && !!local.legacy_private_backup;
    });
    const local = await worker.evaluate(() => chrome.storage.local.get('legacy_private_backup'));
    assert.deepEqual(local.legacy_private_backup.sync_statistics, legacy.statistics);
    assert.deepEqual(local.legacy_private_backup.sync_interaction_history, legacy.interaction_history);
  });
  await check('existing rules, exclusions and settings survive consent and migration', async () => {
    const sync = await worker.evaluate(keys => chrome.storage.sync.get(keys),
      ['auto_enable_list', 'excluded_list', 'user_settings']);
    assert.deepEqual(sync.auto_enable_list, legacy.auto_enable_list);
    assert.deepEqual(sync.excluded_list, legacy.excluded_list);
    assert.equal(sync.user_settings.theme, 'dark');
  });
  await worker.evaluate(() => chrome.storage.local.remove('privacy_notice_ack'));
  await check('clearing consent stops the active page and restores its restrictions', async () => {
    await popup.waitForSelector('#privacyNotice:not([hidden])');
    await page.waitForFunction(() => document.querySelector('p').getAttribute('oncopy') === 'return false');
    assert.equal(await page.evaluate(() => {
      const event = new Event('copy', { bubbles: true, cancelable: true });
      document.querySelector('p').dispatchEvent(event);
      return event.defaultPrevented;
    }), true);
  });
  await popup.locator('#privacyNoticeAckBtn').click();
  await check('agreeing again reactivates the existing page', async () => {
    await page.waitForFunction(() => document.querySelector('p').getAttribute('oncopy') === null);
  });
  await context.close();
  context = await launch();
  worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const restarted = await context.newPage();
  await restarted.goto(fixtureUrl);
  await check('consent and functionality survive browser restart', async () => {
    await restarted.waitForFunction(() => document.documentElement.dataset.easycvInjected === 'true');
    const local = await worker.evaluate(() => chrome.storage.local.get('privacy_notice_ack'));
    assert.equal(local.privacy_notice_ack, '2026-11-03-consent-v1');
  });
  await check('clear all data also revokes consent and stops the active page', async () => {
    const settings = await context.newPage();
    await settings.setViewportSize({ width: 1024, height: 768 });
    await settings.goto(`chrome-extension://${new URL(worker.url()).host}/options/options.html`);
    await settings.waitForFunction(() => window.optionsManager);
    await settings.locator('[data-tab="advanced"]').click();
    settings.once('dialog', dialog => dialog.accept());
    await settings.locator('#clearDataBtn').click();
    await settings.waitForURL(url => url.pathname.endsWith('/popup/popup.html'));
    await settings.waitForSelector('#privacyNotice:not([hidden])');
    await restarted.waitForFunction(() => document.querySelector('p').getAttribute('oncopy') === 'return false');
    const local = await worker.evaluate(() => chrome.storage.local.get('privacy_notice_ack'));
    const sync = await worker.evaluate(() => chrome.storage.sync.get(null));
    assert.equal(local.privacy_notice_ack, undefined);
    assert.deepEqual(sync, {});
    await settings.close();
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
  const resolved = path.resolve(profile);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('easycv-consent-')) {
    throw new Error('Unsafe test profile cleanup target');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}
