/**
 * EasyCV 真实站点回归脚本（DEBT-03）
 *
 * 目标：
 *  1. 限制类站点：验证解锁效果（可选择 / 可复制 / 右键可用）
 *  2. 高交互对照站：寻找误伤（播放器快捷键、输入框、表单过滤）
 *  3. 双上下文对照：同一站点分别跑「带扩展」与「无扩展基线」，
 *     用差值归因——扩展上下文失败而基线通过的项才是误伤
 *
 * 诊断探针（直接验证 DEBT-03 机制在真实站点上的表现；语义已按 R2 名单拆分更新）：
 *  - registrationSwallow: 源码含 preventDefault 的 copy 监听器（吞没名单内）应被吞掉
 *  - keydownPassThrough: 同款 keydown 监听器（已退出吞没名单）应正常触发
 *  - runtimeNeutralize: object-form(handleEvent) 监听器绕得过源码过滤，
 *    但其 ctrl+keydown 的 preventDefault() 调用会被运行时重写中和
 *  - plainKeyPreserved: 无修饰键 keydown 的 preventDefault() 应保持有效
 *    （组合键门控放行播放器单键快捷键）
 *
 * 运行：node real-sites-regression.mjs [--sites=zhihu,wenku,...]
 * 输出：real-sites-results.json（每站增量写入）+ shots/ 截图
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REAL_SITES_DIR, SHOTS_DIR,
  makeContext, detectLoginState,
} from './lib/context.mjs';

const RESULTS_FILE = path.join(REAL_SITES_DIR, 'real-sites-results.json');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const NAV_TIMEOUT = 40000;
const SETTLE_MS = 4000;

// 文库文档直链可经环境变量人工指定（自动化入口已被百度验证码墙阻断，
// 见 real-sites-results.json wenku 条目）；未提供时走搜索引擎发现链
const WENKU_ENTRIES = [
  ...(process.env.WENKU_DOC_URL ? [process.env.WENKU_DOC_URL] : []),
  'https://www.baidu.com/s?wd=site%3Awenku.baidu.com%20%E4%BD%9C%E6%96%87%20800%E5%AD%97',
  'https://www.bing.com/search?q=site%3Awenku.baidu.com+%E4%BD%9C%E6%96%87',
  'https://wenku.baidu.com/search?word=作文+800字',
  'https://wenku.baidu.com/',
];

// ---------------------------------------------------------------------------
// 站点配置
// discover: 从入口页运行时抓取内容页链接（固定 URL 容易失效），pattern 为 href 正则
// entry 支持数组：按序尝试，第一个可用的入口胜出
// ---------------------------------------------------------------------------
const SITES = [
  // ---- 限制类：验证解锁 ----
  {
    key: 'zhihu', kind: 'restricted', name: '知乎',
    entry: 'https://www.zhihu.com/hot',
    discover: { pattern: /\/question\/\d+/, note: '热榜第一条问题' },
    contentSelector: '.QuestionHeader-title, .RichContent, .ContentItem-title, h1',
    copyAppendMarker: '著作权', // 知乎复制长文本会追加著作权声明
  },
  {
    key: 'wenku', kind: 'restricted', name: '百度文库',
    entry: WENKU_ENTRIES,
    discover: { pattern: /\/view\/[0-9a-f]+\.html/, note: '搜索引擎SERP/站内第一个文档直链' },
    contentSelector: '.doc-content, #doc, .reader-wrap, p',
  },
  {
    key: 'doc88', kind: 'restricted', name: '道客巴巴',
    entry: 'https://www.doc88.com/',
    discover: { pattern: /\/p-\d+\.html/, note: '首页第一个文档' },
    contentSelector: '.doc-header, h1, .doc-info, p',
    // 道客巴巴文档页以图片渲染正文，文本选择可能天然不可用（非扩展问题）
    mayBeImageBased: true,
  },
  {
    key: 'docin', kind: 'restricted', name: '豆丁',
    entry: 'https://www.docin.com/',
    discover: { pattern: /\/p-\d+\.html/, note: '首页第一个文档' },
    contentSelector: '.doc_title, h1, .doc-info, p',
    mayBeImageBased: true,
  },
  {
    key: 'csdn', kind: 'restricted', name: 'CSDN',
    entry: [
      // 首页新版为信息流聚合，未必输出文章直链；站内搜索页稳定列出文章链接
      'https://so.csdn.net/so/search?q=python+教程&t=all',
      'https://blog.csdn.net/',
    ],
    discover: { pattern: /\/article\/details\/\d+/, note: '搜索结果第一篇文章' },
    contentSelector: '#article_content, .article_content, article',
    copyAppendMarker: '版权声明',
  },
  // ---- 高交互对照：找误伤 ----
  {
    key: 'bilibili', kind: 'control', name: 'B站视频',
    entry: 'https://www.bilibili.com/v/popular/all',
    discover: { pattern: /\/video\/BV[0-9A-Za-z]+/, note: '热门第一个视频' },
    player: true,
  },
  { key: 'youtube', kind: 'control', name: 'YouTube', entry: [
      // 匿名首页常呈空态且受表单恢复污染（见 shots/youtube-ext.png），
      // 搜索结果页锚点稳定输出 /watch?v= 直链
      'https://www.youtube.com/results?search_query=nasa',
      'https://www.youtube.com/',
    ],
    discover: { pattern: /\/watch\?v=/, note: '搜索结果第一个视频' },
    player: true },
  { key: 'gdocs', kind: 'control', name: 'Google Docs', entry: 'https://docs.google.com/', reachOnlyOnFail: true },
];

// ---------------------------------------------------------------------------
// 浏览器上下文：共享持久化 profile（见 lib/context.mjs）
// ---------------------------------------------------------------------------

function wireConsoleTaps(page, bucket) {
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('EasyCV')) bucket.easycvLogs++;
    if (msg.type() === 'error') bucket.consoleErrors.push(text.slice(0, 200));
  });
  page.on('pageerror', (err) => bucket.pageErrors.push(String(err).slice(0, 200)));
}

// ---------------------------------------------------------------------------
// 通用检查
// ---------------------------------------------------------------------------

// DEBT-03 机制探针：注册吞没 + 运行时中和（探针语义按 R2 名单拆分设计）
async function swallowProbes(page) {
  return page.evaluate(() => {
    const out = {
      registrationSwallow: null,
      keydownPassThrough: null,
      runtimeNeutralize: null,
      plainKeyPreserved: null
    };

    // 探针1a：源码含 preventDefault 的 copy 监听器（仍在吞没名单内）
    let copyFired = false;
    const copyListener = function (e) { e.preventDefault(); copyFired = true; };
    document.addEventListener('copy', copyListener);
    document.dispatchEvent(new Event('copy', { cancelable: true, bubbles: true }));
    document.removeEventListener('copy', copyListener);
    out.registrationSwallow = !copyFired; // true = 被吞（吞没机制生效）

    // 探针1b：同款 keydown 监听器（R2 后已退出吞没名单，应正常触发）
    let keyFired = false;
    const fnListener = function (e) {
      if (e.key === 'F24') { e.preventDefault(); keyFired = true; }
    };
    document.addEventListener('keydown', fnListener);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F24', cancelable: true, bubbles: true }));
    document.removeEventListener('keydown', fnListener);
    out.keydownPassThrough = keyFired; // true = keydown 不再被吞

    // 探针2：object-form(handleEvent) 监听器（源码过滤只看 function/string，对象绕过），
    // 分别观察组合键与无修饰键 keydown 的 preventDefault() 中和情况
    const probeNeutralize = (withCtrl) => {
      let handled = false;
      const objListener = {
        handleEvent(e) { if (e.key === 'F24') { handled = true; e.preventDefault(); } },
      };
      const ev = new KeyboardEvent('keydown', { key: 'F24', ctrlKey: withCtrl, cancelable: true, bubbles: true });
      document.addEventListener('keydown', objListener);
      document.dispatchEvent(ev);
      document.removeEventListener('keydown', objListener);
      return { handled, defaultPrevented: ev.defaultPrevented };
    };
    const ctrl = probeNeutralize(true);
    out.runtimeNeutralize = ctrl.handled && !ctrl.defaultPrevented; // true = 组合键被中和
    const plain = probeNeutralize(false);
    out.plainKeyPreserved = plain.handled && plain.defaultPrevented; // true = 单键 preventDefault 保留

    out.addEventListenerWrapped = EventTarget.prototype.addEventListener
      .toString().includes('originalFunctions');
    out.preventDefaultWrapped = Event.prototype.preventDefault
      .toString().includes('originalFunctions');
    return out;
  });
}

// 在内容容器内挑选有真实文本的段落（容器常是整篇文章，超高、首行可能是图/广告）
async function pickTextParagraph(page, selector) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel) || document.body;
    const p = Array.from(root.querySelectorAll('p, h1, h2, li, div'))
      .find((el) => (el.textContent || '').trim().length > 30
        && el.children.length <= 3
        && el.getBoundingClientRect().height > 8
        && el.getBoundingClientRect().height < 400);
    if (!p) return null;
    p.setAttribute('data-easycv-copy-target', '1');
    return (p.textContent || '').trim().slice(0, 40);
  }, selector);
}

// 鼠标拖拽选择 + 真实 Ctrl+C + 读剪贴板（端到端复制验证）
async function copyEndToEnd(page, selector) {
  // 预滚动触发回答区虚拟列表挂载（知乎等长页面的正文在滚动后才渲染进 DOM）
  let paraText = null;
  for (const dy of [0, 400, 900, 1400]) {
    if (dy) {
      await page.evaluate((y) => window.scrollTo(0, y), dy).catch(() => {});
      await page.waitForTimeout(800).catch(() => {});
    }
    paraText = await pickTextParagraph(page, selector);
    if (paraText) break;
  }
  if (!paraText) return { attempted: false, reason: '未找到含文本的段落（可能是图片渲染型文档）' };

  const target = await page.$('[data-easycv-copy-target="1"]');
  if (!target) return { attempted: false, reason: '段落标记失效' };

  await target.scrollIntoViewIfNeeded().catch(() => {});
  const box = await target.boundingBox();
  if (!box) return { attempted: false, reason: '滚动后元素失去布局' };

  // 只拖段内前两行，保证起止点都在视口内
  const x1 = box.x + 4, y1 = box.y + 6;
  const x2 = box.x + Math.min(box.width - 4, 300);
  const y2 = box.y + Math.min(box.height - 4, 26);
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);

  let selection = await page.evaluate(() => window.getSelection().toString());
  let selectMethod = 'drag';

  // 拖拽失败时退化到 Selection API：绕过了 selectstart，但仍能验证 copy 拦截与剪贴板
  if (!selection || selection.length < 4) {
    selection = await page.evaluate(() => {
      const el = document.querySelector('[data-easycv-copy-target="1"]');
      if (!el || !el.firstChild) return '';
      const range = document.createRange();
      const node = el.firstChild;
      range.setStart(node, 0);
      range.setEnd(node, Math.min(node.length || 0, 80));
      const selObj = window.getSelection();
      selObj.removeAllRanges();
      selObj.addRange(range);
      return selObj.toString();
    });
    selectMethod = 'programmatic';
  }
  if (!selection || selection.length < 4) {
    return { attempted: true, selected: false, selLen: selection ? selection.length : 0, paraText };
  }

  await page.keyboard.press('Control+c');
  await page.waitForTimeout(600);
  const clip = await page.evaluate(() =>
    navigator.clipboard.readText().catch((e) => `__READ_FAIL__:${e.message}`));
  const clipOk = typeof clip === 'string' && !clip.startsWith('__READ_FAIL__');

  return {
    attempted: true,
    selected: true,
    selectMethod,
    selLen: selection.length,
    selSample: selection.slice(0, 60),
    clipboardRead: clipOk,
    clipboardLen: clipOk ? clip.length : 0,
    clipboardMatchesSelection: clipOk && clip.includes(selection.slice(0, 20)),
    // 追加的版权文本在末尾，必须看尾部
    clipboardTail: clipOk ? clip.slice(-150) : '',
  };
}

// 解锁三要素：user-select / 右键不拦截 / 注入状态
async function unlockChecks(page, site) {
  const base = await page.evaluate((sel) => {
    const el = document.querySelector(sel) || document.querySelector('p') || document.body;
    const cs = getComputedStyle(el);
    return {
      injected: window.EasyCVInjected === true,
      userSelect: cs.userSelect,
      found: !!document.querySelector(sel),
    };
  }, site.contentSelector || 'p');

  // 合成 contextmenu 事件：dispatchEvent 返回 false = 有处理器取消了默认行为
  const contextmenu = await page.evaluate((sel) => {
    const el = document.querySelector(sel) || document.body;
    const ok = el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    return { notCanceled: ok };
  }, site.contentSelector || 'p');

  return { ...base, contextmenu };
}

// 输入框打字检查（误伤信号：值与输入不一致）
async function inputTyping(page) {
  const input = await page.$('input[type="text"]:visible, input:not([type]):visible, input[type="search"]:visible');
  if (!input) return { attempted: false, reason: '无可见输入框' };
  try {
    await input.click();
    await input.fill('');
    await page.keyboard.type('easycv', { delay: 25 });
    const value = await input.inputValue();
    return { attempted: true, typed: 'easycv', value, ok: value === 'easycv' };
  } catch (e) {
    return { attempted: false, reason: e.message.slice(0, 120) };
  }
}

// B站/YouTube 播放器快捷键检查
async function playerChecks(page) {
  const r = { videoFound: false };
  const video = await page.$('video');
  if (!video) return { ...r, reason: '未找到 video 元素' };
  r.videoFound = true;

  const getState = () => page.evaluate(() => {
    const v = document.querySelector('video');
    return v ? { paused: v.paused, t: v.currentTime, scrollY: window.scrollY } : null;
  });

  // 确保处于播放状态（点击播放器中央触发播放）
  let s = await getState();
  if (!s) return { ...r, reason: 'video 元素消失' };
  if (s.paused) {
    const box = await video.boundingBox();
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1200);
    s = await getState();
  }
  r.canPlay = s && !s.paused;
  if (!r.canPlay) return { ...r, reason: '视频无法进入播放状态（可能登录墙/地区限制）' };

  // 快捷键测量前置：悬停播放器并失焦输入框——B站/YouTube 的快捷键
  // 只在播放器获得“焦点上下文”时响应，否则基线也会全部失败无法归因
  const vb = await video.boundingBox();
  if (vb) await page.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2);
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  await page.waitForTimeout(300);

  // 空格暂停：快捷键被吞则不暂停；页面滚动为 preventDefault 被中和的副作用
  const before = await getState();
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  const after = await getState();
  r.spacePauses = after.paused === true && before.paused === false;
  r.spaceScrollSideEffect = Math.abs(after.scrollY - before.scrollY) > 50;

  // 恢复播放再测方向键seek
  if (after.paused) { await page.keyboard.press('Space'); await page.waitForTimeout(600); }
  const t0 = (await getState()).t;
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(600);
  const t1 = (await getState()).t;
  r.arrowRightSeekDelta = +(t1 - t0).toFixed(2);
  r.arrowRightSeeks = r.arrowRightSeekDelta >= 1.5;

  return r;
}

// B站登录弹窗手机号输入过滤观察（keydown preventDefault 过滤非数字的典型场景）
async function loginPhoneFilterProbe(page) {
  try {
    const loginBtn = await page.$('text=/^登录$/');
    if (!loginBtn) return { attempted: false, reason: '未找到登录入口' };
    await loginBtn.click();
    await page.waitForTimeout(2500);
    // B站登录在 passport 子域 iframe 中
    const frame = page.frames().find((f) => f.url().includes('passport'));
    const scope = frame || page;
    const phone = await scope.$('input[placeholder*="手机"], input[type="tel"], input[name="tel"]');
    if (!phone) return { attempted: false, reason: '未找到手机号输入框' };
    await phone.click();
    await page.keyboard.type('abc123', { delay: 40 });
    const value = await phone.inputValue();
    return {
      attempted: true,
      value,
      digitsFiltered: value === '123', // 基线预期：字母被过滤
      lettersLeaked: /[a-z]/.test(value), // true = 过滤失效（误伤信号）
    };
  } catch (e) {
    return { attempted: false, reason: e.message.slice(0, 120) };
  }
}

// ---------------------------------------------------------------------------
// 站点运行器
// ---------------------------------------------------------------------------
async function runSite(site, withExt) {
  const label = `${site.key}(${withExt ? '扩展' : '基线'})`;
  const result = {
    site: site.key, name: site.name, kind: site.kind, withExt,
    loginState: null, url: null, reachable: false, checks: {}, errors: [],
    easycvLogs: 0, consoleErrors: [], pageErrors: [],
  };

  const context = await makeContext(withExt);
  try {
    const page = await context.newPage();
    wireConsoleTaps(page, result);

    // 入口页导航（entry 可为数组，按序尝试）
    const entries = Array.isArray(site.entry) ? site.entry : [site.entry];
    let lastNavError = null;
    for (const entry of entries) {
      try {
        await page.goto(entry, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
        lastNavError = null;
        break;
      } catch (e) {
        lastNavError = e;
      }
    }
    if (lastNavError) throw lastNavError;
    result.reachable = true;
    result.loginState = await detectLoginState(context, site.key);

    // 运行时发现内容页（轮询等待，站点信息流常为 JS 延迟渲染，固定 2.5s 不够）
    let targetUrl = site.entry;
    if (site.discover) {
      const href = await page
        .waitForFunction((patternSrc) => {
          const re = new RegExp(patternSrc);
          const a = Array.from(document.querySelectorAll('a[href]')).find((x) => re.test(x.getAttribute('href')));
          return a ? a.href : null;
        }, site.discover.pattern.source, { timeout: 10000, polling: 800 })
        .then((h) => h.jsonValue())
        .catch(() => null);
      if (!href) {
        result.errors.push(`内容页发现失败: ${site.discover.note}`);
      } else {
        targetUrl = href;
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      }
    }
    result.url = page.url();
    await page.waitForTimeout(SETTLE_MS);

    // 扩展注入确认（扩展上下文）
    if (withExt) {
      result.checks.injected = await page
        .waitForFunction(() => window.EasyCVInjected === true, null, { timeout: 12000 })
        .then(() => true).catch(() => false);
    }

    // DEBT-03 探针（两类站点都跑，对照站用于误伤归因）
    result.checks.swallowProbes = await swallowProbes(page).catch((e) => ({ error: e.message.slice(0, 120) }));

    if (site.kind === 'restricted') {
      result.checks.unlock = await unlockChecks(page, site).catch((e) => ({ error: e.message.slice(0, 120) }));
      const copy = await copyEndToEnd(page, site.contentSelector || 'p')
        .catch((e) => ({ attempted: false, reason: e.message.slice(0, 120) }));
      if (site.copyAppendMarker && copy.clipboardRead) {
        copy.hasCopyAppend = (copy.clipboardTail || '').includes(site.copyAppendMarker)
          || (copy.clipboardLen > copy.selLen + 30);
      }
      result.checks.copy = copy;
    } else {
      result.checks.inputTyping = await inputTyping(page).catch((e) => ({ attempted: false, reason: e.message.slice(0, 120) }));
      if (site.player) {
        result.checks.player = await playerChecks(page).catch((e) => ({ error: e.message.slice(0, 120) }));
      }
      if (site.key === 'bilibili') {
        result.checks.loginPhoneFilter = await loginPhoneFilterProbe(page)
          .catch((e) => ({ attempted: false, reason: e.message.slice(0, 120) }));
      }
    }

    await page.screenshot({
      path: path.join(SHOTS_DIR, `${site.key}-${withExt ? 'ext' : 'base'}.png`),
    }).catch(() => {});
  } catch (e) {
    result.errors.push(`${label}: ${e.message.slice(0, 200)}`);
  } finally {
    await context.close().catch(() => {});
  }

  result.easycvLogs = result.easycvLogs || 0;
  console.log(`[done] ${label} reachable=${result.reachable} login=${result.loginState} errors=${result.errors.length}`);
  return result;
}

// ---------------------------------------------------------------------------
// 主流程：串行跑（剪贴板/焦点敏感，不并行；同一 profile 不可并发）
// ---------------------------------------------------------------------------
const onlyArg = (process.argv.find((a) => a.startsWith('--sites=')) || '').slice(8);
const siteList = onlyArg ? SITES.filter((s) => onlyArg.split(',').includes(s.key)) : SITES;

const allResults = fs.existsSync(RESULTS_FILE)
  ? JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'))
  : [];

for (const site of siteList) {
  for (const withExt of [true, false]) {
    const r = await runSite(site, withExt);
    // 同站同模式重跑时覆盖旧结果
    const idx = allResults.findIndex((x) => x.site === r.site && x.withExt === r.withExt);
    if (idx >= 0) allResults[idx] = r; else allResults.push(r);
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(allResults, null, 2));
  }
}

// 汇总登录态覆盖情况，提示结论置信度
const covered = new Set(allResults.map((r) => r.site));
const summary = siteList.map((s) => {
  if (!covered.has(s.key)) return `${s.key}: 未执行`;
  const withExtRun = allResults.find((r) => r.site === s.key && r.withExt === true);
  const st = withExtRun ? withExtRun.loginState : null;
  return `${s.key}: ${st ?? 'n/a'}`;
}).join('\n  ');
console.log(`\n全部完成，结果写入 ${RESULTS_FILE}`);
console.log(`登录态汇总（logged-in 结论可直接采信；anonymous 仅作参考）:\n  ${summary}`);
