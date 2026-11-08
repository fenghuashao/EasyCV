# EasyCV 文档索引

## 面向用户的文档

[仓库首页](../README.md)提供简体中文、繁體中文、日文和英文的使用手册、隐私政策与更新日志入口。[对外文档核对记录](./对外文档核对记录-2026-11-08.md)记载 2026-11-08 的商店包比对和版本边界；[Wiki 更新模板](./wiki-draft/README.md)用于维护公开入口，实际状态以线上 Wiki 为准。当前仓库 manifest 为 1.1.2；同一天核对的 Chrome Web Store 分发包为 1.1.3，不能仅按本地版本号推断线上状态。

历史阶段的本地实现与验收见[四语言支持验收](../EASYCV-I18N-ACCEPTANCE-20261103.md)、[W1–W6 本地验收报告](../EASYCV-W1-W6-LOCAL-ACCEPTANCE.md)和[状态修复验收](../EASYCV-1.1.2-STATE-FIX-ACCEPTANCE.md)。这些报告的“未发布”等状态描述仅适用于各自记录时点，不能作为现在商店状态的证明。

本索引用于帮助你快速判断：现在应该看哪份文档、改动时应该同步更新哪份文档。

文档角色（Vocabulary）以根目录的 [CONTEXT.md](../CONTEXT.md) 为准：Source Document / Reference Document / Working Document / Evidence Document / Governance Document / Archive / Asset。本文档用“状态=archive”表达“归档（Archive）材料”。

## 1.1.2 本地修复与验收

[状态修复验收](../EASYCV-1.1.2-STATE-FIX-ACCEPTANCE.md)、[权限整改](../EASYCV-1.1.2-PERMISSION-FIX.md)、[旧包 Windows 验收](../EASYCV-1.1.2-WINDOWS-ACCEPTANCE.md)及[后续优化记录](../EASYCV-OPTIMIZATION-20261103.md)分别记录不同源码或本地候选包，不能互相替代。后续 Git 与商店状态以实际来源复核为准。

## 快速入口

- 用户手册、隐私政策和更新日志：从 [仓库首页](../README.md)选择语言
- 需求与范围：优先看 [EasyCV插件功能需求文档](./EasyCV插件功能需求文档%20.txt)
- 当前实现与模块边界：优先看 [技术架构文档](./技术架构文档.md)
- 工具类接口与模块 API：优先看 [API设计文档](./API设计文档.md)
- 发布与打包：优先看 [部署文档](./部署文档.md) 与 [自动化打包配置说明](./自动化打包配置说明.md)
- 测试怎么做：优先看 [测试计划](./测试计划.md) 与 [测试用例](./测试用例.md)
- 文档如何维护：优先看 [文档维护指南](./文档维护指南.md) 与 [AI开发助手指南](./AI开发助手指南.md)

## 文档清单

