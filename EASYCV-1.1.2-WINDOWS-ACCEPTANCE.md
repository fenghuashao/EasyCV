# EasyCV 1.1.2 — Windows 发布前验收

日期：2026-11-02，Asia/Shanghai（接续 11 月 1 日环境准备）。**RELEASE_DECISION = BLOCKED**。

本文和原始证据中的提交边界标志记录验收收口时状态；FA 后续授权的本地 Git 提交范围见[提交说明](docs/evidence/1.1.2/commit-20261102/commit-scope.md)。历史快照不回写，提交不改变发布 Gate。

真实 Windows 虚拟机中的安装、真实复制/粘贴/拖选、原生 Popup/右键及一般浏览器重启已执行。原商店 1.1.1 安装和非默认数据已保留，但没有建立可信的同 ID 1.1.2 更新目标，升级及升级后重启仍未核验。另有两项本轮新登记的既存问题：设置页强制模式回读错误、自动名单首访未即时解锁；均在原商店 1.1.1 的 Windows Chrome 对照中复现，不能认定为 1.1.2 新增回归，也不能自动套用 Popup 历史缺陷的放行例外。

## 基线与安全

已读取[发布收口](EASYCV-1.1.2-RELEASE-CLOSEOUT.md)、[Popup 历史调查](EASYCV-1.1.2-POPUP-PASTE-TRIAGE.md)、[权限整改](EASYCV-1.1.2-PERMISSION-FIX.md)、[docs Gate 修复](EASYCV-1.1.2-DOCS-GATE-FIX.md)、[测试计划](docs/测试计划.md)、[测试用例](docs/测试用例.md)及[功能验证指南](docs/功能验证指南.md)。沿用已通过的权限、打包及 docs 基线，不重建或重打候选包。

| 项目 | 核对结果 |
| --- | --- |
| Git 基线 | `master`，`bbd6300ecd7f3a23dd1f3a9ca2f74e517ffa1d09`；既有未提交工作完整保留 |
| 唯一锁定候选 | `releases/permission-recheck-20261101/EasyCV-v1.1.2-20261031.zip`；不使用 releases 根目录的旧同名包 |
| 大小 / 内容 | 132475 字节、38 文件、manifest 1.1.2；CRC、唯一条目、逐文件核对通过 |
| SHA256 | `6a2f2478e847ff06d6b7a35dbe01b543d2cd00ab52df7f96d2763d758e77782a` |
| Windows 候选 | ZIP 副本同哈希；原样解压 38 文件与锁定 ZIP 逐字节一致，未改 manifest/key/ID |
| 保全 | 11 月 1 日 427 文件原始快照；11 月 2 日 440 文件续测快照。最终仅更新本轮自有报告，原报告草稿另存证据目录；[最终保全记录](docs/evidence/1.1.2/windows-acceptance-20261102/final-preservation.json) |

## 环境与方法

宿主 macOS / Darwin 24.6.0 arm64，Parallels Desktop 20.3.1；来宾 **Windows 11 Pro 10.0.26100 ARM64**。Chrome **156.0.8078.80**，Edge **156.0.4314.58**，两浏览器实际可执行文件均为 ARM64（PE `0xAA64`），没有按 UA 或安装目录推断架构。[系统记录](docs/evidence/1.1.2/windows-acceptance-20261102/windows-environment.json)、[浏览器架构](docs/evidence/1.1.2/windows-acceptance-20261102/native-browser-architectures.json)。本结论不覆盖 Windows x64、最低浏览器版本或广泛公开站点兼容性。

此前损坏 VM 的删除和 Windows 重装由 FA 完成；FX 未修复/重配 VM 或改变共享、安全、企业策略。Chrome 旧 EXE 安装器的 `INVALID_OPTION` 失败已保留，随后改用 Google 官方签名有效的 ARM64 MSI，由 FA 完成交互安装，当前已正常运行。

测试根目录为 `C:\Users\fengshaohua\AppData\Local\EasyCV-Acceptance-20261102-r3`：

| 独立 Profile | 用途 / 实际扩展身份 |
| --- | --- |
| `chrome-profile` | Chrome 候选 1.1.2，开发安装 ID `dgckfbbdhlgcjhaihmpdnnhnfpfeaono` |
| `edge-profile` | Edge 候选 1.1.2，同一原样候选路径产生的开发 ID |
| `chrome-store-profile` | 正常商店安装 1.1.1，原 ID `bnbmgiidicjdbnmkmdnjeelhijnlhnjb`，`FROM_STORE / ENABLED` |

