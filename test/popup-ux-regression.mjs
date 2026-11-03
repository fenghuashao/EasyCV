/**
 * Load current source in isolated Chromium profiles; never rebuild dist or a release ZIP.
 * PLAYWRIGHT_PATH / CHROMIUM_PATH can override the locally installed test tools.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { acceptPrivacyConsent } from './helpers/privacy-consent.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || path.join(path.dirname(process.execPath),
  'node_modules/@playwright/cli/node_modules/playwright'));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = path.resolve(process.env.EASYCV_EXTENSION_PATH || root);
const executablePath = process.env.CHROMIUM_PATH || path.join(process.env.LOCALAPPDATA,
  'ms-playwright/chromium-1228/chrome-win64/chrome.exe');
const outputDir = path.resolve(process.env.EASYCV_EVIDENCE_DIR || path.join(root, '.tmp/popup-ux-evidence'));
const profileRoot = path.join(root, '.tmp/popup-ux-20261103');
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(profileRoot, { recursive: true });
const results = [];
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><html><head><title>EasyCV isolated UX fixture</title></head><body>
    <textarea id="copySource" oncopy="return false">EasyCV trusted copy 20261103</textarea>
    <textarea id="pasteTarget" onpaste="return false"></textarea>
    <p style="user-select:none" oncontextmenu="return false">Restricted text</p>
  </body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

try {
  for (const language of ['en-US', 'zh-CN']) {
    const context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(profileRoot, 'profile-')), {
      executablePath, headless: true, locale: language, viewport: { width: 380, height: 600 },
      args: [`--load-extension=${extensionPath}`, `--disable-extensions-except=${extensionPath}`, `--lang=${language}`]
    });
    const result = { language, checks: [], popupSurface: 'extension HTML tab, not native action popup',
      targetTabLookup: 'test-only override to the real fixture tab' };
    results.push(result);
    context.setDefaultTimeout(10000);
    const check = async (name, fn) => {
      await fn();
      result.checks.push(name);
      console.log(`PASS [${language}] ${name}`);
    };
    try {
      const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
      const extensionOrigin = `chrome-extension://${new URL(worker.url()).host}`;
      await acceptPrivacyConsent(context, extensionOrigin);
      const page = await context.newPage();
      await page.goto(`${origin}/?private-test-token=omit#private-fragment`);
      await page.waitForFunction(() => document.documentElement.dataset.easycvInjected === 'true');
      const popup = await context.newPage();
      // A standalone HTML tab becomes active itself. An action popup instead queries
      // the website tab; override only that lookup so the real UI targets our fixture.
      const targetTabId = await worker.evaluate(async fixtureOrigin =>
        (await chrome.tabs.query({})).find(tab => tab.url?.startsWith(fixtureOrigin)).id, origin);
      await popup.addInitScript(tabId => {
        Object.defineProperty(window, 'PopupManager', { configurable: true, set(Manager) {
          Manager.prototype.getCurrentTab = () => chrome.tabs.get(tabId);
          Object.defineProperty(window, 'PopupManager', { value: Manager, configurable: true, writable: true });
        } });
      }, targetTabId);
      await page.bringToFront();
      await popup.goto(`${extensionOrigin}/popup/popup.html`);
      const waitStatus = key => popup.waitForFunction(key =>
        document.getElementById('statusText').textContent === chrome.i18n.getMessage(key), key);
      await check('actual enabled page status', () => waitStatus('status_active'));
      result.browserVersion = context.browser().version();
      result.uiLanguage = await popup.evaluate(() => chrome.i18n.getUILanguage());
      await check('requested UI locale and translated copy check', async () => {
        assert.equal(result.uiLanguage.toLowerCase().startsWith(language.slice(0, 2)), true);
        assert.equal(await popup.locator('#testCopyBtn').innerText(),
          await popup.evaluate(() => chrome.i18n.getMessage('test_copy')));
      });
      await check('refresh detection traverses the real content receiver', async () => {
        await popup.locator('#refreshBtn').click();
        await popup.waitForFunction(() => document.querySelector('.notification-message').textContent ===
          chrome.i18n.getMessage('refresh_success'));
      });
      await check('trusted keyboard copy and paste on the restricted fixture', async () => {
        await page.locator('#copySource').click();
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Control+C');
        await page.locator('#pasteTarget').click();
        await page.keyboard.press('Control+V');
        assert.equal(await page.locator('#pasteTarget').inputValue(), 'EasyCV trusted copy 20261103');
      });
      await check('enabled copy check requests manual verification', async () => {
        await popup.locator('#testCopyBtn').click();
        await popup.waitForFunction(() => document.querySelector('.notification-message').textContent ===
          chrome.i18n.getMessage('copy_check_enabled'));
      });
      await popup.locator('.advanced-summary').click();
      await check('paste switch immediately updates partial page status', async () => {
        await popup.locator('label[for="pasteToggle"]').click();
        assert.equal(await popup.locator('#pasteToggle').isChecked(), false);
        await waitStatus('status_partial');
      });
      await check('both switches off updates inactive page status', async () => {
        await popup.locator('label[for="copyToggle"]').click();
        assert.equal(await popup.locator('#copyToggle').isChecked(), false);
        await waitStatus('status_inactive');
      });
      await check('disabled copy check does not claim successful copying', async () => {
        await popup.locator('#testCopyBtn').click();
        await popup.waitForFunction(() => document.querySelector('.notification-message').textContent ===
          chrome.i18n.getMessage('copy_check_disabled'));
      });
      await check('main switch restores enabled page status', async () => {
        await popup.locator('#mainUnlockBtn').click();
        await waitStatus('status_active');
      });
      await check('local help expands, remains accessible and fits 380px', async () => {
        await popup.waitForFunction(() => !document.getElementById('notification').classList.contains('show'));
        const pageCount = context.pages().length;
        await popup.locator('#helpBtn').click();
        assert.equal(await popup.locator('#helpPanel').isVisible(), true);
        assert.equal(await popup.locator('#helpBtn').getAttribute('aria-expanded'), 'true');
        assert.equal(context.pages().length, pageCount);
        assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await popup.screenshot({ path: path.join(outputDir, `popup-help-${language}.png`) });
        await popup.locator('#helpBtn').click();
        assert.equal(await popup.locator('#helpPanel').isVisible(), false);
      });
      await popup.locator('.advanced-summary').click();
      await popup.evaluate(() => { document.querySelector('.popup-main').scrollTop = 0; window.scrollTo(0, 0); });
      await popup.screenshot({ path: path.join(outputDir, `popup-${language}.png`) });
      await check('feedback draft is localized and omits browsing information (tabs.create intercepted)', async () => {
        await popup.evaluate(() => {
          window.feedbackDrafts = [];
          chrome.tabs.create = options => { window.feedbackDrafts.push(options); return Promise.resolve({}); };
        });
        await popup.locator('#feedbackBtn').click();
        const drafts = await popup.evaluate(() => window.feedbackDrafts);
        assert.equal(drafts.length, 1);
        const url = new URL(drafts[0].url);
        assert.equal(`${url.origin}${url.pathname}`, 'https://github.com/fenghuashao/EasyCV/issues/new');
        const body = url.searchParams.get('body');
        assert.equal(body.includes('private-test-token') || body.includes('127.0.0.1'), false);
        assert.equal(body.includes(await popup.evaluate(() => chrome.runtime.getManifest().version)), true);
        assert.equal(body.includes('$VERSION$'), false);
      });
      await check('site exclusion explains the state and disables auto-enable', async () => {
        await worker.evaluate(() => chrome.storage.sync.set({ excluded_list: ['127.0.0.1'] }));
        await page.bringToFront();
        await popup.reload();
        await waitStatus('status_excluded');
        assert.equal(await popup.locator('#addToAutoBtn').isDisabled(), true);
        assert.equal(await popup.locator('#testCopyBtn').isDisabled(), true);
      });
      await check('browser page explains unsupported state and disables page actions', async () => {
        await page.goto('chrome://settings/');
        await popup.reload();
        await waitStatus('status_unsupported');
        assert.equal(await popup.locator('#testCopyBtn').isDisabled(), true);
        assert.equal(await popup.locator('#addToAutoBtn').isDisabled(), true);
      });
      result.pass = true;
    } catch (error) {
      result.pass = false;
      result.error = error.stack;
      const popup = context.pages().find(page => page.url().endsWith('/popup/popup.html'));
      if (popup) {
        result.observed = await popup.evaluate(() => ({ status: document.getElementById('statusText')?.textContent,
          copy: document.getElementById('copyToggle')?.checked, paste: document.getElementById('pasteToggle')?.checked,
          language: chrome.i18n.getUILanguage() })).catch(() => null);
        await popup.screenshot({ path: path.join(outputDir, `failure-${language}.png`) }).catch(() => {});
      }
      console.error(error);
    } finally {
      await context.close();
    }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(path.join(outputDir, 'browser.json'), JSON.stringify({
    source: 'working tree (manifest version unchanged; no release build)',
    platform: process.platform, architecture: process.arch,
    externalFeedbackNavigation: 'tabs.create intercepted in the final test harness; no issue submitted',
    results
  }, null, 2));
}
if (results.length !== 2 || results.some(result => !result.pass)) process.exitCode = 1;