| 文档 | 角色 | 状态 | 默认真相来源（Source Document / Governance Document） | 推荐读者 | 维护触发条件 |
| --- | --- | --- | --- | --- | --- |
| [docs/README](./README.md) | Governance Document | active | 本文档 | 全员 | 文档清单、默认入口或维护约定发生变化 |
| [CONTEXT](../CONTEXT.md) | Governance Document | active | 本文档 | 全员 | 文档治理术语发生变化 |
| [EasyCV插件功能需求文档](./EasyCV插件功能需求文档%20.txt) | Source Document | active | 本文档 | 产品/开发/测试 | 需求、交互、范围发生变化 |
| [解除网页复制粘贴插件分析报告](./解除网页复制粘贴插件分析报告_.txt) | Reference Document | active | EasyCV插件功能需求文档 | 产品/开发 | 需要补充竞品研究或设计依据 |
| [技术架构文档](./技术架构文档.md) | Source Document | active | 本文档 | 开发/测试 | 模块边界、消息流、存储结构、关键算法发生变化 |
| [API设计文档](./API设计文档.md) | Source Document | active | 本文档 | 开发/测试 | utils/消息协议/API 接口发生变化 |
| [代码规范文档](./代码规范文档.md) | Governance Document | active | 本文档 | 开发 | 引入新的代码组织方式、风格规范需要更新 |
| [文档维护指南](./文档维护指南.md) | Governance Document | active | 本文档 | 开发/测试/维护者 | 文档分类、维护流程、质量门禁发生变化 |
| [AI开发助手指南](./AI开发助手指南.md) | Governance Document | active | 本文档 | 开发/AI助手 | AI 执行流程、检查清单、质量门禁发生变化 |
| [项目开发计划](./项目开发计划.md) | Working Document | active | EasyCV插件功能需求文档 | 开发/产品 | 里程碑、阶段目标、风险与优先级发生变化 |
| [ADR-001 合并 t1 重写版](./decisions/ADR-001-合并t1重写版.md) | Governance Document | active | 本文档 | 开发/维护者 | 合并范围或移植选型被重新决策 |
| [待修复任务清单](./待修复任务清单.md) | Working Document | active | 项目开发计划 | 开发/测试 | 新增任务、任务状态变化、优先级调整 |
| [发布核验清单](./release-checklist.md) | Working Document | active | 测试计划 | 开发/发布 | 每次发布前按 release-readiness 流程刷新 |
| [测试计划](./测试计划.md) | Source Document | active | 本文档 | 测试/开发 | 测试策略、浏览器支持范围、执行方式、发布前门槛发生变化 |
| [测试用例](./测试用例.md) | Source Document | active | 测试计划 | 测试/开发 | 功能变更、新增功能、回归范围变化 |
| [功能验证指南](./功能验证指南.md) | Reference Document | active | 测试计划 | 测试/开发 | 验证步骤、关键流程或测试环境发生变化 |
| [测试报告-第三阶段](./测试报告-第三阶段.md) | Evidence Document | archive | 测试计划 | 测试/维护者 | 仅在补录历史证据或复盘时更新 |
| [测试报告-真实站点回归-2026-08-v2](./测试报告-真实站点回归-2026-08-v2.md) | Evidence Document | active | 测试计划 | 测试/开发/维护者 | 真实站点复测结论变化；知乎/B站登录态补测与文库人工项完成后更新 |
| [部署文档](./部署文档.md) | Source Document | active | 本文档 | 开发/发布 | 构建、打包、发布流程或脚本入口发生变化 |
| [自动化打包配置说明](./自动化打包配置说明.md) | Reference Document | active | 部署文档 | 开发/发布 | scripts 或 npm 命令发生变化 |
| [用户使用手册（简体中文）](./用户使用手册.md) | Source Document | active | 当前分发包及产品实现 | 用户/产品/开发 | 用户功能、隐私与权限说明、交互流程发生变化 |
| [User Guide（繁體中文）](./user-guide/zh-TW.md) | Source Document | active | 用户使用手册（简体中文） | 用户/产品/开发 | 用户手册内容或翻译变化 |
| [User Guide（日文）](./user-guide/ja.md) | Source Document | active | 用户使用手册（简体中文） | 用户/产品/开发 | 用户手册内容或翻译变化 |
| [User Guide（英文）](./user-guide/en.md) | Source Document | active | 用户使用手册（简体中文） | 用户/产品/开发 | 用户手册内容或翻译变化 |
| [隐私政策（简体中文 / 英文）](../PRIVACY.md) | Source Document | active | 实际分发包及数据处理实现 | 用户/维护者 | 数据处理、权限、版本范围或政策变化 |
| [隐私政策（繁體中文）](./privacy/zh-TW.md) | Source Document | active | 隐私政策（简体中文 / 英文） | 用户/维护者 | 政策正文或翻译变化 |
| [隐私政策（日文）](./privacy/ja.md) | Source Document | active | 隐私政策（简体中文 / 英文） | 用户/维护者 | 政策正文或翻译变化 |
| [更新日志（简体中文）](../CHANGELOG.md) | Source Document | active | 分发版本及项目记录 | 用户/维护者 | 版本或状态变化 |
| [更新日志（繁體中文）](./changelog/zh-TW.md) | Reference Document | active | 更新日志（简体中文） | 用户/维护者 | 更新日志的用户相关摘要变化 |
| [更新日志（日文）](./changelog/ja.md) | Reference Document | active | 更新日志（简体中文） | 用户/维护者 | 更新日志的用户相关摘要变化 |
| [更新日志（英文）](./changelog/en.md) | Reference Document | active | 更新日志（简体中文） | 用户/维护者 | 更新日志的用户相关摘要变化 |
| [对外文档核对记录](./对外文档核对记录-2026-11-08.md) | Evidence Document | archive | 核对时实际代码及官方分发包 | 维护者 | 仅补录本轮证据 |
| [Wiki 更新草稿](./wiki-draft/README.md) | Working Document | active | 用户手册、隐私政策、更新日志 | 维护者 | 仓库对外文档入口变化 |
| [开发日志-2024-12](./开发日志-2024-12.md) | Evidence Document | archive | 项目开发计划 | 开发/维护者 | 仅在补录历史记录或复盘时更新 |
| [开发日志模板](./开发日志模板.md) | Asset | active | 文档维护指南 | 开发/维护者 | 日志结构或记录要求发生变化 |
| [spec-文档信息架构与治理（轻量治理）](./spec-文档信息架构与治理（轻量治理）.md) | Working Document | archive | 文档维护指南 | 维护者 | 仅用于追溯本次治理决策与范围 |
| [EasyCV-UI](./EasyCV-UI.svg) | Asset | active | EasyCV插件功能需求文档 | 产品/开发 | UI 原型或视觉资产发生变化 |
| [svg_to_png_converter](./svg_to_png_converter.html) | Asset | active | EasyCV插件功能需求文档 | 开发/维护者 | EasyCV-UI 变更或需要重新生成图标 |

## 维护约定

- 运行文档校验：`npm run docs:check`。该命令会检查索引链接，以及索引纳管的 active 非 Asset 文档中的明显占位内容和仓库内路径引用是否有效。
- 用户功能、隐私、权限或版本状态变化时，核对四种语言的手册、政策、更新摘要和导航；发布前另核对商店及 Wiki，不把仓库修改当作线上同步。
- 修改任何功能/代码时，至少检查并同步更新对应的 Source Document（例如：需求、架构、API、测试、发布、用户手册）。
- Evidence Document 与 Archive 用于留痕与追溯，不作为当前实现的默认真相来源。
- Asset 只承载辅助材料与工具，不应该包含“系统如何工作”的权威描述。
