/**
 * B站播放器右键定制菜单检查：扩展的 contextmenu 拦截可能使站点自定义菜单失效
 * 判定：真实右键点击播放器 -> DOM 内出现 bpx 自定义菜单节点 = 定制菜单生效；无 = 原生菜单/失效
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH
  || 'C:/Program Files/nodejs/node_modules/@playwright/cli/node_modules/playwright');

// 扩展构建产物默认取仓库根 dist/，可用 EASYCV_EXT_PATH 覆盖（如验证其他 worktree 的构建）
const EXT_PATH = process.env.EASYCV_EXT_PATH
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
const CHROME = process.env.CHROMIUM_PATH
  || path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1228/chrome-win64/chrome.exe');

async function probe(withExt) {
  const args = withExt
    ? [`--load-extension=${EXT_PATH}`, `--disable-extensions-except=${EXT_PATH}`] : [];
  const ctx = await chromium.launchPersistentContext('', {
    executablePath: CHROME, headless: false, viewport: { width: 1280, height: 800 }, args,
  });
  try {
    const page = await ctx.newPage();
    await page.goto('https://www.bilibili.com/v/popular/all', { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(2500);
    const href = await page.evaluate(() => {
      const a = document.querySelector('a[href*="/video/BV"]');
      return a ? a.href : null;
    });
    if (!href) { console.log('  未找到视频链接'); return; }
    await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(6000);
    console.log(`  video: ${page.url()}`);

    const video = await page.$('video');
    const box = video && await video.boundingBox();
    if (!box) { console.log('  无 video 布局'); return; }

    // 真实右键点击播放器中央
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
    await page.waitForTimeout(800);

    const menuInfo = await page.evaluate(() => {
      const menus = Array.from(document.querySelectorAll(
        '.bpx-player-contextmenu, .bilibili-player-video-popup, [class*="context-menu"], [class*="contextmenu"]'))
        .filter((el) => el.offsetWidth && el.offsetHeight);
      return `customMenuVisible=${menus.length > 0} count=${menus.length} cls=${menus.map((m) => m.className.toString().slice(0, 50)).join(',')}`;
    });
    console.log(`  ${menuInfo}`);
  } finally {
    await ctx.close().catch(() => {});
  }
}

console.log('##### bilibili 扩展');
await probe(true).catch((e) => console.log(`  FATAL: ${e.message.slice(0, 200)}`));
console.log('##### bilibili 基线');
await probe(false).catch((e) => console.log(`  FATAL: ${e.message.slice(0, 200)}`));
console.log('done');
