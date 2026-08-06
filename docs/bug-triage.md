# Bug Triage — Service Worker 失效与状态写入缺陷（2026-08-06）

> 性质：Working Document（本轮修复工作的分诊记录，不纳入索引纳管）。
> 输入：真实 Chrome 浏览器实测报告（2026-08-06 早些时候，CDP `Extensions.loadUnpacked` 加载 `dist/`）。
> 状态：工作区已存在未提交修复，本文档同时记录分诊结论与修复覆盖度审查。

## 问题清单

### EASYCV-001（P0）Service Worker 顶层执行中止，background 全部功能失效

- **症状**：`chrome://extensions` 显示扩展已启用，但 SW 全局中 `MonitoringManager` / `IconManager` / `AutoEnableManager` / `StateConfirmationManager` / `stateManager` 全部 `undefined`；消息监听、右键菜单、图标管理、自动开启、统计均未注册。
- **根因假设**：`background/service-worker.js:7` 的 `importScripts(...)` 引用 4 个不存在的文件（`icon-manager.js`、`auto-enable-manager.js`、`state-confirmation-manager.js`、`monitoring-manager.js`），importScripts 遇 404 抛错，脚本在第 7 行中止执行。git 历史显示文件曾存在于 `32be5c2`/`075ce8d`/`e90e185`，`716d232 "修复错误合并"` 引入了引用但未包含文件本体。
- **影响模块**：background 全部；popup（状态加载）、content script（GET_STATUS）、options（SETTINGS_UPDATED 通知）全部连带退化。
- **依赖关系**：根因。EASYCV-004、EASYCV-005 高度疑似其次生症状。
- **影响**：核心工作流被阻断（扩展安装后无后台能力）。
- **优先级**：P0
- **修复状态**：✅ 工作区已恢复 4 个文件（untracked）。注意：**恢复版本与 git 历史任何 blob 均不一致（重写/改编版）**，正确性必须依赖运行时验证，不能从"与历史一致"获得背书。

### EASYCV-002（P0）`StorageUtils.setPluginSettings` / `setAutoEnableList` 缺少 `static`

- **症状**：options 页面修改任何设置 → `TypeError: StorageUtils.setPluginSettings is not a function`，UI 报"保存失败"且实测 `chrome.storage.sync/local` 均无写入。
- **根因假设**：`utils/storage-utils.js:348` 与 `:226` 声明为实例方法（同类其余 20 个方法均为 `static`），而所有调用点均为静态调用。
- **影响模块**：`options/options.js:351,674,712,678`、`popup/popup.js:561`（添加到自动开启）、`background/service-worker.js:1089,1106`。
- **依赖关系**：独立于 EASYCV-001（SW 修复后此缺陷仍会 100% 触发）。
- **影响**：核心工作流被阻断（设置系统整体不可写）。
- **优先级**：P0
- **修复状态**：✅ 工作区已补两个 `static` 关键字并同步注释（`git diff` 已审查，最小修改，无附带重构）。

### EASYCV-003（P2）`utils/notification-utils.js` 缺失，popup 用户反馈全灭

- **症状**：`popup/popup.html:166` 引用 404；popup.js 15+ 处 `NotificationUtils.show(...)` 路径执行时将抛 `ReferenceError`，用户操作（含失败提示）无任何反馈。
- **根因假设**：与 EASYCV-001 同源（`075ce8d` 曾提交该文件，错误合并丢失）。
- **影响模块**：popup 全部交互反馈。
- **依赖关系**：独立文件缺失；症状被 EASYCV-001 放大（SW 失效时几乎所有 popup 操作都会走到失败提示路径）。
- **优先级**：P2（单独看是反馈层缺陷；与 P0 叠加时加剧用户困惑）
- **修复状态**：✅ 工作区已恢复（90 行，同为重写版，需运行时验证）。

### EASYCV-004（P1）popup 开关操作永久静默挂起（待复测）

- **症状**：SW 失效场景下点击"解锁复制"→ checkbox 乐观切换后 24s+ 无回滚、无错误提示；`updateStateWithConfirmation`（`popup/popup.js:382`，timeout 5000）的 promise 疑似永久 pending，UI 呈现"假状态"。
- **根因假设**：疑似 EASYCV-001 次生症状（状态确认协议等待永不到来的 SW 广播/响应，且 timeout 未生效）；也可能是确认协议自身的独立缺陷。
- **依赖关系**：疑似依赖 EASYCV-001。
- **优先级**：P1
- **修复状态**：⏳ 未修复。**决策：SW 恢复后复测**；若仍复现再单独立项修确认协议。

### EASYCV-005（P1）content script 约 85 秒降级延迟（待复测）

