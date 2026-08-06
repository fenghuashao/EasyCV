# Root Cause Analysis — EASYCV-001 / EASYCV-002（2026-08-06）

> 性质：Working Document。证据来源：真实 Chrome 151 + CDP `Extensions.loadUnpacked` 实测、git 历史分析、静态接口比对。
> 关联文档：[bug-triage.md](bug-triage.md)。

## EASYCV-001：Service Worker 顶层执行中止

### 证据链

| 分析维度 | 结论 |
| --- | --- |
| 运行时症状 | SW 已注册（target 存在），但全局中 `MonitoringManager`/`IconManager`/`AutoEnableManager`/`StateConfirmationManager`/`stateManager` 全部 `undefined`；`StorageUtils`/`MessageUtils` 为 `function` |
| 期望行为 | `importScripts` 同步加载 6 个脚本后，顶层代码完成类定义与监听器注册 |
| 实际行为 | `background/service-worker.js:7` 的 `importScripts` 按序执行：前两个（`../utils/*.js`）成功，第 3 个（`icon-manager.js`）404 → NetworkError → 顶层执行在第 7 行中止，其后所有类定义/监听器未注册 |
| 执行路径 | Chrome 启动 SW → 执行 service-worker.js → 第 7 行抛错 → SW 对任何消息无响应（表现为"Background script timeout"而非"Receiving end does not exist"，因为 SW target 注册过但无法激活处理事件） |
| 受影响模块 | background 全部；次生影响：popup 状态加载（EASYCV-004 嫌疑）、content GET_STATUS 85s 降级链（EASYCV-005）、右键菜单不存在、options SETTINGS_UPDATED 通知 |
| 近期代码变更 | `716d232 "修复错误合并"`：service-worker.js ±898 行，引入了对 4 个 manager 的 importScripts 引用与 `new MonitoringManager(this)` 等调用，但 commit 文件清单不含 4 个 manager 文件本体 |
| git 历史 | 4 个文件分别存在于 `32be5c2`（icon/auto-enable/state-confirmation）、`075ce8d`（monitoring/notification）、`e90e185`；HEAD 全部缺失 |

### 必答题

- **为什么发生？** 合并 `716d232` 时只采纳了"引用方"（service-worker.js）的变更，丢失了"被引用方"（4 个 manager 文件）。属于典型的合并产物不完整。
- **为什么被引入？** 分支线 `32be5c2`/`075ce8d` 引入了中心化状态管理架构（4 个 manager 文件 + SW 重写），合并回主线时文件未随引用一起进入。
- **为什么没更早发现？** ① `scripts/build.js` 只复制不校验引用（EASYCV-007，流程根因）；② 无自动化测试覆盖 SW 启动路径；③ `chrome://extensions` 对 MV3 SW 顶层执行失败不显示红色"错误"按钮（实测确认卡片仅显示"已开启"），人工巡检也不易察觉。
- **最小安全修复？** 恢复 4 个文件本体。工作区已恢复；接口比对确认与 SW 调用点符号匹配（详见 bug-triage.md 修复覆盖度表）。

### 修复命中度评估

恢复文件直接消除"404 → 顶层中止"这一根因。注意点：
- `icon-manager.js`/`monitoring-manager.js`/`notification-utils.js` 与历史 blob 仅末尾换行差异，实质相同；
- `auto-enable-manager.js` 删除了一行 `await import('../utils/storage-utils.js')` 动态导入（SW 环境不支持动态 import，且 importScripts 已提供全局 `StorageUtils`），属于正确的环境适配；
- `state-confirmation-manager.js` 为重写版（与历史 906 行差异），其 `constructor(stateManager)` 与 `executeWithConfirmation(updates, options)` 签名与 SW 调用点（`service-worker.js:601,184`）匹配，但行为正确性必须经真实 Chrome 运行时验证背书。

## EASYCV-002：`StorageUtils.setPluginSettings` / `setAutoEnableList` 缺 `static`

### 证据链

| 分析维度 | 结论 |
| --- | --- |
| 运行时症状 | options 修改任意设置 → console `TypeError: StorageUtils.setPluginSettings is not a function`，UI 报"保存失败"，`chrome.storage.sync`/`local` 实测均无写入 |
| 期望行为 | 静态调用 `StorageUtils.setPluginSettings(obj)` 成功写入 |
| 实际行为 | `utils/storage-utils.js:226,348` 两处方法声明漏 `static`（同类其余 20 个方法全部为 `static async`），静态访问得到 `undefined` |
| 执行路径 | `options.js:351 updateSetting()` → `StorageUtils.setPluginSettings(...)` → TypeError → catch → "保存失败"误报 |
| 受影响模块 | `options/options.js:351,674,712,678`、`popup/popup.js:561`、`background/service-worker.js:1089,1106`（全部静态调用点，命中率 100%） |
| 近期代码变更 | 与 EASYCV-001 无依赖关系；独立缺陷 |

