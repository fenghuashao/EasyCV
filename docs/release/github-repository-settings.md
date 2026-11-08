# GitHub 仓库展示与属性配置

仓库：[fenghuashao/EasyCV](https://github.com/fenghuashao/EasyCV)。此文件记录本地协作配置与需要单独保存的 GitHub 后台属性。文件进入仓库不会自动改变 About、功能开关或安全设置。

## 本地配置

| 文件 | 用途 |
| --- | --- |
| [README](../../README.md) | 英文首页、安装入口、四语言文档与目录说明 |
| [LICENSE](../../LICENSE) | 与既有 package.json 声明一致的 MIT 许可证正文 |
| [Contributing](../../.github/CONTRIBUTING.md) | 环境、验证与贡献流程 |
| [Support](../../.github/SUPPORT.md) | 用户反馈与信息要求 |
| [Security policy](../../.github/SECURITY.md) | 漏洞报告流程及当前私密报告边界 |
| [Code of conduct](../../.github/CODE_OF_CONDUCT.md) | 社区参与约定 |
| [Issue 表单](../../.github/ISSUE_TEMPLATE/) | 问题与功能/翻译反馈 |
| [PR 模板](../../.github/PULL_REQUEST_TEMPLATE.md) | 变更、验证和风险说明 |
| [CI](../../.github/workflows/ci.yml) | PR、master 推送或手动触发的安装、语法、单测、文档与隔离打包检查 |
| [Dependabot](../../.github/dependabot.yml) | npm 和 GitHub Actions 的月度依赖更新 PR 配置 |
| [.gitattributes](../../.gitattributes) | 文档与历史证据的 GitHub 文档分类 |
| [.editorconfig](../../.editorconfig) | 文本编辑约定，不批量改写既有文件 |

CI 不提交商店、不推送代码，也不替代真实浏览器、升级或人工体验验收。Dependabot 的后续更新 PR 需要维护者审核；是否运行还取决于仓库后台设置。Actions 固定到已核对的完整 commit SHA，权限限定为读取仓库。

## 后台属性建议（待维护者确认后保存）

2026-11-08 只读 API 核对结果：公开仓库，默认分支为 `master`，Issues 与 Wiki 已开启，Discussions 关闭；Description、Website、Topics 和 License 识别项均为空，私密漏洞报告关闭。该结果只描述核对时点，后台后续可能变化。

| 属性 | 建议值或处理方式 |
| --- | --- |
| Description | `Browser extension that helps restore text selection, copy, paste and context menus on supported web pages.` |
| Website | [Chrome Web Store 安装页](https://chromewebstore.google.com/detail/bnbmgiidicjdbnmkmdnjeelhijnlhnjb) |
| Topics | `browser-extension`, `chrome-extension`, `copy-paste`, `text-selection`, `manifest-v3`, `javascript` |
| License | 将本地 LICENSE 推送到默认分支后核对 GitHub 的 MIT 识别结果 |
| Issues | 保持开启，默认分支更新后核对表单入口 |
| Wiki | 保留入口；正文与仓库四语言文档同步维护 |
| Discussions | 当前保持关闭；出现持续讨论需求时再决定 |
| Private vulnerability reporting | 建议启用，再同步安全政策中的渠道状态；本次未更改此安全开关 |
| Branch protection / Rulesets | 可在首次 CI 成功后评估必需检查和 PR 合并规则；本次未设置 |

在仓库首页的 About 编辑 Description、Website 与 Topics；安全开关位于 Settings 的安全相关设置中。具体界面可能变化，按 GitHub 当前页面为准。

## 验证与回滚

推送文件后检查首页、License、贡献入口和 Issue 表单；观察首次 CI 结果，并把真实浏览器验证单独记录。后台字段修改后重新查询或打开仓库核对。

本地文件调整可通过普通 Git 反向提交恢复。About 属性可以恢复为上述记录的空值；启用私密报告或分支规则前单独记录旧设置及影响。2026-11-09 已获准核对后提交推送仓库文件；About、安全开关及其他后台属性仍保留为待确认建议，本次不提交商店。
