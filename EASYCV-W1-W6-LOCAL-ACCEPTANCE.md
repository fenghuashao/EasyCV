# EasyCV W1–W6 本地整改与验收报告

日期：2026-11-03。执行：FX；依据 FA 对 [下一版计划](EASYCV-NEXT-VERSION-PLAN.md) W1–W6 及剩余 6 个中风险依赖整改的批准。

**结论：依赖整改本地验收 PASS。原 6 项中风险依赖链已移除；官方 npm 审计接口对全部锁定依赖返回零告警。冻结快照内 124 项测试、53 个脚本语法检查、干净安装及隔离 ZIP 校验通过。最终发布验收仍为 PARTIAL / 不可提交商店。** npm CLI 的 TLS 连接失败单列，不伪称 `npm audit` 成功退出；浏览器、同 ID 升级、版本及后台状态仍待核实。

**并行任务边界：** 打包后 FA 确认另一个任务正在修改语言包、manifest、Options/Popup 与 i18n 工具。本轮没有覆盖这些变更。以下依赖包及 124 项结果以界面并行修改开始前的冻结源码为准，不代表当前正在变动的工作区或并行界面成果已整体通过。合流后的重新构建与完整验收为 **NOT_RUN**。

本轮没有操作浏览器（包括无头浏览器）、安装扩展、读取或迁移真实浏览器配置、上传或提交商店，也没有 commit、push、fetch、升版或修改全局 npm 配置。真实数据迁移代码仍只在内存 fixtures 中验证。

## 1. 基线、保全与产物身份

| 项目 | 结果 |
| --- | --- |
| 仓库 / HEAD | `D:\pro\github\EasyCV`，`master`；`9d378b5e731e2e3f5e3513762fab7b36fcb35236` 未变 |
| 版本 | manifest、package、lock 顶层及根包均保持 **1.1.2**；没有锁定下一版 |
| 工作区 | 保留既有改动、方案与证据；并行界面变更单列；本轮未暂存或提交 |
| 保全 | 上轮 475 个文件保全结果保留；本轮以 888 个既有文件为基线，区分依赖整改、并行界面变更及其余保全文件，见 [本轮保全记录](docs/evidence/dependency-remediation-20261103/preservation-final.json) |
| 检查环境 | Windows / Node v24.21.0 x64；不代表其他 Node、操作系统或浏览器通过 |

依赖整改冻结快照测试包：

- 路径：`D:\pro\github\EasyCV\releases\dependency-remediation-20261103\EasyCV-DEPENDENCY-TEST-ONLY.zip`
- SHA256：`abde4ba65db9ee6680d2511ea8ebf245712244c7e83238c98ffe5de13d98bc45`
- 大小：**138802 bytes**；**38 个文件**。37 个运行文件与本轮初始源码、冻结 fixture 和上轮 W1–W6 最终 ZIP 逐字节相同；另一个是 build-info。
- 内部版本：**1.1.2**；**TEST ONLY，不是已锁定的下一版，也不是并行界面任务的合流包。**
- 在全新 fixture 执行 `npm ci --ignore-scripts --no-audit --no-fund`，使用 fixture 内依赖构建打包，没有借用工作区旧 node_modules。
- 证据：[包校验](docs/evidence/dependency-remediation-20261103/package-verification.json)、[独立 Python 校验](docs/evidence/dependency-remediation-20261103/package-independent.json)、[干净安装](docs/evidence/dependency-remediation-20261103/clean-install-verification.json)、[构建日志](docs/evidence/dependency-remediation-20261103/build-package-final.txt)。

上轮 `releases/w1-w6-local-final-20261103/EasyCV-W1-W6-TEST-ONLY.zip` 保留（138460 bytes，SHA256 `25a74f354f4ba17912dc0acccb627b1803a046f7e8103555658e584cd0df461d`）。早期 local-test、默认旧 dist 与旧商店 ZIP 均未清理或覆盖；其历史证据不升级为当前合流或商店验收。

## 2. W1–W6 完成情况

