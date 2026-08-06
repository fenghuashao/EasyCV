# Fix Plan — EASYCV-001/002/003/007 修复审查与验证计划（2026-08-06）

> 性质：Working Document。修复已存在于工作区（未提交），本计划用于审查覆盖度、定义验证与回滚路径。
> 上游文档：[bug-triage.md](bug-triage.md)、[root-cause-analysis.md](root-cause-analysis.md)。

## FIX-1（对应 EASYCV-001）：恢复 4 个 background manager 文件

- **目标**：消除 `importScripts` 404，使 SW 顶层执行完整完成，background 全部功能恢复。
- **涉及文件**：`background/icon-manager.js`、`background/auto-enable-manager.js`、`background/state-confirmation-manager.js`、`background/monitoring-manager.js`（均为 untracked 新增）。
- **代码变更审查**：✅ 已实施。`icon/monitoring` 与历史 blob 实质相同（仅末尾换行）；`auto-enable` 删除一行 SW 环境不支持的动态 `import()`（正确适配）；`state-confirmation-manager.js` 为重写版，构造器与 `executeWithConfirmation` 签名与 SW 调用点（`service-worker.js:601,184`）匹配。
- **风险评估**：中。`state-confirmation-manager.js` 重写版无历史背书，行为正确性依赖运行时验证；若其确认协议语义与原版不同，可能影响 popup 状态确认链路（EASYCV-004 相关）。
- **测试策略**：① 真实 Chrome 加载 dist，验证 SW 全局类全部有定义；② 验证 SW 无启动错误；③ 验证消息链路（popup 状态加载、content GET_STATUS 秒级响应）。
- **回滚策略**：删除 4 个新增文件即恢复原状（均为 untracked，不影响 git 跟踪内容）。

## FIX-2（对应 EASYCV-002）：`storage-utils.js` 补 `static`

- **目标**：`setPluginSettings`/`setAutoEnableList` 支持静态调用，options/popup/SW 的 6 个调用点全部恢复。
- **涉及文件**：`utils/storage-utils.js`（M，2 处声明 + 2 行注释）。
- **代码变更审查**：✅ 已实施。diff 最小，无附带重构。
- **风险评估**：低。声明与调用点一致性可由静态分析完全确认；不影响实例调用（类从未被实例化）。
- **测试策略**：① `node --check` 语法通过；② 真实 Chrome 中 options 修改设置 → 无 TypeError、storage 有实际写入、UI 报"设置已保存"。
- **回滚策略**：`git checkout -- utils/storage-utils.js`（用户明确禁止破坏性 git 操作，故回滚由人工决定执行，本文档仅记录路径）。

## FIX-3（对应 EASYCV-003）：恢复 `utils/notification-utils.js`

- **目标**：popup 15+ 处 `NotificationUtils.show(...)` 不再 ReferenceError，操作反馈恢复。
- **涉及文件**：`utils/notification-utils.js`（untracked 新增，90 行）。
- **代码变更审查**：✅ 已实施。与历史 blob 仅末尾换行差异；`static show(message, type, duration)` 签名与 popup.js 全部调用点匹配。
- **风险评估**：低。
- **测试策略**：真实 Chrome 中 popup 执行任意操作（如切换开关），确认出现通知条且无 ReferenceError。
- **回滚策略**：删除该新增文件。

## FIX-4（对应 EASYCV-007）：`build.js` 引用完整性校验

- **目标**：缺失引用在构建期即失败，防止同类缺陷再次静默流入 dist。
- **涉及文件**：`scripts/build.js`（M，+62 行 `validateFileReferences`）、`docs/部署文档.md`（M，说明同步）。
- **代码变更审查**：✅ 已实施。覆盖 manifest 入口（SW/content scripts/popup/options/icons）、全目录 `<script src>` 与 `importScripts(...)` 引用；失败时机在 `clean()` 之前（保护旧产物）；文档已同步。
- **风险评估**：低。纯增量校验逻辑，不改变复制行为。
- **测试策略**：① 正向：`npm run build` 通过并输出"✅ 扩展文件引用验证通过"；② 负向：在隔离副本中删除任一被引用文件，build 必须失败且列出缺失项。
- **回滚策略**：`git checkout -- scripts/build.js docs/部署文档.md`（同上，由人工决定）。

