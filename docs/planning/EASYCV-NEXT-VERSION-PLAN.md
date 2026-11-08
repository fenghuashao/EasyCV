# EasyCV 下一版本方案：P0 调查、P1 产品分析、P2 升级计划

日期：2026-11-03（Asia/Shanghai） · 状态：**待 FA 审核，尚未实施**

**建议以“权限合规、配置不丢失、网站规则可信、页面操作状态可信”为下一版目标。当前不满足商店提交条件。** 已有权限与状态修复应保留；本轮新发现的数据可靠性和诊断隐私问题需要修复。暂定候选版本 **1.1.3**，用于区分已有多个 1.1.2 产物；最终版本必须在后台核实后确定，本轮不修改版本号。

本轮只读取代码、历史文档和证据，运行本地单元/静态检查、内存探针及隔离构建，并新增本方案与证据。依照 FA 最新指令，没有操作浏览器，包括无头浏览器；没有更改产品代码、原测试、版本、权限、隐私政策、商店资料、发布渠道或既有 ZIP，没有提交 Git、push、上传或送审。

## 1. 证据口径与当前基线

本报告的 **PASS** 表示指定对象在所述范围内通过；**PARTIAL** 表示只有部分范围有证据；**FAIL** 表示明确要求未满足或代码行为已复现缺陷；**NOT_RUN** 表示本轮未执行/无法确认，不能视为通过。历史 `NOT_VERIFIED` 在本轮 Gate 表中归为 NOT_RUN，并保留其原始含义。BLOCKED 是发布决策，不是测试结果。

| 对象 | 本轮确认结果 | 证据或限制 |
| --- | --- | --- |
| 仓库 | `D:\pro\github\EasyCV`，分支 `master` | 未发现仓库内或父目录额外 AGENTS.md；遵循 FA 提供的 Kernel |
| HEAD | `9d378b5e731e2e3f5e3513762fab7b36fcb35236` | 今天的 Popup 状态与支持入口修复 |
| 远端关系 | 本地 tracking 显示 ahead 1 | 本轮未 fetch，不能证明当前远端未变化 |
| 初始工作区 | 无已跟踪修改；已有 5 个未跟踪文件 | `docs/evidence/1.1.2/store-submission-20261103/`；全部保留 |
| 源码版本 | manifest/package/lock 顶层与根包均为 `1.1.2` | [产物审计](../evidence/p0-p2-review-20261103/artifact-audit.json) |
| 当前线上版本 | **待后台核实** | 2026-11-02 21:02 的历史官方更新下载为 manifest `1.1.1`；文件名 `_1_1_1_0.crx` 不能证明 manifest 有四段版本 |
| 当前草稿、审核、警告状态 | **待后台核实** | 上轮浏览器读取被工具停止；本轮按指令不再操作浏览器 |
| 默认 dist | **旧 1.1.1，仍含 scripting/activeTab** | 不得直接 `npm run zip` 后送审；本轮未覆盖 |
| 现有 ZIP | 1.1.2，133088 字节，38 文件，CRC/白名单通过 | 37 个运行文件逐字节对应提交 `02d0681`，不对应当前 HEAD |
| 原状态修复 ZIP | 此机器没有旧报告指向的原 ZIP | 不把历史路径缺失当作旧验收造假，也不把重打包等同商店提交 |

现有 ZIP 为 `releases/store-submission-20261103/EasyCV-v1.1.2-20261103.zip`，SHA256：

```text
52d58935bad6f40b2fd987ff4d1e9f2b2a81f88e87d333eda42fd52d1a7c49f9
```

它与当前源码有 7 个运行文件不同：`_locales/en/messages.json`、`_locales/zh_CN/messages.json`、`content/content.js`、`popup/popup.css`、`popup/popup.html`、`popup/popup.js`、`utils/message-utils.js`。不能把今天 Popup 优化的测试结果直接标到这个 ZIP 上。

最近提交链：`bbd6300`（仓库 1.1.1）→ `fc9c6e2`（文档门禁）→ `200adff`（权限元数据/证据）→ `2e93f89`（Windows 历史验收）→ `02d0681`（状态修复）→ `9d378b5`（Popup 优化）。[基线及保全哈希](../evidence/p0-p2-review-20261103/baseline.json)记录本轮初始文件状态。

## 2. P0：官方警告及整改矩阵

以下官方通知来自**上一轮通过 Gmail 读取的原邮件**，本轮没有重新访问邮件或后台。邮件由 `chromewebstore-noreply@google.com` 发出，产品 ID 为 `bnbmgiidicjdbnmkmdnjeelhijnlhnjb`。日期为 2026-10-29 11:26:12 -07:00，即北京时间 **2026-10-30 02:26:12**。原邮件保存在用户邮箱中。

与本任务直接相关的原文：

> 违规行为参考 ID：Purple Potassium。请求但不使用以下权限：scripting。
>
> 从清单文件中移除上述未使用的权限。审核您的产品请求的所有其他权限。
>
> 请在 30 天内进行必要的更改，以免商品被下架。
>
> 如果新草稿在警告期结束之前未获得批准，系统会移除现有商品详情。

因此，**仅提交审核不足以确认警告解除**。以邮件时间加 30 天推算约为北京时间 11 月 29 日，这只是排期参照，邮件没有提供精确到期时刻；后台截止日期、计时口径和当前是否仍处警告期均待核实。应预留拒审和返修时间，不能等到最后一天提交。上一轮限定查询只检出这封相关近期官方邮件，不证明没有其他后台问题。

| 官方要求/相关项目 | 涉及代码 | 当前状态 | 整改方案 | 验证方法 |
| --- | --- | --- | --- | --- |
| 移除未用 scripting | `manifest.json:7`、包内 manifest | 源码及已有 1.1.2 ZIP 已删除；旧 dist 仍存在 | 保留删除，最终包严禁回带旧 manifest | ZIP 解包核对权限并搜索 API；后台包页核验 |
| 审核所有其余权限 | storage/contextMenus/host_permissions | activeTab 已删除；保留项有代码用途；全站范围仍需说明必要性 | 保留当前功能范围，形成逐项理由，不为未来功能预申请 | 权限→调用→用户路径表，真实回归 |
| 最小权限 | `content_scripts` 与 WAR | `<all_urls>` 用于普通网页静态注入及 URL 判断；WAR 暴露范围有缩减空间 | 本版先确认 injector 实际需要；拟仅公开 injector，缩减图标/utils 前检查完整资源链 | ZIP 静态引用与 Chrome/Edge 功能回归 |
| 新草稿经审核获批 | 后台草稿/审核流程 | NOT_RUN，当前状态未知 | 审核本方案、完成整改和质量门禁后再按授权处理 | 后台记录、版本与包哈希、审核回执 |
| 警告期内获批 | 邮件及后台到期信息 | 30 天要求已确认，精确期限待核实 | 尽早完成并留返修窗口；不把推算日期当后台事实 | 后台状态及官方后续邮件 |
| 诊断/统计数据与披露一致 | `service-worker.js:988/1057`、`storage-utils.js:42`、`PRIVACY.md` | 本地调查确认差异，**不是 Google 已认定的新违规** | W1：最小化并改为明确 local 存储，停止默认域名统计，更新本地披露草稿 | 探针 F07/F12、无 URL/内容采集断言、公开政策对照 |

