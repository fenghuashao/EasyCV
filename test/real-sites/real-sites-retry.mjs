/**
 * 第三轮补测：doc88 根因直查 + wenku 经百度搜索发现文档 + youtube 直连视频页
 * 直接 stdout 输出，不走 JSON 文件
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
const NAV_TIMEOUT = 40000;

async function makeContext(withExt) {
  const args = withExt
    ? [`--load-extension=${EXT_PATH}`, `--disable-extensions-except=${EXT_PATH}`]
    : [];
  const ctx = await chromium.launchPersistentContext('', {
    executablePath: CHROME, headless: false, viewport: { width: 1440, height: 900 }, args,
  });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  return ctx;
}

function wire(page, tag) {
  page.on('console', (msg) => {
    const m = /Intercepted restrictive (\w+) listener/.exec(msg.text());
    if (m) console.log(`  [${tag}] swallowed: ${m[1]}`);
  });
  page.on('pageerror', (err) => console.log(`  [${tag}] pageerror: ${String(err).slice(0, 200)}`));
}

async function runDoc88(withExt) {
  console.log(`\n##### doc88 (${withExt ? '扩展' : '基线'})`);
  const ctx = await makeContext(withExt);
  try {
    const page = await ctx.newPage();
    wire(page, 'doc88');
    await page.goto('https://www.doc88.com/', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(2500);
    const href = await page.evaluate(() => {
      const a = document.querySelector('a[href*="/p-"][href$=".html"]');
      return a ? a.href : null;
    });
    console.log('  doc:', href);
    if (!href) return;
    await page.goto(href, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(5000);
    console.log('  landed:', page.url());

    const integrity = await page.evaluate(() => ({
      mapHas: typeof Map.prototype.has,
      mapCtorNative: /\[native code\]/.test(Map.toString()),
      setHas: typeof Set.prototype.has,
      arrayFromNative: /\[native code\]/.test(Array.from.toString()),
      aELNative: /\[native code\]/.test(EventTarget.prototype.addEventListener.toString()),
      pdNative: /\[native code\]/.test(Event.prototype.preventDefault.toString()),
      easycvFlag: window.EasyCVInjected === true,
    }));
    console.log('  integrity:', JSON.stringify(integrity));

    const rendered = await page.evaluate(() => ({
      imgs: document.querySelectorAll('img').length,
      canvas: document.querySelectorAll('canvas').length,
      bodyTextLen: document.body ? document.body.innerText.length : 0,
      title: document.title.slice(0, 40),
    }));
    console.log('  rendered:', JSON.stringify(rendered));

    // 吞没路径健壮性：注册一个含 preventDefault 的 keydown 监听器，观察是否抛错
    const regResult = await page.evaluate(() => {
      try {
        let fired = false;
        const fn = function (e) { if (e.key === 'F24') { e.preventDefault(); fired = true; } };
        document.addEventListener('keydown', fn);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F24', cancelable: true }));
        document.removeEventListener('keydown', fn);
        return { threw: false, fired };
      } catch (e) {
        return { threw: true, error: String(e).slice(0, 150) };
      }
    });
    console.log('  restrictive-registration:', JSON.stringify(regResult));
  } finally {
    await ctx.close().catch(() => {});
  }
}

async function runWenku(withExt) {
  console.log(`\n##### wenku (${withExt ? '扩展' : '基线'})`);
  const ctx = await makeContext(withExt);
  try {
    const page = await ctx.newPage();
    wire(page, 'wenku');
    // 经百度搜索发现文库文档直链
    await page.goto('https://www.baidu.com/s?wd=site%3Awenku.baidu.com%20%E4%BD%9C%E6%96%87', {
      waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT,
    });
    await page.waitForTimeout(3000);
    const href = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll('a[href]'))
        .find((x) => /wenku\.baidu\.com\/view\//.test(x.href));
      return a ? a.href : null;
    });
    console.log('  doc via baidu:', href);
    if (!href) return;
    await page.goto(href, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(6000);
    console.log('  landed:', page.url());

    const render = await page.evaluate(() => ({
      title: document.title.slice(0, 40),
      userSelectBody: getComputedStyle(document.body).userSelect,
      easycvFlag: window.EasyCVInjected === true,
      paraCount: document.querySelectorAll('p').length,
    }));
    console.log('  render:', JSON.stringify(render));

    // 选择 + 复制
    const found = await page.evaluate(() => {
      const p = Array.from(document.querySelectorAll('p, div'))
        .find((el) => (el.textContent || '').trim().length > 40 && el.offsetHeight && el.children.length <= 3);
      if (p) p.setAttribute('data-probe-target', '1');
      return !!p;
    });
    console.log('  paraFound:', found);
    if (found) {
      const el = await page.$('[data-probe-target="1"]');
      await el.scrollIntoViewIfNeeded().catch(() => {});
      const box = await el.boundingBox();
      if (box) {
        await page.mouse.move(box.x + 4, box.y + 6);
        await page.mouse.down();
        await page.mouse.move(box.x + Math.min(box.width - 4, 300), box.y + Math.min(box.height - 4, 26), { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(400);
        const sel = await page.evaluate(() => window.getSelection().toString());
        console.log('  selection:', JSON.stringify({ len: sel.length, sample: sel.slice(0, 40) }));
        if (sel.length >= 10) {
          await page.keyboard.press('Control+c');
          await page.waitForTimeout(600);
          const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => `__FAIL__${e.message}`));
          console.log('  clipboard:', JSON.stringify({ ok: !String(clip).startsWith('__FAIL__'), len: String(clip).length, matches: String(clip).includes(sel.slice(0, 20)) }));
        }
      }
    }
    // 右键
    const ctxMenu = await page.evaluate(() =>
      document.body.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
    console.log('  contextmenu notCanceled:', ctxMenu);
  } finally {
    await ctx.close().catch(() => {});
  }
}

async function runYoutube(withExt) {
  console.log(`\n##### youtube (${withExt ? '扩展' : '基线'})`);
  const ctx = await makeContext(withExt);
  try {
    const page = await ctx.newPage();
    wire(page, 'youtube');
    // Big Buck Bunny：稳定、无版权限制、通常无广告
    await page.goto('https://www.youtube.com/watch?v=aqz-KE-bpKQ', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForTimeout(6000);
    console.log('  landed:', page.url());

    const state = () => page.evaluate(() => {
      const v = document.querySelector('video');
      return v ? { paused: v.paused, t: v.currentTime } : null;
    });

    let s = await state();
    console.log('  initial video:', JSON.stringify(s));
    if (s && s.paused) {
      const btn = await page.$('.ytp-large-play-button');
      if (btn) await btn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1500);
      s = await state();
      if (s && s.paused) { await page.evaluate(() => document.querySelector('video').play().catch(() => {})); await page.waitForTimeout(1500); s = await state(); }
    }
    console.log('  playing:', s && !s.paused);
    if (s && !s.paused) {
      await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
      await page.keyboard.press('k');
      await page.waitForTimeout(800);
      const s1 = await state();
      console.log('  k toggles pause:', s.paused !== s1.paused, JSON.stringify({ before: s.paused, after: s1.paused }));
      if (s1.paused) { await page.keyboard.press('k'); await page.waitForTimeout(600); }
      const t0 = (await state()).t;
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(600);
      const t1 = (await state()).t;
      console.log('  ArrowRight seek delta:', +(t1 - t0).toFixed(2));
    }
  } finally {
    await ctx.close().catch(() => {});
  }
}

const which = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const tasks = { doc88: runDoc88, wenku: runWenku, youtube: runYoutube };
for (const [key, fn] of Object.entries(tasks)) {
  if (which && key !== which) continue;
  for (const withExt of [true, false]) {
    await fn(withExt).catch((e) => console.log(`  FATAL: ${e.message.slice(0, 200)}`));
  }
}
console.log('\n补测完成');
