# EasyCV 1.1.2 权限整改与发布前验收

> 归档说明（2026-11-09）：下文部分 ZIP、发布说明与 CRX 是当时的本地产物，未随公开仓库收录。对应原始路径以代码形式保留；包身份、哈希和历史结论仍以本报告记录为准。

验收日期：2026-11-01（Asia/Shanghai）。仅本地修改、测试和打包；未执行 Git commit、push、商店上传或提交审核。

## 整改结论

**本地权限整改和发布包内容验证完成；完整发布验收仍阻塞，不建议现在提交商店。**

候选已删除未使用的 `scripting` 和冗余的 `activeTab`，保留 `storage`、`contextMenus` 与现有 `<all_urls>`。manifest、package、lockfile 根版本统一为 1.1.2。36 个运行资源与 Git 1.1.1 基线逐字节相同，未修改核心业务、注入机制或增加功能。对照回归没有检出权限删除造成的新增失败，但两版均复现既有粘贴问题。

本次接手时已经存在上述未提交整改、测试、报告和旧证据。本次主要独立复验、重新构建打包并纠正报告；不将已有改动冒充本次新写代码。以下结论以 [recheck-20261101 证据目录](../../evidence/1.1.2/recheck-20261101) 为准；上级目录旧日志保留，不能替代本次验证。

## 基线、已有工作与商店关系

- 本次初始工作区**不干净**，包括 15 个已跟踪文件修改及报告、测试和证据目录。见 [initial-status.txt](../../evidence/1.1.2/recheck-20261101/initial-status.txt) 和 [initial-diff.patch](../../evidence/1.1.2/recheck-20261101/initial-diff.patch)。43 个已有文件的哈希见 [preexisting-files.json](../../evidence/1.1.2/recheck-20261101/preexisting-files.json)，备份保存在 `.tmp/permission-recheck-20261101/preexisting-work.tar`。不 reset、clean、stash 或暂存任何文件。
- HEAD 为 `bbd6300ecd7f3a23dd1f3a9ca2f74e517ffa1d09`，提交说明为发布 v1.1.1；该提交 manifest/package 为 1.1.1，lockfile 根版本为 1.1.0。候选仅同步 lockfile 根版本，未改变依赖版本。见 [baseline-sha.txt](../../evidence/1.1.2/recheck-20261101/baseline-sha.txt) 及初始 diff。
- 从 `git archive HEAD` 独立重建基线，源码与 dist 位于 `.tmp/permission-recheck-20261101/baseline-source/`。构建直接复制运行目录、生成 build-info.json，无 JS 转译或压缩。基线实际构建成功，见 [baseline-build.txt](../../evidence/1.1.2/recheck-20261101/baseline-build.txt)。
- 本地提交名、版本号和重建产物只能证明仓库关系，不能证明与商店发布字节一致。仓库发布目录仅发现本地 1.1.2 包，无来源可核验的商店原始 1.1.1 ZIP/CRX，见 [local-archives.json](../../evidence/1.1.2/recheck-20261101/local-archives.json)。**STORE_PACKAGE_MATCH_GATE = NOT_VERIFIED**。本次没有取得 FA 对商店原包来源的额外确认，也未验证商店实际在售版本。
- 旧报告“初始干净、初始记录零字节”的说法与其记录 `?? docs/evidence/` 不符，本报告已更正。历史测试报告及旧证据不改写，不访问个人浏览器 profile 或登录态。

## 权限变更与功能映射