- **症状**：SW 失效场景下，页面加载到解除限制生效实测 85,425ms（6 轮 × [10s 超时 + 递增延迟]，`content/content.js:33-35`；`message-utils.js` 内部每次发送另有 3 次重试）。
- **根因假设**：EASYCV-001 次生症状——重试链本为"SW 冷启动慢"设计，对"SW 永久不可用"场景退化严重。
- **依赖关系**：依赖 EASYCV-001。
- **优先级**：P1（SW 正常时应自然消失）
- **修复状态**：⏳ 未修复。SW 恢复后复测；若 SW 正常后状态秒级加载，本项关闭。

### EASYCV-006（P3）content.js 跨 world 注入验证误报

- **症状**：每次启用解除限制后 console 出现两条误报：`✗ EasyCVInjected flag not found after injection`（`content/content.js:568`，error 级，`script.onload` 后 50ms 检查点）与 `⚠ Custom script injection may have failed - EasyCVInjected flag not found`（`content/content.js:329`，warn 级，100ms 检查点）。实际注入成功。
- **根因假设**：两个检查点均在 isolated world 读 `window.EasyCVInjected`，而 `content/injector.js:19` 在 main world 设置该 flag（`injector.js:10` 的防重复注入读同一 main world flag，自身一致），两 world 的 window 对象隔离，isolated 侧读取必然为 undefined。
- **功能影响确认（本轮证据复核）**：main world 实测 `window.EasyCVInjected === true`、`window.easycvInjector` 为 object、`style[data-easycv-injected="text-selection"]` 存在、selectstart/contextmenu 拦截解除、真实双击可选中文本——**注入与解除功能真实有效，确认为纯误报**。
- **影响模块**：`content/content.js`（两个检查点：:564-570、:325-331）；日志可信度（真实注入失败如 CSP 拦截将被误报淹没）。
- **依赖关系**：独立缺陷，与其他问题无依赖。
- **影响**：误导性告警；用户/排查者自查 console 时被干扰；真实注入失败无法通过该检查识别。
- **优先级**：P3
- **推荐修复顺序**：本轮唯一处理项。候选方案：A. DOM `dataset`（两 world 共享 DOM，同步可读，改动最小）✅ 推荐；B. CustomEvent（异步，需监听+超时，代码量大）；C. window.postMessage（污染页面消息通道）；D. 直接删除验证（失去真实故障可见性，不可取）。
- **修复状态**：✅ 已修复并验证关闭（2026-08-06 第四轮，FIX-9：跨 world 信号改走共享 DOM `dataset.easycvInjected`，main world window flag 保留；真实 Chrome 回归：两条误报消失、确认日志出现、解除功能正常。详见 test-report.md 第八节）。

### EASYCV-007（P2，工程流程）build 不校验引用完整性

- **症状**：5 个文件缺失期间 `npm run build` 与 `docs:check` 全部通过，缺陷静默流入 dist。
- **根因假设**：`scripts/build.js` 仅复制文件，无引用扫描。
- **优先级**：P2（流程根因，不修复则同类问题必然复发）
- **修复状态**：✅ 工作区已新增 `validateFileReferences(manifest)`（校验 manifest 入口 + 全目录 `<script src>`/`importScripts` 引用，且在 `clean()` 前失败以保护旧产物），`docs/部署文档.md` 已同步说明。本轮 build 实测通过。

## 依赖链与推荐修复/验证顺序

```
EASYCV-007 (流程缺口) ── 放行 ──▶ EASYCV-001 (P0, SW 全灭) ──┬─▶ EASYCV-004 (P1, popup 假状态)
                                EASYCV-003 (P2, 通知缺失) ──┴─▶ EASYCV-005 (P1, 85s 降级)
EASYCV-002 (P0, static 缺失) —— 独立
EASYCV-006 (P3, 误报) —— 独立，低优先
```

1. ~~EASYCV-001~~（已恢复，待运行时验证）→ 2. ~~EASYCV-002~~（已修复，静态确认）→ 3. ~~EASYCV-003~~（已恢复，待验证）→ 4. **回归验证（真实 Chrome）** → 5. 复测 EASYCV-004/005 决定是否关闭 → 6. EASYCV-006 记录跟进。

## 回归验证中新发现（2026-08-06 第二轮实测）

### EASYCV-008（P0）`MonitoringManager.isDebugMode()` 引用 SW 不存在的 `process` 全局

