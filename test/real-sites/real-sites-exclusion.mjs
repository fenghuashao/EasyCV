/**
 * EasyCV 真实站点回归 —— 站点排除列表（DEBT-08）端到端场景
 *
 * 模拟真实用户完整操作链（全部走 options 页 UI，不直改存储）：
 *   1. 基线：未排除的普通站点（example.org）应正常注入（EasyCVInjected=true）
 *   2. 用户在「站点排除」页添加 example.org
 *   3. 排除后该站点应完全停用：不再注入（休眠日志属于正常提示，不算失败）
 *   4. 用户从列表移除，存储层确认删除后，站点恢复注入
 *   5. 收尾核验：排除列表恢复为初始快照（不污染后续测试与日常配置）
 *
 * 注意：本扩展配置存储区域为 chrome.storage.sync（见 utils/storage-utils.js get/set）。
 *
 * 运行：node test/real-sites/real-sites-exclusion.mjs
 * 输出：real-sites-exclusion-results.json + shots/exclusion-*.png
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  REAL_SITES_DIR, SHOTS_DIR,
  makeContext, getExtensionId,
} from './lib/context.mjs';

const RESULTS_FILE = path.join(REAL_SITES_DIR, 'real-sites-exclusion-results.json');
const TARGET_SITE = 'https://example.org/';
const TARGET_DOMAIN = 'example.org';

const results = { timestamp: new Date().toISOString(), steps: [], pass: false };
function report(name, pass, detail = '') {
  results.steps.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function waitInjected(page, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const v = await page.evaluate(() => window.EasyCVInjected === true).catch(() => null);
    if (v === true) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

// 在 options 页上下文读取排除列表（与 StorageUtils 同区域：sync）
async function readExcludedList(optPage) {
  return optPage.evaluate(
    () => chrome.storage.sync.get(null).then((all) => all.excluded_list)
  ).catch(() => null);
}

const context = await makeContext(true);
try {
  // 等扩展 service worker 就绪并取得扩展 ID
  const extId = await getExtensionId(context);
  report('扩展加载（service worker 就绪）', true, extId);

  const optionsUrl = `chrome-extension://${extId}/options/options.html`;

  // ---- 步骤1：基线注入 ----
  const basePage = await context.newPage();
  const baseLogs = [];
  basePage.on('console', (m) => { if (m.text().includes('EasyCV')) baseLogs.push(m.text()); });
  await basePage.goto(TARGET_SITE, { timeout: 30000 });
  const baseInjected = await waitInjected(basePage);
  report('基线：未排除站点正常注入', baseInjected);
  await basePage.close().catch(() => {});

  // ---- 步骤2：通过 options UI 添加排除域名 ----
  const optPage = await context.newPage();
  await optPage.goto(optionsUrl, { timeout: 30000 });
  await optPage.click('li.menu-item[data-tab="excluded"]').catch(async () => {
    await optPage.click('#excluded');
  });
  await optPage.waitForSelector('#excludedInput', { timeout: 5000 });
  await optPage.fill('#excludedInput', TARGET_DOMAIN);
  await optPage.click('#addExcludedBtn');
  const addedToUi = await optPage.waitForFunction(
    (d) => document.querySelector('#excludedContainer')?.innerText.includes(d),
    TARGET_DOMAIN,
    { timeout: 5000 },
  ).then(() => true).catch(() => false);
  report(`options UI 添加 ${TARGET_DOMAIN}`, addedToUi);

  const listAfterAdd = await readExcludedList(optPage);
  const storedOk = Array.isArray(listAfterAdd) && listAfterAdd.includes(TARGET_DOMAIN);
  report('存储层写入确认（chrome.storage.sync）', storedOk,
    storedOk ? `共 ${listAfterAdd.length} 项：${listAfterAdd.join(', ')}` : `实际值=${JSON.stringify(listAfterAdd)}`);
  // 快照以添加后的状态为准（收尾比对 + 清理兜底都相对它进行）
  const snapshotAfterAdd = Array.isArray(listAfterAdd) ? [...listAfterAdd] : [];

  await optPage.screenshot({ path: path.join(SHOTS_DIR, 'exclusion-added.png') }).catch(() => {});

  // ---- 步骤3：排除后停止注入 ----
  // 等待 service worker 通过 storage.onChanged 刷新状态缓存
  await optPage.waitForTimeout(1500);
  const isoLogs = [];
  const isoPage = await context.newPage();
  isoPage.on('console', (m) => { if (m.text().includes('EasyCV')) isoLogs.push(m.text()); });
  await isoPage.goto(TARGET_SITE, { timeout: 30000 });
  const stillInjected = await waitInjected(isoPage, 6000);
  // 用户可见契约只有一条：不再注入。休眠期的提示性日志不构成误伤证据，
  // 但仍记录样本供人工审阅（如出现高频刷屏日志则应另立 DEBT 跟踪）
  report('排除后站点完全停用（不再注入）', !stillInjected,
    stillInjected ? '注入标志仍存在' : `注入已停；页面 EasyCV 日志 ${isoLogs.length} 条${isoLogs[0] ? `，如：「${isoLogs[0].slice(0, 80)}」` : ''}`);
  results.isolationLogsSample = isoLogs.slice(0, 5);
  await isoPage.screenshot({ path: path.join(SHOTS_DIR, 'exclusion-isolated.png') }).catch(() => {});
  await isoPage.close().catch(() => {});

  // ---- 步骤4：UI 移除 → 存储确认 → 恢复注入 ----
  // 仅定位行内删除按钮（data-domain 同名 div 是整行容器，点它无效）
  const delBtn = optPage.locator(`#excludedContainer button.action-btn-small.delete[data-domain="${TARGET_DOMAIN}"]`).first();
  try {
    await delBtn.click({ timeout: 5000 });
  } catch (e) {
    report(`options UI 移除 ${TARGET_DOMAIN}`, false, e.message.slice(0, 120));
  }
  await optPage.waitForTimeout(500);

  const listAfterRemove = await readExcludedList(optPage);
  const removedOk = Array.isArray(listAfterRemove) && !listAfterRemove.includes(TARGET_DOMAIN);
  report('存储层移除确认', removedOk, `剩余 ${listAfterRemove?.length ?? '?'} 项`);
  // 等 service worker 缓存刷新后再验证恢复
  await optPage.waitForTimeout(1500);

  const resumePage = await context.newPage();
  await resumePage.goto(TARGET_SITE, { timeout: 30000 });
  const resumed = await waitInjected(resumePage);
  report('移除后站点恢复注入', resumed);
  await resumePage.screenshot({ path: path.join(SHOTS_DIR, 'exclusion-resumed.png') }).catch(() => {});
  await resumePage.close().catch(() => {});

  // ---- 步骤5：收尾核验（列表恢复至添加前口径：即快照去掉目标域名）----
  const finalList = await readExcludedList(optPage);
  const expectedFinal = snapshotAfterAdd.filter((d) => d !== TARGET_DOMAIN);
  const sameAsBefore = Array.isArray(finalList)
    && finalList.length === expectedFinal.length
    && expectedFinal.every((d) => finalList.includes(d));
  report('收尾：排除列表恢复至初始快照', sameAsBefore,
    `最终列表(${finalList?.length ?? '?'}项): ${(Array.isArray(finalList) ? finalList : []).join(', ')}`);
  await optPage.screenshot({ path: path.join(SHOTS_DIR, 'exclusion-final.png') }).catch(() => {});
  await optPage.close().catch(() => {});

  results.pass = results.steps.every((s) => s.pass);
} catch (e) {
  report('执行异常', false, String(e).slice(0, 300));
} finally {
  await context.close().catch(() => {});
}

fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
console.log(`\n${results.pass ? '🎉 排除列表端到端全部通过' : '⚠ 存在失败步骤'}，结果写入 ${RESULTS_FILE}`);
process.exit(results.pass ? 0 : 1);