| 工作项 | 已实现的行为 | 本地结果 | 尚未完成的验收 |
| --- | --- | --- | --- |
| W1 隐私与失败保护 | 诊断最小化/local；停止域名访问统计；历史数据先验证备份再移除 sync；失败提示重试；状态未知休眠；WAR 仅 injector | PASS | 真实升级迁移、浏览器资源加载及公开政策一致性 |
| W2 配置可靠性 | 各界面通过 worker 串行写；sync 失败报错；草稿编辑/取消；最新值合并；整体导入验证；本机副本导出/显式恢复 | PASS | 真实多窗口、配额、断连、worker 重启及跨设备行为 |
| W3 站点规则 | 旧字符串/混合格式统一；精确优先与点边界；排除/总关闭优先；自动访问不改全局默认 | PASS | 双站多标签、已有用户规则升级及真实页面 |
| W4 独立开关 | copy/paste 四组合按模式处理；关闭还原原型/样式/内联处理器；保留监听器注册；快捷键限范围 | PASS（VM） | 编辑器、播放器、iframe、Shadow、SPA、严格 CSP 的真实效果 |
| W5 构建与门禁 | 真正执行检查；版本一致性；独立输出；拒绝旧构建/覆盖；ZIP 文件、CRC 与 hash 验证；最小打包依赖替换 | PASS（冻结快照/官方审计接口）；npm CLI 传输失败单列 | 并行任务合流检查、最终版本重建及最终包浏览器验收 |
| W6 必要 UI/双语 | 保存/导入错误、编辑取消、本机恢复、迁移重试说明；只展示启用计数；保留今日 Popup 功能 | PASS（结构/方法/locale） | 中英显示、键盘、焦点及用户操作体验 |

这些 PASS 表示本轮对应的本地检查通过，不表示 W1–W6 的真实浏览器验收已经关闭。

## 3. 核心实现与边界

### 3.1 隐私和数据迁移

- `REPORT_ERROR` 不再传递异常 message/stack/完整 URL；后台也不接受 sender/页面任意数据作为存储内容。最多 10 条诊断仅写 local，字段为固定 code、module、受限时间与扩展版本。
- `PAGE_ANALYZED` 不再持久化域名；内容脚本停止发送带 URL 的页面分析。AutoEnable 不再记录访问域名和时间。普通页面 `oncontextmenu === null` 不再被判为限制。
- 统计只保留本机激活计数、当日计数和日期，尊重 `enableStatistics=false`；过期日期的今日计数显示为 0，成功率显示“—”。这不是实际解锁效果采样。
- 旧 sync `statistics`/`interaction_history` 先写入 local `legacy_private_backup` 并回读校验；诊断脱敏、旧反馈内容丢弃；然后移除对应 sync 键。手工规则和配置不在迁移删除范围内。
- local 写失败、校验失败、sync 删除失败均保留未完成的源数据；后续可重试。设置页展示迁移未完成状态及重试入口。云同步不是事务：其他设备仍运行旧版时可能继续写入，不承诺远端副本立即一致。
- WAR 只公开 `content/injector.js`。保留 `storage`、`contextMenus` 与现有 host 范围，没有增加权限。引用扫描和 ZIP 检查通过；浏览器实际资源加载待测。
- [PRIVACY.md](PRIVACY.md) 已改为中英**本地草稿**，明确同步配置、本机诊断、历史备份、失败保留与用户主动反馈。不代表网站或商店公开隐私页已更新。

### 3.2 配置写入、导入与恢复

- Popup/Options 的 `StorageUtils` 写入经 `storage_mutation` 发送到 worker。worker 校验发送者是本扩展页面；和 StateManager 共用一个队列，从最新状态按字段/规则操作合并。
- sync 是权威。成功读取时，只有缺失的配置键才兼容读取原 local 副本；有冲突时 sync 优先。sync 读错误不使用旧副本继续启用页面，sync 写错误不再回退成“本地成功”。
- 保留原 local 数据，设置页可导出并主动恢复。恢复只覆盖副本包含的键，其他配置保留；失败保留源副本。导出的本机恢复文件也可通过验证后的导入流程恢复。
- 点编辑只填草稿，取消、关闭窗口或保存失败不删除原规则；保存执行原子替换。不存在的原规则、非法域名、重名替换均拒绝。
- 导入限制大小 1 MB、名单 1000 项、JSON 深度 20；验证类型、已知开关、数值范围、域名、重复项及危险对象键，再单次 sync.set。旧文件无 excludedList 时保留当前排除规则，保留已有未知设置字段及规则扩展字段。
- 普通导出使用 `schemaVersion:1`，旧无 schemaVersion 格式仍支持。恢复文件使用 `kind:easycv-local-recovery`。不通过复制浏览器 Profile 或改变扩展 ID 恢复。
- 列表事件委托只绑定一次；域名输出进行属性/文本转义。写成功后才更新确认状态；写失败保留草稿并报错。

单 worker 队列不是跨设备数据库事务。Chrome 写入完成但响应丢失时，UI 可能显示“未确认”，应重新读取再决定重试，不能把“不确定”宣称为绝对未写入。

### 3.3 站点和页面状态

