/**
 * doc88 根因终验：字符串返回规避对象序列化（doc88 页面环境下 evaluate 返回对象会变 undefined）
 * 同时验证 injector 的 Map 依赖在真实页面是否被破坏
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
    page.on('pageerror', (e) => console.log(`  pageerror: ${String(e).slice(0, 200)}`));
    await page.goto('https://www.doc88.com/', { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(2500);
    const href = await page.evaluate(() => {
      const a = document.querySelector('a[href*="/p-"][href$=".html"]');
      return a ? a.href : null;
    });
    console.log(`  doc: ${href}`);
    if (!href) return;
    await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(5000);

    // 全部以字符串形式返回，绕开对象序列化问题
    const s = await page.evaluate(() => [
      `mapHas=${typeof Map.prototype.has}`,
      `mapSet=${typeof Map.prototype.set}`,
      `mapNative=${/\[native code\]/.test(Map.toString())}`,
      `setHas=${typeof Set.prototype.has}`,
      `jsonStringifyNative=${/\[native code\]/.test(JSON.stringify.toString())}`,
      `jsonRoundtrip=${JSON.stringify({ a: 1 }) === '{"a":1}'}`,
      `promiseNative=${/\[native code\]/.test(Promise.toString())}`,
      `easycvInjected=${window.EasyCVInjected === true}`,
      `aELNative=${/\[native code\]/.test(EventTarget.prototype.addEventListener.toString())}`,
      `pdNative=${/\[native code\]/.test(Event.prototype.preventDefault.toString())}`,
    ].join(' | '));
    console.log(`  integrity: ${s}`);

    // 模拟 injector 拦截路径：new Map().has 在当前页面是否可用
    const mapSim = await page.evaluate(() => {
      try {
        const m = new Map();
        m.set('k', 1);
        return `mapSim ok has=${m.has('k')} get=${m.get('k')}`;
      } catch (e) {
        return `mapSim THREW: ${String(e).slice(0, 120)}`;
      }
    });
    console.log(`  ${mapSim}`);

    // 注册含 preventDefault 的监听器，观察 injector 拦截路径是否抛错（字符串返回）
    const reg = await page.evaluate(() => {
      try {
        const fn = function (e) { if (e.key === 'F24') { e.preventDefault(); } };
        document.addEventListener('keydown', fn);
        document.removeEventListener('keydown', fn);
        return 'reg ok (no throw)';
      } catch (e) {
        return `reg THREW: ${String(e).slice(0, 150)}`;
      }
    });
    console.log(`  ${reg}`);
  } finally {
    await ctx.close().catch(() => {});
  }
}

console.log('##### doc88 扩展');
await probe(true).catch((e) => console.log(`  FATAL: ${e.message.slice(0, 200)}`));
console.log('##### doc88 基线');
await probe(false).catch((e) => console.log(`  FATAL: ${e.message.slice(0, 200)}`));
console.log('done');
