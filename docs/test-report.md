# 回归验证测试报告 — Service Worker 失效与状态写入修复（2026-08-06）

> 性质：Evidence Document（本轮修复的验证证据，不纳入索引纳管）。
> 上游文档：[bug-triage.md](./bug-triage.md)、[root-cause-analysis.md](./root-cause-analysis.md)、[fix-plan.md](./fix-plan.md)。
> 环境：Chrome 151.0.7922.76（干净 profile），CDP `Extensions.loadUnpacked` 加载 `dist/`（Chrome 137+ 稳定版已移除 `--load-extension`），playwright-cli 驱动，本地 `python -m http.server 8765` 承载 test-page.html。

## 一、验证矩阵总览

| # | 验证项 | 方法 | 结果 |
| --- | --- | --- | --- |
| 1 | 语法检查 | `node --check` 全部 9 个 background/utils 文件 + 3 个增量修复文件 | ✅ 通过 |
| 2 | 构建正向 | `npm run build`（含新引用完整性校验） | ✅ 通过，输出"✅ 扩展文件引用验证通过" |
| 3 | 构建负向 ① | 隔离副本删 `background/icon-manager.js` → build 失败并精确列出 `background\icon-manager.js (referenced by background\service-worker.js)`，退出码 1 | ✅ 通过 |
| 4 | 构建负向 ② | 隔离副本删 `utils/notification-utils.js` → build 失败并列出 `utils\notification-utils.js (referenced by popup\popup.html)`（HTML `<script src>` 引用被捕获） | ✅ 通过 |
| 5 | 构建对照 | 完整隔离副本 build 通过 | ✅ 通过 |
| 6 | 文档门禁 | `npm run docs:check` | ✅ 通过（6 个 baseline 已知项与本轮无关） |
| 7 | manifest/引用扫描 | 全量扫描 manifest/HTML/importScripts 引用（24 项） | ✅ 全部存在 |

## 二、Chrome 扩展专项（真实浏览器）

| # | 检查项 | 证据 | 结果 |
| --- | --- | --- | --- |
| 8 | manifest 正确性 | CDP `Extensions.loadUnpacked` 返回扩展 ID `pobjcedffenhdhiogagpgfbmpaagejnn`；chrome://extensions 卡片显示 v1.0.0 无错误 | ✅ |
| 9 | Service Worker 启动 | SW target `chrome-extension://…/background/service-worker.js` 注册并可评估；开发者模式"检查视图：Service Worker"链接出现 | ✅ |
| 10 | import 依赖（P0-1 核心） | SW 全局评估：`MonitoringManager`/`IconManager`/`AutoEnableManager`/`StateConfirmationManager`/`StorageUtils`/`MessageUtils` 全部 `function`（修复前 4 个 manager 全 `undefined`） | ✅ |
| 11 | 消息传递（读路径） | popup `GET_COMPLETE_STATE` 秒级返回（修复前 3 次重试 ~30s 后失败）；content `GET_STATUS` 毫秒级响应（修复前单轮 10s 超时） | ✅ |
| 12 | chrome.storage 写路径 | popup 切换"解锁复制"→ `user_settings.copyEnabled` 真实写入并回读一致；options 切换"解锁粘贴"→ `pasteEnabled` 真实写入 | ✅ |
| 13 | content script 注入 | test-page.html 上 CopyPasteManager 初始化日志完整，`Final state: {isEnabled: true,…}`（自动开启列表命中 localhost） | ✅ |
| 14 | 解除限制端到端 | 从页面加载到 `selectstart` 解除拦截：**3,629ms**（SW 失效基线：**85,425ms**）；console 无相关错误 | ✅ |
| 15 | popup 通知链（P2-1） | 切换开关显示"复制功能已开启/已关闭"（`#notification` visible），无 `ReferenceError` | ✅ |
| 16 | options 保存反馈 | "设置已保存"（success class）；console 零错误 | ✅ |
| 17 | 浏览器 console 错误 | popup/options 页面 Errors: 0；test-page 仅 favicon 404（页面自身）+ 已知 EASYCV-006 误报 | ✅ |

## 三、回归中发现的增量缺陷与处置

| Bug | 严重度 | 现象 | 处置 |
| --- | --- | --- | --- |
| EASYCV-008 | P0 | `MonitoringManager.isDebugMode()` 引用 SW 不存在的 `process`（历史遗留，三版本均带缺陷）→ 所有经 SW 的状态写入在日志记录处抛 `ReferenceError`，事务中断 | ✅ 已修（`return false` + 注释），复测写入/持久化/通知全链路通过 |
| EASYCV-009 | P0 | `addMessageListener` 包装层把 `{success:false}` 协议对象再包为 `{success:true,data:{…}}` → popup 把失败误判成功（实测响应铁证） | ✅ 已修（含 `success` 字段原样透传；裸数据路径行为不变，已复测） |
| EASYCV-010 | P1 | `verifyStateUpdate` 用 `currentState['copyEnabled']` 验证嵌套在 `userSettings` 中的字段 → 更新成功误报失败（`got undefined`） | ✅ 已修（补 userSettings 映射分支），复测通过 |
| EASYCV-011 | P2 | options 对纯静态类 `new MessageUtils()` → 通知 SW 步骤 TypeError → "保存失败"误报（实际已写入） | ✅ 已修（改类引用），复测"设置已保存"+ 零错误 |