均使用专用 `user-data-dir`，不登录/启用账号同步，不读取或修改个人浏览器配置、cookie、私人页面或未知剪贴板内容。HTTP fixture 只监听 `127.0.0.1:18951`，使用既有机制页和复制/选择限制页；`*.localhost` 只用于本地测试域名，不改 hosts 或防火墙。

agent-browser 在真实 Windows 浏览器中执行鼠标拖选、Ctrl+C/Ctrl+V，并核对精确落地文本及 `isTrusted` / `defaultPrevented`；`fill` 仅用于准备已知文本。Popup 自动化操作真正 action Popup（`POPUP / tabId=-1`），不是普通标签页中的 popup.html。原生加载目录、工具栏 Popup 和菜单点击由 FA 协作，FX 观察界面并独立核对页面结果。[原生 UI 记录](docs/evidence/1.1.2/windows-acceptance-20261102/native-ui-observation.md)。

## Gate 判定

`FAIL` 表示相应预期行为未全部满足，不等同“新增回归”；历史归因与 Gate 是否全绿分开判定。

| Gate | 结果 | 判定依据 |
| --- | --- | --- |
| WINDOWS_CHROME_P0_GATE | **FAIL** | 基础解锁、原生入口、排除、一般重启通过；Popup/多标签即时同步、自动名单首访和强制模式 UI 回读未满足预期，均有旧版对照 |
| WINDOWS_EDGE_SMOKE_GATE | **FAIL** | 安装、真实复制粘贴、原生入口、基本数据重启保留通过；已知 Popup 场景与强制模式 UI 回读仍有失败，不能称全部设置正确 |
| NATIVE_UI_GATE | **PASS** | FA 协作实际打开两浏览器工具栏 Popup；Chrome 三个菜单动作和网页右键恢复完成，Edge 全局菜单关闭/恢复完成 |
| UPGRADE_111_TO_112_GATE | **NOT_VERIFIED** | 原商店 1.1.1 已安装并保留非默认数据；没有可信同 ID 1.1.2 更新目标，未执行升级 |
| BROWSER_RESTART_PERSISTENCE_GATE | **PARTIAL** | 两个 1.1.2 开发安装及原商店 1.1.1 的一般重启数据/页面通过；强制模式 UI 缺陷仍在，升级后的重启未执行 |
| SETTINGS_AND_SITE_LIST_GATE | **FAIL** | 非默认参数、子开关和两类名单保存/重启数据一致；强制模式独立键 true 但 Options 回读 false |
| KNOWN_POPUP_DEFECT_GATE | **PASS_WITH_KNOWN_DEFECT** | Windows Chrome 两版及 Edge 1.1.2 复现；真实刷新绕行有效。此项通过指复现/归因/绕行验证完成，不表示缺陷修复 |
| RELEASE_DECISION | **BLOCKED** | 同 ID 升级必要证据缺失，既存设置/状态传播问题也无本轮放行决定；不自动提交商店 |

## Windows 实测结果

| 场景 | Chrome 1.1.2 | Edge 1.1.2 | 关键证据 |
| --- | --- | --- | --- |
| 安装、启用、正常加载 | PASS | PASS | 原生开发安装、实际版本/ID、真实页面解锁；[Chrome](docs/evidence/1.1.2/windows-acceptance-20261102/chrome-candidate-manager-after-assist.json)、[Edge](docs/evidence/1.1.2/windows-acceptance-20261102/edge-install-identity.json) |
| 四类粘贴限制 | PASS | PASS | inline textarea/input、document paste listener、Ctrl+V keydown 限制均落入精确哨兵；[Chrome](docs/evidence/1.1.2/windows-acceptance-20261102/chrome-install-options-and-real-paste.json)、[Edge](docs/evidence/1.1.2/windows-acceptance-20261102/edge-real-paste-enabled.json) |
| 受限文本复制、拖选 | PASS | PASS | 真鼠标拖选 `EASYCV_PERMISSION_TEST_TEXT`，Ctrl+C 后实际粘入目标；[Chrome](docs/evidence/1.1.2/windows-acceptance-20261102/chrome-real-copy-select-r2.json)、[Edge](docs/evidence/1.1.2/windows-acceptance-20261102/edge-real-copy-select-enabled.json) |
| Popup 主按钮 | 历史失败已复现 | 同左 | 关闭后刷新可建立限制负对照；重新开启后当前页仍阻止粘贴，刷新恢复 |
| 强力模式 | 控件/菜单及模式下页面可用；不能补救历史场景 | Popup 状态切换和基础页面可用；强力菜单未单独通过 | Chrome 实际菜单开启后四类真实粘贴通过；[页面](docs/evidence/1.1.2/windows-acceptance-20261102/chrome-native-force-mode-real-page-final.json) |
| 自动名单首次访问 | FAIL，刷新可绕行 | 非 smoke 必测，未单独执行该首访条件 | [首访与旧版对照](docs/evidence/1.1.2/windows-acceptance-20261102/auto-enable-first-visit-observation.md) |
| 排除与优先级 | PASS | 基本排除 PASS | Chrome 同域位于两名单仍保留限制；删除排除项后四类解锁，重新加入后恢复限制；[闭环](docs/evidence/1.1.2/windows-acceptance-20261102/site-lists-and-native-context-summary.json) |
| 原生右键 | 三动作、网页菜单恢复 PASS | 全局关闭/恢复 PASS | 原生菜单真实点击后核对页面；未伪造 onClicked |
| 设置和名单保存/刷新 | 参数/名单 PASS；强制模式 UI FAIL | 同左 | Chrome 通知 false、1700ms/6；Edge 通知 false、1500ms/5；名单实际渲染，独立强制键与 UI 分裂 |
| 多标签即时同步 | FAIL，与历史传播缺陷一致 | 未扩展到完整 P0 | 两个已有页开启后均仍被阻止；各自刷新后恢复；[对照](docs/evidence/1.1.2/windows-acceptance-20261102/chrome-popup-functional-summary.json) |
| 正常退出/重启 | 数据/页面 PASS，UI 问题仍在 | 数据/页面 PASS | 关闭对应 Profile 进程归零，同路径无重新安装/加载恢复；五次 trusted 粘贴及复制/拖选有效；[对照](docs/evidence/1.1.2/windows-acceptance-20261102/restart-functional-comparison.json) |

