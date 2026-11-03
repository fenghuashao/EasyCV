# EasyCV W1–W6 本地整改与验收报告

日期：2026-11-03。执行：FX；依据 FA 对 [下一版计划](EASYCV-NEXT-VERSION-PLAN.md) W1–W6 的批准。

**结论：W1–W6 的本地代码、必要界面和回归测试已完成。118 项测试、52 个脚本语法检查、文档检查及隔离包校验通过。最终发布验收仍为 PARTIAL / 不可提交商店。** 浏览器与同 ID 升级未运行；依赖审计仍有 6 个中风险依赖条目，版本和后台状态待核实。

本轮没有操作浏览器（包括无头浏览器）、安装扩展、读取或迁移真实浏览器配置、上传或提交商店，也没有 commit、push、fetch、升版或修改全局 npm 配置。真实数据迁移代码只在内存 fixtures 中验证，尚未在 FA 的浏览器上执行。

## 1. 基线、保全与产物身份

| 项目 | 结果 |
| --- | --- |
| 仓库 | `D:\pro\github\EasyCV`，`master` |
| HEAD | `9d378b5e731e2e3f5e3513762fab7b36fcb35236`，前后相同 |
| 版本 | manifest、package、lock 顶层及根包均保持 **1.1.2**；没有锁定下一版 |
| 工作区 | 保留原先未跟踪方案、调查证据及商店送审证据目录；本轮新改动留在工作区，未暂存或提交 |
| 保全校验 | **475 个既有文件哈希未变**，包括原方案、历史证据、默认 dist 与旧 ZIP；见 [保全结果](docs/evidence/w1-w6-local-20261103/preservation-final.json) |
| 检查环境 | Windows / Node v24.21.0 x64；不是浏览器、Windows ARM64 或跨平台验收 |

最终本地测试包：

- 路径：`D:\pro\github\EasyCV\releases\w1-w6-local-final-20261103\EasyCV-W1-W6-TEST-ONLY.zip`
- SHA256：`25a74f354f4ba17912dc0acccb627b1803a046f7e8103555658e584cd0df461d`
- 大小：**138460 bytes**；**38 个文件**，其中 37 个运行文件与源码逐字节相同，另一个是 build-info。
- 内部版本：1.1.2；**TEST ONLY，不是已锁定的下一版，也不是商店送审包。**
- 证据：[包校验](docs/evidence/w1-w6-local-20261103/package-verification.json)、[独立 Python 校验](docs/evidence/w1-w6-local-20261103/package-independent.json)、[构建日志](docs/evidence/w1-w6-local-20261103/build-package-final.txt)。

`releases/w1-w6-local-test-20261103/` 是过程中的较早自测产物；当前报告只接受上述 `local-final` 包。默认 `dist/` 仍是原有旧目录，没有清理或覆盖。旧 `store-submission-20261103` ZIP 保持原字节，不可混用其验收结果。

## 2. W1–W6 完成情况

| 工作项 | 已实现的行为 | 本地结果 | 尚未完成的验收 |
| --- | --- | --- | --- |
| W1 隐私与失败保护 | 诊断最小化/local；停止域名访问统计；历史数据先验证备份再移除 sync；失败提示重试；状态未知休眠；WAR 仅 injector | PASS | 真实升级迁移、浏览器资源加载及公开政策一致性 |
| W2 配置可靠性 | 各界面通过 worker 串行写；sync 失败报错；草稿编辑/取消；最新值合并；整体导入验证；本机副本导出/显式恢复 | PASS | 真实多窗口、配额、断连、worker 重启及跨设备行为 |
| W3 站点规则 | 旧字符串/混合格式统一；精确优先与点边界；排除/总关闭优先；自动访问不改全局默认 | PASS | 双站多标签、已有用户规则升级及真实页面 |
| W4 独立开关 | copy/paste 四组合按模式处理；关闭还原原型/样式/内联处理器；保留监听器注册；快捷键限范围 | PASS（VM） | 编辑器、播放器、iframe、Shadow、SPA、严格 CSP 的真实效果 |
| W5 构建与门禁 | 真正执行检查；版本一致性；独立输出；拒绝旧构建/覆盖；ZIP 文件、CRC 与 hash 验证；兼容依赖修复 | PASS（本地构建）；依赖审计未通过 | 中风险依赖处置、最终版本重建及最终包浏览器验收 |
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

最初的 17 项回归在修改前全部出现预期失败，证据见 [red baseline](docs/evidence/w1-w6-local-20261103/regression-before.txt)。原有 77 项测试保留并按批准后的契约更新必要断言，新增 41 项后总计 118 项。

调整旧断言的原因包括：不再期待永久吞掉监听器；快捷键测试指定具体键；损坏排除列表应失败而非变空；自动配置不应改全局 paste；没有真实采样就不显示成功率。没有通过删除失败测试来获得通过结果。

## 5. 本地验证结果

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| `node --test "test/unit/*.test.mjs"` | **118/118 PASS**，无 skipped/todo | [最终测试日志](docs/evidence/w1-w6-local-20261103/unit-final.txt) |
| `node scripts/lint.js` | **52 个文件 PASS** | [语法检查](docs/evidence/w1-w6-local-20261103/syntax-final.txt) |
| `node scripts/check-docs.js` | PASS | [文档检查](docs/evidence/w1-w6-local-20261103/docs-final.txt) |
| `git diff --check` | PASS | [差异检查](docs/evidence/w1-w6-local-20261103/diff-check-final.txt) |
| 构建及 Node ZIP 验证器 | PASS，38 文件、source/build/ZIP 一致 | [包验证](docs/evidence/w1-w6-local-20261103/package-verification.json) |
| Python zipfile 独立校验 | PASS，CRC、唯一文件名、每文件字节及 manifest | [独立验证](docs/evidence/w1-w6-local-20261103/package-independent.json) |
| 保全 | PASS，475 个既有文件、HEAD、版本未变 | [保全结果](docs/evidence/w1-w6-local-20261103/preservation-final.json) |
| Chrome / Edge / 无头 / 原生安装 | **NOT_RUN**，遵守本轮范围 | 无浏览器验收记录 |
| 同 ID 升级、商店后台与公开政策 | **待核实 / NOT_RUN** | 不以历史证据替代 |

