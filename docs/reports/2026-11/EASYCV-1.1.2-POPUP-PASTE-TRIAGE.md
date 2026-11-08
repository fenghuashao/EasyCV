# EasyCV 1.1.2 Popup 粘贴失败专项调查

调查日期：2026-11-01（Asia/Shanghai）。基于 [权限整改报告](EASYCV-1.1.2-PERMISSION-FIX.md)。本轮只调查、复测和新增报告/证据；未修改产品、manifest、现有测试、旧报告或发布包，未 commit、push、提交 Chrome Web Store。

## 结论与发布判断

**这是仓库 1.1.1 已存在、正式 Google Chrome 可复现的产品缺陷，不是删除 scripting / activeTab 导致的新回归。** Popup 更新了后台存储，却没有更新当前页面的复制/粘贴子开关；已有 textarea/input 的内联 `onpaste="return false"` 因而残留。强力模式不能补救这条状态断链；刷新后可恢复。

**建议将此缺陷列为独立修复项，不强制并入 1.1.2 纯权限合规修复。** 理由是运行资源相同、两版表现相同、失败范围明确且有已验证的刷新绕行办法。但是，本专项不替代完整发布验收，也不自行豁免项目现有发布门槛。

| 判定项 | 结论 | 边界 |
| --- | --- | --- |
| POPUP_PASTE_ROOT_CAUSE | CONFIRMED：消息契约断裂 + USER_SETTINGS 未消费 | 类型、白名单、payload 均不一致；存储通知的备用通路遗漏子开关 |
| BASELINE_DEFECT_CONFIRMED | YES，仓库 1.1.1 | HEAD `bbd6300ecd7f3a23dd1f3a9ca2f74e517ffa1d09`；不能代替商店原始 1.1.1 包身份确认 |
| NEW_PERMISSION_REGRESSION | NOT_DETECTED | 本轮状态传播、Popup、粘贴、刷新及扩展开关对照未检出新增退化；不是全站兼容性保证 |
| REAL_CHROME_REPRODUCTION | YES，Google Chrome 156.0.8078.79 | 有头正式 Chrome、实际 action Popup、真实键盘粘贴；非 Chrome for Testing，非单独打开 popup.html 标签页 |
| USER_IMPACT_SEVERITY | P2 / 中等，建议分级 | 触发条件下 textarea/input 粘贴完全失败；刷新可恢复，未观察到数据丢失；影响比例未知 |
| HOTFIX_RELEASE_READY | CONDITIONAL：Popup 专项非阻塞；整体发布门槛仍有未完成项 | 可保留独立权限修复候选；不等于现在已取得无条件商店提交放行 |

这里的“非阻塞”是对**纯权限修复的增量风险建议**，不表示原有 CORE_FUNCTION_REGRESSION 应改为 PASS。[测试计划](../../testing/测试计划.md)仍要求 docs:check、Chrome P0、Edge smoke 等；本轮重跑 docs:check 仍是同一项历史路径错误，Windows/Edge 和商店升级路径未完成。FA 若按现行完整门槛发布，应先补足这些证据；若决定例外提交纯合规版本，应明确接受既有缺陷和未覆盖项。本轮没有执行或代替该发布决定。

## 证据对象与复测方法

全部新证据位于 [popup-paste-triage-20261101](../../evidence/1.1.2/popup-paste-triage-20261101)。

