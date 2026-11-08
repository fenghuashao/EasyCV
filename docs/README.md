# EasyCV documentation / 文档索引

For installation and day-to-day use, choose a language from the [repository homepage](../README.md#user-guides). Contributor instructions are in [Contributing](../.github/CONTRIBUTING.md); most detailed engineering documents are currently in Simplified Chinese.

用户文档按语言组织；工程文档按用途归类。历史报告只描述记录时点的构建与验证，不作为当前商店状态的证明。2026-11-08 的[分发包核对记录](./reports/2026-11/对外文档核对记录-2026-11-08.md)说明商店 1.1.3 与源码 manifest 1.1.2 的版本边界。

## Quick links / 快速入口

- 用户：从[首页](../README.md#user-guides)选择四语言手册、隐私政策和更新摘要。
- 开发：[贡献指南](../.github/CONTRIBUTING.md)、[架构](./development/技术架构文档.md)、[API](./development/API设计文档.md)、[代码规范](./development/代码规范文档.md)。
- 测试：[测试入口](../test/README.md)、[计划](./testing/测试计划.md)、[用例](./testing/测试用例.md)、[功能验证](./testing/功能验证指南.md)。
- 发布：[部署与候选构建](./release/部署文档.md)、[打包说明](./release/自动化打包配置说明.md)、[发布清单](./release/release-checklist.md)。
- 维护：[文档维护](./governance/文档维护指南.md)、[历史报告](./reports/README.md)、[GitHub 属性配置](./release/github-repository-settings.md)。

## Layout / 目录用途

```text
docs/
├── user-guide/     English, 繁體中文、日本語手册
├── 用户使用手册.md  简体中文手册，保留公开链接
├── privacy/        繁體中文、日本語政策；中英文政策在根目录
├── changelog/      英文、繁體中文、日本語更新摘要
├── development/   架构、API、代码规范
├── testing/       测试计划、用例与验证方法
├── release/       构建发布、核验清单与仓库后台配置
├── planning/      需求、计划与任务清单
├── governance/    文档治理、词汇表与助手指南
├── decisions/     架构决策记录
├── research/      参考研究
├── reports/       按年月归类的调查与验收报告
├── evidence/      历史原始证据，保留原路径和内容
├── archive/       早期日志、方案与历史分析页
├── assets/        文档图示
├── templates/     写作模板
└── wiki-draft/    公开 Wiki 的维护草稿
```

扩展运行时源码保留在仓库根目录对应模块中，详见[首页目录说明](../README.md#repository-layout)。受控测试页位于 `test/fixtures/copy-paste.html`，图标辅助工具位于 `scripts/tools/svg-to-png.html`，Windows 快速打包入口位于 `scripts/package-quick.bat`。

## Document inventory / 文档清单

角色术语以 [CONTEXT](./governance/CONTEXT.md) 为准。`active` 表示持续维护的入口或参考，`archive` 表示保留用于追溯；不把历史报告中的状态自动当作当前状态。

| 文档 | 角色 | 状态 | 推荐读者 | 维护触发条件 |
| --- | --- | --- | --- | --- |
| [Repository homepage](../README.md) | Governance Document | active | 全员 | 对外介绍、安装入口、目录或版本范围变化 |
| [Documentation index](./README.md) | Governance Document | active | 全员 | 文件分类、默认入口变化 |
| [Contributing](../.github/CONTRIBUTING.md) | Governance Document | active | 贡献者 | 开发命令或贡献流程变化 |
| [Support](../.github/SUPPORT.md) | Reference Document | active | 用户 | 反馈入口或所需信息变化 |
| [Security policy](../.github/SECURITY.md) | Governance Document | active | 用户与贡献者 | 报告渠道或支持策略变化 |
| [Code of conduct](../.github/CODE_OF_CONDUCT.md) | Governance Document | active | 社区 | 社区规范或联系渠道变化 |
| [Test directory guide](../test/README.md) | Reference Document | active | 开发与测试 | 测试命令、环境或 fixture 变化 |
| [CONTEXT](./governance/CONTEXT.md) | Governance Document | active | 维护者 | 文档治理术语变化 |
| [用户使用手册（简体中文）](./用户使用手册.md) | Source Document | active | 用户 | 用户行为或版本范围变化 |
| [User guide（English）](./user-guide/en.md) | Source Document | active | 用户 | 手册内容或翻译变化 |
| [使用手冊（繁體中文）](./user-guide/zh-TW.md) | Source Document | active | 用户 | 手册内容或翻译变化 |
| [ユーザーガイド（日本語）](./user-guide/ja.md) | Source Document | active | 用户 | 手册内容或翻译变化 |
| [Privacy（简体中文 / English）](../PRIVACY.md) | Source Document | active | 用户与维护者 | 实际数据处理、权限或政策变化 |
| [隱私權政策（繁體中文）](./privacy/zh-TW.md) | Source Document | active | 用户 | 政策正文或翻译变化 |
| [プライバシーポリシー（日本語）](./privacy/ja.md) | Source Document | active | 用户 | 政策正文或翻译变化 |
| [Changelog（简体中文）](../CHANGELOG.md) | Source Document | active | 用户与维护者 | 分发版本或历史状态补录 |
| [Changelog（English）](./changelog/en.md) | Reference Document | active | 用户 | 用户相关更新摘要变化 |
| [更新紀錄（繁體中文）](./changelog/zh-TW.md) | Reference Document | active | 用户 | 用户相关更新摘要变化 |
| [更新履歴（日本語）](./changelog/ja.md) | Reference Document | active | 用户 | 用户相关更新摘要变化 |
| [需求](./planning/requirements.txt) | Source Document | active | 产品与开发 | 需求、交互或范围变化 |
| [复制粘贴限制研究](./research/copy-paste-analysis.txt) | Reference Document | active | 产品与开发 | 参考研究补充 |
| [技术架构](./development/技术架构文档.md) | Source Document | active | 开发与测试 | 模块、消息或存储边界变化 |
| [API 设计](./development/API设计文档.md) | Source Document | active | 开发与测试 | 接口或消息协议变化 |
| [代码规范](./development/代码规范文档.md) | Governance Document | active | 开发 | 代码组织或规范变化 |
| [测试计划](./testing/测试计划.md) | Source Document | active | 开发与测试 | 测试策略或发布门槛变化 |
| [测试用例](./testing/测试用例.md) | Source Document | active | 开发与测试 | 功能回归范围变化 |
| [功能验证指南](./testing/功能验证指南.md) | Reference Document | active | 开发与测试 | 操作步骤或环境变化 |
| [部署文档](./release/部署文档.md) | Source Document | active | 发布维护者 | 构建、打包或发布流程变化 |
| [自动化打包说明](./release/自动化打包配置说明.md) | Reference Document | active | 发布维护者 | 脚本或 npm 命令变化 |
| [发布核验清单](./release/release-checklist.md) | Working Document | active | 发布维护者 | 新候选验证前刷新，保留旧包身份 |
| [GitHub 属性配置](./release/github-repository-settings.md) | Reference Document | active | 维护者 | 仓库属性或协作配置变化 |
| [文档维护指南](./governance/文档维护指南.md) | Governance Document | active | 维护者 | 分类、维护或校验流程变化 |
| [AI 开发助手指南](./governance/AI开发助手指南.md) | Governance Document | active | 开发与助手 | 协作与验证流程变化 |
| [项目开发计划](./planning/项目开发计划.md) | Working Document | active | 产品与开发 | 当前目标与计划变化 |
| [待修复任务](./planning/待修复任务清单.md) | Working Document | active | 开发与测试 | 待办或优先级变化 |
| [下一版计划](./planning/EASYCV-NEXT-VERSION-PLAN.md) | Working Document | archive | 维护者 | 追溯 2026-11 的计划依据 |
| [ADR-001](./decisions/ADR-001-合并t1重写版.md) | Governance Document | active | 维护者 | 相关决策重新评估 |
| [报告索引](./reports/README.md) | Governance Document | active | 维护者 | 新增或归档报告 |
| [分发包核对记录](./reports/2026-11/对外文档核对记录-2026-11-08.md) | Evidence Document | archive | 维护者 | 仅补录当轮证据 |
| [Wiki 草稿](./wiki-draft/README.md) | Working Document | active | 维护者 | 对外文档入口变化 |
| [早期开发日志](./archive/开发日志-2024-12.md) | Evidence Document | archive | 维护者 | 历史追溯 |
| [文档治理方案](./archive/spec-文档信息架构与治理（轻量治理）.md) | Working Document | archive | 维护者 | 历史追溯 |
| [早期测试报告](./archive/测试报告-第三阶段.md) | Evidence Document | archive | 维护者 | 历史追溯 |
| [历史一致性分析](./archive/analysis-report.html) | Evidence Document | archive | 维护者 | 历史追溯 |
| [开发日志模板](./templates/开发日志模板.md) | Asset | active | 开发 | 模板结构变化 |
| [UI 图示](./assets/EasyCV-UI.svg) | Asset | active | 产品与开发 | 视觉资产变化 |
| [SVG 图标工具](../scripts/tools/svg-to-png.html) | Asset | active | 开发 | 图标生成方式变化 |

## Maintenance / 维护约定

- 运行 `npm run docs:check` 检查索引及纳管的 active 文档；移动文件时同步更新入站、出站链接和调用脚本。
- 保留首页、根目录隐私政策及更新日志，以及既有四语言用户文档的公开路径。工程文档按上述目录归类。
- 用户功能、权限和数据处理变化时核对全部语言、商店实际包及 Wiki。仓库文件修改不会自动发布这些外部内容。
- 只调整历史报告链接，不倒写历史结论。原始证据中的旧路径和命令保留；当前报告位置见[报告索引](./reports/README.md)。
- `docs/evidence` 作为文档证据纳入 GitHub 文档分类，扩展打包继续只包含既定运行时白名单。