### 必答题

- **为什么发生？** 人为笔误：两个方法声明时漏写 `static`。
- **为什么被引入？** 同类方法均为 static 工具方法，新增这两个方法时未保持一致。
- **为什么没更早发现？** 无 lint/类型检查/单元测试；options 设置保存路径无自动化覆盖。
- **最小安全修复？** 补两个 `static` 关键字。工作区 diff 已审查：仅添加关键字并同步注释（"实例方法"→"静态方法"），零附带改动，直接命中根因。✅

### 修复命中度评估

完全命中根因，静态分析即可确认（声明与全部调用点现在一致）。运行时回归（options 实际保存一次）作为最终确认。

## 根因关系图

```
流程根因：build 无引用校验（EASYCV-007）
    └─ 放行 ─▶ 合并产物不完整（EASYCV-001 根因）
                  └─ 次生：popup 假状态（EASYCV-004）、85s 降级（EASYCV-005）
独立根因：static 笔误（EASYCV-002）
独立根因：notification-utils.js 随同一错误合并丢失（EASYCV-003）
```

## 结论

两个 P0 根因均被工作区修复直接命中，无过度修复、无附带重构。剩余风险集中在：
1. `state-confirmation-manager.js` 重写版的行为正确性（需运行时验证）；
2. EASYCV-004/005 是否为纯次生症状（SW 恢复后复测决定关闭或立项）。

---

## 收尾复核增补（2026-08-06 第二轮）

### EASYCV-003（P2）`utils/notification-utils.js` 缺失 —— 根因确认

- **症状**：`popup/popup.html:166` 引用 404（实测 `net::ERR_FILE_NOT_FOUND`）；popup.js 15+ 处 `NotificationUtils.show(...)`（393,406,434,447,475,488,506,512,529,535,544,555,566,569 等）执行时将抛 `ReferenceError`，用户操作无任何可见反馈。
- **根因**：与 EASYCV-001 同一次错误合并丢失（`075ce8d` 曾提交）。
- **最小安全修复**：恢复文件本体（工作区已完成，90 行；与历史 blob 仅末尾换行差异）。✅

### EASYCV-004/005（P1）根因判定：次生症状，本轮不修

- **判定依据**：两者的触发前提均为"SW 永久不可用"——popup 的 `updateStateWithConfirmation` 等待 SW 确认广播（实测 promise 24s+ pending、无回滚无提示）；content script 的 6 轮 ×（10s 超时+递增延迟）重试链（实测 85,425ms）本为"SW 冷启动慢"设计。
- **决策**：不预先修改确认协议/重试链。SW 恢复后复测：若症状消失即关闭；若复现则属独立缺陷，单独立项。避免在根因未消除前对次生症状做无依据修改。

### EASYCV-007（P2，流程根因）build 引用校验 —— 已修复

- `scripts/build.js` 新增 `validateFileReferences(manifest)`：校验 manifest 全部入口（service_worker/content_scripts/popup/options_page/icons）+ 扫描 background/content/popup/options/utils 目录的 `<script src>` 与 `importScripts(...)` 引用；在 `clean()` 之前失败以保护旧产物。`docs/部署文档.md` 已同步命令说明。✅

### manager 方法级契约核对（澄清早期误报）

对 SW 全部 manager 调用点逐一 grep 行号复核（早期一次方法提取因正则局限误报"缺 3 方法"，已排除）：

| SW 调用 | 恢复文件定义位置 | 结论 |
| --- | --- | --- |
| `monitoringManager.recordPerformance` (SW:395,406) | monitoring-manager.js:74 | ✅ |
| `monitoringManager.getPerformanceReport` (SW:537,573) | monitoring-manager.js:224 | ✅ |
| `monitoringManager.performHealthCheck` (SW:547，经 :697 间接) | monitoring-manager.js:146 | ✅ |
| `monitoringManager.exportLogs / logStateChange / queryLogs / resetMetrics` | 均有定义 | ✅ |
| `iconManager.updateIcon` | icon-manager.js 有定义 | ✅ |
| `autoEnableManager.cleanup` | auto-enable-manager.js 有定义 | ✅ |
| `stateConfirmationManager`（SW 无直接方法调用，仅 :601 实例化） | constructor(stateManager) 匹配 | ✅ |

### 修复与现场计划一致性审查（替代 fix-plan）

对照 bug-triage.md 的推荐顺序逐项核对未提交变更：

- 5 个恢复文件：仅新增，零修改既有文件 ✅
- `storage-utils.js`：仅 2 处 `static` + 注释同步 ✅
- `build.js`：仅新增校验函数 + 一行调用 ✅
- `docs/部署文档.md`：一行说明同步 ✅
- 未触碰：service-worker.js / popup.js / content.js / options.js 逻辑；无顺手重构；未提交 commit ✅