有效顺序保持为：不支持/状态不可确认 → 休眠；排除域 → 休眠；总开关关闭 → 休眠；本站规则 → 使用其 copy/paste；否则使用全局默认。

- `*.example.com` 仅匹配子域，不能匹配 `example.com` 或 `notexample.com`；精确规则优先，更具体的通配优先。根域需要单独添加精确规则。
- 旧字符串规则读取为双开对象，混合列表保留扩展字段；读取不会自动改写原存储。无效列表使读取失败并休眠，不能因错误默认全站开启。
- 访问 A 站只通知重取有效状态，不再修改 B 站或全局默认。Popup 的子开关仍表示全局默认，本站规则可覆盖；没有增加独立本站总开关。
- 后台读取失败返回 success:false。内容脚本在加载失败时立即停止干预，不用 lastKnownState 恢复启用；之后可在有效状态刷新时恢复。
- injector 按 copy/paste 参数控制事件、内联属性和样式；仅粘贴模式不强制复制选择样式。Ctrl/Meta 只处理对应的 C/X/A 或 V，不干预其他组合键。
- `addEventListener` 保留原注册和移除语义，避免永久吞掉站点监听器造成关闭不能恢复；限制在运行时中和。关闭恢复原型、文档事件属性、动态属性和注入样式；仍保留已有 Map 异常容错。

监听器策略改变可能影响依赖特殊限制实现的站点，必须用关闭负对照、富文本、播放器及真实网站验证。这是 W4 的剩余验收，不能靠 VM 结果推断所有网站兼容。

## 4. 历史问题逐项复核

| 调查编号 | 本轮处理 | 证据状态 |
| --- | --- | --- |
| F01 sync 写失败假成功 | 不再隐式回退写 local；错误向 UI 传播，队列后续操作仍可继续 | LOCAL_FIXED |
| F02 编辑即删除规则 | 草稿编辑，保存后替换；失败/取消保留原数据 | LOCAL_FIXED |
| F03 旧字符串名单未被后台识别 | StorageUtils、StateManager、AutoEnable 使用一致规范化 | LOCAL_FIXED |
| F04 通配误匹配近似域名 | 子域点边界、精确优先及更具体通配规则 | LOCAL_FIXED |
| F05 A 站配置污染全局 | 自动访问不写 user_settings | LOCAL_FIXED |
| F06 状态未知默认开启 | 后台失败信封，内容脚本立即休眠，不回退旧启用态 | LOCAL_FIXED |
| F07 敏感 URL/错误写 sync | 固定诊断字段/local；旧诊断脱敏迁移 | LOCAL_FIXED |
| F08 导入非法名单部分写入 | 整体 schema 验证后单次提交 | LOCAL_FIXED |
| F09 并发设置丢字段 | 跨界面 worker 串行队列，按最新值合并 | LOCAL_FIXED |
| F10 删除键破坏缓存 | 缺键按默认规范化，刷新权威状态；无效值报告失败 | LOCAL_FIXED |
| F11 单项关闭仍被通用 injector 干预 | 四组合模式门控，关闭恢复，保留监听器注册 | LOCAL_FIXED（VM） |
| F12 普通页误报且记录访问域 | 修正 null 判定，停止域名采集，统计不伪称成功 | LOCAL_FIXED |

最初的 17 项回归在修改前全部出现预期失败，证据见 [red baseline](docs/evidence/w1-w6-local-20261103/regression-before.txt)。原有 77 项测试保留并按批准后的契约更新必要断言，新增 41 项后总计 118 项；本轮依赖整改再新增 6 项，总计 124 项。

调整旧断言的原因包括：不再期待永久吞掉监听器；快捷键测试指定具体键；损坏排除列表应失败而非变空；自动配置不应改全局 paste；没有真实采样就不显示成功率。没有通过删除失败测试来获得通过结果。

