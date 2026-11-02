# Changelog

所有重要的项目更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [Unreleased]

## [1.1.2] - 2026-11-01

### 权限整改（本地候选，尚未提交商店）
- 移除未使用的 `scripting` 与冗余的 `activeTab`；保留 `storage`、`contextMenus` 及现有 `<all_urls>` 范围，保持注入与核心业务逻辑原样
- 同步 manifest、package 与 lockfile 根版本；打包说明从产物 manifest 读取权限，修正用户手册及隐私权限说明
- 本轮回归、发布 ZIP 校验、人工验收及商店包比对限制见 [1.1.2 权限整改报告](./EASYCV-1.1.2-PERMISSION-FIX.md)

## [1.1.1] - 2026-08-31

### ✨ 新功能
- 关于页「技术支持」三个链接（GitHub 仓库 / 问题反馈 / 使用文档）指向真实仓库并抽为配置项：`options/options.js` 顶部 `REPO_BASE_URL`，仓库迁移或更名仅需改一处
- 仓库转为公开并启用 GitHub Wiki 作为对外使用文档入口（Home + 使用文档两页，由 `docs/用户使用手册.md` 提炼同步）

### 🐛 问题修复
- DEBT-05 日志静音：content/injector 调试日志接入 debugMode 开关——content.js 42 处调试日志收口至 debugLog 门控；injector.js 由 content 经 dataset 下发开关（25 处门控）；warn/error 保留作异常诊断通道。B 站登录态实测单页日志 67→1 条，注入与快捷键行为无回归
- popup 默认状态与设置导出文件中的版本号改为动态读取 `chrome.runtime.getManifest().version`，消除每次发版的硬编码漂移（原导出文件始终盖 1.1.0 版本戳）
- popup 首次打开立即执行页面状态检测（原逻辑仅注册 30 秒周期定时器，首次打开最长停留「检测中」半分钟）；修复「当前网址」行从未赋值、任何页面下永远显示「正在获取...」的缺陷——现展示 http(s) 站点域名，扩展页等非网页场景自动隐藏；快捷操作按钮启用 nowrap，修复「添加到自动开启」文字折行

### 🧪 测试
- 真实站点测试基建重建：持久化登录态 profile（cookie 跨次保留 + zh-CN 本地化，替代旧空临时目录方案）、人工登录准备工具（轮询检测 z_c0/SESSDATA）、站点排除列表端到端场景（7/7 通过）、结果按 loginState 置信度分级
- 旧 2026-08 实测证据作废清除（其空 profile 方法将"环境受限"误记为插件问题），以 v2 全量重测报告替代（`docs/测试报告-真实站点回归-2026-08-v2.md`）：CSDN 解锁归因成立；B站播放器快捷键误伤排除（登录态双确认，推翻旧报告）；doc88 旧 P0 翻案为站点固有行为；知乎 40362 / YouTube 定论为环境受限

## [1.1.0] - 2026-08-10

### ✨ 新功能
- 站点排除列表（DEBT-08）：设置页新增「站点排除」管理，被排除站点完全休眠（优先级高于全局开关、自动启用与强力模式），是误伤场景的用户逃生通道；匹配支持子域覆盖（排除 bilibili.com 即覆盖 www.bilibili.com）；内置 accounts.google.com / login.live.com / appleid.apple.com 敏感账号域名默认排除（解除脚本不在账号登录页运行）；纳入设置导入导出
- t1 重写合并：标准国际化（_locales 中英双语）；Shadow DOM 穿透与 SPA 路由感知；popup 重构为单主按钮 + 高级折叠区；自动启用管理逻辑重构

### 🔒 拦截策略收敛（DEBT-03，基于 8 个真实站点双上下文回归实测）
- R1 拦截路径零异常：修复页面篡改全局 Map 的站点（道客巴巴）上 TypeError 穿透进页面脚本的问题
- R2 收窄注册吞没名单至 6 类纯限制事件，keydown/keyup 仅在组合键时中和、移除 mouseup——保住播放器快捷键等正常交互
- R3 移除 content 层冗余 stopPropagation；contextmenu 维持全拦截防止定制菜单与原生菜单双弹（其副作用由站点排除列表兜底）

### 🎨 资源与权限
- 补齐 partial / inactive 状态图标 8 个 PNG 及生成脚本（DEBT-04）
- 移除未使用的 management 权限，权限申请最小化

### 🐛 修复（随 t1 重写合并）
- 消息白名单拦截、禁用后原型重写残留、存储设置缺失等多项历史缺陷

### 🧪 工程化
- 新增 lint / 单元测试 / e2e / docs:check 验证链
- 真实站点回归脚本与 2026-08 实测证据归档（test/real-sites/，非门禁）