原生焦点、隐藏控件等待、旧标签、选择器或脚本错误等工具失败原样保留，未计为产品失败。特别是零 paste 事件、plain 对照也为空的键盘轮次无效；最终有效结果均有正对照及精确文本，不以存储、Worker/injector 存在或命令退出 0 认定功能成功。

## 缺陷与归因

1. **`ECV-POST-112-01`，原报告 P2，既有 Popup/状态传播缺陷。** 关闭复制/粘贴并刷新 inline 受限页，再开启时实际粘贴仍被取消；强力模式不能补救，开启后刷新可恢复。Chrome 1.1.2 两个已有标签均复现；原商店 1.1.1 同条件 Windows Chrome 也复现，Edge 1.1.2 复现及刷新绕行通过。[旧版未刷新](docs/evidence/1.1.2/windows-acceptance-20261102/store111-popup-on-stale.json)、[旧版强力无补救](docs/evidence/1.1.2/windows-acceptance-20261102/store111-popup-force-stale.json)、[旧版绕行](docs/evidence/1.1.2/windows-acceptance-20261102/store111-popup-refresh-workaround.json)、[Edge 有效复测](docs/evidence/1.1.2/windows-acceptance-20261102/edge-popup-r4-refresh-workaround.json)。关闭方向残留解锁等其他历史变体不冒称本轮已完整重验。
2. **强制模式 Options 回读，暂按 P2，既存设置问题。** UI 开启后 `force_mode=true`、旧 `user_settings.forceMode=false`；刷新及 Chrome 重启后控件显示 false，实际独立键仍 true。Chrome/Edge 1.1.2、原商店 1.1.1 Windows Chrome 均实测。源码 `getPluginSettings` 的后展开旧对象覆盖独立字段与观察一致；下一次无关设置可能回写旧值属于源码推断，本轮未把该二次覆盖写成已发生。[步骤与证据](docs/evidence/1.1.2/windows-acceptance-20261102/settings-force-mode-observation.md)。
3. **自动名单首访，暂按 P2，既存传播问题。** 全局启用而复制/粘贴子开关关闭时，首访自动域名 plain 对照正常、受限输入仍被取消；1.1.2 延迟复测仍失败，刷新恢复。原商店 1.1.1 Windows Chrome 同样复现。相关源码与已签名旧包一致；传播链路解释为源码推断，真实页面结论独立成立。[详细对照](docs/evidence/1.1.2/windows-acceptance-20261102/auto-enable-first-visit-observation.md)。

本轮没有证据支持已覆盖场景中出现 1.1.2 新增 P0/P1 回归。上述两项新登记的既存问题不自动归入原 Popup 例外，仍须修复后复验或明确处置；本轮未改代码。

## 原商店身份、升级与保留数据

官方公开更新请求仍返回 1.1.1，137031 字节，SHA256 `71804c76f85b30fc3b78c16a631f72fbcaa5d983a71ba8aedd47372ab9472cef`；既有只读 CRX3 验签含原 ID 绑定 proof，本轮公开请求与已核验包逐字节一致。[请求记录](docs/evidence/1.1.2/windows-acceptance-20261102/store-current-check.json)。这仅代表该次匿名公开请求，不代表认证后台或所有地区。

