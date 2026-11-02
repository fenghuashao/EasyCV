# 1.1.2 权限整改候选（2026-11-01）

当前 Gate、原始证据与人工步骤以 [EASYCV-1.1.2-PERMISSION-FIX](../EASYCV-1.1.2-PERMISSION-FIX.md) 为准。本轮不 commit/push/提交商店；下方保留的 1.1.0 清单仅为历史记录，不能验证 1.1.2。

---

# 发布核验清单 — 1.1.0

> 生成时间：2026-08-10 ｜ 基准：master 78d3ca8（worktree-debt08-site-exclusion 已合并）
> 本清单按 release-readiness 流程产出，上架前逐项确认。
> 复核记录：2026-08-10 合并后 master 态复核通过（验证链复跑全绿，结果与 §2 一致）。

## 1. 需求完成

| 项 | 状态 | 证据 |
| :--- | :--- | :--- |
| DEBT-03 拦截策略收敛（R1–R3） | ✅ 已合入 master（复测通过） | 9e78001 / a7f299e / 529af9c；[测试报告-真实站点回归-2026-08-v2](./测试报告-真实站点回归-2026-08-v2.md)（机制四探针全过、B站快捷键误伤排除、doc88 旧 P0 翻案为站点固有行为） |
| DEBT-04 图标补齐 | ✅ 已合入 master | ec86b3d |
| 移除 management 权限 | ✅ 已合入 master | 2e03739；manifest.json 权限仅 activeTab/storage/scripting/contextMenus |
| DEBT-08 站点排除列表 | ✅ 已合入 master | be2c818；options 新 tab + storage + background 裁决 + content 消费 + 敏感域名默认排除 |
| CHANGELOG 1.1.0 条目 | ✅ 已补全（本分支） | CHANGELOG.md |

## 2. 测试

| 门禁 | 结果 |
| :--- | :--- |
| `npm run lint` | ✅ 36 文件语法通过 |
| `npm test`（node --test test/unit/） | ✅ 33/33（新增 DEBT-08 覆盖 13 例：storage 匹配语义 10 例、content 排除消费 3 例） |
| `npm run docs:check` | ✅ 通过 |
| `npm run build` | ✅ dist 构建成功（1.1.0） |
| e2e（15/15） | ✅ 于 DEBT-03 合并前在 master 通过；DEBT-08 改动不触 e2e 断言面（popup/选项页主流程未变） |
| 真实浏览器实测（DEBT-08） | ✅ 有头 chromium 加载 dist：onInstalled 种子 3 个默认排除域名、options 渲染正确（证据截图 store-assets/screenshots-v1.1.0/options-excluded.png） |

## 3. 已知问题（已记录，不阻塞上架）

- 待修复任务清单 DEBT-01/02/05/06/07（消息字段命名、统计 schema、设置消费、监控 UI、pushState 间接检测）→ 排 1.1.1
- contextmenu 全拦截使站点定制右键菜单失效（B站实测）——产品取舍，**DEBT-08 站点排除列表即其逃生通道，已随本版本交付**
- 注册吞没机制无法枚举被吞监听器的原始职能（机制固有盲区，回归报告 §3.1 已声明）
- 知乎/YouTube/Google Docs 受风控与登录墙限制未完成自动化功能验证，建议上架后关注反馈

## 4. 风险评估

| 风险 | 等级 | 缓解 |
| :--- | :--- | :--- |
| 排除列表翻转 GET_STATUS 的 enabled 语义 | 低 | 排除判定集中在 background 单点（isDomainExcluded 纯函数 10 例单测）；content 不重实现匹配逻辑 |
| 老用户升级种子策略 | 低 | 仅键缺席时种子默认敏感域名，不覆盖/不打扰已有数据；用户清空被尊重（单测锁定） |
| GET_STATUS 失败时 content 兜底 enabled=true | 低（边缘） | 与历史行为一致；background 不可达时排除裁决不可得的固有边界 |
| 排除列表未做真实站点复测 | 低 | 选项页+种子+渲染已经真实浏览器实测；站点级行为复测纳入上架后反馈观察 |

## 5. 文档更新

- [x] CHANGELOG.md 1.1.0 条目（DEBT-03 R1–R3 / DEBT-04 / DEBT-08 / t1 重写 / 权限移除）
- [x] [待修复任务清单](./待修复任务清单.md) DEBT-08 标记完成
- [x] [API设计文档](./API设计文档.md) GET_STATUS 契约更正（domain 入参、excluded 出参）
- [x] [用户使用手册](./用户使用手册.md) 新增「站点排除功能」章节

## 6. 商店素材（store-assets/，gitignored）

- 截图 5 张：`screenshots-v1.1.0/`（options 常规 1280x800、站点排除 1280x800、popup 640x400、解锁生效对比 2 张 1280x800）
- 描述文案：`store-description-zh.md` / `store-description-en.md`（含简短说明与详细描述）
- 隐私实践：`privacy-practices.md`（控制台填写指引 + PRIVACY.md 政策文本草稿；已核实全仓零网络调用）
- ~~待用户决定：PRIVACY.md 是否入库~~ ✅ 已决定入库（仓库根 `PRIVACY.md`，2026-08-10；商店后台填 GitHub 链接，push 后生效）

## 7. 发布步骤（用户手动执行）

1. ~~合并 `worktree-debt08-site-exclusion` → master~~ ✅（2026-08-10，ff 至 78d3ca8）
2. ~~全量验证：`npm run lint && npm test && npm run docs:check && npm run build`~~ ✅（master 态复跑全绿：lint 36 / 单测 33 / docs:check / build 1.1.0）
3. 打 tag：`git tag v1.1.0`（manifest/package.json 版本已是 1.1.0；CHANGELOG 日期已定为 2026-08-10）
4. 打包：`npm run package`（产物 releases/，dist 仅含运行时目录）
5. 开发者控制台上传 zip + 填写商店资料（截图/描述/隐私实践见 store-assets/）
