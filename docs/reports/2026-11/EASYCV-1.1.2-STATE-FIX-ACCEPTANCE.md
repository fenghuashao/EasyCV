# EasyCV 1.1.2 状态修复与验收

> 归档说明（2026-11-09）：下文部分 ZIP、发布说明与 CRX 是当时的本地产物，未随公开仓库收录。对应原始路径以代码形式保留；包身份、哈希和历史结论仍以本报告记录为准。

日期：2026-11-03，Asia/Shanghai。基线：`master / 2e93f89`，开始时工作区干净。

**三项指定缺陷已修复，并通过本地及 Windows Chrome/Edge 针对性验收。可以进入商店送审准备；尚未提交、审核或正式发布。** 原商店同 ID 的 1.1.1 → 1.1.2 升级仍未发生，不能以开发扩展重新加载或一般浏览器重启替代。

本报告描述新包。[旧 Windows 验收](EASYCV-1.1.2-WINDOWS-ACCEPTANCE.md)、[权限整改](EASYCV-1.1.2-PERMISSION-FIX.md)、[Popup 调查](EASYCV-1.1.2-POPUP-PASTE-TRIAGE.md)与原始失败证据保持不变。机器可读结果见 [acceptance.json](../../evidence/1.1.2/state-fix-20261103/acceptance.json)。

## 修复内容

| 问题 | 原因 | 修改及实际结果 |
| --- | --- | --- |
| Popup 开启后当前页仍不能粘贴，多标签不同步 | 消息名称大小写/类型不一致；内容端未消费 user_settings；广播缓存对象不等于页面状态 | 使用共享消息常量，状态通知入队后重读带域名的 GET_STATUS；两张已有页面无需刷新解锁 |
| 强力模式刷新后显示关闭；无关设置可能覆盖实际值 | 旧 user_settings.forceMode 覆盖独立 force_mode；设置页保存整份旧快照 | 独立键优先；只保存本次编辑字段。刷新、其他选项保存和浏览器重启均保持正确 |
| 自动名单首次访问不能立即解锁 | 自动启用发送的旧格式消息不被接收；名单命中/未命中缓存未失效 | 使用有效状态通知，名单变更清缓存；首访真实粘贴通过，添加已访问域名后的下一次访问生效 |
| 关联的关闭态残留 | 子开关都关闭仍启动注入器；恢复处理器写成 element[event]；内联属性丢失；恢复时观察器再次清理 | 双关闭不注入；保存属性及原始样式，等待 main world 停止后恢复 on*；开→关→开及两个标签实际验证通过 |
| 排除页可能被全局通知唤醒 | 直接把 plugin_enabled 当作本站 enabled | 所有相关通知重读本站裁决，延迟元素处理也检查启用态；排除优先级验证通过 |

产品改动限定于 `background/auto-enable-manager.js`、`content/content.js`、`content/injector.js`、`options/options.js`、`utils/storage-utils.js`。未改变 manifest、权限、版本、存储键或原商店身份；旧嵌套 forceMode 值无需迁移，读者以独立键为准。未进行无关重构或全局配置变更。

## 唯一新候选包

- `releases/state-fix-20261103/EasyCV-v1.1.2-20261102.zip`
- 完整相对路径：`releases/state-fix-20261103/EasyCV-v1.1.2-20261102.zip`
- SHA256：`b0613dd4140dd599710c42c2ddd0e3b8fb1af8b77405cb628255482c06af396a`
- 133088 字节，38 个文件；文件名日期来自打包脚本 UTC，验收日期为北京时间 11 月 3 日。
- 权限：`storage`、`contextMenus`；`<all_urls>` 网站范围保留，无 scripting/activeTab 或 optional 权限。

[包校验](../../evidence/1.1.2/state-fix-20261103/package-final.json)核对 CRC、精确文件白名单、重复项、版本、权限说明、源码/dist/ZIP 逐字节一致性与仅五个运行文件加 build-info 变化。[Windows 内容核验](../../evidence/1.1.2/state-fix-20261103/windows-package-check.json)再次核对实际测试目录全部 38 文件。

旧锁定包 `releases/permission-recheck-20261101/EasyCV-v1.1.2-20261031.zip` 的 SHA256 仍为 `6a2f2478e847ff06d6b7a35dbe01b543d2cd00ab52df7f96d2763d758e77782a`。旧 Windows 开发源目录已备份到本轮测试目录，全部 38 文件与旧 ZIP 相等。原商店 1.1.1 Profile 未访问、重装或修改。

