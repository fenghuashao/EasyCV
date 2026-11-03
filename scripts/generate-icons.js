/**
 * 图标生成脚本
 * 复用 docs/svg_to_png_converter.html 内的 SVG 源数据，渲染四态图标到 icons/
 *
 * 用法：
 *   node scripts/generate-icons.js              # 默认只生成缺失的 partial/inactive 两套
 *   node scripts/generate-icons.js all          # 重新生成全部四态（会覆盖现有 PNG）
 *   node scripts/generate-icons.js partial      # 只生成指定状态
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const ALL_STATES = ['default', 'active', 'partial', 'inactive'];
const SIZES = ['16', '32', '48', '128'];

(async () => {
  // playwright 未列为项目依赖（避免强制下载浏览器），默认解析全局 @playwright/cli 的嵌套依赖
  const playwrightModule = process.env.PLAYWRIGHT_PATH
    || path.join(path.dirname(process.execPath), 'node_modules/@playwright/cli/node_modules/playwright');
  const { chromium } = await import(playwrightModule);
  const args = process.argv.slice(2);
  const states = args.includes('all')
    ? ALL_STATES
    : (args.length ? args : ['partial', 'inactive']); // 默认补齐缺失的两态，不碰现有文件

  const invalid = states.filter(s => !ALL_STATES.includes(s));
  if (invalid.length) {
    console.error(`未知状态: ${invalid.join(', ')}（可选: ${ALL_STATES.join('/')} 或 all）`);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH
      || path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1228/chrome-win64/chrome.exe'),
    headless: true // 纯 canvas 渲染，无需扩展环境
  });

  try {
    const page = await browser.newPage();
    const converterPath = path.join(rootDir, 'docs', 'svg_to_png_converter.html');
    await page.goto('file:///' + converterPath.replace(/\\/g, '/'));

    for (const state of states) {
      for (const size of SIZES) {
        const dataUrl = await page.evaluate(async ([state, size]) => {
          return await new Promise(resolve => svgToPng(iconData[state][size], parseInt(size), resolve));
        }, [state, size]);

        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        const outPath = path.join(rootDir, 'icons', `icon-${state}-${size}.png`);
        fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
        console.log(`✅ icons/icon-${state}-${size}.png`);
      }
    }
  } finally {
    await browser.close();
  }
})();