- 基线：既有 git archive HEAD 重建目录 `.tmp/permission-recheck-20261101/baseline-source/dist`。本轮再次逐文件核对：其 36 个非 manifest/build-info 运行资源与 HEAD 相同。
- 候选：`releases/permission-recheck-20261101/EasyCV-v1.1.2-20261031/`，直接加载先前锁定 ZIP 的解压目录。ZIP SHA256 仍为 `6a2f2478e847ff06d6b7a35dbe01b543d2cd00ab52df7f96d2763d758e77782a`。
- 两版 38 个构建文件中，36 个资源逐字节相同，只有 manifest 和 build-info 不同；manifest 仅版本及删除 scripting/activeTab 两项不同。见 [runtime-comparison.json](../../evidence/1.1.2/popup-paste-triage-20261101/runtime-comparison.json)。没有重新构建或打包。
- macOS arm64、正式 `/Applications/Google Chrome.app` 156.0.8078.79、Playwright 1.62.1、有头模式、独立临时 profile、`chromiumSandbox: true`。不读取个人 profile、登录态或私人剪贴板文本；只写入 `EASYCV_TRIAGE_*` 测试文本。
- CDP 加载未修改扩展；以官方 [action.openPopup()](https://developer.chrome.com/docs/extensions/reference/api/action#method-openPopup) 打开实际 Popup，再在该目标中触发既有控件事件。`runtime.getContexts()` 记录了 `contextType=POPUP`、`tabId=-1`。这是实际 Popup 上下文自动化，**不是人工鼠标点击工具栏验收**。原生控制工具两次失败（timeout、native pipe closed），这一人工项保留 NOT_RUN。
- 以 `Meta+v` 产生浏览器真实 paste；典型模式页同时记录 `isTrusted=true`、`defaultPrevented` 和输入值。不是以合成事件或 Clipboard API 写入 textarea 冒充粘贴。原有受限 fixture 和新证据内的 [mechanisms.html](../../evidence/1.1.2/popup-paste-triage-20261101/mechanisms.html) 均由本地 HTTP 提供。
- CDP 读取 Content Script isolated world 的实际 `copyPasteManager` 状态；后台仅增加保持原参数/返回值的临时消息日志探针。因果实验临时调用既有方法或移除测试页面属性，不编辑扩展文件，不能称为“修复版通过”。

正式记录：[1.1.1](../../evidence/1.1.2/popup-paste-triage-20261101/chrome-1.1.1.json)、[1.1.2](../../evidence/1.1.2/popup-paste-triage-20261101/chrome-1.1.2.json)；每版 16 个观察场景。扩展重启用后的 context 选择问题另以 [1.1.1 定向复测](../../evidence/1.1.2/popup-paste-triage-20261101/chrome-1.1.1-reenable.json)、[1.1.2 定向复测](../../evidence/1.1.2/popup-paste-triage-20261101/chrome-1.1.2-reenable.json)校正。证据一致性检查 52 项通过，见 [verdicts.json](../../evidence/1.1.2/popup-paste-triage-20261101/verdicts.json)。**这是检查观察结果符合所述结论，不是产品功能全部通过。**

## 原失败步骤、断言与真实调用链

原 [permission-regression 测试](../../../test/permission-regression.mjs) 的相关位置：

1. 第 91 行开始：将 `plugin_enabled=true`、`user_settings.copyEnabled/pasteEnabled=false`，刷新页面，再打开 Popup 点击主按钮。第 67 行的旧 popupOpen 是单独的扩展标签页。
2. 第 102 行开始：断言 copy/paste/selectstart 合成事件均未被取消；实际只有 paste 仍为 true。
3. 第 124 行开始：向 textarea 发送真实 Cmd+V，等待测试文本出现；两版均超时。
4. 第 129 行“强力模式通过”只检查 force_mode 存储及 injector/wrapper 存在，**没有断言开启强力模式后粘贴成功**。
5. 第 152、160 行刷新后属性清理、真实粘贴通过。旧 [recheck 对照结果](../../evidence/1.1.2/recheck-20261101/permission-regression.json)完整保留失败现场。

上级目录旧 [paste-diagnosis.json](../../evidence/1.1.2/paste-diagnosis.json) 展示的是已经移除 onpaste 的节点，缺少上述关闭→刷新→开启的状态历史，不能拿来否定本问题。

真实链路如下（文件均与基线相同）：

1. [popup.js](../../../popup/popup.js) 第 393 行主按钮调用第 240 行 updateStateWithConfirmation，发送 `UPDATE_PLUGIN_STATE_WITH_CONFIRMATION`，顶层 updates 为 `{copyEnabled:true,pasteEnabled:true}`。它不修改全局 `plugin_enabled`。
2. [service-worker.js](../../../background/service-worker.js) 第 1139 行进入 StateManager；第 297 行 performStateUpdate 合并子开关到 `user_settings`，写 sync 存储和后台缓存。
3. [state-confirmation-manager.js](../../../background/state-confirmation-manager.js) 第 158 行只核对后台状态，**不核对各页面 Content Script 或输入框是否已经可粘贴**。因此 UI 可得到 success。
4. 后台第 1152 行广播 `state_updated`，payload 是 `{requestId,updates,newState:{pluginEnabled,forceMode,userSettings,...}}`。实测当前内容页返回 `success:false, error:"Unknown message type"`，该返回也没有改变前述成功结果。
5. [message-utils.js](../../../utils/message-utils.js) 第 12 行常量定义的是 `state_updated`；第 180 行白名单校验仅允许常量表里的值。[content.js](../../../content/content.js) 第 272 行监听的却是 `STATE_BROADCAST`。后者既未由后台发送，也不在白名单中。
6. 即使只改名字仍不够：content 第 997 行 handleStateBroadcast 需要 `{isEnabled,copyEnabled,pasteEnabled,forceMode}` 四个顶层布尔值，而后台发送的是嵌套结构，且全局字段名为 pluginEnabled。
7. 存储变化还有第二通路：后台第 731 行 setupStorageSync 广播合法的 `update_status`，Content 第 824 行 handleUpdateStatus 能处理 excluded_list、plugin_enabled、force_mode，**未处理 user_settings**。本轮观察到它对 user_settings 通知返回 success，但本地 pasteEnabled 仍为 false。

所以不是“Popup 未保存”，也不是“injector 没有下载”，而是**后台成功不代表页面已应用状态**。新开关从 true→false 同样不及时生效，说明影响不限于一个方向。

### 为什么 textarea 特别容易失败

即便子开关都为 false，只要全局 isEnabled=true，content 第 926 行 applyCurrentState 仍会进入 enableCopyPaste 并加载 injector。injector 的原型中和可以让普通 `event.preventDefault()` 不生效，所以部分复制/粘贴看似已经恢复，并不能证明子开关同步成功。

但 [injector.js](../../../content/injector.js) 第 278 行对**已有元素**的清理名单没有 textarea/input/select；div 在名单中，因此受测 contenteditable div 恰好能被清理。后续 MutationObserver 处理新增节点和 on* 属性变化，不会自动补扫已有且未变化的 textarea。浏览器执行内联 `return false` 的取消路径，在本轮实验中也没有被 JS preventDefault 包装抵消。

content 第 534 行原本可以在 pasteEnabled=true 时移除 onpaste；状态仍为 false 时它跳过。强力模式虽然通过 force_mode 存储通知到达，内部 pasteEnabled 仍为 false，第 580 行也跳过粘贴属性清理。刷新重新 GET_STATUS 后读取 true，才会处理 textarea 并恢复粘贴。

### 实际注入时序

manifest 静态脚本确实声明 `document_start`，但 content 第 1255 行等待 DOMContentLoaded 才创建管理器；第 72 行异步 GET_STATUS 完成后，才在第 593 行 DOM 插入外部 injector。**不能把 manifest 的 document_start 等同于 injector 先于网站脚本执行。**

本次失败场景的毫秒观察值（同一导航 performance.now，MutationObserver 是观察时间，不是性能基准）：

| 版本 | DOMContentLoaded | 观察到 injector script 插入 | main-world 注入标志 |
| --- | --- | --- | --- |
| 1.1.1 | 14.8 | 24.8 | 34.6 |
| 1.1.2 | 15.1 | 24.8 | 36.9 |

页面早期已注册监听器。测试现在等待真实状态和 DOM 处理，不按“页面脚本尚未注册”这一注释假设下结论。早期保存原生方法、CSP、复杂编辑器的其他时序问题未在本轮全面验证；本缺陷在页面稳定后仍存在，单纯加长等待不能修好状态断链。

## 正式 Chrome 复现结果

下表两个版本结果完全相同，主要在未经因果实验干预的页面上观察：

| 场景 | 1.1.1 | 1.1.2 | 可核验事实 |
| --- | --- | --- | --- |
| 全局禁用负对照，已有 inline textarea | 粘贴失败 | 粘贴失败 | 无 injector，限制有效 |
| 默认子开关启用后加载受限页面 | 成功 | 成功 | content=true，onpaste 被清理；此项使用默认等价设置，不代表完整安装流程验收 |
| 页面以子开关关闭状态加载，Popup 主按钮开启 | 失败 | 失败 | UI/存储=true，content=false，onpaste 残留 |
| 上述失败后通过 Popup 开强力模式 | 失败 | 失败 | forceMode=true，但 content.pasteEnabled=false |
| 开启后刷新，强力模式开 | 成功 | 成功 | 重读设置、清理属性、真实粘贴通过 |
| 开启后刷新，强力模式关 | 成功 | 成功 | 刷新绕行不依赖强力模式 |
| Popup 关闭→刷新→Popup 开启 | 失败 | 失败 | 只用 Popup 控件制造开关历史，确认不是直接写 false 设置才会发生 |
| 已正常解锁页面，不刷新地 Popup 关闭再开启 | 仍可粘贴 | 仍可粘贴 | 关闭时存储=false、content=true；不能据此声称关闭功能正确 |
| Chrome 禁用扩展，期间加载受限页 | 失败 | 失败 | Content Script 不存在，符合禁用预期 |
| Chrome 重新启用扩展，不刷新上述页 | 失败 | 失败 | ping 无接收端，不是“已收到开关但失效” |
| 重新启用后刷新 | 成功 | 成功 | 新 Content Script ping 成功、pasteEnabled=true、injector 存在、真实粘贴通过 |

关闭/重启用扩展使用隔离 Chrome 扩展管理页自身的 management API；**未向 EasyCV 添加 management 权限**。本项与 Popup 子开关不同，也与关闭浏览器后重新以命令行加载扩展不同。

典型拦截模式页的真实 paste 事件均记录 isTrusted=true：

| 目标 / 机制 | Popup 开启但未刷新，两版 | 刷新后，两版 |
| --- | --- | --- |
| 普通 textarea，无拦截 | 成功 | 成功 |
| 预注册 paste listener 调用 preventDefault | 成功 | 成功 |
| 预注册 Cmd+V keydown 调用 preventDefault | 成功 | 成功 |
| 已有 textarea，内联 onpaste return false | 失败，defaultPrevented=true | 成功 |
| 已有 input，内联 onpaste return false | 失败，defaultPrevented=true | 成功 |
| 已有 contenteditable div，同一内联限制 | 成功 | 成功 |

这是本地真实 HTTP 页上的典型机制验证，**没有伪称已验收第三方生产站点、登录站点、全部富文本编辑器或所有 contenteditable 元素类型**。

因果拆分实验，两版同样得到：

- 仅将消息名改成 STATE_BROADCAST 并保留真实嵌套 payload：白名单不接受，无有效响应，仍失败。
- 绕过消息入口，直接把嵌套 payload 交给既有 handleStateBroadcast：返回 Invalid state data，仍失败。
- 同一个既有处理器收到正确扁平状态：content 更新为 true，onpaste 清理，粘贴成功。
- 直接执行既有 loadSettingsWithRetry → applyCurrentState：粘贴成功。这验证了优先复用现有加载路径的修复方向。
- 保留 stale content=false，只移除测试 textarea 的 onpaste：粘贴成功。这确认了当前取消动作的直接来源。

## 问题归类、影响与最小处理方案

**测试环境问题：** 旧测试打开的是 Popup 标签页；旧强力模式断言没有验证粘贴；命令行重启时出现 onInstalled reason=install，不能证明正常升级或浏览器重启丢设置。本轮正式 Chrome 的实际 Popup 仍复现失败，排除了“只有旧 Popup 测试环境才失败”。新脚本的首轮局部变量读取错误、重跑端口占用，以及主轮重启用后 stale CDP context 都是调查工具问题，不当成产品缺陷：保留 harness-* 日志；扩展重启用最终以定向复测及刷新后 ping 为准。

**历史产品缺陷：** 双向子开关状态传播不完整；已有输入元素 return false 清理盲区；实际 injector 晚于 DOMContentLoaded。当前已确认的是仓库 1.1.1，不把未取得原包的商店版本当作已确认相同。

**权限变更回归：** 本轮未检出。两项被删权限没有参与这条静态注入/消息/存储链，36 个资源相同，实际 Popup 能读取目标域名，main world 注入成功，刷新可用，且基线相同条件失败。没有依据为此恢复 scripting 或 activeTab。

**用户影响：** 已将子开关关闭并在此状态加载页面，再用 Popup 启用的用户，遇到已有 textarea/input 内联 return false 时会看到“关闭解锁”按钮却仍无法粘贴。强力模式会增加困惑，不能作为可靠绕行；**开启后刷新页面**是已验证的办法。没有自动收集用户数据，不能推算用户占比。默认启用后新加载页面和受测 preventDefault 类限制并未普遍失效；同时，关闭后当前页仍保持部分解锁，是状态控制的另一个已确认风险。建议分级 P2/中等，优先另修，不声称无用户影响。

**最小修复提案，未实施：** 在 content 的 handleUpdateStatus 中，让 USER_SETTINGS 变化复用现有 EXCLUDED_LIST 的“loadSettingsWithRetry → applyCurrentState → notifyStateListeners”分支。这样经已有合法 update_status 通路重读 canonical GET_STATUS，保留域名排除裁决，并重新处理现有元素；不需要增加权限或更换注入方式。本轮既有方法的因果实验支持该方案，但它仍需真正补丁及回归才能称为修复完成。

只改 STATE_UPDATED 常量名会留下白名单和 payload 问题；只给 injector 加 textarea/input 会绕过子开关语义，不能作为正确状态同步修复。若另做消息契约统一，应一起处理类型常量、白名单、状态结构和接收确认，作为单独可审阅变更。对子开关关闭后的 DOM/原型恢复语义也要单独验证，上述最小开启修复不承诺解决所有关闭行为。

后续最小验收应覆盖：Popup 关闭→刷新→开启，paste 子开关单独开启，强力模式两态，已有/新增 textarea 与 input，域名排除优先级，以及多标签同步。不能再以“storage=true / injector 存在”替代页面状态与真实粘贴断言。

## 合规修复候选的边界与交付核验

允许保持 1.1.2 为独立纯合规修复候选的具体依据是：相同运行字节、相同失败条件、相同状态断链、相同刷新恢复、正式 Chrome 的实际 Popup 对照均无新增退化。该缺陷不需要通过重新加回两项权限规避；将业务修复强行混入会改变本次候选边界并要求重新打包验收。

剩余事项仍应如实保留：

- docs:check 本轮退出码 1，仍指向历史真实站点报告第 5 行的缺失 profile 路径；见 [docs-check.txt](../../evidence/1.1.2/popup-paste-triage-20261101/docs-check.txt)。没有创建私人 profile 或改写历史报告来刷绿。
- 实际 action Popup 自动化通过的观察不能替代人工工具栏/原生右键菜单；Windows Chrome、Edge、第三方站点/CSP 验收仍 NOT_RUN。
- 来源可核验的商店原始 1.1.1 包、真实商店升级和正常浏览器重启持久化仍 NOT_VERIFIED。本轮只是禁用/重新启用同一个隔离安装。
- 不改写原权限报告中的总发布 Gate；本报告新增“Popup 缺陷可作为已知基线风险分离”的判断，不把未知门槛默认为通过。

复跑命令（本轮脚本只启动独立测试 Chrome；18941 端口需空闲，串行执行）：

```sh
PLAYWRIGHT_PATH=/Users/fengshaohua/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright NO_PROXY=localhost,127.0.0.1,.localhost node docs/evidence/1.1.2/popup-paste-triage-20261101/triage-runner.mjs
PLAYWRIGHT_PATH=/Users/fengshaohua/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright NO_PROXY=localhost,127.0.0.1,.localhost node docs/evidence/1.1.2/popup-paste-triage-20261101/reenable-runner.mjs
python3 docs/evidence/1.1.2/popup-paste-triage-20261101/verify-observations.py
```

首个脚本保留了主轮 context 探针限制，重启用后的最终结论使用第二个定向脚本。复跑会更新本轮目录下的对应观察文件，复跑前应另选输出目录或备份本轮证据。临时 profile 留在忽略的 `.tmp/popup-paste-triage-20261101/`，不属于产品或发布包；测试浏览器已关闭。

本轮前已有 190 个受版本控制或未忽略的工作区文件逐字节核对未变，另核对候选 ZIP/解压目录及基线构建未变；见 [preservation.json](../../evidence/1.1.2/popup-paste-triage-20261101/preservation.json)。新增仅此报告和本轮证据目录，及忽略的临时测试 profile。撤销本轮文档交付只需移走新增报告与证据目录，不应 reset/clean 或覆盖之前的权限整改。

PRODUCT_CODE_MODIFIED_THIS_RUN = NO  
EXISTING_REPORT_MODIFIED = NO  
COMMIT_CREATED = NO  
PUSH_PERFORMED = NO  
STORE_SUBMISSION = NOT_RUN
