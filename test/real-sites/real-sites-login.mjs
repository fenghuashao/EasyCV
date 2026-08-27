/**
 * EasyCV 真实站点测试 —— 人工登录准备
 *
 * 用持久化 profile 打开浏览器（带扩展，与真实使用一致），列出待登录站点，
 * 由使用者人工完成登录（密码/扫码均支持）；脚本每 3 秒轮询登录态 cookie，
 * 全部就绪后自动关闭浏览器并退出。
 *
 * 运行：node test/real-sites/real-sites-login.mjs [--sites=zhihu,bilibili] [--timeout-min=15]
 * 退出码：0 = 全部登录成功；1 = 超时或浏览器被提前关闭（stdout 会给出缺失项）
 */
import { makeContext, detectLoginState, PROFILE_DIR } from './lib/context.mjs';

const onlyArg = (process.argv.find((a) => a.startsWith('--sites=')) || '').slice(8);
const targets = (onlyArg ? onlyArg.split(',') : ['zhihu', 'bilibili'])
  .filter((k) => ['zhihu', 'bilibili'].includes(k));
if (!targets.length) {
  console.error('无有效站点参数，可选值：zhihu,bilibili');
  process.exit(1);
}
const timeoutMin = Number(
  (process.argv.find((a) => a.startsWith('--timeout-min=')) || '').split('=')[1]
) || 15;

const LOGIN_PAGES = {
  zhihu: 'https://www.zhihu.com/signin?next=%2F',
  bilibili: 'https://passport.bilibili.com/login',
};

console.log(`使用 profile: ${PROFILE_DIR}`);
console.log(`待登录站点: ${targets.join(', ')}`);
console.log('请在弹出的浏览器窗口中完成人工登录；全部登录成功后窗口会自动关闭。\n');

const context = await makeContext(true); // 带扩展启动，与日常使用完全一致
const pages = new Map();
let closedByUser = false;
context.on('close', () => { closedByUser = true; });

for (const key of targets) {
  const page = await context.newPage();
  page.on('close', () => pages.delete(key)); // 用户手动关标签页视为该站放弃
  await page.goto(LOGIN_PAGES[key], { timeout: 30000 }).catch(() => {});
  pages.set(key, page);
}

const deadline = Date.now() + timeoutMin * 60_000;
const state = Object.fromEntries(targets.map((k) => [k, 'anonymous']));
let lastReport = '';

while (Date.now() < deadline) {
  if (closedByUser && !pages.size) break;
  for (const key of targets) {
    if (!pages.has(key)) continue; // 标签页已被关闭
    state[key] = await detectLoginState(context, key).catch(() => 'unknown');
  }
  const report = targets.map((k) => `${k}=${state[k] ?? 'unknown'}`).join(' | ');
  if (report !== lastReport) {
    console.log(`[${new Date().toLocaleTimeString()}] ${report} （等待中…）`);
    lastReport = report;
  }
  if (targets.every((k) => state[k] === 'logged-in')) {
    console.log('\n🎉 全部站点登录完成');
    await context.close().catch(() => {});
    process.exit(0);
  }
  if (closedByUser && !pages.size) break;
  await new Promise((r) => setTimeout(r, 3000));
}

await context.close().catch(() => {});
const missing = targets.filter((k) => state[k] !== 'logged-in');
console.log(`\n⏹ 结束。未确认登录态: ${missing.join(', ') || '无'}`);
process.exit(missing.length ? 1 : 0);