## 测试结果

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 新增首轮单测对旧代码 | 7 项均失败，确实复现问题 | [unit-before](../../evidence/1.1.2/state-fix-20261103/unit-before.txt) |
| 最终单元测试 | 57/57 PASS | [unit-final](../../evidence/1.1.2/state-fix-20261103/unit-final.txt) |
| 语法检查 | 46 文件 PASS | [lint-final](../../evidence/1.1.2/state-fix-20261103/lint-final.txt) |
| 文档、差异与最终包复查 | docs:check、git diff --check、38 文件包校验均 PASS | [最终检查](../../evidence/1.1.2/state-fix-20261103/final-checks.json) |
| 原有 E2E | 15/15 PASS，含动态内容、Shadow DOM、SPA、Popup/Options | [e2e-final](../../evidence/1.1.2/state-fix-20261103/e2e-final.txt) |
| 同一专项浏览器测试的旧包/新包对照 | 旧包 2/10，新包 10/10 | [旧包](../../evidence/1.1.2/state-fix-20261103/browser-baseline.json)、[新包](../../evidence/1.1.2/state-fix-20261103/browser-final.json) |
| Windows Chrome 指定缺陷复验 | PASS | [原生 Popup 与多标签](../../evidence/1.1.2/state-fix-20261103/chrome-native-main-r3.json)、[自动/排除](../../evidence/1.1.2/state-fix-20261103/chrome-native-auto.json)、[设置输入复验](../../evidence/1.1.2/state-fix-20261103/chrome-native-prepare.json)、[真实复制/拖选](../../evidence/1.1.2/state-fix-20261103/chrome-native-copy-r2.json) |
| Windows Edge 指定缺陷复验 | PASS | [原生 Popup 与多标签](../../evidence/1.1.2/state-fix-20261103/edge-native-main.json)、[自动/排除](../../evidence/1.1.2/state-fix-20261103/edge-native-auto.json)、[真实复制/拖选](../../evidence/1.1.2/state-fix-20261103/edge-native-copy.json) |
| 两浏览器正常重启 | PASS，五类存储键前后完全相等，UI 与实际页面通过 | [精确数据比较](../../evidence/1.1.2/state-fix-20261103/restart-comparison.json)、[Chrome 页面](../../evidence/1.1.2/state-fix-20261103/chrome-native-restart.json)、[Edge 页面](../../evidence/1.1.2/state-fix-20261103/edge-native-restart.json) |

macOS 自动化使用 Chrome for Testing 151.0.7922.34 / Playwright 1.62.1，临时独立 Profile。专项测试直接加载新 ZIP 的原样解压目录；Popup HTML 用于逻辑测试，不称原生工具栏测试。

Windows 为 Windows 11 Pro 10.0.26100 ARM64，Chrome 156.0.8078.80、Edge 156.0.4314.58，实际 PE 架构均为 `0xAA64`。复用前轮两个独立开发测试 Profile，新代码开发重新加载；没有接触个人 Profile。实际 action Popup 经 chrome.action.openPopup 打开，核对 `POPUP / tabId=-1`，用 trusted CDP 鼠标操作。页面使用真实 Ctrl+C/V 与鼠标拖选；粘贴要求 plain 正对照、精确文本和 trusted 事件，覆盖 textarea/input 内联 return false、document paste listener、Ctrl+V keydown 四类限制。没有用模拟 paste 或存储值替代页面结果。

正常重启采用 Browser.close，核对对应 Profile 进程归零，再以原 user-data-dir 启动；不传 load-extension、不重装、不搬运存储。比较 plugin_enabled、force_mode、user_settings、auto_enable_list、excluded_list 全部内容，保留非默认 1900ms、Chrome/Edge 各自重试参数及名单。

## 失败轮次与验证边界

所有中间失败保留：第一轮专项浏览器暴露双关闭仍部分解锁；第二轮暴露恢复内联属性的问题；修复后新包 10/10。Windows 的 Popup 重开时机、测试服务未可用、数字输入未滚入视口、鼠标拖选起点位于文本外均作为工具/前置条件问题记录，经后续有效实测闭环。Chrome 自动/排除页五项已通过，其末项数字输入失败由独立 prepare 复验修正，未把整份原始失败 JSON 改为 PASS。