## 5. 本地验证结果

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| `node --test "test/unit/*.test.mjs"` | **124/124 PASS**，无 skipped/todo；冻结 fixture 复跑 | [测试日志](docs/evidence/dependency-remediation-20261103/unit-frozen-final.txt) |
| `node scripts/lint.js` | **53 个文件 PASS**；冻结 fixture 复跑 | [语法检查](docs/evidence/dependency-remediation-20261103/syntax-frozen-final.txt) |
| 文档及本轮链接检查 | PASS；不覆盖并行界面验收 | [文档检查](docs/evidence/dependency-remediation-20261103/docs-final.txt) |
| 本轮路径 `git diff --check` | PASS；全工作区检查另发现并行任务需求文档的行尾空白，未覆盖其文件 | [本轮差异检查](docs/evidence/dependency-remediation-20261103/diff-check-scoped.txt)、[全工作区当时结果](docs/evidence/dependency-remediation-20261103/diff-check-final.txt) |
| 全新目录 `npm ci` | PASS，仅安装 2 个开发依赖；integrity 与官方元数据一致 | [安装日志](docs/evidence/dependency-remediation-20261103/clean-install.txt)、[完整性核对](docs/evidence/dependency-remediation-20261103/integrity-verification.json) |
| npm 官方 bulk 审计接口 | PASS，全部锁定依赖返回 `{}`，0 条已知告警 | [审计核对](docs/evidence/dependency-remediation-20261103/audit-verification.json) |
| `npm audit` CLI | **TRANSPORT_FAILED**，TLS 建连失败；不声称退出码 0 | [CLI 原始结果](docs/evidence/dependency-remediation-20261103/audit-after.json) |
| 构建 / Node ZIP 验证器 | PASS，冻结快照 38 文件 source/build/ZIP 一致 | [包验证](docs/evidence/dependency-remediation-20261103/package-verification.json) |
| Python zipfile 独立校验 | PASS，CRC、唯一名称、每文件字节及 manifest；37 个运行文件与上轮包相同 | [独立验证](docs/evidence/dependency-remediation-20261103/package-independent.json) |
| 并行界面变更后的打包专项回归 | **10/10 PASS**；仅验证依赖、构建及打包门禁，不覆盖界面完整回归 | [专项日志](docs/evidence/dependency-remediation-20261103/targeted-parallel-integration.txt) |
| 保全 | PASS（按归属核对），既有证据与旧产物保留；并行界面变更另列 | [保全记录](docs/evidence/dependency-remediation-20261103/preservation-final.json) |
| 并行界面修改后的合流包 | **NOT_RUN**，该任务仍在修改 | 不混用冻结快照结果 |
| Chrome / Edge / 无头 / 原生安装 | **NOT_RUN** | 遵守本轮范围 |
| 同 ID 升级、商店后台与公开政策 | **待核实 / NOT_RUN** | 不以历史证据替代 |

本轮新增 6 项：锁文件禁止已知受影响 minimatch 范围；中文/空格路径；并发写同名 ZIP；已有校验记录冲突；源文件读失败；目标写失败。保留并复跑原有 118 项。读失败回归发现新依赖不自动转发输入流错误，现已显式传播错误、关闭流并停止队列。失败不生成成功收据，残留文件不冒险删除或覆盖。

修改前依赖回归出现预期失败，见 [red baseline](docs/evidence/dependency-remediation-20261103/regression-before.txt)；错误传播修复负例见 [读失败定位](docs/evidence/dependency-remediation-20261103/read-failure-debug.txt)。冻结 fixture 首次遗漏 deploy 导入的 clean 模块，补齐准备文件后复跑通过，没有修改产品代码绕过失败。脚本和测试清单见 [fixture 清单](docs/evidence/dependency-remediation-20261103/frozen-tests-manifest.json)。

`release-checks.test.mjs` 中 synthetic failure 专门验证发布脚本遇到真实 Node 测试失败就停止，不是最终 124 项测试失败。W1–W6 方法/VM/locale 测试继续保留；没有浏览器视觉证据，不能称为中英文浏览器 UX 已通过。

## 6. 构建与依赖审计

### 6.1 历史结果与最小替换

上轮 W5 已增加 source/build/ZIP 文件清单、CRC、hash、版本和权限门禁；独立输出且不覆盖旧构建。版本脚本仅在临时 fixture 验证，源码四处版本未更新。项目仍采用三段数字版本，不把项目约定误称为 Chrome 只允许三段。

上轮兼容更新四个传递依赖节点后 high/critical 为 0，但 **moderate=6**；[原审计](docs/evidence/w1-w6-local-20261103/dependency-audit-after.json) 与 [原更新日志](docs/evidence/w1-w6-local-20261103/dependency-fix-result.txt) 保持原字节。六项属于同一 [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) 的链条：archiver、archiver-utils、glob、minimatch、readdir-glob、zip-stream，受影响 minimatch 范围为 `<11.0.1`。这些依赖本来就不进入扩展 ZIP；本轮通过移除整条依赖链消除告警来源。

