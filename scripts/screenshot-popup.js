/**
 * Popup 商店截图脚本
 * 以持久化上下文加载 dist/ 扩展，在新标签页打开 popup 并截取稳态画面。
 * 输出 1280x800（Chrome 商店截图允许规格，与其余 4 张截图一致），保存至 store-assets/screenshots-v1.1.0/popup.png。
 *
 * 前置条件：先执行 npm run build
 * 运行：node scripts/screenshot-popup.js [输出路径]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// playwright 未列为项目依赖（避免强制下载浏览器），默认解析全局 @playwright/cli 的嵌套依赖
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH
  || 'C:/Program Files/nodejs/node_modules/@playwright/cli/node_modules/playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '../dist');
const outputPath = process.argv[2]
  || path.resolve(__dirname, '../store-assets/screenshots-v1.1.0/popup.png');

// 品牌版 Chrome 137+ 已移除 --load-extension 支持，必须使用 playwright 缓存的 chromium
const chromiumExecutable = process.env.CHROMIUM_PATH
  || path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1228/chrome-win64/chrome.exe');

const WIDTH = 1280;
const HEIGHT = 800;

const context = await chromium.launchPersistentContext('', {
  executablePath: chromiumExecutable,
  headless: false, // MV3 扩展要求在有头模式下运行
  locale: 'zh-CN', // 商店主语言为中文，截图须与 _locales/zh_CN 文案一致
  viewport: { width: WIDTH, height: HEIGHT },
  args: [
    `--load-extension=${extensionPath}`,
    `--disable-extensions-except=${extensionPath}`
  ]
});

try {
  // MV3 service worker URL 携带扩展 ID
  let sw = context.serviceWorkers()[0];
  if (!sw) {
    sw = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }
  const extensionId = new URL(sw.url()).host;

  const page = await context.newPage();
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

  // 等待稳态：版本徽章与 manifest 一致，且状态区不再显示加载中文案
  const expectedVersion = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../manifest.json'), 'utf8')
  ).version;
  await page.waitForFunction(
    (v) => {
      const badge = document.getElementById('versionBadge');
      return !!badge
        && badge.textContent === `v${v}`
        && !document.body.innerText.includes('正在获取');
    },
    expectedVersion,
    { timeout: 10000 }
  );
  await page.waitForTimeout(300); // 渲染余量

  // 截图专用呈现层：popup 本体 380px 宽，居中放在品牌浅蓝渐变画布上补满 1280x800。
  // 仅影响截图构图，不改动任何 UI 数据与交互。
  await page.addStyleTag({
    content: `
      html, body { margin: 0; overflow: hidden; }
      body {
        width: 1280px !important;
        height: 800px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #dbe8fc 0%, #f2f6fc 55%, #dbe8fc 100%);
      }
      .popup-container {
        height: 576px !important;
        max-height: 576px;
        border-radius: 14px;
        box-shadow: 0 12px 40px rgba(66, 133, 244, 0.28);
        overflow: hidden;
      }
    `
  });
  await page.waitForTimeout(100);

  await page.screenshot({ path: outputPath });
  console.log(`✅ popup 截图完成: ${path.relative(path.resolve(__dirname, '..'), outputPath)} (${WIDTH}x${HEIGHT})`);
} finally {
  await context.close();
}
