# EasyCV 1.1.2 — P2 docs Gate 修复

日期：2026-11-01（Asia/Shanghai）。**DOCS_CHECK_GATE = PASS；RELEASE_DECISION = BLOCKED。** 本报告仅更新文档检查结论，其余发布 Gate 沿用 [release closeout](EASYCV-1.1.2-RELEASE-CLOSEOUT.md)，不改写历史 FAIL 证据。

## 根因与最小修改

- 原检查器对索引纳管的 active 非 Asset 文档提取路径并检查存在性。[修复前复跑](docs/evidence/1.1.2/docs-gate-fix-20261101/docs-check-before.txt)退出 1，唯一命中历史报告第 5 行的 `test/real-sites/.profile/`，与 closeout 原始失败日志一致。
- [历史报告](docs/测试报告-真实站点回归-2026-08-v2.md)明确标注 profile 含真实 cookie 且已忽略；[测试设施](test/real-sites/lib/context.mjs)在 `makeContext` 中创建该目录；[.gitignore](.gitignore)有对应目录规则。因此这是按需生成的私有运行目录说明，不是必须随仓库存在的文档资源。
- [检查器](scripts/check-docs.js)仅对**解析后恰好指向该目录、带尾斜杠、紧邻反引号的代码引用**免除缺失检查，并要求 `.gitignore` 仍保留确切的 `test/real-sites/.profile/` 条目。支持仓库根路径及文档相对路径；不豁免子文件、相似目录、其他 ignored 路径或 Markdown 链接。
- 新增 [CLI 回归测试](test/unit/docs-check.test.mjs)，在临时仓库中运行真实检查器。没有新增 suppression、创建真实/假 profile、读取登录态、修改历史文档或 `.gitignore`；产品业务代码、manifest、package/lock 及打包脚本均未改动。

## 验证证据

| 检查 | 结果 |
| --- | --- |
| `npm run docs:check` | [PASS，退出 0](docs/evidence/1.1.2/docs-gate-fix-20261101/docs-check.txt)，真实 profile 目录仍不存在 |
| `node --test test/unit/docs-check.test.mjs` | [14/14 PASS](docs/evidence/1.1.2/docs-gate-fix-20261101/docs-regression.txt)：3 项正向、11 项负向；普通失效文件/文档链接、索引链接、子文件、相似目录等均保持退出 1 |
| 同一最终测试套件运行原检查器 | [11 PASS / 3 FAIL，退出 1](docs/evidence/1.1.2/docs-gate-fix-20261101/regression-before-final.txt)：两个缺失 profile 正向场景及混合引用问题数断言失败，证明测试能检出此次误报 |
| `npm test` | [47/47 PASS](docs/evidence/1.1.2/docs-gate-fix-20261101/unit.txt)，含原有 33 项及新增 14 项 |
| `npm run lint` / `git diff --check` | [44 个文件语法通过](docs/evidence/1.1.2/docs-gate-fix-20261101/lint.txt)；diff 空白检查退出 0 |
| 原包验证器（只读，不构建/打包） | [PASS](docs/evidence/1.1.2/docs-gate-fix-20261101/package-verification.json)：CRC、38 文件、白名单、源码/dist/ZIP 字节一致及 36 个运行资源与 1.1.1 基线一致 |
| 原有文件保全 | [PASS](docs/evidence/1.1.2/docs-gate-fix-20261101/preservation.json)：本轮开始的 326 文件清单与 closeout 的 372 文件清单分别复核，均仅检查器发生预期变化；其余原有文件、既有发布报告和证据无变化 |

首次新增测试误将索引链接的两个既有诊断（index/path）计为一个；已修正测试预期并完整复跑。首次日志保留为本轮证据中的 `*-attempt1.*`，不作为最终通过证据。

锁定 ZIP：`releases/permission-recheck-20261101/EasyCV-v1.1.2-20261031.zip`，132475 字节，SHA256：

```text
6a2f2478e847ff06d6b7a35dbe01b543d2cd00ab52df7f96d2763d758e77782a
```

包验证器自带的 `storePackageMatch: NOT_VERIFIED` 仅说明该脚本未验证商店来源，不覆盖 closeout 已有的 `STORE_PACKAGE_MATCH_GATE = PASS`。

## 剩余风险与判定

规则只处理已核实的这一种运行目录说明；其他生成路径需要分别审查。检查器仍沿用索引纳管及原有路径提取范围，不代表全仓 Markdown 语义完整校验。未重跑浏览器/E2E，未新增 Windows、真实升级或正常重启设置保持证据。

本轮解除 docs 阻塞项；`HOTFIX_RELEASE_READY = FAIL`、`UPGRADE_AND_PERSISTENCE_GATE = PARTIAL`、`PLATFORM_ACCEPTANCE_GATE = PARTIAL`、`KNOWN_BASELINE_RISK_GATE = PARTIAL` 保持。其余 Gate 保持 closeout 原状态，整体发布仍阻塞。回滚只需撤销检查器本轮差异、移走新增测试及本报告/本轮证据目录，保留所有既有未提交工作。

```ini
DOCS_CHECK_GATE = PASS
PRODUCT_RUNTIME_MODIFIED = NO
LOCKED_ZIP_CHANGED = NO
WINDOWS_ACCEPTANCE = NOT_RUN
UPGRADE_PERSISTENCE = NOT_VERIFIED
RELEASE_DECISION = BLOCKED
COMMIT_CREATED = NO
PUSH_PERFORMED = NO
STORE_SUBMISSION = NOT_RUN
```