| 声明 | 仓库 1.1.1 | 候选 1.1.2 | 实际用途或删除依据 |
| --- | --- | --- | --- |
| scripting | 申请 | 删除 | 源码、后台、Popup、Content Script、工具和辅助脚本无 scripting、executeScript、insertCSS 或动态脚本注册调用 |
| activeTab | 申请 | 删除 | 普通网页 tabs.query/get 的 URL 读取由已有 host permissions 覆盖；tabs.sendMessage、静态脚本和 action 功能无需此权限；无截图调用 |
| storage | 申请 | 保留 | utils/storage-utils.js 使用 sync/local 和 onChanged，保存设置、自动启用、排除名单及统计；Options 也使用存储 API |
| contextMenus | 申请 | 保留 | background/service-worker.js 创建并监听开关、强力模式、加入自动启用三个菜单 |
| host_permissions: all_urls | 声明 | 保留 | 普通网页标签 URL 识别与自动启用目标判断；本轮不缩小网站范围 |
| content_scripts.matches: all_urls | 声明 | 保留 | document_start 静态注入，all_frames=true |
| web_accessible_resources | 声明 | 保留 | 包内 injector、图标、utils 资源，matches 保持 all_urls；属于资源暴露声明 |

注入链为 manifest 静态 Content Script → content/content.js:injectCustomScript() → runtime.getURL → DOM script 加载包内 content/injector.js，未经过 scripting API。其余使用的 runtime、tabs 基础查询/消息/创建、action 图标标题和 i18n API 没有额外待申请权限。

[全仓权限/API 搜索](../../evidence/1.1.2/recheck-20261101/permission-search.txt) 覆盖产品源码、Popup、后台、Options、Content Script、辅助脚本、测试、文档、dist 和解压发布产物；排除 Git 数据、依赖、临时副本、生成证据和私人 profile。搜索参数独立留存；文档中的权限名称不当作 API 依赖。ZIP 内 JS 与已扫描源码逐字节匹配，逐文件哈希与 API 引用见 [package-verification.json](../../evidence/1.1.2/recheck-20261101/package-verification.json)。

