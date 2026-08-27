/**
 * EasyCV 真实站点回归 —— 深挖探针（第二轮）
 *
 * 针对第一轮发现的问题做归因验证：
 *  1. bilibili：视频点击无法播放是否由扩展吞监听器导致（逐事件类型统计吞没日志）
 *     快捷键测试修正：先点播放器再按键（首轮先在搜索框打字污染了焦点）
 *  2. doc88：根因验证——页面是否篡改了 Map.prototype 等内置原型，
 *     以及该异常是否破坏了页面自身功能（翻页按钮）
 *  3. zhihu：多候选入口自适应（/hot 被重定向登录页）
 *  4. wenku：从搜索/频道页发现 /view/ 文档链接
 *  5. youtube：发现 /watch 视频页后测播放器快捷键
 *
 * 运行：node real-sites-probes.mjs [--sites=bilibili,doc88]
 * 输出：probes-results.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REAL_SITES_DIR, SHOTS_DIR, makeContext } from './lib/context.mjs';

const RESULTS_FILE = path.join(REAL_SITES_DIR, 'probes-results.json');

const NAV_TIMEOUT = 40000;
// 浏览器上下文使用共享持久化 profile（见 lib/context.mjs）

// 逐事件类型统计 injector 吞没日志（DEBT-03 误伤归因的关键证据）
function wireTaps(page, bucket) {
  page.on('console', (msg) => {
    const text = msg.text();
    const m = /Intercepted restrictive (\w+) listener/.exec(text);
    if (m) bucket.swallowed[m[1]] = (bucket.swallowed[m[1]] || 0) + 1;
    if (msg.type() === 'error') bucket.consoleErrors.push(text.slice(0, 300));
  });
  page.on('pageerror', (err) => bucket.pageErrors.push(String(err).slice(0, 300)));
}

const getVideoState = (page) => page.evaluate(() => {
  const v = document.querySelector('video');
  return v ? { paused: v.paused, t: v.currentTime, readyState: v.readyState } : null;
});

// 多策略尝试让视频进入播放态，记录每种策略的结果
async function tryStartPlayback(page, siteKey) {
  const attempts = {};
  const strategies = {
    // 点击视频画面中央
    clickVideoCenter: async () => {
      const v = await page.$('video');
      const box = v && await v.boundingBox();
      if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    },
    // 播放器控件播放按钮
    clickPlayButton: async () => {
      const sel = siteKey === 'youtube'
        ? '.ytp-large-play-button, .ytp-play-button'
        : '.bpx-player-ctrl-play, .bpx-player-play-wrap, .bilibili-player-video-btn-start';
      const btn = await page.$(sel);
      if (btn) await btn.click({ force: true }).catch(() => {});
    },
    // 键盘 k（YouTube 通配播放暂停）
    pressK: async () => { await page.keyboard.press('k'); },
    // 程序化播放（用户手势已发生后通常被允许）
    programmaticPlay: async () => {
      await page.evaluate(() => {
        const v = document.querySelector('video');
        if (v) return v.play().catch((e) => String(e));
        return 'no-video';
      });
    },
  };

  for (const [name, fn] of Object.entries(strategies)) {
    const before = await getVideoState(page);
    await fn().catch((e) => { attempts[`${name}:error`] = e.message.slice(0, 100); });
    await page.waitForTimeout(1200);
    const after = await getVideoState(page);
    attempts[name] = { before: before && before.paused, after: after && after.paused };
    if (after && !after.paused) { attempts.playingVia = name; break; }
  }
  const final = await getVideoState(page);
  return { attempts, playing: !!(final && !final.paused) };
}

// 快捷键矩阵：悬停播放器 + 先确保焦点不在输入框
async function shortcutMatrix(page, siteKey) {
  const r = {};
  const v = await page.$('video');
  const box = v && await v.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });

  const s0 = await getVideoState(page);
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  const s1 = await getVideoState(page);
  r.space = { before: s0.paused, after: s1.paused, toggled: s0.paused !== s1.paused };
  // 空格后若暂停了，先恢复再测方向键
  if (s1.paused) { await page.keyboard.press('Space'); await page.waitForTimeout(600); }

  const t0 = (await getVideoState(page)).t;
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(600);
  const t1 = (await getVideoState(page)).t;
  r.arrowRight = { delta: +(t1 - t0).toFixed(2), seeks: t1 - t0 >= 1.5 };

  const t2 = (await getVideoState(page)).t;
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(600);
  const t3 = (await getVideoState(page)).t;
  r.arrowLeft = { delta: +(t3 - t2).toFixed(2), seeks: t2 - t3 >= 1.5 };
  return r;
}

async function probeBilibili(page, withExt, result) {
  await page.goto('https://www.bilibili.com/v/popular/all', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(2500);
  const href = await page.evaluate(() => {
    const a = document.querySelector('a[href*="/video/BV"]');
    return a ? a.href : null;
  });
  if (!href) { result.errors.push('未找到视频链接'); return; }
  await page.goto(href, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(6000); // 播放器初始化较慢
  result.url = page.url();

  result.playback = await tryStartPlayback(page, 'bilibili');
  if (result.playback.playing) {
    result.shortcuts = await shortcutMatrix(page, 'bilibili');
  }

  // 搜索输入框诊断：列出页面所有 input 及其可见性
  result.inputDiagnostics = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input')).slice(0, 8).map((el) => ({
      type: el.type, id: el.id, cls: (el.className || '').toString().slice(0, 40),
      visible: !!(el.offsetWidth && el.offsetHeight),
    })));
}

async function probeYoutube(page, withExt, result) {
  await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(3000);
  const href = await page.evaluate(() => {
    const a = document.querySelector('a#video-title-link[href*="/watch"], a[href*="/watch?v="]');
    return a ? a.href : null;
  });
  if (!href) { result.errors.push('未找到视频链接'); return; }
  await page.goto(href, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(5000);
  result.url = page.url();

  result.playback = await tryStartPlayback(page, 'youtube');
  if (result.playback.playing) {
    result.shortcuts = await shortcutMatrix(page, 'youtube');
  }
}

async function probeDoc88(page, withExt, result) {
  await page.goto('https://www.doc88.com/', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(2500);
  const href = await page.evaluate(() => {
    const a = document.querySelector('a[href*="/p-"][href$=".html"]');
    return a ? a.href : null;
  });
  if (!href) { result.errors.push('未找到文档链接'); return; }
  await page.goto(href, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(5000);
  result.url = page.url();

  // 根因验证：内置原型是否被页面篡改
  result.prototypeIntegrity = await page.evaluate(() => ({
    mapHas: typeof Map.prototype.has,
    mapCtorNative: /\[native code\]/.test(Map.toString()),
    setHas: typeof Set.prototype.has,
    arrayFromNative: /\[native code\]/.test(Array.from.toString()),
    addEventListenerNative: /\[native code\]/.test(EventTarget.prototype.addEventListener.toString()),
    preventDefaultNative: /\[native code\]/.test(Event.prototype.preventDefault.toString()),
  })).catch((e) => ({ error: e.message.slice(0, 150) }));

  // 页面功能是否被异常阻断：文档是否渲染出页面内容
  result.docRendered = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img').length;
    const canvas = document.querySelectorAll('canvas').length;
    const text = document.body ? document.body.innerText.length : 0;
    return { imgs, canvas, bodyTextLen: text };
  }).catch((e) => ({ error: e.message.slice(0, 150) }));

  // 翻页/工具栏按钮可点性（拦截异常会中断脚本，按钮可能失效）
  result.pagerClick = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('a, span, div, button'))
      .filter((el) => /下一页|下页|next/i.test(el.textContent || '') && el.offsetWidth)
      .slice(0, 1);
    if (!btns.length) return { found: false };
    try { btns[0].click(); return { found: true, clicked: true }; }
    catch (e) { return { found: true, clicked: false, error: e.message.slice(0, 100) }; }
  }).catch((e) => ({ error: e.message.slice(0, 150) }));
}

// 多候选入口自适应：第一个不被重定向到登录页的胜出
async function probeZhihu(page, withExt, result) {
  const candidates = [
    'https://www.zhihu.com/question/19550225',
    'https://www.zhihu.com/question/263460725',
    'https://www.zhihu.com/hot',
  ];
  let landed = null;
  for (const url of candidates) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(2500);
    if (!page.url().includes('signin')) { landed = page.url(); break; }
  }
  result.url = page.url();
  if (!landed) { result.errors.push('所有候选入口均被重定向到登录页'); return; }

  // 知乎复制追加著作权声明的验证：拖拽选择正文 -> Ctrl+C -> 读剪贴板
  const para = await page.evaluate(() => {
    const p = Array.from(document.querySelectorAll('.RichContent p, .QuestionHeader-title, h1, p'))
      .find((el) => (el.textContent || '').trim().length > 40 && el.offsetHeight);
    if (!p) return false;
    p.setAttribute('data-probe-target', '1');
    return true;
  });
  if (!para) { result.errors.push('未找到正文段落'); return; }
  const el = await page.$('[data-probe-target="1"]');
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const box = await el.boundingBox();
  await page.mouse.move(box.x + 4, box.y + 6);
  await page.mouse.down();
  await page.mouse.move(box.x + Math.min(box.width - 4, 400), box.y + Math.min(box.height - 4, 40), { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const selection = await page.evaluate(() => window.getSelection().toString());
  result.selection = { len: selection.length, sample: selection.slice(0, 50) };
  if (selection.length >= 10) {
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(600);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => `__FAIL__${e.message}`));
    result.clipboard = {
      read: !String(clip).startsWith('__FAIL__'),
      len: String(clip).length,
      hasCopyrightAppend: String(clip).includes('著作权'),
      tail: String(clip).slice(-120),
    };
  }
}

async function probeWenku(page, withExt, result) {
  const entries = [
    'https://wenku.baidu.com/search?word=%E4%BD%9C%E6%96%87%E8%8C%83%E6%96%87',
    'https://wenku.baidu.com/',
  ];
  let docUrl = null;
  for (const entry of entries) {
    await page.goto(entry, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(3000);
    docUrl = await page.evaluate(() => {
      const a = document.querySelector('a[href*="/view/"]');
      return a ? a.href : null;
    });
    if (docUrl) break;
  }
  if (!docUrl) { result.errors.push('未发现 /view/ 文档链接'); result.url = page.url(); return; }
  await page.goto(docUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(6000); // 文库文档渲染较慢
  result.url = page.url();

  // 文库正文渲染形态 + 选择/复制能力
  result.docRender = await page.evaluate(() => ({
    textLen: document.body ? document.body.innerText.length : 0,
    selectableEls: document.querySelectorAll('.reader-wrap p, .doc-content p, .mod p, p').length,
    userSelectBody: getComputedStyle(document.body).userSelect,
  }));
  const probe = await page.evaluate(() => {
    const p = Array.from(document.querySelectorAll('p, .reader-wrap div, .doc-content div'))
      .find((el) => (el.textContent || '').trim().length > 40 && el.offsetHeight && el.children.length <= 3);
    if (!p) return null;
    p.setAttribute('data-probe-target', '1');
    return (p.textContent || '').trim().slice(0, 40);
  });
  result.paraFound = probe;
  if (probe) {
    const el = await page.$('[data-probe-target="1"]');
    await el.scrollIntoViewIfNeeded().catch(() => {});
    const box = await el.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 4, box.y + 6);
      await page.mouse.down();
      await page.mouse.move(box.x + Math.min(box.width - 4, 300), box.y + Math.min(box.height - 4, 26), { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(400);
      const selection = await page.evaluate(() => window.getSelection().toString());
      result.selection = { len: selection.length, sample: selection.slice(0, 50) };
      if (selection.length >= 10) {
        await page.keyboard.press('Control+c');
        await page.waitForTimeout(600);
        const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => `__FAIL__${e.message}`));
        result.clipboard = { read: !String(clip).startsWith('__FAIL__'), len: String(clip).length, matches: String(clip).includes(selection.slice(0, 20)) };
      }
    }
  }
}

const PROBES = { bilibili: probeBilibili, youtube: probeYoutube, doc88: probeDoc88, zhihu: probeZhihu, wenku: probeWenku };

const onlyArg = (process.argv.find((a) => a.startsWith('--sites=')) || '').slice(8);
const keys = onlyArg ? onlyArg.split(',') : Object.keys(PROBES);

const allResults = fs.existsSync(RESULTS_FILE)
  ? JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'))
  : [];

for (const key of keys) {
  for (const withExt of [true, false]) {
    const result = { site: key, withExt, url: null, swallowed: {}, consoleErrors: [], pageErrors: [], errors: [] };
    const context = await makeContext(withExt);
    try {
      const page = await context.newPage();
      wireTaps(page, result);
      await PROBES[key](page, withExt, result);
      await page.screenshot({ path: path.join(SHOTS_DIR, `probe-${key}-${withExt ? 'ext' : 'base'}.png`) }).catch(() => {});
    } catch (e) {
      result.errors.push(e.message.slice(0, 200));
    } finally {
      await context.close().catch(() => {});
    }
    const idx = allResults.findIndex((x) => x.site === key && x.withExt === withExt);
    if (idx >= 0) allResults[idx] = result; else allResults.push(result);
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(allResults, null, 2));
    console.log(`[probe-done] ${key}(${withExt ? '扩展' : '基线'}) swallowed=${JSON.stringify(result.swallowed)} errors=${result.errors.length}`);
  }
}
console.log(`\n探针完成，结果写入 ${RESULTS_FILE}`);