## 覆盖度结论

| 问题 | 修复 | 状态 |
| --- | --- | --- |
| EASYCV-001（P0） | FIX-1 | ✅ 已覆盖，待运行时验证 |
| EASYCV-002（P0） | FIX-2 | ✅ 已覆盖，静态可证 |
| EASYCV-003（P2） | FIX-3 | ✅ 已覆盖，待运行时验证 |
| EASYCV-007（P2） | FIX-4 | ✅ 已覆盖，正/负向测试待跑 |
| EASYCV-004（P1） | 无独立修复 | ⏳ 计划内：SW 恢复后复测，复现再立项 |
| EASYCV-005（P1） | 无独立修复 | ⏳ 计划内：SW 恢复后复测，预期自然消失 |
| EASYCV-006（P3） | 无修复 | 📌 有意暂缓（最小修改原则），记录跟进 |

**审查结论：已有修复构成最小可测实现，无遗漏项需要增量实施。** 本轮不新增代码变更，直接进入回归验证。

## 回归验证驱动的增量修复（2026-08-06 第三轮，本轮新增）

### FIX-5（对应 EASYCV-008）：`monitoring-manager.js` `isDebugMode()` 去除 `process` 引用

- **目标**：消除 SW 环境 `ReferenceError: process is not defined`，恢复全部经 `logStateChange` 的状态写入路径。
- **涉及文件**：`background/monitoring-manager.js`（M，1 处方法体 + 注释说明）。
- **验证**：✅ 修复后 SW 内 `executeWithConfirmation({copyEnabled:false})` 真实写入内存 cache 与 `chrome.storage.user_settings`；popup 端到端切换 + 持久化 + 通知全链路通过。
- **回滚**：`git checkout -- background/monitoring-manager.js`（该文件 untracked 时为删除后从历史恢复；当前修复在其上叠加 1 处 diff，人工决定）。

### FIX-6（对应 EASYCV-009）：`message-utils.js` 响应包装层透传协议对象

- **目标**：handler 返回含 `success` 字段的对象时原样透传，业务失败不再被包装层统一标记为 `success:true`。
- **涉及文件**：`utils/message-utils.js`（M，包装处分支 + 注释）。裸数据返回路径（GET_STATUS 等）行为不变——已经 popup/content 正常加载复测确认。
- **验证**：✅ popup 切换开关收到真实业务结果并显示正确通知；修复前实测响应对照 `{"success":true,"data":{"success":false,...}}` → 修复后协议语义正确。
- **回滚**：`git checkout -- utils/message-utils.js`（人工决定）。

### FIX-7（对应 EASYCV-010）：`verifyStateUpdate` 补 userSettings 嵌套映射

- **目标**：`copyEnabled`/`pasteEnabled` 顶层更新键按 `currentState.userSettings[key]` 验证，消除"更新成功但误报失败"。
- **涉及文件**：`background/state-confirmation-manager.js`（M，verify 循环新增分支 + 注释）。
- **验证**：✅ 修复前复现 `State verification failed: copyEnabled expected false, got undefined`；修复后 popup 端到端成功通知 + 持久化一致。
- **回滚**：同 FIX-5 路径（人工决定）。

### FIX-8（对应 EASYCV-011）：options 去除 `new MessageUtils()`

- **目标**：`this.messageUtils = MessageUtils`（纯静态工具类不允许实例化使用），恢复 SETTINGS_UPDATED 通知步骤，消除"保存失败"误报。
- **涉及文件**：`options/options.js`（M，1 处赋值 + 注释）。
- **验证**：✅ options 切换设置 → "设置已保存"（success）+ storage 实际写入 + console 零错误。
- **回滚**：`git checkout -- options/options.js`（人工决定）。