`release-checks.test.mjs` 使用独立临时项目，真正运行一个会失败的 Node 测试，确认部署检查停止并不继续文档步骤；再运行通过样例确认继续。日志内的 synthetic failure 是预期负例，不是最终 118 项测试失败。它也发现并解决了嵌套 Node 测试环境可能跳过子测试的情况。

中英文 key 一致、静态引用齐全；Options 的取消、错误保留及单次事件委托有方法测试。界面没有截图或视觉验收，不能称为中英文浏览器 UX 已通过。

## 6. 构建与依赖审计

W5 新增 `scripts/release-checks.js`，校验 manifest/package/lock 版本、允许的权限和 WAR、运行文件集合及 hash。Builder 不覆盖非空输出目录，默认旧 dist 会被拒绝；deploy/quick 使用独立目录，ZIP 和说明拒绝同名覆盖。所有产物校验明确记录 browserAcceptance:NOT_RUN、storeReady:false。

版本脚本只在执行时统一更新三个文件中的四处版本；本轮只在临时 fixture 验证，源码版本未更新。项目脚本继续采用三段数字版本，不把这一项目约定误称为 Chrome 只允许三段。

依赖审计过程：

1. 当前 npm 镜像的审计端点返回 404 / NOT_IMPLEMENTED，见 [初次审计](docs/evidence/w1-w6-local-20261103/dependency-audit.json)。
2. 使用一次性 `--registry=https://registry.npmjs.org`，没有修改全局配置；官方审计发现 brace-expansion/minimatch 的高风险条目，见 [修复前](docs/evidence/w1-w6-local-20261103/dependency-audit-official.json)。
3. 执行兼容范围内的 `npm audit fix --ignore-scripts`，未使用 force，未升级 archiver 主版本；lock 和本机 node_modules 更新四个节点：

| 依赖节点 | 原版本 | 当前版本 |
| --- | --- | --- |
| brace-expansion | 1.1.11 | 1.1.21 |
| minimatch | 3.1.2 | 3.1.5 |
| readdir-glob 下 brace-expansion | 2.0.1 | 2.1.7 |
| readdir-glob 下 minimatch | 5.1.6 | 5.1.9 |

修复后 **high=0、critical=0、moderate=6，npm audit 仍返回 1**。六项是同一 minimatch globparts 放大问题及其反向依赖链：archiver、archiver-utils、glob、minimatch、readdir-glob、zip-stream。它们是构建开发依赖，未打入扩展 ZIP；当前打包按已校验文件逐项添加，不接受用户 glob 输入，但这不等于依赖漏洞已消除。

证据：[审计结果](docs/evidence/w1-w6-local-20261103/dependency-audit-after.json)、[更新结果](docs/evidence/w1-w6-local-20261103/dependency-fix-result.txt)。上游记录为 [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)，来源是本次 npm 官方审计返回。自动建议涉及 archiver 4.0.2 的破坏性降级，本轮未直接采用。

**剩余门禁：** 对构建链做独立的兼容性迁移/最小替换，或由 FA 明确接受该开发依赖风险后再评估发布。不能把“0 high”写成“审计通过”，也不能在未审核时使用 force 更改依赖大版本。

## 7. 改动范围、回退与下一步

本轮主要改动位于 background、StorageUtils、content/injector、Options、必要 Popup 文案/统计、locale 和发布脚本；新增两组回归测试及 helper/包校验器。更新 CHANGELOG、隐私本地草稿、API/测试/部署说明、发布清单和文档索引。

为实现 W5 的 source→build→ZIP 校验，除了计划列出的 deploy/package/version 脚本，还修改了 `scripts/build.js` 和 `scripts/quick-package.js`，并增加统一校验模块；为处理本次审计结果更新了 lock 的四个依赖节点。均为任务内的本地可审阅改动，没有新增产品功能或外部发布。

- 本地回退：按本轮 [工作区收据](docs/evidence/w1-w6-local-20261103/workspace-receipt.json) 和逐文件 diff 审阅撤销；不要使用整仓 reset/clean，以免删除 FA 原有未跟踪材料。旧 dist/ZIP/证据无须回退。
- 真实浏览器未被改动，目前没有运行数据回退事项。后续安装若执行诊断脱敏，不应为了回退功能恢复完整敏感 URL；设置恢复与诊断隐私清理分开处理，历史统计备份保持本机。
- 浏览器验收获准后，优先做：升级保存与迁移失败重试、多窗口并发保存、规则 A/B 隔离、四开关组合与关闭负对照、编辑器/播放器/SPA/Shadow/iframe/严格 CSP、中英 UI 及正常重启。
- 后台核实当前发布/草稿/待审版本、商品 ID、Purple Potassium 警告状态/截止期及发布模式；这些均为**待核实**，不根据本地 1.1.2 推断后台状态。
- 最终版本锁定后重新构建、固定最终 ZIP 身份并完成真实验收；公开政策、商店声明与送审分别等待对应授权。

当前停在本地整改与报告交付。**不提交商店，不 commit 或 push。**