| 选择 | 核对与决定 |
| --- | --- |
| archiver 5 兼容更新 | 仍受旧 minimatch 依赖范围约束，不能消除本次告警 |
| archiver 7 / 8 | 7 仍含旧 glob 链；[8 改用 ESM](https://github.com/archiverjs/node-archiver/blob/master/package.json)，readdir-glob 3 仍使用 minimatch 10 范围，增加模块迁移仍不能关闭告警 |
| 强制 override minimatch 11 / 自动建议降级 archiver 4 | 跨 API/Node 兼容边界或破坏性降级，不采用 |
| **仅替换 ZIP 写入器为 yazl 3.3.1** | [CommonJS 接口](https://github.com/thejoshwolfe/yazl)，不依赖 glob，仅一个传递依赖；保留打包入口、白名单、压缩级别、返回值和独立验证器 |

改动限于 `package.json`、lock、`scripts/package.js`、回归测试及相关文档，没有改写扩展架构或引入运行时依赖。开发依赖节点 **51 → 2**：固定 `yazl@3.3.1`，lock 固定 `buffer-crc32@1.0.0`。未使用 `npm audit fix --force`，未修改版本号或全局 npm 配置。

安装沿用现有镜像并使用锁文件 integrity 校验；另从官方 registry 读取两项元数据，确认 integrity 完全一致。新打包器继续逐项添加已校验文件，懒加载输入流并使用 pipeline；独占创建 ZIP 与收据，拒绝已有文件，读写失败关闭流并拒绝 Promise，不生成成功收据。

### 6.2 当前审计结果与限制

- npm CLI 对官方 registry 多次请求在 TLS 建连前失败，见 [修复前](docs/evidence/dependency-remediation-20261103/audit-before.json) 和 [修复后](docs/evidence/dependency-remediation-20261103/audit-after.json)。未关闭 TLS 校验或更改全局代理/网络配置。
- 使用 `curl.exe --fail`，保持 TLS 校验，对同一官方 bulk 审计接口发送完整锁文件包名/版本。旧清单复现 minimatch 中风险告警：[旧响应](docs/evidence/dependency-remediation-20261103/bulk-before-response.json)；新锁文件返回 `{}`：[新响应](docs/evidence/dependency-remediation-20261103/bulk-after-response.json)。[请求清单](docs/evidence/dependency-remediation-20261103/bulk-payload-after.json) 与当前锁文件逐项比对一致。
- **6 项已知受影响链条已移除；官方端点当前返回零告警。** 这是当前已知漏洞数据快照，不承诺未来没有新公告，也不把替代传输结果写成 npm CLI 成功。
- 兼容性证据限于 Windows / Node v24.21.0 的干净安装、124 项回归和 ZIP 独立解析；浏览器、其他 Node/操作系统及并行界面合流验收不由此覆盖。

## 7. 改动范围、回退与下一步

W1–W6 上轮代码与文档改动保留。本轮仅追加依赖替换、6 项回归与验收记录；FA 确认的并行界面修改归属另一任务，本轮没有覆盖或认领。旧报告原文保留为 [修改前快照](docs/evidence/dependency-remediation-20261103/before-EASYCV-W1-W6-LOCAL-ACCEPTANCE.md)。

共享文件中的并行修改也已保留：CHANGELOG 的四语言说明，以及打包测试将固定文件数改为按运行文件清单计算的断言。后者差异见 [共享测试差异](docs/evidence/dependency-remediation-20261103/parallel-release-test.diff)，专项 10 项复跑通过；冻结快照测试原文仍单独留存，不替换其证据身份。

- 本地回退按 [依赖整改收据](docs/evidence/dependency-remediation-20261103/workspace-receipt.json)、修改前快照和本轮差异逐项审阅；[上轮收据](docs/evidence/w1-w6-local-20261103/workspace-receipt.json) 保留。不使用整仓 reset/clean，不覆盖并行界面文件；恢复旧依赖会重新引入已知告警。
- 真实浏览器未被改动，无运行数据回退事项。后续回退功能也不应恢复完整敏感 URL；设置恢复与诊断隐私清理分开处理，历史统计备份保持本机。
- 并行界面任务完成后先做合流回归与打包。浏览器验收获准后，优先验证升级保存、迁移失败重试、多窗口写入、站点规则隔离、四开关组合、关闭负对照及编辑器/播放器/SPA/Shadow/iframe/CSP、中英 UI 和重启。
- 后台当前发布/草稿/待审版本、商品 ID、Purple Potassium 警告状态/截止期和发布模式仍为**待核实**，不根据本地 1.1.2 推断后台状态。
- 最终版本锁定后重新构建、固定最终 ZIP 身份并完成真实验收；公开政策、商店声明和送审分别等待对应授权。

当前停在本地依赖整改与报告交付。**不操作浏览器，不提交商店，不 commit 或 push。**
