# EasyCV 1.1.2 最小合规发布收口

> 归档说明（2026-11-09）：下文部分 ZIP、发布说明与 CRX 是当时的本地产物，未随公开仓库收录。对应原始路径以代码形式保留；包身份、哈希和历史结论仍以本报告记录为准。

验收日期：2026-11-01（Asia/Shanghai）。本轮只新增本报告及 [收口证据](../../evidence/1.1.2/release-closeout-20261101)，不改产品代码、现有报告、历史证据或锁定发布包。

**RELEASE_DECISION = BLOCKED。** 权限整改、包完整性及已测范围内无新增退化有证据支持；阻塞来自尚未满足的必要验收条件，不能归咎于 Popup 历史缺陷，也不能自动豁免。当前不建议直接提交商店审核。

## 1. 发布包身份与完整性

| 项目 | 锁定身份 / 本轮复核 |
| --- | --- |
| 候选 ZIP | `releases/permission-recheck-20261101/EasyCV-v1.1.2-20261031.zip` |
| 大小 / 文件数 | 132475 字节 / 38 个文件 |
| SHA256 | `6a2f2478e847ff06d6b7a35dbe01b543d2cd00ab52df7f96d2763d758e77782a` |
| 仓库基线 | `bbd6300ecd7f3a23dd1f3a9ca2f74e517ffa1d09`，1.1.1 |
| 候选版本 | source、dist、ZIP manifest、package/lock 根版本及 build-info 均为 1.1.2 |
| 权限差异 | 仅删除 `scripting`、`activeTab`；保留 `storage`、`contextMenus`、`<all_urls>` |
| 内容差异 | manifest 仅版本及上述权限变化；36 个运行资源与基线逐字节相同；build-info 为候选构建信息 |

本轮执行原包验证器通过：CRC、无重复条目、精确白名单、源码/dist/ZIP 字节一致、运行资源与基线一致、无被删权限 API 依赖。见 [package-verification.json](../../evidence/1.1.2/release-closeout-20261101/package-verification.json)。**未运行 build、package 或 release 重建候选**；既有成功构建记录仍见 [build.txt](../../evidence/1.1.2/recheck-20261101/build.txt)。同名旧包不能替代上表路径和哈希。

本轮取得 Google 官方更新端点实际返回的 `docs/evidence/1.1.2/release-closeout-20261101/store-current.crx`：扩展 ID `bnbmgiidicjdbnmkmdnjeelhijnlhnjb`，版本 1.1.1，137031 字节，SHA256 `71804c76f85b30fc3b78c16a631f72fbcaa5d983a71ba8aedd47372ab9472cef`。HTTPS 来源和重定向记录见 [store-download.json](../../evidence/1.1.2/release-closeout-20261101/store-download.json)；CRX3 三份签名均有效，其中一份公钥哈希绑定该扩展 ID，见 [签名验证](../../evidence/1.1.2/release-closeout-20261101/store-signature-verification.json)。

商店原包的 36 个运行资源与仓库基线完全相同，没有缺失文件。全部差异已列明：manifest 仅多出 Google `update_url`；build-info 同为 1.1.1，但商店构建时间为 `2026-08-31T07:53:56.495Z`，与本地重建时间不同；商店额外包含 `_metadata/verified_contents.json`。见 [逐文件比较](../../evidence/1.1.2/release-closeout-20261101/store-package-comparison.json)及已执行通过的 [只读复验脚本](../../evidence/1.1.2/release-closeout-20261101/verify-store-package.py)。这确认商店发布内容与回归基线的关系，**不声称两个归档整体哈希相同，也不声称已核对后台构建记录中的 Git SHA**。