[旧权限专项脚本首轮](../../evidence/1.1.2/state-fix-20261103/permission-round1.json)为 20/21；唯一失败是其重新以 load-extension 启动触发 `onInstalled.reason=install` 并初始化设置。该轮不是正常已安装浏览器重启，不用于判断持久化，也不改产品安装逻辑刷绿。正常重启结论来自上述 Windows 原安装、无加载参数的实际过程。

本轮未复测 Windows x64、所有原生网页右键菜单项、物理键鼠体验、广泛公开网站或完整跨源 iframe 兼容性。不得把局部修复验收外推为这些项目全部通过。

**原商店同 ID 升级保持 NOT_VERIFIED。** 当前开发 ID 与商店 ID 不同；重新加载开发源是测试新代码，不是升级验收。待原商品获得可分发的新版本后，用保留的商店 1.1.1 Profile 正常更新，核对完整设置、名单、页面与再重启。不得卸载重装、改 ID、搬运存储或模拟 update 事件。

## 送审准备与判定

`REQUESTED_DEFECTS=PASS`，`LOCAL_ACCEPTANCE=PASS`，`STORE_REVIEW_PREPARATION=READY`。这表示指定故障及本轮回归已通过，可准备提交审核；不表示商店更新完成、完整发布 Gate 全绿或 Google 已解除 Purple Potassium 警告。

提交时使用本报告的新 ZIP，并同步后台权限理由：storage 保存用户设置、名单及统计；contextMenus 提供三个右键动作；网站访问用于普通网页静态解锁、自动启用与 URL 判断。移除旧 scripting/activeTab 理由，核对公开隐私政策与后台声明一致。

建议版本说明：

> 移除未使用的扩展权限。修复解锁开关与已有页面同步、自动启用名单首次访问，以及强力模式设置保存和显示问题。

可选择审核通过后手动发布；Google 的审核、警告解除及正式分发结果仍以商店后台实际状态为准。原商品升级验证在具备正常分发目标后继续。当前没有对外上传、提交或发布操作。

## 复查与回滚

`npm test`、`npm run lint`、`npm run docs:check`。浏览器环境变量沿用[既有环境记录](../../evidence/1.1.2/recheck-20261101/environment.json)，启动 `node test/static-server.mjs 18963` 后，将 TEST_ORIGIN 设为 `http://easycv.localhost:18963`、EASYCV_EXT_PATH 设为本报告新 ZIP 的解压目录，执行 `node test/state-sync-regression.mjs`。[命令退出码](../../evidence/1.1.2/state-fix-20261103/checks.json)保留对照失败。

只读包检查：`python3 test/verify-state-fix-package.py releases/state-fix-20261103/EasyCV-v1.1.2-20261102.zip releases/permission-recheck-20261101/EasyCV-v1.1.2-20261031.zip OUTPUT_JSON`。验证前不要重建 dist，避免 build-info 时间戳改变；重新打包必须重新锁定哈希与证据。

回滚以开始时的 `2e93f89` 为基线，逐文件审阅并恢复本轮五个运行文件、关联测试/文档；保留旧 ZIP 及证据。Windows 开发源可从本轮 candidate-before 备份恢复并重新加载，仅用于隔离测试。不要 reset/clean 或覆盖后续其他工作。原商店安装与 Profile 留待升级复验。

收尾已完成：两个独立 Windows 测试浏览器正常关闭，进程归零；Windows 与 macOS 本轮临时 HTTP 服务已停止，18963 端口无监听。测试 Profile、候选目录、旧包及原始证据保留，虚拟机保持原有运行状态。见 [Chrome](../../evidence/1.1.2/state-fix-20261103/chrome-final-close.json)、[Edge](../../evidence/1.1.2/state-fix-20261103/edge-final-close.json)、[Windows 服务](../../evidence/1.1.2/state-fix-20261103/windows-final-cleanup.json)、[主机服务](../../evidence/1.1.2/state-fix-20261103/host-final-cleanup.json)。

验收完成时、Git 提交前的状态快照（与 acceptance.json 一致）：

`COMMIT_CREATED=NO` · `PUSH_PERFORMED=NO` · `STORE_SUBMISSION=NOT_RUN` · `GOOGLE_WARNING_CLEARED=NOT_VERIFIED`

后续 Git 交付状态以仓库日志为准；Git 提交不代表商店提交、审核通过或正式发布。
