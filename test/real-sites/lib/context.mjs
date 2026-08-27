/**
 * 真实站点测试共享设施：持久化 profile 浏览器上下文
 *
 * 与真实用户场景对齐的关键点：
 *  - 固定 userDataDir（test/real-sites/.profile/）：cookie/登录态跨次保留，
 *    避免空临时目录导致的反爬墙误判（此前知乎 40362、YouTube 登录墙均因此）
 *  - locale=zh-CN + Asia/Shanghai 时区：与目标用户一致，站点输出中文界面
 *  - 有头模式（MV3 扩展要求）+ 剪贴板全局授权（端到端复制验证需要）
 *
 * 环境变量覆盖：
 *  - EASYCV_EXT_PATH  指定其他扩展构建产物（默认仓库根 dist/）
 *  - CHROMIUM_PATH    指定浏览器可执行文件
 *  - EASYCV_PROFILE   指定其他 profile 目录（默认 test/real-sites/.profile）
 *
 * 注意：同一 profile 目录不可被两个浏览器进程同时使用，各脚本请串行运行。
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH
  || 'C:/Program Files/nodejs/node_modules/@playwright/cli/node_modules/playwright');

export const OUT_DIR = path.dirname(fileURLToPath(import.meta.url)); // .../test/real-sites/lib
export const REAL_SITES_DIR = path.resolve(OUT_DIR, '..');
export const SHOTS_DIR = path.join(REAL_SITES_DIR, 'shots');
export const EXT_PATH = process.env.EASYCV_EXT_PATH || path.resolve(OUT_DIR, '../../../dist');
export const CHROME = process.env.CHROMIUM_PATH
  || path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1228/chrome-win64/chrome.exe');
export const PROFILE_DIR = process.env.EASYCV_PROFILE || path.join(REAL_SITES_DIR, '.profile');

export async function makeContext(withExt) {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const args = withExt
    ? [`--load-extension=${EXT_PATH}`, `--disable-extensions-except=${EXT_PATH}`]
    : [];
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    executablePath: CHROME,
    headless: false, // MV3 必须有头
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    args,
  });
  // 剪贴板端到端验证需要读取权限；全局授权避免各站 origin 差异
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  return ctx;
}

/**
 * 获取扩展 ID（用于打开 chrome-extension:// 页面，如 options 页）
 */
export async function getExtensionId(ctx) {
  const sw = ctx.serviceWorkers()[0]
    || await ctx.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => null);
  if (!sw) throw new Error('未能获取扩展 service worker（确认 dist/ 已构建且加载成功）');
  return new URL(sw.url()).host;
}

/**
 * 各站点登录态检测（读取含 HttpOnly 的完整 cookie）
 * 返回 'logged-in' | 'anonymous' | 'n/a'
 */
export async function detectLoginState(ctx, siteKey) {
  try {
    if (siteKey === 'zhihu') {
      const cookies = await ctx.cookies('https://www.zhihu.com/');
      return cookies.some((c) => c.name === 'z_c0') ? 'logged-in' : 'anonymous';
    }
    if (siteKey === 'bilibili') {
      const cookies = await ctx.cookies('https://www.bilibili.com/');
      return cookies.some((c) => c.name === 'SESSDATA' || c.name === 'DedeUserID')
        ? 'logged-in' : 'anonymous';
    }
  } catch {
    return 'anonymous';
  }
  return 'n/a';
}