**结论：当前未提交修复与现场计划完全一致，无需增量补修代码。剩余动作仅为回归验证与 EASYCV-004/005 复测决策。**

### 第三轮复核修正：`state-confirmation-manager.js` 差异定性

对该文件做忽略空白/EOL 的逐行 diff（vs `32be5c2`）：实质差异仅 **7 行**——失败告警路径的 `error` 字段兜底 `'Unknown error'` 及错误堆栈日志输出，属防御性增强。早期"重写版（906 行差异）"的定性实为 CRLF/EOL 差异导致的原始 diff 行数误读（453 行文件 × 2 ≈ 906）。风险由"中"下调为"低"；回归验证中 popup 状态确认链路（EASYCV-004）仍按原计划复测，但无需对协议语义差异做额外假设。

---

## EASYCV-006 根因分析（2026-08-06 第四轮）

### 证据链

| 分析维度 | 结论 |
| --- | --- |
| 运行时症状 | 每次启用解除限制后 console 出现两条告警：`✗ EasyCVInjected flag not found after injection`（`content/content.js:568`，error 级）与 `⚠ Custom script injection may have failed`（`content/content.js:329`，warn 级） |
| 期望行为 | injector 成功注入后，验证检查应通过并打印确认日志；仅在真实注入失败（CSP 拦截、injector 执行抛错）时告警 |
| 实际行为 | 两个检查点（`content.js:564-570` onload+50ms、`content.js:325-331` 100ms）在 **isolated world** 读 `window.EasyCVInjected`；`content/injector.js:19` 在 **main world** 设置该 flag。Chrome 扩展 content script 的 isolated world 与页面 main world 共享 DOM 但 **window 对象完全隔离**，isolated 侧读取恒为 undefined，检查必然失败 |
| 功能影响复核 | main world 实测：`window.EasyCVInjected === true`、`window.easycvInjector` 为 object、`style[data-easycv-injected]` 存在、selectstart/contextmenu 解除、真实双击可选中——**注入与解除功能真实有效，纯误报** |
| 执行路径 | `enableCopyPaste()` → `injectCustomScript()` 创建 `<script src=chrome-extension://…/injector.js>` → main world 同步 IIFE 执行（`:19` 设 flag）→ isolated 侧 `onload`/setTimeout 检查读 isolated window → 恒 false → 误报 |
| 相关模块 | `content/content.js`（两个检查点）；`content/injector.js:10` 防重复注入读 main world flag（**自洽，不受影响，不应改动**） |
| 引入历史 | `git log -S "EasyCVInjected"` → `716d232 "修复错误合并"`（与 EASYCV-001/003 同 commit 引入） |

### 必答题

- **为什么发生？** 验证代码忽略了 content script 的 world 隔离模型：设置方与检查方分属 main/isolated 两个 world，却用 `window` 全局变量做跨 world 信号。
- **为什么被引入？** `716d232` 重构时为注入验证补了"确认日志"，作者未意识到 `<script>` 注入的代码在 main world 执行，与 content script 本体不共享 window。
- **为什么没更早发现？** 误报不影响功能（解除限制真实生效），开发自测看到功能正常易忽略告警；且无自动化 console 断言。
- **最小安全修复？** 跨 world 信号改走两 world **共享的 DOM**：injector 增设 `document.documentElement.dataset.easycvInjected='true'`，content.js 两个检查点改读该 dataset。理由见下。

### 方案评估

| 方案 | 时序语义 | MV3 兼容 | 改动量 | 判定 |
| --- | --- | --- | --- | --- |
| A. DOM `dataset` | injector 为同步 IIFE，`script.onload` 时 dataset 必已设置（除非执行抛错——此时检查正确报失败）；同步可读，无竞态 | ✅ 无需新权限 | injector +1 行；content.js 两处读取各改 1 行 | **推荐** |
| B. CustomEvent | 异步：content 需先注册监听再注入，还要超时兜底 | ✅ | 两侧各 +10 行以上，引入新时序面 | 过度设计 |
| C. `window.postMessage` | 异步；消息对页面 JS 同样可见，污染页面消息通道 | ✅ | 同 B，且需过滤 source | 否定 |
| D. 删除验证 | — | — | -2 处日志 | 失去真实故障可见性，否定 |

**补充判定**：`injector.js:10` 防重复注入读 main world `window.EasyCVInjected` 逻辑自洽，**保留不动**；main world window flag 一并保留（兼容 test-page 等既有检测与调试习惯），dataset 仅作为新增的跨 world 信号。禁用/恢复路径（`restoreOriginalFunctions`）不触碰——flag 语义为"injector 已注入执行"，与启用状态无关。