[商店公开页面](https://chromewebstore.google.com/detail/easycv-%E8%A7%A3%E9%99%A4%E7%BD%91%E9%A1%B5%E5%A4%8D%E5%88%B6%E7%B2%98%E8%B4%B4%E9%99%90%E5%88%B6/bnbmgiidicjdbnmkmdnjeelhijnlhnjb)显示 1.1.1、更新日期 2026-09-02；页面读取可能含抓取缓存，官方更新端点本轮实际下载的 1.1.1 提供交叉证据。后台匿名请求跳转登录，未读取认证发布记录、警告详情或精确整改期限。见 [商店观察](../../evidence/1.1.2/release-closeout-20261101/store-listing-observation.json)及 [后台访问结果](../../evidence/1.1.2/release-closeout-20261101/dashboard-access.json)。

## 2. Gate、已完成验收与剩余事项

PASS 均限定在表中证据范围；PARTIAL 不等于发布例外已获批准。`HOTFIX_RELEASE_READY` 使用检查状态，最终发布裁决另列 `RELEASE_DECISION`。

| Gate | 状态 | 证据与边界 |
| --- | --- | --- |
| PERMISSION_COMPLIANCE_GATE | PASS | manifest 精确差异、原包验证器/API 搜索、36 个运行资源不变；两项删除不影响现有静态注入链。仅为技术合规判断，不代表 Google 已批准 |
| PACKAGE_INTEGRITY_GATE | PASS | 本轮核验上述固定 ZIP、版本、CRC、38 文件及 SHA256；见 package-verification.json |
| REGRESSION_DIFF_GATE | PASS | 复核既有 1.1.1/1.1.2 同一专项测试均 18/21、失败项一致；正式 Chrome 156 实际 action Popup 调查结果一致；本轮单测 33/33、语法 43 文件通过。结论限已测范围 |
| KNOWN_BASELINE_RISK_GATE | PARTIAL | Popup 双向子开关同步缺陷已归为共同基线风险，P2/中等，另行登记且保留刷新绕行；关闭后页面仍可能保持部分解锁，不能宣称功能全绿或零用户影响 |
| UPGRADE_AND_PERSISTENCE_GATE | PARTIAL | 原生 Options 设置保存并刷新回读通过；正常浏览器重启及现有商店安装 1.1.1→1.1.2 升级仍 NOT_VERIFIED，详见下文 |
| PLATFORM_ACCEPTANCE_GATE | PARTIAL | macOS 正式 Chrome 156 的既有实际 action Popup 证据；本轮 Chrome for Testing 151 原生工具栏/菜单补验完成。Windows Chrome P0、Windows Edge P0 smoke 均 NOT_RUN，必测义务未解除 |
| DOCS_CHECK_GATE | FAIL | 本轮候选和基线均退出 1，唯一命中同一历史 profile 路径；归因为环境路径校验问题，但既有“docs:check 必须通过”条件仍未满足 |
| STORE_PACKAGE_MATCH_GATE | PASS | 已取得来源可核验的商店原始 1.1.1 CRX，签名/ID 与 36 个运行资源匹配；manifest/元数据差异全部解释。此项不覆盖后台发布流水或 1.1.2 商店升级 |
| HOTFIX_RELEASE_READY | FAIL | docs 必须通过、Windows 必测及升级/重启有效证据尚缺；没有已批准的发布例外 |

对照结果复用 [权限复验证据](../../evidence/1.1.2/recheck-20261101/acceptance.json)及 [Popup 正式 Chrome 调查](EASYCV-1.1.2-POPUP-PASTE-TRIAGE.md)，没有改写其失败或旧发布裁决。本轮另跑 [单测](../../evidence/1.1.2/release-closeout-20261101/unit.txt)、[语法检查](../../evidence/1.1.2/release-closeout-20261101/lint.txt)和包验证；未把既有 E2E/粘贴调查冒充本轮重跑。

**实际原生 UI 补验：** 独立 macOS Chrome for Testing 151.0.7922.34，通过原生扩展菜单打开 Popup，固定后再次从工具栏打开；实际点击主开关关闭/开启、强力模式、添加自动启用及设置入口。实际网页右键菜单逐个点击全局开关、启用强力模式和添加新域名。以 Service Worker 读取真实存储交叉核验：全局 true→false、强力模式 false→true、新域名写入成功；Options 通知 true→false，刷新后仍为 false。见 [原始观察及逐项结果](../../evidence/1.1.2/release-closeout-20261101/chrome-upgrade-observations.json)、[Popup](../../evidence/1.1.2/release-closeout-20261101/native-popup-initial.txt)、[右键菜单](../../evidence/1.1.2/release-closeout-20261101/native-context-menu.txt)、[设置回读](../../evidence/1.1.2/release-closeout-20261101/native-options-persistence.txt)。这些证明 UI 动作及保存路径；页面子开关同步仍受已知缺陷影响。未宣称粘贴、排除列表 UI 或所有 Popup 控件完整验收。

正式 Chrome 156 的原生绑定只定位到个人 Chrome 进程，未能绑定隔离测试窗口；未在个人 profile 加载候选或改设置。扩展管理页被浏览器 URL 策略拒绝，未绕过；原生补验因此明确使用不同应用身份的 Chrome for Testing，不能代替正式 Chrome/Windows 的全部验收。

**升级与重启：** 在独立正式 Chrome 中尝试“已加载 1.1.1、写非默认设置、同一临时路径替换候选、关闭重开”。CDP 加载的未打包扩展未自动恢复，显式重新加载后设置回到默认；这属于重新安装路径，不能当作正常升级丢设置，也不能算持久化通过。同会话 `runtime.reload` 及 Chrome for Testing 补充尝试均未取得新的有效 Worker/update 事件；后者还出现首次安装初始化覆盖测试种子的竞争，已作废该次持久化解释。没有有效的非默认设置升级前后对照，故不作数据保持结论。临时 staging 可以替换，锁定 ZIP、其解压目录和基线均未改。真实签名安装的升级、正常重启和升级后功能须补验；不能用回调合成或直接执行 update 分支代替。

**平台义务：** [测试计划](../../testing/测试计划.md)将 Windows 10+ Chrome P0 标为“发布前必测”，Edge P0 标为“发布前 smoke 必测”；macOS Chrome 是 P1 条件验证。只读查询发现 Parallels Windows 11 状态为 `invalid`，未修复、启动或改虚拟机配置，Windows 两项保留 NOT_RUN。最低版本 88+、真实站点/CSP、复杂编辑器和跨源 frame 也未在本轮新增覆盖。见 [平台记录](../../evidence/1.1.2/release-closeout-20261101/platform-availability.json)。

**docs 历史失败归类：** [基线](../../evidence/1.1.2/release-closeout-20261101/baseline-docs-check.txt)和 [候选](../../evidence/1.1.2/release-closeout-20261101/docs-check.txt)均只命中历史报告第 5 行的 `test/real-sites/.profile/`。历史正文已明确该目录含真实 cookie、已忽略；`.gitignore` 第 157 行确实忽略它，测试设施会按配置创建运行目录。检查器对内联路径一律执行存在性检查，未区分这种环境产物，故是环境依赖/校验语义问题，未检出真实文档链接损坏或候选新增错误。没有创建假 profile、复制私人登录态、增加 suppression 或修改历史证据。详见 [分类记录](../../evidence/1.1.2/release-closeout-20261101/docs-classification.json)。后续可单独审阅修正检查器对这类明确标注的运行路径的处理后复跑；本轮未修改工具，FAIL 保留。

## 3. Popup 历史缺陷独立登记

**本地跟踪项 `ECV-POST-112-01`：Popup 子开关与当前页面状态不同步；建议 P2，列入后续独立修复候选，未创建外部 Issue、未实施。**

- 已确认：后台发送 `state_updated` 与内容侧监听及 payload 契约不一致；合法 `update_status` 通路未消费 `user_settings`。已有 textarea/input 内联 `return false` 因此可能残留；关闭方向也可能保留部分解锁。
- 1.1.1/1.1.2 同条件复现，商店 1.1.1 运行字节现已确认与基线相同。它不要求恢复 `scripting`/`activeTab`，不混入本次权限热修复。
- 临时绕行：**开启解锁后刷新目标网页**；原调查已验证恢复真实粘贴，强力模式不构成可靠替代。不能承诺所有第三方编辑器都适用。
- 后续最小提案：让 `USER_SETTINGS` 通知复用现有 canonical 设置重载→应用状态路径，保留域名排除裁决；独立验证关闭→刷新→开启、单独 paste 开关、两种强力模式、已有/新增输入元素、多标签和排除优先级。关闭后的 DOM/原型恢复语义另行明确，不能以 storage=true 代替真实粘贴断言。

## 4. 能否提交审核与风险接受边界

**当前 BLOCKED；本轮不提交。** 未检出权限删除导致的新增严重退化，Popup 历史缺陷已按 FA 指定范围独立处理。但必要条件未满足，因此不能仅凭“核心合规有证据”自动升为 CONDITIONAL_READY。

- **READY**：完成有效升级/正常重启及功能保持验收，补齐 Windows Chrome/Edge 必测，docs 检查通过，并完成后台提交资料核对。
- **CONDITIONAL_READY**：仅在 FA 审阅具体未完成项、明确批准逐项例外及补验责任后，核心合规与无新增退化证据才可支持条件发布；未跑项依然保留原状态，不能改写成 PASS。
- **BLOCKED**：当前状态；docs、Windows 必测及升级证据不足均未获例外授权。新发现严重退化或无法解释的核心风险也应阻塞。

剩余风险是升级/重启设置保持未知、Windows 交互兼容性未知、已知页面状态同步缺陷、保留全站访问可能被进一步审查，以及后台警告状态/精确期限未知。公开商店仍能下载 1.1.1 不代表警告已解除。

## 5. 开发者后台人工提交核对清单

以下供解除阻塞并获 FA 发布授权后执行；本轮无上传、提交或发布。

- [ ] 在后台确认原商品 ID `bnbmgiidicjdbnmkmdnjeelhijnlhnjb`、当前已发布版本、待审草稿、警告原因及精确截止时间，留存发布记录。
- [ ] 补齐升级/正常重启/升级后功能、Windows Chrome P0 与 Edge smoke、docs Gate；逐项记录有效证据，任何例外由 FA 明确批准。
- [ ] 在保留原安装、同一扩展 ID、无卸载/清空数据的条件下，记录非默认复制/粘贴/全局/强力开关、通知、自动名单和排除名单；升级后、正常重启后均比较，刷新实际网页验证复制/粘贴、菜单、自动启用与排除优先级，单独标注基线缺陷及绕行。
- [ ] 上传前重新计算上表固定 ZIP 的 SHA256，核对 132475 字节、manifest 1.1.2、仅 storage/contextMenus、全站范围保持；不选同名旧包、不重新打包替换。
- [ ] 更新权限理由：storage 用于设置/名单/统计；contextMenus 对应三个菜单；全站访问用于普通网页静态运行、自动启用和目标 URL 识别；移除旧 scripting/activeTab 理由。版本说明仅写权限清理，不宣称修复 Popup。
- [ ] 检查公开隐私政策 URL 和商店隐私声明与最终包一致。仓库已有未提交文档改动不等于公开页面已更新；不得把此检查当作本轮已发布。
- [ ] 核对审核备注、发布方式和渠道。Google 对受警告版本的下一次发布要求覆盖 100% 用户，不以灰度规避；由 FA 在后台核实并选择。上传新 ZIP 后仍需提交审核，提交本身不改变已发布版本。见 [官方更新流程](https://developer.chrome.com/docs/webstore/update)。
- [ ] 人工提交后保存提交时间、版本、状态及对应包身份；如被拒，按实际反馈处理，任何候选字节变更均重新锁定并验收。

## 6. Google 警告解除的后续验证

按 [官方审核/警告说明](https://developer.chrome.com/docs/webstore/review-process#warning)，修复需走新版本审核流程；以本商品后台及通知为准，不以本地权限检查、已上传或“审核中”认定解除。

人工确认 1.1.2 已获批并实际发布后，核对后台警告/违规状态及相关通知，保留时间与商品 ID；再查看公开版本和更新时间，并从官方更新渠道取得已发布 CRX，验证签名/ID、版本、权限及其运行资源与锁定候选的关系（容许并逐项解释商店注入元数据）。用已有 1.1.1 安装实际接收更新，复验设置和功能；遇到缓存或分发延迟，以后台和实际下载包交叉确认。后台未明确解决、仍有拒审或警告时继续 `GOOGLE_WARNING_CLEARED = NOT_VERIFIED`，按官方支持流程跟进，不能只等待。

本轮 `STORE_APPROVAL = NOT_RUN`、`PUBLIC_RELEASE = NOT_RUN`、`GOOGLE_WARNING_CLEARED = NOT_VERIFIED`。不创建定时监控或承诺自动跟进。

本轮原有 372 个文件（含产品、两份报告、历史证据、dist、候选 ZIP/解压目录及基线构建）哈希核对见 [preservation.json](../../evidence/1.1.2/release-closeout-20261101/preservation.json)。回滚本轮交付只需移走新增报告和本轮证据目录；测试 profile/staging 留在忽略的 `.tmp/release-closeout-20261101/`，测试浏览器和 HTTP 服务已关闭。不要 reset/clean 或覆盖现有未提交工作。

```text
RELEASE_DECISION = BLOCKED
PRODUCT_CODE_MODIFIED = NO
COMMIT_CREATED = NO
PUSH_PERFORMED = NO
STORE_SUBMISSION = NOT_RUN
```