Google 明确点名的权限只有 `scripting`；不能声称官方也点名 `activeTab`、Side Panel 或诊断数据。删除 activeTab 是项目权限审查结论。[官方权限排错说明](https://developer.chrome.com/docs/webstore/troubleshooting#excessive-permissions)和[更新流程](https://developer.chrome.com/docs/webstore/update)已在上一轮查阅，实际商品状态仍以后台为准。

## 3. P0：模块、权限与数据盘点

| 模块 | 实现与入口 | 观察和支持边界 |
| --- | --- | --- |
| MV3 | [manifest](../../manifest.json)，service worker、静态 content scripts、action popup、options_page | 没有 MV2 background page、远程 background 页面 |
| 后台 | [service-worker.js](../../background/service-worker.js) 的 StateManager/BackgroundManager；另有 auto-enable/icon/state-confirmation/monitoring manager | 多层缓存、广播与确认逻辑；监控计时器是 worker 内存任务，不能当作可靠后台调度或遥测 |
| 注入层 | [content.js](../../content/content.js):610 动态插入包内 injector；[injector.js](../../content/injector.js) 包装事件原型、移除限制、观察 DOM | 静态脚本声明 document_start，但管理器在 DOMContentLoaded 后初始化并异步读设置；不能承诺早于所有页面脚本 |
| Popup | [popup.js](../../popup/popup.js)、HTML/CSS、中英 locale | 主按钮写全局复制/粘贴开关；当前源码已说明作用范围。显示开启不等于实际复制成功 |
| Side Panel | **没有 Chrome side_panel 配置、sidePanel API 或对应页面** | Options 的侧边导航不是 Side Panel；运营数据“扩展侧边栏入口”不能反推已有此功能，本版不新增 |
| Options | [options.js](../../options/options.js) 的设置、自动名单、排除名单、导入导出、清空、统计 | 普通单项设置已改为按字段保存；名单编辑、导入和并发仍有缺陷 |
| 工具 | StorageUtils、MessageUtils、DOMUtils、I18nUtils、NotificationUtils | 运行时均为包内 JS；消息类型有白名单，payload/导入 schema 不完整 |
| 权限 | `storage` → StorageUtils/Options；`contextMenus` → 后台三个菜单 | 三个菜单分别为全局启停、强力模式、加入自动启用；无剪贴板读写权限 |
| 网站访问 | `host_permissions:<all_urls>`、静态 matches/all_frames | URL 识别、网页消息/静态脚本；浏览器内部页/商店受限页不保证可用，file 访问还依赖用户浏览器设置 |
| WAR | `content/injector.js`、`icons/*.png`、`utils/*.js` 对 all_urls | 确认 injector 需页面可访问；未发现页面引用图标/utils 的必要路径，可在 W1 经回归缩减 |
| CSP | manifest 未自定义 content_security_policy | 使用浏览器默认扩展 CSP；DOM 加载 MAIN world injector 仍有页面 CSP、时序及资源加载失败风险，尚未实测矩阵 |
| 远程代码/依赖 | [搜索结果](../evidence/p0-p2-review-20261103/runtime-scan.txt)；37 个运行文件无运行时第三方 npm 包 | 未发现 fetch/XHR/WebSocket/beacon、eval/new Function 的产品运行调用或远程脚本；测试 harness 的 new Function 不进入发布包 |
| 外部导航 | Popup 主动打开 GitHub issue 草稿；Options 打开仓库/issues/wiki | 当前 Popup 不自动附带浏览 URL；不等于“任何形式都不产生网络导航”。Wiki 内容可达性本轮未验证 |
| 开发依赖 | package 直接 devDependency 为 archiver；lock 记录 51 个依赖包项 | 用于本地打包，不进入扩展；本轮未做联网漏洞审计，不能称依赖无漏洞 |
| 浏览器兼容 | 使用 chrome 命名空间，没有 Firefox/Safari 兼容层和最低 Chrome 版本声明 | 支持重点是 Chromium；Edge/macOS/ChromeOS 以各自实际验收为准 |

### 3.1 存储契约

| 数据 | 真实保存路径/格式 | 兼容性结论 |
| --- | --- | --- |
| 总开关/强力 | `plugin_enabled`、`force_mode` 独立键 | 默认 true/false；独立键优先于 user_settings 内历史同名字段，最近修复应保留 |
| 普通设置 | `user_settings` 对象 | copyEnabled/pasteEnabled 默认 true；旧未知字段目前 merge 保留，下一版不能清洗掉用户配置 |
| 自动名单 | `auto_enable_list`，对象数组 `{domain,copyEnabled,pasteEnabled}`，历史也可能为字符串数组 | 工具读取能转换字符串，但后台直接 preload 原值，导致兼容链断裂（F03） |
| 排除名单 | `excluded_list` 字符串数组 | 精确域/点边界子域；缺键默认三个账号域名，用户明确空数组应保留 |
| 统计/交互历史 | `statistics`、`interaction_history` | 默认写 sync；sitesUnlocked 保存检测到限制的域名，交互历史保存域名→时间戳；检测误判导致普通页也可能被记录（F12），不能称没有保存浏览衍生信息 |
| 错误/旧反馈 | `errorReports` 最多 10 条、`userFeedback` 最多 20 条 | 注释写 local，实际调用 StorageUtils 写 sync；错误包含完整 URL、sender、userAgent（F07） |
| last_update | 键常量存在并纳入通用导出 | 本轮未发现决定升级策略的 schema version/完整迁移机制 |

`StorageUtils.get/set` 默认使用 sync，异常才退到 local；不是两个区域自动合并。W2 必须明确权威来源和冲突处理。Options 导出格式为 `{settings,whitelist,excludedList,exportDate,version}`，而 StorageUtils 还有一套原始键导出并硬编码 `1.1.0`；当前 UI 使用前者，后者不能当作统一、已验证的恢复协议。

首次 install 会写默认配置；update 只在 excluded_list 缺失时种子默认域名，不清空现有配置。3 组内存模拟通过了这段 handler 的旧键保留检查，但自动名单读链仍有 F03。**模拟 update、开发重载和真实同 ID 升级是三个不同证据等级。** 无自定义卸载回调/外部卸载跟踪；卸载后的实际 sync/local 行为本轮未实测。

### 3.2 核心功能与真实操作路径

| 功能 | 当前实现/用户路径 | 缺陷或边界 | 测试覆盖 |
| --- | --- | --- | --- |
| 复制、选择、拖选、右键 | Popup 复制开关；content 的 COPY_EVENTS、样式修复；injector 拦截 | 自定义网页菜单可能被原生菜单替代；不能保证所有网站 | 历史真实输入及现有事件单测；本轮浏览器 NOT_RUN |
| 粘贴 | Popup 粘贴开关、paste 事件和内联处理器清理 | 旧即时状态缺陷已修；部分关闭时 MAIN world 未按子开关门控（F11） | 状态单测 PASS；功能负对照需补 |
| 强力模式 | Popup 高级项/右键菜单/Options；独立 force_mode | 默认关闭；既有刷新动作可能影响未保存表单，需验证提示和操作范围 | 独立键优先单测与历史 Windows 证据 |
| 自动启用 | Popup/菜单加入，Options 管理；后台 tabs.onUpdated | 不是“名单外不启用”的白名单模式；当前规则会改全局子开关（F05） | 历史首访修复通过；多域不同配置未充分覆盖 |
| 排除 | Options 加入/删除；后台 GET_STATUS 按域名裁决 | 正常路径优先于自动规则；错误路径默认启用会破坏边界（F06） | 正常排除单测 PASS，异常保护 FAIL |
| 网站管理 | 添加、编辑、删除、导入导出 | 编辑提前删除、重复绑定事件、未校验导入、旧格式链断裂 | F02/F03/F08；真实设置页复验待做 |
| 状态持久化 | sync/local 与缓存，内容端重新 GET_STATUS | 回退读写不一致、并发覆盖、clear 后缓存失效（F01/F09/F10） | 常规状态单测 PASS，异常探针 FAIL |
| 状态反馈 | Popup 真实状态信封、排除/不支持/断连说明 | 仍不能证明剪贴板成功；异常 GET_STATUS 伪成功（F06） | 现有 Popup 单测；历史中英 26 项浏览器用例 |
| 快捷操作 | action Popup、右键菜单、设置入口 | 无 manifest commands 自定义快捷键；不应承诺已有快捷键功能 | 历史原生菜单局部通过 |
| 动态/SPA | MutationObserver、分批处理；popstate/DOM 变化感知 URL | 仅 pushState 改 URL 而不变 DOM 可能漏检；大型 DOM 性能未重验 | 旧 E2E 局部覆盖 |
| iframe | 静态 all_frames，按各 frame 自身域名读状态 | 跨源/沙箱/about:blank、顶层域排除与子 frame 规则、Popup 汇总状态需专项验证 | 没有完整跨源矩阵，PARTIAL |
| Shadow DOM | 遍历已有 open roots，包装后创建的 attachShadow 含 closed | 注入前既有 closed roots 无法通过 shadowRoot 遍历；禁用恢复和动态样式需测 | 历史 E2E 与原型单测，不是任意 closed root 保证 |

## 4. P0：本轮缺陷复现与风险分级

[local-probes.mjs](../evidence/p0-p2-review-20261103/local-probes.mjs)执行未改动的真实产品方法，用内存 Chrome/DOM 替身，未访问个人数据。12 项探针断言通过表示**缺陷路径已复现**，不是产品 PASS。完整输入/输出见 [local-probes.json](../evidence/p0-p2-review-20261103/local-probes.json)。真实浏览器影响频率、网站覆盖率均未知。

| ID / 优先级 | 触发、根因及后果 | 源码证据 | 建议处置 |
| --- | --- | --- | --- |
| F01 / P1 | sync 写失败→local 保存 true→sync 读正常返回旧 false；操作看似成功，刷新回旧值 | `utils/storage-utils.js:42–68` | W2：一致的读写权威和显式错误，不静默假成功 |
| F02 / P1 | 点编辑即持久删除原规则；取消/关闭页面丢规则 | `options/options.js:537–568` | W2：编辑草稿，确认保存时原子替换 |
| F03 / P1 | 字符串旧名单在工具层转换，StateManager 直接缓存原值；自动匹配返回 null | `storage-utils.js:139`、`service-worker.js:59/132`、`auto-enable-manager.js:108` | W3：统一无损规范化，旧格式读链全覆盖 |
| F04 / P1 | 已保存/导入 `*.example.com` 命中 `notexample.com`；endsWith 缺少点边界 | `auto-enable-manager.js:123–128` | W3：规范化并校验域边界；默认 UI 输入未必接受 wildcard，不夸大触发范围 |
| F05 / P1 | A 站自动配置写全局 userSettings，影响其他标签页和名单外网站 | `auto-enable-manager.js:152–170`、`service-worker.js:819` | W3：计算本站有效值，自动访问不得写全局默认 |
| F06 / P0 | 后台状态读取抛错时返回 success:true/enabled:true；排除站也可能被启用 | `service-worker.js:844–860`；`content.js:178–197` 重试耗尽也默认启用 | W1/W4：异常不能授权解锁；显示不可确认，等待恢复后重查 |
| F07 / P0 | 错误报告完整 URL（含 query/hash）、sender.tab.url 写到 sync；“仅本地”描述不准确 | `service-worker.js:988–1010`、`content.js:1095`、`storage-utils.js:62` | W1：诊断字段最小化、local 存储、披露对齐；不是官方已认定违规 |
| F08 / P1 | 导入只检查字段存在，`whitelist:{bad:true}` 被保存，随后 .find 抛错 | `options/options.js:819–843` | W2：写前整体 schema 验证、大小/类型约束、失败零写入 |
| F09 / P1 | 两个并发字段更新均读旧对象，后一写覆盖前一字段 | `storage-utils.js:312–315` | W2：扩展侧单一写入口和串行合并；不声称跨设备事务原子性 |
| F10 / P1 | clear/remove 事件把名单缓存变 undefined，下一次本站查询抛错并走 F06 | `service-worker.js:81–100/132` | W2：删除事件按缺省规范化；读取错误与用户清空区分 |
| F11 / P1 | 仅粘贴开启也启动通用 injector；其原型层同时中和 copy/paste，没有子开关参数 | `content.js:314/353/924`、`injector.js:52–104/693` | W4：传递有效子开关并按事件门控；双开/单开/双关均测。当前证据是方法组合及源码，浏览器效果 NOT_RUN |
| F12 / P0 | 普通元素 oncontextmenu 为 null 被误判为受限；报告 handler 忽略总开关和 enableStatistics=false，把域名加入 sync 的 sitesUnlocked | `dom-utils.js:90–111`、`content.js:85/293`、`service-worker.js:1057–1067` | W1：停止默认按访问域累计，修正检测误判、尊重统计关闭；W6 不将该数据标为成功解锁 |

其他已确认的发布工程缺口：

- **P0：deploy 测试是模拟。** `scripts/deploy.js:111–130` 通过 sleep 后打印“测试通过”，未调用单测、语法或集成检查。命令名“deploy”也不代表上传商店。正式链路必须执行真实检查并传播退出码。
- **P0：候选身份混乱。** 默认 dist、1.1.2 ZIP、同版本的新 HEAD 是不同内容；旧包验证器硬编码版本/基线 SHA/变化文件，不能直接覆盖下一版。W5 必须阻止 stale dist 和同名覆盖。
- **P1：版本脚本不同步 lock。** `scripts/bump-version.js` 只改 package/manifest 和 changelog；三段解析不等于 Chrome 1–4 段版本校验。计划使用三段版本，同时验证范围与 lock 一致。
- **需进一步验证的风险：** Options 导入域名经 innerHTML/data-domain 插值（`options.js:621/749`），存在标记注入面；未证明可执行脚本，不宣称已发生 XSS。W2 验证导入并用安全文本/属性赋值；每次 renderWhitelist 又绑定监听器（656 行）需一并消除重复。
- **P2：无效设置。** autoDetect/detectionDelay/maxRetries/performanceMonitoring 可保存却无对应 content 消费；showNotifications 也未找到内容通知门控。debugMode 已有消费，不能把它一起标为无效。参数保存测试不证明参数改变实际行为。
- **P2：兼容性副作用。** injector 的 ctrl/meta 中和范围不限 C/V/X；播放器右键已有取舍，页面可发同名 postMessage 影响自身 injector。无证据表明借此获得扩展权限。严格 CSP、复杂编辑器和页面主动对抗须实测，不承诺全网站支持。

## 5. P0：历史问题逐项复核

已对照 [权限整改](../reports/2026-11/EASYCV-1.1.2-PERMISSION-FIX.md)、[Popup 调查](../reports/2026-11/EASYCV-1.1.2-POPUP-PASTE-TRIAGE.md)、[发布收尾](../reports/2026-11/EASYCV-1.1.2-RELEASE-CLOSEOUT.md)、[文档门禁](../reports/2026-11/EASYCV-1.1.2-DOCS-GATE-FIX.md)、[Windows 验收](../reports/2026-11/EASYCV-1.1.2-WINDOWS-ACCEPTANCE.md)、[状态修复](../reports/2026-11/EASYCV-1.1.2-STATE-FIX-ACCEPTANCE.md)、[今日优化](../reports/2026-11/EASYCV-OPTIMIZATION-20261103.md)，以及 CHANGELOG、测试计划、发布清单、待办与原始 JSON。历史报告保留原结论，不倒写成今天全部通过。

| 历史问题/Gate | 当时结果 | 当前代码、根因和修复状态 | 本轮结论与证据 |
| --- | --- | --- | --- |
| WINDOWS_CHROME_P0 | FAIL | Popup 通知协议/USER_SETTINGS 消费、自动名单缓存、forceMode 优先级已修 | **PARTIAL**：旧 Windows ARM64 针对性通过；当前完整 HEAD 原生测试 NOT_RUN，F01–F12 不能被旧结果覆盖 |
| WINDOWS_EDGE_SMOKE | FAIL | 同一状态修复已进入现有 ZIP | **PARTIAL**：旧 Edge 156 ARM64 证据；当前 HEAD Edge NOT_RUN |
| NATIVE_UI | PASS | 曾实际 action Popup/菜单，非单独 HTML | **PARTIAL**：历史证据成立；最新 Popup 改动尚未原生重验 |
| UPGRADE_111_TO_112 | NOT_VERIFIED | 原商店 ID 安装和非默认数据已在历史环境保留，无可信更新目标 | **NOT_RUN**：本轮只做 update handler 模拟，未升级或接触该 Profile |
| BROWSER_RESTART_PERSISTENCE | PARTIAL | 状态修复后 Chrome/Edge 正常同 Profile 重启，五类存储一致，force UI 正确 | **PARTIAL**：查阅 restart-comparison 支持历史通过；当前源码/新候选、升级后重启 NOT_RUN |
| SETTINGS_AND_SITE_LIST | FAIL | 原 force_mode 被嵌套快照覆盖已修，单项保存不再写整份旧快照 | **FAIL**：原指定问题有修复证据，但 F01/F02/F03/F08/F09/F10 显示完整设置门禁仍不满足 |
| KNOWN_POPUP_DEFECT | PASS_WITH_KNOWN_DEFECT | 原“关闭→刷新→开启仍不能粘贴”的协议断链已修 | **PARTIAL**：现有状态单测通过；历史真实旧包 2/10→修复包 10/10；当前最终包原生验证缺失 |
| docs:check | 曾 FAIL | 私有按需 Profile 路径误判，检查器有窄范围修复 | **PASS**：本轮重新执行通过，未创建假 Profile |
| Popup 状态/反馈 | 旧误报/占位链接 | HEAD 已修真实信封、消息注册、本地帮助、无 URL 的 issue 草稿 | **PARTIAL**：本轮单测 PASS；历史 x64 Chromium 中英 26 项通过，不是原生 action Popup |
| RELEASE_DECISION | BLOCKED | 官方后台、最终候选、真实升级、当前完整浏览器门禁仍缺；本轮新问题待修 | **BLOCKED**，不根据“READY_FOR_STORE_REVIEW_PREPARATION”自动放行 |

历史证据重点：[状态修复 acceptance](../evidence/1.1.2/state-fix-20261103/acceptance.json)、[正常重启精确对照](../evidence/1.1.2/state-fix-20261103/restart-comparison.json)、[原商店升级基线](../evidence/1.1.2/windows-acceptance-20261102/upgrade-baseline-summary.json)、[历史官方 CRX 检查](../evidence/1.1.2/windows-acceptance-20261102/store-current-check.json)、[中英 Popup 浏览器结果](../evidence/optimization-20261103/browser.json)。历史 Windows 为 ARM64，而今日 Popup 自动化为 x64 Chromium；两者不能拼成“当前 Windows x64 Chrome/Edge 全量验收”。

### 5.1 当前测试与发布能力

| 本轮检查 | 结果 | 证据/实际含义 |
| --- | --- | --- |
| `npm test` | **PASS 77/77** | [日志](../evidence/p0-p2-review-20261103/unit.txt)；已有 Node tests，非浏览器 |
| `npm run lint` | **PASS 48 文件** | [日志](../evidence/p0-p2-review-20261103/lint.txt)；实际是语法检查，不是完整风格/安全审计 |
| `npm run docs:check` | **PASS** | [初始日志](../evidence/p0-p2-review-20261103/docs-before.txt)；检查器有纳管范围，另需校验本方案链接 |
| 12 项现状探针 | **FAIL（产品要求）** | 12/12 成功复现缺陷路径；没有修复任何产品代码 |
| update handler 3 组模拟 | **PASS（局部）** | 缺省/空/非空排除列表，已有设置保留；实际升级 NOT_RUN |
| 隔离 Builder | **PASS，38 文件，37 运行文件与源码相同** | [结果](../evidence/p0-p2-review-20261103/isolated-build.json)，输出 `.tmp/p0-p2-review-20261103-build`，不是发布候选 |
| 既有 ZIP 结构/CRC | **PASS** | 38 文件精确白名单、无重复/路径穿越，无测试/profile/凭据混入 |
| 既有 ZIP 与 HEAD 一致 | **FAIL** | 7 个文件不同；对 `02d0681` 的 37/37 运行文件相同 |
| Browser/E2E/Chrome/Edge/重启/真实升级 | **NOT_RUN** | 遵守本轮不操作浏览器要求，包括没有运行浏览器测试脚本 |
| 依赖联网安全审计、商店后台/公开政策 | **NOT_RUN** | 不将本地检查扩大为外部验证 |

仓库已有 E2E、permission-regression、state-sync-regression、popup-ux-regression 与 ZIP 检查脚本，具备可复用基础。但 Playwright/浏览器路径未作为项目锁定开发依赖，依赖外部安装；原权限脚本使用 load-extension 重启导致 install 默认化，不能作正常重启判据；`test:coverage` 与 test 相同，没有实际覆盖率输出；未发现仓库 GitHub Actions 工作流。**当前发布流程为 PARTIAL，尚非可靠的一键发布。**

## 6. P1：产品判断与优先级

用户最核心的路径应是：打开受限网页 → 看懂本站状态 → 开启需要的能力 → 回网页实际操作 → 失败时刷新/尝试强力模式/排除不兼容站点/反馈。当前源码已有多数基础能力；主要短板是规则和状态是否真正生效、是否影响其他站点、是否保存可靠，不是功能数量。

本版保留 Popup 的全局复制/粘贴语义及其说明，不突然改成站点开关。自动名单的“本站配置”应真正只作用于本站，这是修复既有规则语义。真正的一键本站开关、快捷排除以及独立 Side Panel 均不在本版新增。默认仍为全局开启、复制/粘贴开启、强力关闭、三个敏感账号域排除；不擅自把已安装用户切到名单专用模式。

| 工作包/级别 | 用户价值 | 复杂度/风险 | 依赖 | 验证方法 | 本版 |
| --- | --- | --- | --- | --- | --- |
| W0 / P0 后台事实与版本身份 | 不误发、不错过整改时限 | 低/高影响外部操作 | 后台可访问、FA 审核 | 包页/状态页/官方通知核对 | 必须，当前待核实 |
| W1 / P0 权限、诊断/统计隐私、异常休眠 | 减少不必要暴露，异常时尊重关闭/排除 | 中/中 | W0 信息；无需新增权限 | 权限审计、F06/F07/F12、安全错误路径、披露核对 | 必须 |
| W2 / P1 配置与名单保存 | 防止丢配置、编辑取消不丢规则 | 中/中 | 明确 sync 权威及恢复契约 | F01/F02/F08/F09/F10、导入失败零写入、并发/重启 | 必须 |
| W3 / P1 站点规则与旧格式 | A 站配置不串到 B，升级后名单继续生效 | 中/中 | W2 统一写入口 | F03/F04/F05、双站异配置、旧字符串、排除优先 | 必须 |
| W4 / P1 复制/粘贴独立开关 | UI 与实际页一致，关闭有真实效果 | 中/中高 | W3 有效状态裁决 | F11、四种开关组合、真实正负对照、注入启停 | 必须 |
| W5 / P0 可核验构建与 Gate | 不把模拟测试、旧 dist 当成功 | 中/低 | W1–W4 完成 | 真实检查退出码、锁版本、source/build/ZIP 哈希 | 必须 |
| W6 / P1 必要 UI/双语说明 | 状态失败可理解，避免误报成功 | 低/低 | W1–W4 | 保留今日 Popup 修复；编辑保存/失败提示双语测试 | 限必要变更 |
| W7 / P2 真正本站开关、快捷排除 | 降低遇到误伤时的操作成本 | 中/中 | 单独交互设计、W3 | 站点开关与全局关系测试 | 否 |
| W8 / P2 无消费设置、统计语义 | 消除“保存但不生效”和伪成功率 | 中/中 | 明确参数含义/产品决策 | 每个设置有行为测试或说明为未生效 | 独立后续；本版不新增承诺 |
| W9 / P2 iframe/Shadow/SPA/编辑器/ChromeOS | 扩大兼容性，减少页面副作用 | 高/中高 | W4 稳定 | 专项真实页面与平台矩阵 | 本版做必要回归，不承诺全面增强 |
| W10 / P2 商店中英素材/FAQ/网站 | 用户安装前理解能力和限制 | 中/低 | 最终行为冻结，公开内容审批 | 文案与实际截图、隐私一致性 | 仅必要更正草稿；不建新网站 |
| W11 / P3 增长、运营、商业化 | 判断长期投入方向 | 中/高不确定性 | 连续同口径数据 | 周趋势及人工反馈分类 | 否，不新增遥测/付费 |

### 6.1 运营数据与反馈

FA 本次给出的 2026-10-03 至 11-01 指标：安装 124、卸载 6、页面浏览 39、展示 93、周用户 8；增幅分别按原请求保留为安装 +100%、浏览 +143.75%、展示 -8.82%、周用户 +511.11%。这是**用户提供的阶段性数据，本轮未独立核验后台/CSV**。旧优化文档另有 187 等数字，不与本次合并，也不据此推断用户矛盾；需核对区间和指标定义。

不能把 6/124 当真实卸载率，不能把 124 当独立或活跃用户，也不能从地区/语言推断增长渠道或长期留存。优先解决合规和可靠性，让这批安装有机会转为持续使用。中文/英文保持完整；罗马尼亚安装不直接支持新增罗马尼亚语投资。

保留当前用户主动打开的 GitHub issue 草稿和本地帮助。问题模板建议只含版本、用户主动选择的功能/浏览器、可选站点域名、复现步骤、期望/实际结果；明确提醒不要填写密码、私密页面正文、剪贴板内容或含 token 的 URL。不得自动附带完整网址或诊断包。产品网站、重新设计商店截图、商业化都另排，不阻塞核心整改。

## 7. P2：推荐版本与修改边界

### 7.1 版本决策

**规划名：EasyCV 1.1.3 可靠性与合规修复；版本锁定状态：NOT_RUN / 待后台核实。** 选择跳过当前开发沿用的 1.1.2，是为避免将已有候选、可能已存在的草稿和新修复混为一个对象，并非声称商店已发布 1.1.2。

按上一轮已查阅的 [Chrome version 规则](https://developer.chrome.com/docs/extensions/reference/manifest/version)，版本允许 1–4 段 0–65535 整数，缺段按 0 比较，不能全 0；`1.1.1` 与 `1.1.1.0` 比较相等，`1.1.3` 大于它们及 `1.1.2`。最终决策规则：

1. 读取原商品已发布版本、当前草稿/待审版本及包身份，禁止取消或覆盖未知草稿。
2. 若不存在冲突且最高需要避让的版本不高于 1.1.2，使用 1.1.3；若已有相同/更高版本，重新确定严格递增版本并更新方案。
3. manifest、package、lock 顶层/根包、build-info、发布说明统一；不伪造旧版本号，不修改商品 ID、key、update_url 或渠道。
4. 采用“提交审核、审核通过后手动发布”的流程建议；正式发布和渠道变更不在当前授权内，若后台操作会导致自动发布，须先明确处理。

### 7.2 拟修改文件

下表是审核后的预计白名单，不是本轮改动清单。实现中发现必须扩大范围时，应说明原因后重新审阅。

| 文件/目录 | 拟改内容 |
| --- | --- |
| `manifest.json`、`package.json`、`package-lock.json` | 核实后升版本；保留 storage/contextMenus；验证后缩减 WAR；不扩大 host 权限 |
| `background/service-worker.js` | 状态读取异常不伪成功；域配置裁决；删除事件缺省化；统一可串行的扩展侧设置变更入口；诊断最小化/local |
| `background/auto-enable-manager.js` | 统一域匹配，移除自动访问写全局默认的副作用；规范化旧名单；通知有效状态 |
| `utils/storage-utils.js` | 读写来源契约、旧格式规范化、按字段合并、导入验证复用；未知字段与历史 local 备份保留；统计/交互数据改为明确 local 路径 |
| `utils/dom-utils.js` | 修正无 oncontextmenu 处理器却被判受限的条件；不把检测到限制视为解锁成功 |
| `utils/message-utils.js` | 仅在现有协议不足时新增明确的设置变更消息/错误结果；同步校验白名单，避免再发生类型断链 |
| `content/content.js`、`content/injector.js` | 异常休眠与重查；传递/应用 copy/paste 有效开关；关闭恢复、不重复包装；不重写全部注入架构 |
| `options/options.js`，必要的 HTML/CSS | 名单编辑草稿、保存后替换、一次绑定事件、安全渲染、整体导入校验、保存错误不误报成功 |
| `popup/popup.js`、中英 locale | 保留当前优化；仅补充异常/保存错误/有效状态提示，必要时调整标签 |
| `scripts/deploy.js`、`scripts/bump-version.js`、`scripts/package.js` | 真检查/失败退出、lock 同步、独立输出/拒绝同名覆盖、候选标识。不得以 deploy 命令名自动触发外部发布 |
| `test/unit/`、受控 fixtures、现有 regression 脚本、ZIP 验证器 | 将调查探针转为需求回归；更新包校验以显式参数接受候选/基线，不放松白名单 |
| `CHANGELOG.md`、`PRIVACY.md`、测试/用户手册/发布清单 | 仅与最终行为对应的必要说明；公开政策/商店同步为单独外部审核步骤 |

### 7.3 配置与规则契约

- **保留既有键名和默认值，不引入全量 schema 重建。** 独立 plugin_enabled/force_mode 为权威，user_settings 内旧同名值不能覆盖它们；不清空未知用户字段。
- **规则顺序：** 不支持页面/状态不可确认先不操作 → 排除域休眠 → 全局总开关关闭则休眠 → 匹配本站自动配置 → 使用全局 copy/paste 默认。强力模式只能加强已允许的能力，不能跨越排除或总关闭。
- 自动名单仍不是“只允许名单网站”的白名单。精确域优先于通配；通配必须有点边界，`*.example.com` 拟仅匹配其子域，不匹配 `example.com` 或 `notexample.com`；需要根域时添加精确规则。该通配语义需在审核中明确接受，并在迁移测试中覆盖。
- 旧字符串数组在读取时规范化为双开对象，保持原值可恢复；对象数组保持各站配置、顺序和未知字段。空名单和缺失名单区别保留。混合/异常输入必须给出明确校验结果，不能一项异常导致全站默认开启。
- **存储策略建议：** sync 继续保存既有用户设置/名单；扩展内写入通过统一入口串行合并。sync 写失败应向 UI 返回失败并保持已确认状态，不再把 local 回退当已同步成功。既有 local 回退数据保留；sync 缺值或不可用时检测它，有冲突则提供导出/用户选择恢复，不能静默覆盖 sync 或删 local。此为修复不可靠降级的明确行为变更。
- 缺键、清空数据、跨区域 onChanged 和 worker 冷启动必须使用同一规范化逻辑。跨设备 sync 冲突仍是平台边界，本版不承诺数据库式事务或任意离线合并。
- Options 编辑仅改变草稿，保存成功后替换规则；取消、窗口关闭、验证错误或写失败均保留原规则。两页并发名单修改要从最新状态执行操作，不能保存启动时整份快照。
- 导入先解析/校验所有字段，再一次提交允许的数据：数组类型、域名/通配、布尔值、数字范围、文件大小、重复项；全部失败零写入。旧文件无 excludedList 时保留现有排除名单。使用文本/属性安全赋值避免导入内容形成 HTML。
- 诊断仅保存错误码/模块/时间/扩展版本等必要信息到 local，默认不记录 URL、正文、剪贴板、sender 全对象或浏览器明细。旧 sync 诊断建议升级时脱敏迁到 local，验证写入成功后移除原诊断键；设置/名单不受影响。这一诊断清理及披露修改应随方案审核明确确认，不能先执行。
- **统计隐私的必要调整：** 停止默认按访问域累积 sitesUnlocked，以及自动记录域名访问时间；保留无域名的本地激活计数，并尊重 enableStatistics=false。历史 statistics/interaction_history 建议先完整迁到 local 备份、验证成功后移除 sync 副本，不删除用户手工站点规则。UI 改用真实的激活次数，不能再称这些记录为成功解锁/准确唯一站点数。若以后需要新的域名明细统计，单独设计用户主动开启及保留期限。本版不新增该采集。这一行为收缩基于 F12 及隐私最小化需求，须随方案明确审核。
- 本地导出使用用户可理解且版本化的配置格式，导出前读取最新设置；恢复不依赖复制浏览器 Profile 或修改扩展身份。

### 7.4 UI 范围

保留今日新增的真实状态、部分开启、断连、不支持、排除说明和本地中英文帮助。界面文案只称“已开启/已关闭/未确认”，实际成功以回到页面操作验证；不把消息成功或点击次数称为复制成功率。名单编辑显示保存/取消，保存失败保留草稿及原规则。全局操作继续标明影响范围，站点规则显示它覆盖哪两项。

不新增 Side Panel、独立站点总开关、账户、遥测、云后台、商业化或整站 UI 重构。不为实现全面复杂网站支持重写事件系统；只补齐当前开关契约和必要兼容回归。

## 8. P2：测试与验收计划

所有后续浏览器测试均等 FA 审核后、允许浏览器操作时执行；本轮状态为 NOT_RUN。每份结果记录 commit、浏览器/系统/架构、ZIP 完整路径与 SHA256、安装身份、操作步骤、预期/实际、失败轮次、清理结果。不得把源码测试、HTML 页 Popup 或另一机器旧包的结果当作最终 ZIP 验收。

| 测试层 | 必测内容 | 通过条件 |
| --- | --- | --- |
| 单元/契约 | 现有 77 项；F01–F12 的反向回归；诊断脱敏、统计关闭/无域名采集、导入验证、域规则、并发、clear、状态错误 | 已修问题有行为断言；保留原功能回归。探针旧版失败证据不得改写 |
| 构建/包 | fresh checkout/隔离目录、真实 tests/lint/docs、入口资源、manifest 版本/权限、lock、ZIP 白名单/CRC/重复/路径 | 失败退出非 0；最终 source→build→ZIP 逐文件相等；文件清单与 hash 固定；无 profile/密钥/证据/测试混入 |
| 四种开关组合 | 双开、仅复制、仅粘贴、双关；开→关→开、强力开关、刷新及已打开页 | 每个组合都有受限页面负对照和真实成功正对照，验证关闭的功能不会被 injector 继续解锁 |
| 基础操作 | Ctrl+C/V、拖选、原生右键；textarea/input/contenteditable/富文本 | 精确落地文本与 trusted 输入证据；不靠合成 paste 或 storage 值判断成功 |
| 网站/多标签 | A/B 站不同配置、名单外站、排除交集、精确/通配/大小写、首访、名单增删改 | A 站不改全局/B 站；排除与总关闭优先；取消编辑不删除 |
| 设置异常 | sync 写失败/读失败/配额、两页并发、旧 local 冲突、clear、worker 冷启动、导入坏文件/中断 | 不假成功、不丢旧值、不因异常唤醒排除页；恢复后读写一致 |
| Popup/Options | 实际工具栏 action Popup、受限页、内部页、断连、帮助、反馈草稿，中英两种语言 | 状态与页面一致；无横向溢出；不会自动外带网址或提交 issue |
| Windows Chrome | 当前可用稳定版，x64 必测；ARM64 可复用环境另测 | 最终 ZIP 全部 P0/P1；100%/125%/150% DPI 或清楚记录无法提供的档位 |
| Windows Edge | 当前稳定版 smoke 与关键配置/菜单/重启 | 三个菜单操作、原生 Popup、基础输入、异常保护均有证据 |
| macOS/ChromeOS | 条件允许时 Chrome macOS；ChromeOS 因运营记录列专项 | 无环境则 NOT_RUN，不伪造三平台 PASS；是否为发布必需项由审核明确 |
| 动态/SPA/frames/Shadow | DOM 增量、pushState 无 DOM 变化、同/跨源 frame、sandbox/about:blank、open/closed root、严格 CSP | 记录支持/失败/不支持边界；不发生页面崩溃或误伤关键输入 |
| 普通重启/禁用再启用 | 正常已安装隔离 Profile，浏览器关闭确认进程结束再打开；扩展 disable→enable | 五类配置及未知字段保留、UI 和页面同状态；不重复 load-extension 触发 install |
| 真实升级 | 来源及身份可验证的当前商店旧包→最终同 ID 新包→正常重启 | 同 ID/正常更新；配置、名单、开关、权限与输入保留；不能用复制存储或模拟 onInstalled 替代 |
| 升级失败恢复 | 候选不可用/更新未应用、旧版继续运行、恢复配置流程 | 不卸载用户扩展、不清空数据；记录真实恢复路径与版本 |

原商店 ID 为 `bnbmgiidicjdbnmkmdnjeelhijnlhnjb`。历史旧安装已经留有非默认配置，应在可用且授权的原环境继续，不从私人 Profile 任意提取文件。真实旧版本来源、签名和候选 ID 均需重新确认；若待核实的线上版本已变化，应以实际现有版本作为直接升级起点，同时保留 1.1.1 的兼容测试。

### 8.1 必须显式解决的升级门禁依赖

原任务要求“真实同 ID 升级”以及“全部发布 Gate 通过后提交”。当前未建立可在送审前取得正式同 ID 新包的受支持路径；更改开发 key、搬运配置、开发重载均不能补足。

**本方案不默许把该 Gate 移到发布后，也不自行豁免。** 优先调查是否有已授权且受支持的同 ID 测试更新路径；若只能商店获批并正式分发后才能取得新包，流程存在依赖冲突，必须另交 FA 审核是否将“送审前的兼容证据”和“分发后的真实升级证据”分阶段处理。FA 未明确调整前，提交决策继续 BLOCKED。不存在通过修改发布渠道来自动绕过此门禁的授权。

## 9. P2：发布检查表、风险与回滚

### 9.1 提交前检查表（全部尚未执行完成）

- [ ] FA 审核本方案、范围、存储失败行为、通配语义及诊断/统计迁移与采集收缩。
- [ ] 核实原商品当前线上版本、草稿/待审版本、警告原文、精确期限、有无其他反馈。
- [ ] 锁定唯一 commit/版本/ZIP 路径/SHA256；与最终受测目录完全相同；不取默认旧 dist、quick 包或旧 1.1.2 包。
- [ ] W1–W6 完成；P0/P1 缺陷关闭或由 FA 明确逐项处置，不自动把新缺陷移为发布后。
- [ ] 单元、语法、文档、权限/API、依赖审计、包检查通过；无模拟测试充当证据。
- [ ] 当前最终 ZIP 的 Windows Chrome/Edge、原生 UI、菜单、多标签、保存/重启 Gate 通过；其他平台边界如实列出。
- [ ] 真实同 ID 升级 Gate 有证据，或 FA 已单独批准并记录分阶段门禁；不以方案一般批准推定豁免。
- [ ] 商店单一用途/权限理由/用户数据披露/隐私政策公开 URL 与包一致；所需文字更正先形成草稿再审核，不擅自发布。
- [ ] 商店描述/中英截图准确，不宣称“所有网站成功”“实时统计复制成功”或已有 Side Panel；必要修改按外部内容授权执行。
- [ ] 上传后核对解析出的版本/权限/商品 ID，再核对提交行为不会自动公开发布或改变原渠道。
- [ ] 只有 Gate 满足且权限有效才提交审核，保存时间/版本/后台回执；审核中不称获批，获批也不称警告已解除。

提交审核与正式发布分开。按照已查阅的官方更新流程，送审本身不更新现有用户，支持审核后手动发布；受警告版本的后续正式发布另有全量覆盖要求。具体后台选项与政策应在执行当天复核，不能借“手动发布”认为已解决警告期限问题。[官方更新流程](https://developer.chrome.com/docs/webstore/update)

### 9.2 风险与回滚

| 风险 | 控制措施 | 回滚/恢复 |
| --- | --- | --- |
| 子开关/事件修复影响编辑器 | W4 必须有关闭负对照、富文本、Ctrl/Meta 与拖选测试；限定修改面 | 本地按提交/文件审阅撤回，重跑对应回归；用户可排除站点或关闭强力 |
| 规则修复改变此前串站行为 | 固定优先级，解释本站与全局，双站测试 | 保留原配置和导出；恢复逻辑不改商品 ID、不清空名单 |
| sync/导入重构丢配置 | 验证前不写、局部字段合并、备份/冲突可见；不自动删 local | 恢复受控导出；写入失败保持旧配置；跨设备冲突不承诺自动解决 |
| 诊断迁移有隐私与不可逆字段去除 | 方案审核明确授权；最小字段、先 local 写入验证再清理诊断旧键 | 不恢复敏感完整 URL 来“回滚隐私修复”；配置与功能恢复应独立 |
| 误用旧包/覆盖证据 | 新独立输出目录、版本与哈希锁定，禁止同名覆盖 | 旧 ZIP/旧证据原样保留，重新选择经验证的候选 |
| 官方期限/审核被拒 | 先核实截止，及早准备，不扩大到增长功能 | 根据实际拒审原因修正再审；不把提交或上传当警告解除 |
| 线上回退 | 默认不回退到带未用权限的旧 1.1.1 | 正式发布后如需恢复，优先更高版本修复或审查平台可用回滚；需单独授权，不能上传更低版本假装正常升级 |

本轮文档/证据回滚只涉及新增 `docs/planning/EASYCV-NEXT-VERSION-PLAN.md`、`docs/evidence/p0-p2-review-20261103/` 以及隔离构建输出；不使用 reset/clean，不删除既有未提交工作。产品文件无需回滚，因为本轮没有修改。

## 10. 阶段完成与待审核事项

| 阶段 | 结果 | 边界 |
| --- | --- | --- |
| P0 本地调查 | **PASS（本地范围）/整体 PARTIAL** | 代码、历史、12 项探针、77 项单测、构建/包关系已核验；后台及当前浏览器验证待核实 |
| P1 产品分析 | **PASS（方案交付）** | 优先级、价值/复杂度/风险/依赖/验证与纳入范围已列出，不是功能已实现 |
| P2 升级方案 | **PASS（方案交付）** | 暂定 1.1.3，最终版本未锁定；数据、UI、测试、风险与回滚可审阅 |
| P3 实施 | **NOT_RUN** | 等待 FA 审核 |
| P4 最终发布验收 | **NOT_RUN** | 当前源码及历史证据不足以放行最终候选 |
| P5 上传/提交审核 | **NOT_RUN** | 当前决策 BLOCKED，未操作后台 |

请 FA 审核的具体内容：W0–W6 的必要修复范围；暂定 1.1.3 的版本分支条件；sync 写失败明确报错及旧 local 恢复策略；通配域边界；诊断/统计迁移及停止默认域名采集。真实升级若只能在分发后完成，需要另作明确门禁决定，本方案没有代替该决定。

本轮原有 619 个文件哈希复核均未变化，HEAD、暂存区和已跟踪工作区保持原状，见 [保全结果](../evidence/p0-p2-review-20261103/preservation.json)。[文档检查](../evidence/p0-p2-review-20261103/docs-final.txt)与[本方案本地链接检查](../evidence/p0-p2-review-20261103/report-links.json)通过。

本轮结束在方案审核点。后续实施、浏览器操作、商店资料更改及上传送审均未开始；Git commit/push 也未执行。