## 验证执行顺序

1. 静态：`node --check` 全部改动/新增文件；引用完整性重扫（源码目录）
2. 构建正向：`npm run build`（应通过并打印引用校验通过）
3. 构建负向：隔离副本删文件 → build 必须失败
4. 文档校验：`npm run docs:check`
5. 真实 Chrome：CDP `Extensions.loadUnpacked` 加载新 dist → SW 全局检查 → popup/options/content 场景复测（含 EASYCV-004/005 关闭判定）
6. 若第 5 步环境不可用：记录具体阻塞原因，以前 4 步 + 静态接口比对作为本轮验证边界

---

## FIX-9（对应 EASYCV-006）：注入验证改走共享 DOM dataset（2026-08-06 第四轮）

- **目标**：消除 isolated world 读 main world `window.EasyCVInjected` 导致的两处 console 误报，同时保留验证的真实故障识别能力（CSP 拦截、injector 执行抛错仍能暴露）。
- **涉及文件**：`content/injector.js`（M，+2 行）、`content/content.js`（M，2 处检查点读取方式，各 1 行）。不触碰其他任何文件。
- **代码变更**：
  1. `content/injector.js:19` 设置 main world flag 后，增设 `document.documentElement.dataset.easycvInjected = 'true'`（DOM 为两 world 共享，isolated 侧同步可读）。main world `window.EasyCVInjected` **保留**——`injector.js:10` 防重复注入与 test-page 等既有检测依赖它。
  2. `content/content.js:565`（onload+50ms 检查点）：`window.EasyCVInjected` → `document.documentElement.dataset.easycvInjected`。
  3. `content/content.js:326`（enableCopyPaste 100ms 检查点）：同上改法。
- **风险评估**：低。仅新增 1 个 DOM data 属性并改两处读取；时序安全已论证（injector 为同步 IIFE，`script.onload` 时 dataset 必已设置，除非执行抛错——此时检查正确报失败）；不改 MV3 权限/消息/存储行为；防重复注入与禁用恢复路径不动。已知边界：页面 JS 可读写该 data 属性（与既有 window flag 暴露面相同，无新增风险）。
- **测试策略**：
  1. 静态：`node --check` 两文件；`npm run build` 引用校验通过。
  2. 真实 Chrome（沿用 CDP `Extensions.loadUnpacked` + 干净 profile + 本地 http server 的既有验证环境）：test-page 自动开启场景下——
     - 两条误报日志（`EasyCVInjected flag not found` / `Custom script injection may have failed`）**消失**；
     - 出现 `✓ EasyCVInjected flag confirmed` / `✓ Custom script injection verified successfully` 确认日志；
     - main world 断言：`window.EasyCVInjected === true`（防重/兼容面不破）、`document.documentElement.dataset.easycvInjected === 'true'`；
     - 解除限制功能回归：`selectstart` 放行、真实双击可选中文本。
  3. 若 Chrome 环境不可用：记录阻塞，以静态验证 + 代码路径推演为边界。
- **回滚策略**：`content/content.js` 为 git 跟踪文件（`git checkout -- content/content.js`，人工决定执行）；`content/injector.js` 同为跟踪文件，同路径回退。本文档仅记录路径，不执行。

**FIX-9 验证回填**：✅ 全部通过（2026-08-06）。静态（语法/构建/diff 范围）；真实 Chrome：两条误报消失、`✓ EasyCVInjected flag confirmed` 与 `✓ Custom script injection verified successfully` 出现、main world `window.EasyCVInjected === true` 保留、`dataset.easycvInjected === 'true'`、selectstart 放行 + 真实双击选中。证据详见 test-report.md 第八节。**EASYCV-006 关闭。**