## 四、既有问题复测结论

| Bug | 结论 |
| --- | --- |
| EASYCV-001（P0，SW importScripts 缺失） | ✅ **关闭**：SW 全局类全部就位，消息/写路径恢复 |
| EASYCV-002（P0，缺 static） | ✅ **关闭**：options/popup/SW 调用点全部工作，storage 真实写入 |
| EASYCV-003（P2，notification-utils 缺失） | ✅ **关闭**：popup 通知正常显示 |
| EASYCV-004（P1，popup 假状态） | ✅ **关闭**：确认为 SW 失效 + EASYCV-008/009 叠加的次生症状；修复后切换有真实确认、正确通知、无挂起 |
| EASYCV-005（P1，85s 降级） | ✅ **关闭**：确认为次生症状；自动开启场景 3.6s 解除 |
| EASYCV-006（P3，跨 world 注入验证误报） | 📌 **保持开放**（有意暂缓）：isolated world 读 `window.EasyCVInjected` 必然失败的误报仍在 console 出现；建议后续改 DOM dataset/CustomEvent 方案 |
| EASYCV-007（P2，build 无引用校验） | ✅ **关闭**：正/负向构建测试通过，失败退出码 1 |

## 五、观察记录（非本轮修复范围）

1. **options 域名验证拒绝 `localhost`**（`isValidDomain` 要求 `name.tld` 格式）——自动解锁端到端验证改为直接写 storage 完成；localhost 类开发域名无法通过 UI 添加，可作为产品改进点（P3）。
2. **未知消息类型返回 "port closed"**：`addMessageListener` 对格式验证失败的消息静默 `return false`，调用方只能感知 lastError 而非 `{success:false}`——既有设计，未改动。
3. **CDP 加载的未打包扩展会被 Chrome 强制禁用一次**（"无法验证来源"），需在 chrome://extensions 开启开发者模式后恢复——测试环境注意事项，与扩展代码无关。
4. `executeWithConfirmation` 忽略调用方传入的 `options.requestId`（内部重新生成）——请求关联能力弱化的瑕疵（P3），未改动。

## 六、验证边界与剩余风险

- popup 以 tab 形式测试（JS 行为与工具栏 popup 一致，但生命周期不同）；真实工具栏 popup 的首次打开冷启动未单独计时。
- SW 休眠/唤醒周期依赖 Chrome 调度，复测中唤醒后功能正常（消息触发即激活）；长时间空闲后的首次消息延迟未量化。
- EASYCV-006 的误报对功能无影响，但会干扰用户自查 console 时的判断。
- 本轮修复的 4 个增量文件（FIX-5~8）仅经 Chrome 151 单版本验证。

## 七、结论

**全部 P0/P1 缺陷修复并验证通过，扩展核心功能链（安装加载 → SW 初始化 → 状态读写 → 解除限制 → 用户反馈）端到端恢复。** 剩余开放项均为 P3 级，见第四/五节。

---

## 八、第四轮：EASYCV-006（FIX-9）修复验证（2026-08-06）

**修复内容**：`content/injector.js` 增设 `document.documentElement.dataset.easycvInjected='true'`（保留 main world window flag 供防重复注入与既有检测）；`content/content.js` 两个检查点（onload+50ms、enableCopyPaste+100ms）改读共享 DOM 的 dataset。

**环境**：同第一/二节（Chrome 151 干净 profile，CDP 加载修复后 dist，test-page 自动开启场景）。

| # | 验证项 | 证据 | 结果 |
| --- | --- | --- | --- |
| 1 | 语法/构建 | `node --check` 两文件通过；`npm run build` 引用校验通过；diff 范围精确（content.js ±9 行、injector.js +3 行，无附带改动） | ✅ |
| 2 | 误报消除 | test-page console 中 `✗ EasyCVInjected flag not found`（原 error 级）与 `⚠ Custom script injection may have failed`（原 warn 级）**均未再出现** | ✅ |
| 3 | 确认日志出现 | `✓ EasyCVInjected flag confirmed`（content.js:566）与 `✓ Custom script injection verified successfully`（content.js:326）——isolated world 经共享 DOM 读到了 main world 设置的信号 | ✅ |
| 4 | 兼容面不破 | main world 断言：`window.EasyCVInjected === true`（防重复注入/既有检测依赖面保留）、`window.easycvInjector` 为 object、`style[data-easycv-injected]` 存在 | ✅ |
| 5 | 功能回归 | `dataset.easycvInjected === 'true'`；`selectstart` 放行；真实双击选中文本（"应该"）成功；自动开启链路 `Final state: {isEnabled: true,…}` | ✅ |
| 6 | console 清洁度 | test-page 唯一 ERROR 为 favicon 404（页面自身，与扩展无关）；无扩展相关 error/warning | ✅ |

**推演验证（非实测项）**：二次启用场景下防重复注入逻辑（`injector.js:10` 读 main world window flag，本轮未改动）使 injector IIFE 直接 return，dataset 保持首次设置值，检查点仍通过——代码路径闭环，无新增时序面。

**结论：EASYCV-006 关闭。** 验证保留了真实故障识别能力：injector 加载/执行失败时 dataset 不会被设置，两处检查点仍会正确告警。
