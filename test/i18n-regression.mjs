/** Native Chrome i18n in isolated Chromium profiles. No store access, publishing or user profile changes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || path.join(path.dirname(process.execPath),
  'node_modules/@playwright/cli/node_modules/playwright'));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = path.resolve(process.env.EASYCV_EXTENSION_PATH || root);
const executablePath = process.env.CHROMIUM_PATH || path.join(process.env.LOCALAPPDATA,
  'ms-playwright/chromium-1228/chrome-win64/chrome.exe');
const outputDir = path.resolve(process.env.EASYCV_EVIDENCE_DIR || path.join(root, '.tmp/i18n-20261103/evidence'));
const profileRoot = path.join(root, '.tmp/i18n-20261103/profiles');
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(profileRoot, { recursive: true });
const matrix = [['en-US', 'en'], ['en-GB', 'en'], ['zh-CN', 'zh_CN'], ['zh-TW', 'zh_TW'],
  ['zh-HK', 'zh_TW'], ['ja', 'ja'], ['ro', 'en'], ['ar', 'en']];
const results = [];
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end('<!doctype html><html lang="en"><title>EasyCV localization fixture</title><p>Local test page</p></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

// Range rectangles catch text clipped by overflow:hidden, which scrollWidth alone misses.
async function assertLayout(page, containerSelector) {
  const violations = await page.locator(containerSelector).evaluate(container => {
    const outer = container.getBoundingClientRect();
    const errors = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || !node.parentElement.checkVisibility()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const parent = node.parentElement.getBoundingClientRect();
      for (const rect of range.getClientRects()) {
        if (rect.width && (rect.left < Math.max(0, outer.left, parent.left) - 2 ||
            rect.right > Math.min(innerWidth, outer.right, parent.right) + 2)) {
          errors.push({ text: node.textContent.trim().slice(0, 80), left: rect.left, right: rect.right });
        }
      }
    }
    return errors;
  });
  assert.deepEqual(violations, [], `clipped/overflowing text in ${containerSelector}`);
}

try {
  for (const [language, locale] of matrix) {
    const expected = JSON.parse(fs.readFileSync(path.join(extensionPath, '_locales', locale, 'messages.json'), 'utf8'));
    const result = { language, expectedLocale: locale, checks: [], popupSurface: 'extension HTML tab, not native action popup' };
    results.push(result);
    let context;
    const check = async (name, fn) => { await fn(); result.checks.push(name); console.log(`PASS [${language}] ${name}`); };
    try {
      context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(profileRoot, 'profile-')), {
        executablePath, headless: true, locale: language, viewport: { width: 380, height: 600 },
        args: [`--load-extension=${extensionPath}`, `--disable-extensions-except=${extensionPath}`, `--lang=${language}`]
      });
      context.setDefaultTimeout(10000);
      const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
      const extensionOrigin = `chrome-extension://${new URL(worker.url()).host}`;
      result.browserVersion = context.browser().version();
      const page = await context.newPage();
      await page.goto(origin);
      await page.waitForFunction(() => document.documentElement.dataset.easycvInjected === 'true');
      const targetTabId = await worker.evaluate(async fixture =>
        (await chrome.tabs.query({})).find(tab => tab.url?.startsWith(fixture)).id, origin);
      const popup = await context.newPage();
      await popup.addInitScript(tabId => {
        Object.defineProperty(window, 'PopupManager', { configurable: true, set(Manager) {
          Manager.prototype.getCurrentTab = () => chrome.tabs.get(tabId);
          Object.defineProperty(window, 'PopupManager', { value: Manager, configurable: true, writable: true });
        } });
      }, targetTabId);
      await popup.goto(`${extensionOrigin}/popup/popup.html`);
      const waitStatus = key => popup.waitForFunction(key =>
        document.getElementById('statusText').textContent === chrome.i18n.getMessage(key), key);
      await waitStatus('status_active');
      await check('native locale selection, manifest and every catalog message', async () => {
        const actual = await popup.evaluate(keys => ({ uiLanguage: chrome.i18n.getUILanguage(),
          lang: document.documentElement.lang, dir: document.documentElement.dir,
          manifestName: chrome.runtime.getManifest().name,
          messages: Object.fromEntries(keys.map(key => [key, chrome.i18n.getMessage(key, 'SAMPLE')]))
        }), Object.keys(expected));
        result.actualUILanguage = actual.uiLanguage;
        result.documentLanguage = actual.lang;
        assert.equal(actual.lang, expected.ui_language.message);
        assert.equal(actual.dir, 'ltr');
        assert.equal(actual.manifestName, expected.extension_name.message);
        for (const [key, value] of Object.entries(expected)) {
          assert.equal(actual.messages[key], value.message.replace(/\$\w+\$/g, 'SAMPLE'), key);
        }
      });
      const checkStatic = async surface => {
        const errors = await surface.evaluate(() => {
          const errors = [];
          for (const [attribute, property] of [['data-i18n', 'textContent'], ['data-i18n-placeholder', 'placeholder'],
            ['data-i18n-title', 'title'], ['data-i18n-aria-label', 'aria-label']]) {
            for (const element of document.querySelectorAll(`[${attribute}]`)) {
              // The main button and auto-enable label are intentionally updated with state.
              if (['mainUnlockText', 'addToAutoBtnText', 'statusText', 'currentUrl'].includes(element.id)) continue;
              const key = element.getAttribute(attribute);
              const actual = property === 'aria-label' ? element.getAttribute(property) : element[property];
              if (actual !== chrome.i18n.getMessage(key)) errors.push({ key, actual });
            }
          }
          return errors;
        });
        assert.deepEqual(errors, []);
      };
      await check('popup static text, expanded help, advanced controls and 380px layout', async () => {
        await checkStatic(popup);
        await assertLayout(popup, '.popup-container');
        await popup.screenshot({ path: path.join(outputDir, `popup-${language}.png`), animations: 'disabled' });
        await popup.locator('#helpBtn').click();
        await popup.locator('.advanced-summary').click();
        await assertLayout(popup, '.popup-container');
        await popup.locator('#helpPanel').scrollIntoViewIfNeeded();
        await popup.screenshot({ path: path.join(outputDir, `popup-help-${language}.png`), animations: 'disabled' });
      });
      await check('translated status, copy check and feedback placeholders', async () => {
        await popup.locator('#testCopyBtn').click();
        await popup.waitForFunction(() => document.querySelector('.notification-message').textContent ===
          chrome.i18n.getMessage('copy_check_enabled'));
        await assertLayout(popup, '#notification');
        // Inspect the generated draft without navigating to or submitting to GitHub.
        await popup.evaluate(() => { window.drafts = []; chrome.tabs.create = value => { window.drafts.push(value); return Promise.resolve({}); }; });
        await popup.locator('#feedbackBtn').click();
        const drafts = await popup.evaluate(() => window.drafts);
        assert.equal(drafts.length, 1);
        const body = new URL(drafts[0].url).searchParams.get('body');
        assert.equal(body, expected.feedback_issue_body.message.replace('$VERSION$',
          JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8')).version));
        assert.ok(!body.includes('$VERSION$'));
      });
      const options = await context.newPage();
      await options.setViewportSize({ width: 1024, height: 768 });
      await options.goto(`${extensionOrigin}/options/options.html`);
      await options.waitForFunction(() => window.optionsManager && document.getElementById('aboutVersion').textContent);
      await check('all settings tabs, placeholders and 1024px/768px layouts', async () => {
        await checkStatic(options);
        assert.equal(await options.locator('html').getAttribute('lang'), expected.ui_language.message);
        for (const width of [1024, 768]) {
          await options.setViewportSize({ width, height: 768 });
          for (const tab of ['general', 'whitelist', 'excluded', 'advanced', 'statistics', 'about']) {
            await options.locator(`[data-tab="${tab}"]`).click();
            await assertLayout(options, '.tab-content.active');
          }
        }
        await options.setViewportSize({ width: 1024, height: 768 });
        await options.screenshot({ path: path.join(outputDir, `options-${language}.png`), fullPage: true, animations: 'disabled' });
      });
      await check('rule editing, validation messages, notification label and confirmation dialog', async () => {
        await options.locator('[data-tab="whitelist"]').click();
        await options.locator('#whitelistInput').fill('example.com');
        await options.locator('#addWhitelistBtn').click();
        await options.locator('.whitelist-item[data-domain="example.com"]').waitFor();
        assert.equal(await options.locator('.status-tag').innerText(), expected.tag_all_unlocked.message);
        await options.locator('.action-btn-small.edit').click();
        await options.waitForFunction(() => document.querySelector('.notification-message').textContent ===
          chrome.i18n.getMessage('editing_config', 'example.com'));
        assert.equal(await options.locator('#cancelRuleEditBtn').innerText(), expected.cancel_edit.message);
        await options.locator('#cancelRuleEditBtn').click();
        await options.locator('.notification-close').click();
        await options.locator('[data-tab="excluded"]').click();
        await options.locator('#excludedInput').fill('');
        await options.locator('#addExcludedBtn').click();
        assert.equal(await options.locator('.notification-message').innerText(), expected.invalid_domain_empty.message);
        assert.equal(await options.locator('.notification-close').getAttribute('aria-label'), expected.close_notification.message);
        await options.locator('.notification-close').click();
        await options.locator('[data-tab="advanced"]').click();
        const dialogPromise = options.waitForEvent('dialog').then(async dialog => {
          const message = dialog.message();
          await dialog.dismiss();
          assert.equal(message, expected.confirm_reset.message);
        });
        await options.locator('#resetSettingsBtn').click();
        await dialogPromise;
      });
      await check('worker context menus and toolbar tooltip use selected translations', async () => {
        const titles = await worker.evaluate(async () => {
          const original = chrome.contextMenus.create;
          const titles = [];
          chrome.contextMenus.create = options => { titles.push(options.title); return options.id; };
          try { await backgroundManager.setupContextMenus(); } finally { chrome.contextMenus.create = original; }
          return titles;
        });
        assert.deepEqual(titles, ['context_toggle', 'context_force_mode', 'context_add_to_auto'].map(key => expected[key].message));
        const title = await worker.evaluate(tabId => chrome.action.getTitle({ tabId }), targetTabId);
        assert.ok(Object.entries(expected).filter(([key]) => key.startsWith('icon_title_')).some(([, value]) => value.message === title), title);
      });
      result.pass = true;
    } catch (error) {
      result.pass = false;
      result.error = error.stack;
      console.error(`FAIL [${language}] ${error.message}`);
      if (context) for (const surface of context.pages().filter(p => p.url().startsWith('chrome-extension://'))) {
        await surface.screenshot({ path: path.join(outputDir, `failure-${language}-${surface.url().includes('/popup/') ? 'popup' : 'options'}.png`), fullPage: true }).catch(() => {});
      }
    } finally {
      await context?.close();
      fs.writeFileSync(path.join(outputDir, 'results.json'), JSON.stringify({ extensionPath, results }, null, 2) + '\n');
    }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
console.log(`${results.filter(r => r.pass).length}/${matrix.length} locale scenarios passed`);
process.exitCode = results.some(r => !r.pass) ? 1 : 0;