2026-11-01 查阅 Chrome 官方 [Purple Potassium 排错说明](https://developer.chrome.com/docs/webstore/troubleshooting#excessive-permissions)、[Tabs 权限说明](https://developer.chrome.com/docs/extensions/reference/api/tabs)、[静态 Content Script](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) 与 [scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)：已有相关 host permissions、普通 tabs 查询及消息不需要 activeTab；scripting 权限对应其编程注入 API。结合当前代码与对照测试，支持删除两项权限；这不代表 Google 已审核认可。

## 修改文件与原因

以下列出整个未提交候选相对 HEAD 的变更；本次保留已有整改，仅更新本报告并新增复验证据。

- `manifest.json`：仅删除两权限、版本改为 1.1.2，其他字段与基线相同。
- `package.json`、`package-lock.json`：根项目版本同步；依赖保持原样。
- `scripts/package.js`：发布说明从 dist manifest 读取 permissions/host_permissions，纠正旧硬编码及遗漏 contextMenus。
- `PRIVACY.md`、用户使用手册、技术架构文档：同步权限用途和静态注入边界。
- `CHANGELOG.md`、部署文档、自动化打包配置说明、发布清单、docs/README、项目开发计划、测试计划及测试用例：登记候选、检查方式和人工验收边界。
- `test/fixtures/permission-fix.html`、`test/permission-regression.mjs`：受控限制页与隔离浏览器对照回归；原生工具栏及系统菜单明确未覆盖。
- `test/verify-permission-package.py`：实际 ZIP、白名单、源码/dist/ZIP 字节、版本和基线比较。
- 本报告和 `docs/evidence/1.1.2/recheck-20261101/`：可复查结论、实际退出码和新证据。构建产物保存在忽略的 dist/releases 下。

## 核心回归结果

环境：macOS arm64、Node 24.21.0、npm 11.19.0、Playwright 1.62.1、Chrome for Testing 151.0.7922.34；有头模式、隔离临时 profile、本地 HTTP 页面。agent-browser CLI 不存在（未安装），使用仓库既有 Playwright 测试路径。具体路径与端口见 [environment.json](../../evidence/1.1.2/recheck-20261101/environment.json)。以下所有日志均为本次重跑，详见 [命令与退出码](../../evidence/1.1.2/recheck-20261101/check-results.json)。

| 检查 | Git 1.1.1 基线 | 1.1.2 候选 | 证据文件（recheck 目录） |
| --- | --- | --- | --- |
| 构建 | PASS | PASS | baseline-build.txt / build.txt |
| 原有单元测试 | 33/33 PASS | 33/33 PASS | baseline-unit.txt / unit.txt |
| 原有 E2E | 15/15 PASS | 15/15 PASS | baseline-e2e.txt / e2e.txt |
| 语法检查 | 未单独跑 | PASS，43 个文件 | lint.txt |
| docs:check | FAIL，1 项历史路径引用 | 同一项 FAIL | baseline-docs-check.txt / docs-check.txt |
| 专项权限回归 | 18/21，退出码 1 | 18/21，退出码 1 | baseline-permission-regression.json / permission-regression.json |
| 实际 ZIP 与版本 | 用于字节对照 | PASS，38 文件 | package-check.txt / package-verification.json |

专项测试直接加载新 ZIP 的解压目录；21 项结果逐项与基线相同，新增失败为零。通过项覆盖：禁用负对照、Popup 主按钮的消息/存储路径、CSS/Range 文本选择、真实键盘复制、强力模式与 main-world 注入、动态内容、重复注入不重复包装、刷新及刷新后真实粘贴、标签切换与 URL 可见性、三个右键菜单注册、加入自动名单处理函数合成调用、自动启用、Options 排除/恢复和同会话设置回读。旧 E2E 另覆盖 Shadow DOM、SPA、Popup/Options 渲染和动态版本。

**功能失败：Popup 开启后 textarea 粘贴仍受限制。** 页面在 copyEnabled/pasteEnabled=false 时加载，再经 Popup 主按钮开启，存储两值均变为 true，但 textarea 的 `onpaste="return false"` 仍存在；合成 paste 被取消，真实键盘粘贴超时。两版都复现；刷新等待后属性被清理，真实粘贴通过。两份 JSON 的 diagnostics 保留开启前后存储、HTML 和刷新后状态。

源码与现象相符的根因线索：service-worker.js:1152 广播 STATE_UPDATED（`state_updated`），content.js:272 却分发 STATE_BROADCAST；content.js:824 的存储变化处理也未消费 USER_SETTINGS。旧页面未及时应用新开关，injector.js:278 的既有元素清理名单又不含 textarea，无法清掉其 return false。该问题存在于 1.1.1，不能归因于权限删除；本轮按最小整改范围保留业务代码，需另行修复和复验。

**持久化边界：** 两版重启测试都出现设置重置；diagnostics.restartInstallLog 均捕获 onInstalled 的 reason=install，触发现有首次安装初始化。因此本测试未证明正常 Chrome 重启或商店升级的持久化，也不能简单认定为权限回归。原始失败保留，真实安装/升级路径为 NOT_VERIFIED。

**文档失败：** 两版 docs:check 均指向历史真实站点报告第 5 行的 `test/real-sites/.profile/` 不存在。未制造私人 profile 目录来刷绿，也未改写历史证据；发布前仍需明确处理该门槛。

## 发布包验证与复查

- 本次候选：`releases/permission-recheck-20261101/EasyCV-v1.1.2-20261031.zip`，132475 字节。
- SHA256：`6a2f2478e847ff06d6b7a35dbe01b543d2cd00ab52df7f96d2763d758e77782a`。
- 发布说明：`releases/permission-recheck-20261101/EasyCV-v1.1.2-README.md`，权限仅 storage/contextMenus，网站范围 all_urls。
- 使用原 Packager.package()，仅将输出目录指定为本次独立目录以保护旧包；先实际运行 npm run build。未调用 deploy/release 或外部商店接口。
- ZIP CRC、重复文件检查、38 文件精确白名单、manifest 位于根目录均通过；无测试、报告、profile、密钥或 Git 目录。source/dist/ZIP 运行文件及 manifest 字节一致，无 optional 权限。
- manifest/package/lock 根版本及 build-info 均为 1.1.2；manifest 除版本/permissions 外与基线相同，36 个其他运行资源与基线字节相同，见 [runtime-unchanged.json](../../evidence/1.1.2/recheck-20261101/runtime-unchanged.json)。
- 旧包 `releases/EasyCV-v1.1.2-20261031.zip` 与旧证据原字节保留；本报告候选以**完整路径和 SHA256**为准。文件名日期使用打包脚本 UTC 日期，不是 Asia/Shanghai 验收日期或商店发布时间。

从仓库根目录复查（PLAYWRIGHT_PATH、CHROMIUM_PATH 按 environment.json 配置；另开终端启动 `node test/static-server.mjs 18931`）：

```sh
npm test
npm run lint
npm run docs:check
python3 test/verify-permission-package.py releases/permission-recheck-20261101/EasyCV-v1.1.2-20261031.zip .tmp/permission-recheck-20261101/baseline-source/dist .tmp/permission-recheck-20261101/package-recheck.json
TEST_PAGE_URL=http://127.0.0.1:18931/test-page.html node test/e2e-extension.mjs
TEST_ORIGIN=http://easycv.localhost:18931 EASYCV_EXT_PATH=.tmp/permission-recheck-20261101/baseline-source/dist RESULT_PATH=.tmp/permission-recheck-20261101/baseline-recheck.json node test/permission-regression.mjs
TEST_ORIGIN=http://easycv.localhost:18931 EASYCV_EXT_PATH=releases/permission-recheck-20261101/EasyCV-v1.1.2-20261031 RESULT_PATH=.tmp/permission-recheck-20261101/candidate-recheck.json node test/permission-regression.mjs
```

浏览器测试串行运行，预期会如实返回既有失败；所有命令及 cwd 以 check-results.json 为准。验证指定 ZIP 前不要重新构建 dist（build-info 会变化）；重新打包后必须更新哈希和验收记录。

## Gate

[机器可读验收](../../evidence/1.1.2/recheck-20261101/acceptance.json) 锁定基线、候选哈希、失败项目及证据。PASS 仅限下述范围，不推导商店结果。

| Gate | 结论 | 可复查依据 |
| --- | --- | --- |
| BASELINE_GATE | PASS（仓库范围） | 初始状态/补丁及备份；git archive HEAD 重建；baseline-build/unit/e2e；商店关系单独未验证 |
| SCRIPTING_REMOVAL_GATE | PASS（本地范围） | permission-search、注入链、ZIP manifest/API 清单；21 项对照无新增失败 |
| ACTIVETAB_REMOVAL_GATE | PASS（本地范围） | 保留 host permissions；Popup URL、标签切换及 tabs 消息路径通过；无截图依赖；对照无新增失败 |
| PERMISSION_MINIMIZATION_GATE | PASS（约定范围） | 仅 storage/contextMenus；all_urls 和资源范围保持原样 |
| CORE_FUNCTION_REGRESSION | FAIL | 两版同样的 Popup 后 paste 取消和键盘粘贴失败；重启持久化未验证；原生 Chrome 人工项未跑 |
| PACKAGED_EXTENSION_GATE | PASS（内容校验） | 新 ZIP 38 文件、CRC、白名单、逐文件 SHA256 和 source/dist/ZIP 字节一致；不含完整功能验收 |
| RELEASE_VERSION_GATE | PASS | source/dist/ZIP manifest、package、lock 根和 build-info 均为 1.1.2 |
| STORE_PACKAGE_MATCH_GATE | NOT_VERIFIED | 没有来源可核验的商店原始 1.1.1 发布包 |
| RELEASE_READY | BLOCKED | 粘贴缺陷、docs:check 历史失败、真实 Chrome/升级持久化与商店原包证据待处理 |

未检出权限删除导致的新增退化，因此保留两项删除；若后续真实 Chrome 对照检出新增退化，须停止对应删除并定位依赖，不能牺牲功能通过检查。

## 未覆盖风险与人工验收（以下均 NOT_RUN）

在独立真实 Chrome 测试 profile 操作，记录 OS/Chrome 版本、扩展版本、每步结果及 SW 错误。不得把 Playwright 打开 popup.html 当作原生工具栏验收。

1. 解压本报告指定 ZIP，在 chrome://extensions 加载；核对版本 1.1.2、权限和网站范围，确认 SW 无加载错误及三个菜单存在。
2. 打开本地受控限制页与 test-page.html，用鼠标选择、Cmd/Ctrl+C/V 检查复制粘贴。重点覆盖“关闭后开启、textarea 内联 return false”，分别记录刷新前后行为。
3. 通过**原生工具栏 Popup**操作主开关、复制/粘贴、强力模式、刷新检测、加入自动启用和设置入口；核对当前域名、图标、存储和页面效果。
4. 通过**原生网页右键菜单**逐个点击开关、强力模式和加入自动启用；本轮只自动验证注册及加入名单处理函数，未验证系统菜单点击。
5. 添加/删除自动启用与排除域名，覆盖子域、刷新、多标签切换、动态/SPA 内容、iframe 和重复启用；检查排除优先级及 chrome://、商店页等不可注入页面的降级行为。
6. 修改设置和名单，正常关闭重启 Chrome；再从真实已安装 1.1.1 升级候选，检查设置不丢。缺少可核验原包/安装条件时继续 NOT_VERIFIED。
7. 在代表性真实 HTTP/HTTPS 站点检查 CSP、编辑器/播放器、跨源 frame 与复制粘贴；按项目测试计划补 Windows Chrome、Edge smoke。历史登录态报告不能验证本次候选。

本轮按要求保留 all_urls；未全面审计 web-accessible resources 范围、最低浏览器版本或 Windows/Edge 兼容性。以上不能声称 PASS。

## Chrome Web Store 提交注意事项与最终建议

- **暂缓提交**：先单独处理粘贴状态同步缺陷和 docs:check 门槛，完成上述真实 Chrome/持久化验收，再重新打包并复验 Gate。
- 权限理由同步为 storage（设置/名单/统计）、contextMenus（三个右键动作）和网站访问（普通网页静态解锁、自动启用和 URL 识别）；删除旧 scripting/activeTab 的用途声明。保留 all_urls 仍需说明与单一用途的关系，可能被进一步询问。
- 商店版本说明、权限声明与隐私实践必须匹配最终 ZIP。仓库 PRIVACY.md 修改不代表公开网页或 Wiki 已同步；本轮不发布这些改动。
- 收到原始 1.1.1 发布包后，按文件清单和哈希核验来源/构建关系，补 STORE_PACKAGE_MATCH_GATE；相同版本号不能证明一致。
- 后续提交须锁定最终包完整路径和 SHA256；不要误用旧包或 quick 包。Google 审核是否通过、正式发布是否完成及 Purple Potassium 是否解除，均等待实际商店结果。

## 交付状态与回滚

| 状态 | 本轮结果 |
| --- | --- |
| 本地权限整改完成 | YES；核心业务资源未改 |
| 发布包内容验证完成 | YES；完整发布验收 BLOCKED |
| 商店审核通过 | NOT_RUN |
| 正式发布完成 | NOT_RUN |
| Google 警告解除 | NOT_VERIFIED |

PRODUCT_CODE_MODIFIED = YES（候选相对 HEAD 的 manifest 权限/版本；本次保留已有整改）  
COMMIT_CREATED = NO  
PUSH_PERFORMED = NO  
STORE_SUBMISSION = NOT_RUN

本次初始已有工作已备份；除本报告外保持原字节，见复验证据中的 preservation.json。需要回滚本次工作时只恢复备份中的本报告并处理本次新增目录；候选整改的进一步回滚应按文件审阅初始 diff，勿 reset/clean 或覆盖其他工作。未修改全局配置、权限边界或外部商店状态。