随后在第三个隔离 Profile 从原 CWS 商品正常安装，实际核对 **`bnbmgiidicjdbnmkmdnjeelhijnlhnjb / 1.1.1 / FROM_STORE / ENABLED`**，更新源为官方地址；[安装身份](docs/evidence/1.1.2/windows-acceptance-20261102/store111-installed-identity-r2.json)。未使用改 key/ID 的开发安装充当商店身份。

| 保留的关键数据 | 原商店 1.1.1 升级前基线 |
| --- | --- |
| 全局 / 强力 | `plugin_enabled=true`；`force_mode=true`（Options 显示 false 为已复现缺陷） |
| 子开关 / 通知 | copy=false、paste=true、showNotifications=false |
| 检测参数 | detectionDelay=2100、maxRetries=7 |
| 自动名单 | `store-auto.localhost`、`blocked.localhost`，每项 copy/paste=true |
| 排除名单 | 原三条敏感域名 + `blocked.localhost` |

所有写入通过实际 UI 完成。正常关闭进程归零后，同一 Profile 重启仍为 **1.1.1**，关键数据逐项相等，真实粘贴通过，最后再次正常关闭并保留原安装及本地数据。[保留基线](docs/evidence/1.1.2/windows-acceptance-20261102/upgrade-baseline-summary.json)。**此过程没有发生升级，不能算 1.1.1 → 1.1.2 通过。**

安装目录与 CRX 的初次纯字节比较有六处差异：四张默认图标和两个语言 JSON。30 个其他运行资源逐字节一致；两份 JSON 对象等价，三张图标 RGBA 完全一致；128 图标仅 8 像素的 RGB 通道相差至多 1，alpha、全不透明像素及预乘 RGBA 均一致。该结果与 Chromium 的安装图像/消息清理机制一致，原因归类是推断，不是文件写入链路跟踪；没有将初次字节检查写成全等，也没有改写安装资源。[比较](docs/evidence/1.1.2/windows-acceptance-20261102/store111-install-asset-equivalence.json)、[128 图标分析](docs/evidence/1.1.2/windows-acceptance-20261102/store111-icon128-difference-analysis.json)、[Chromium 源码](https://chromium.googlesource.com/chromium/src/+/refs/tags/141.0.7390.34/extensions/browser/sandboxed_unpacker.cc)。候选 ZIP 及其 38 个原样解压文件则始终逐字节一致。

可信路径应是原商品正常更新，或另有经来源/签名核验且受支持的同 ID 更新渠道；当前没有建立这样的 1.1.2 目标。普通商店更新还需扩展进入 idle，打开的 Options/Popup 会延后应用；[官方生命周期](https://developer.chrome.com/docs/extensions/develop/concepts/extensions-update-lifecycle)。修改开发 key 只能稳定开发身份，不能代替原商店原位升级；自托管/企业部署也不能在缺少原身份签名包、受支持环境和授权时凭空成立。[官方安装限制](https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions)、[既有路径评估](docs/evidence/1.1.2/windows-acceptance-20261101/upgrade-path.json)。

**最小后续**：保留该 `chrome-store-profile`，在取得获授权、可正常分发且已核验的同 ID 1.1.2 后，用原安装执行正常更新；核对版本、上表完整数据、所有关键页面功能，再正常退出/重启复验。不要卸载重装、搬运存储、修改 ID、模拟 update/onInstalled 或用 runtime.reload 冒充升级。若只能在获批发布后取得目标，升级 Gate 继续保留，FX 不为验收自动提交/发布。[官方更新流程](https://developer.chrome.com/docs/webstore/update)。

## 交付边界

本轮只更新验收文档并新增测试证据/辅助脚本；未修改产品、构建产物、既有证据或锁定包。测试 Profile 与原商店安装保留，测试浏览器正常关闭，loopback fixture 停止；[收尾记录](docs/evidence/1.1.2/windows-acceptance-20261102/final-guest-cleanup-and-integrity-r2.json)。恢复测试可在原独立 Profile 继续，不要重装原商店扩展。

未覆盖项保持未验证：真实同 ID 升级和升级后重启、Windows x64、最低浏览器版本、广泛公开网站及完整 Edge P0。权限/打包 Gate 未重跑；文档交付检查与最终保全结果另存本次证据目录。回滚本轮交付只移走自有新增文档/证据，恢复报告草稿备份；不得 reset/clean 或覆盖既有未提交工作。

```ini
PRODUCT_RUNTIME_MODIFIED = NO
LOCKED_ZIP_CHANGED = NO
COMMIT_CREATED = NO
PUSH_PERFORMED = NO
STORE_SUBMISSION = NOT_RUN
```