- **症状**：修复 P0-1/P0-2 后，popup 切换"解锁复制"→ 通知显示"复制功能已关闭"，但 SW 内存与 `chrome.storage` 中 `copyEnabled` 实际未变（仍为 true）。
- **根因**：`background/monitoring-manager.js:322` `return process.env.NODE_ENV === 'development' || false`——Service Worker 无 `process` 全局，`logStateChange`（:63）调用即抛 `ReferenceError: process is not defined`。`performStateUpdate` 首行日志调用处中断，catch 中再次调用 `logStateChange` 再次抛错，更新事务整体 abort。实测 SW 内直接执行 `updatePluginState({copyEnabled:false})` 复现：`FAIL: process is not defined @ MonitoringManager.isDebugMode`。
- **历史定性**：历史遗留缺陷——`32be5c2`/`e90e185` 用 `localStorage`（SW 同样没有），`075ce8d` 改为 `process.env`（注释自述"Service Worker环境不支持localStorage"，但改用的 `process` 在 SW 也不存在）。恢复文件忠实带回了该缺陷。
- **影响模块**：所有经 SW 的状态写入路径（确认协议全部操作、图标更新、自动开启应用）；**不影响** options/content 直写 storage 的路径与 GET_STATUS 读路径。
- **优先级**：P0（background 写路径整体失效）

### EASYCV-009（P0）`MessageUtils.addMessageListener` 包装层把业务失败统一标记为成功

- **症状**：EASYCV-008 导致更新失败时，popup 仍显示成功通知且不回滚——用户被呈现"假成功"。
- **根因**：`utils/message-utils.js:148` `.then(response => sendResponse({ success: true, data: response }))`——handler 返回的 `{success:false, error}` 协议对象被再包一层为 `{success:true, data:{success:false,...}}`。popup `updateStateWithConfirmation`（`popup.js:242`）判定 `response.success` → 恒 true。真实消息实测响应：`{"success":true,"data":{"success":false,"error":"process is not defined"}}`。
- **根因深化**：handler 返回约定不一致——`handleGetStatus` 等返回裸数据（依赖包装层包 success），`handleUpdatePluginStateWithConfirmation` 返回带 success 的协议对象（被包装层吞掉业务结果）。
- **优先级**：P0（数据完整性：任何 SW 端失败都被静默为成功）

### EASYCV-010（P1）`verifyStateUpdate` 对 copyEnabled/pasteEnabled 的嵌套路径误判

- **症状**：EASYCV-008 修复后，状态更新真实生效（内存 cache 与 `chrome.storage.user_settings` 均已写入 false），但确认协议返回 `success:false`：`State verification failed: copyEnabled expected false, got undefined`。
- **根因**：`background/state-confirmation-manager.js:171` 用 `currentState[key]` 读取验证，而 `copyEnabled`/`pasteEnabled` 嵌套在 `currentState.userSettings` 中（`getPluginState()` 顶层只有 `pluginEnabled`/`forceMode`/`userSettings`/`timestamp`）。仅 `key === 'userSettings'` 分支有嵌套处理，顶层传入的单键更新无映射。
- **影响**：更新成功但被误报失败 → popup 回滚 UI、显示失败通知，与实际状态相反。
- **优先级**：P1（写路径已通，误判破坏确认协议语义）
- **修复状态**：✅ 已在 `verifyStateUpdate` 增加 `copyEnabled`/`pasteEnabled` → `userSettings` 映射分支（与 `performStateUpdate` 的顶层键约定一致）。

### EASYCV-011（P2）options 页面误将纯静态类 `MessageUtils` 实例化

- **症状**：EASYCV-002 修复后，options 修改设置 → storage 实际写入成功，但 UI 仍显示"保存失败"：`TypeError: this.messageUtils.sendToBackground is not a function`（`options/options.js:354` 通知 SW 的步骤抛错，进入 catch 误报）。
- **根因**：`options/options.js:10` `new MessageUtils()`，而 `sendToBackground` 是 static 方法（`message-utils.js:34`），实例上不存在。与 EASYCV-002 同族的 static/实例混用。全仓库唯一实例化点；options.js 中 `this.messageUtils` 仅此一处使用。
- **优先级**：P2（存储写入已正常，仅反馈文案与 SW 通知步骤受影响）
- **修复状态**：✅ `options.js:10` 改为引用类本身（`this.messageUtils = MessageUtils`），与 popup.js 的既有用法一致。

## 修复覆盖度审查结论

| 修复项 | 审查结论 |
| --- | --- |
| 5 个文件恢复 | 类名与 SW 实例化点符号匹配（`IconManager`/`AutoEnableManager`/`StateConfirmationManager`/`MonitoringManager`/`NotificationUtils`），`node --check` 全部通过；但与历史版本均不一致，**运行时验证为必经关卡** |
| storage-utils.js 补 static | diff 最小、注释同步，正确 |
| build.js 引用校验 | 覆盖 manifest 入口/`<script src>`/`importScripts`，失败时机在 clean 之前，设计合理；本轮 build 通过 |
| 部署文档.md | 与 build.js 变更同步，符合文档维护规范 |
| 未覆盖 | EASYCV-004/005（待复测决策）、EASYCV-006（有意暂缓） |
