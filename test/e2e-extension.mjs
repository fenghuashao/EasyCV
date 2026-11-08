/**
 * EasyCV 扩展端到端验证脚本
 * 以持久化上下文加载 dist/ 扩展，对 test/fixtures/copy-paste.html 的 7 个测试区逐项断言
 *
 * 前置条件：先执行 npm run build，并启动本地静态服务（默认 http://127.0.0.1:8931）
 * 运行：node test/e2e-extension.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { acceptPrivacyConsent } from './helpers/privacy-consent.mjs';

// playwright 未列为项目依赖（避免强制下载浏览器），默认解析全局 @playwright/cli 的嵌套依赖
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH
  || 'C:/Program Files/nodejs/node_modules/@playwright/cli/node_modules/playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '../dist');
const expectedVersion = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../manifest.json'), 'utf8')
).version;
const testPageUrl = process.env.TEST_PAGE_URL || 'http://127.0.0.1:8931/test/fixtures/copy-paste.html';

const results = [];
function report(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

// 品牌版 Chrome 137+ 已移除 --load-extension 支持，必须使用 playwright 缓存的 chromium
const chromiumExecutable = process.env.CHROMIUM_PATH
  || path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1228/chrome-win64/chrome.exe');

const context = await chromium.launchPersistentContext('', {
  executablePath: chromiumExecutable,
  headless: false, // MV3 扩展要求在有头模式下运行
  args: [
    `--load-extension=${extensionPath}`,
    `--disable-extensions-except=${extensionPath}`
  ]
});

try {
  const initialWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await acceptPrivacyConsent(context, `chrome-extension://${new URL(initialWorker.url()).host}`);
  const page = await context.newPage();
  await page.goto(testPageUrl);

  // 等待扩展注入（service worker 启动 + 状态加载需要时间）
  const injected = await page
    .waitForFunction(() => window.EasyCVInjected === true, null, { timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  report('扩展注入（EasyCVInjected）', injected);

  if (injected) {
    // 测试1: CSS user-select 限制
    const test1 = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.no-select')).userSelect !== 'none'
    );
    report('测试1 CSS user-select 解除', test1);

    // attachShadow 包装检查
    const wrapped = await page.evaluate(() =>
      Element.prototype.attachShadow.toString().includes('originalFunctions')
    );
    report('attachShadow 已被包装', wrapped);

    // 测试6: 初始 shadow root（声明式 + JS 预创建）
    await page.waitForTimeout(1600);
    const shadowInitial = await page.evaluate(() => {
      const hosts = [
        document.getElementById('declarative-shadow-host'),
        document.getElementById('shadow-host')
      ];
      return hosts.map(h => {
        const p = h.shadowRoot && h.shadowRoot.querySelector('p');
        return p ? getComputedStyle(p).userSelect !== 'none' && !p.getAttribute('oncopy') : false;
      });
    });
    report('测试6a 声明式 Shadow DOM 解除', shadowInitial[0]);
    report('测试6b 预创建 Shadow DOM 解除', shadowInitial[1]);

    // 测试6c: 动态创建 shadow root
    await page.click('#create-shadow-btn');
    await page.waitForTimeout(400);
    const shadowDynamic = await page.evaluate(() => {
      const hosts = document.getElementById('shadow-host').querySelectorAll('div');
      const last = hosts[hosts.length - 1];
      const p = last && last.shadowRoot && last.shadowRoot.querySelector('p');
      return p ? getComputedStyle(p).userSelect !== 'none' && !p.getAttribute('oncopy') : false;
    });
    report('测试6c 动态 Shadow DOM 解除', shadowDynamic);

    // 测试7: SPA 路由切换重放
    await page.click('#spa-nav-btn');
    await page.waitForTimeout(1500);
    const spa = await page.evaluate(() => {
      const p = document.querySelector('#spa-content p');
      return p ? getComputedStyle(p).userSelect !== 'none' && !p.getAttribute('oncopy') : false;
    });
    report('测试7 SPA 重放解除', spa);
  }

  // ===== popup / options 页面验证（i18n + 单按钮结构） =====
  const sw = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => null);
  if (!sw) {
    report('Service Worker 注册', false);
  } else {
    report('Service Worker 注册', true);
    const extensionId = new URL(sw.url()).host;

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popupPage.waitForTimeout(1500);
    const popupState = await popupPage.evaluate(() => {
      const btn = document.getElementById('mainUnlockBtn');
      const text = document.getElementById('mainUnlockText')?.textContent || '';
      return {
        hasMainButton: !!btn,
        // 浏览器 UI 语言决定显示中文还是英文，两者皆为 i18n 生效
        mainTextI18n: ['一键解锁当前页面', '关闭解锁', 'Unlock This Page', 'Turn Off Unlock'].includes(text),
        versionBadge: document.getElementById('versionBadge')?.textContent,
        hasAdvancedDetails: !!document.querySelector('details#advancedSection'),
        htmlLang: document.documentElement.lang
      };
    });
    report('popup 主按钮存在', popupState.hasMainButton);
    report('popup 主按钮 i18n 文案', popupState.mainTextI18n, popupState.htmlLang);
    report('popup 版本号取自 manifest', popupState.versionBadge === `v${expectedVersion}`, popupState.versionBadge);
    report('popup 高级选项折叠区存在', popupState.hasAdvancedDetails);

    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/options/options.html`);
    await optionsPage.waitForTimeout(1200);
    const optionsState = await optionsPage.evaluate(() => ({
      navText: document.querySelector('[data-tab="general"]')?.textContent.trim(),
      hasAutoAddSetting: !!document.getElementById('autoAddToWhitelist'),
      aboutVersion: document.getElementById('aboutVersion')?.textContent || ''
    }));
    report('options 导航 i18n 生效', ['常规设置', 'General'].includes(optionsState.navText), optionsState.navText);
    report('options 自动加入设置项存在', optionsState.hasAutoAddSetting);
    report('options 版本号 i18n', optionsState.aboutVersion.includes(expectedVersion), optionsState.aboutVersion);

    await popupPage.close();
    await optionsPage.close();
  }
} finally {
  await context.close();
}

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} 项通过`);
process.exit(failed.length ? 1 : 0);
