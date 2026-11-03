# EasyCV 隐私说明（下一版本地草稿）

更新日期：2026-11-03。**这是 W1–W6 本地整改源码的披露草稿，版本号待后台核实；尚未发布，不代表当前商店版本或公开隐私页面已更新。**

## 数据如何处理

EasyCV 在页面中处理选择、复制和粘贴相关的样式及事件限制，不读取或保存剪贴板内容，不把页面正文、完整浏览 URL、查询参数或浏览器标识写入诊断。没有开发者遥测、广告或自动上传诊断的服务。

不同的数据使用不同的浏览器存储区域：

| 数据 | 存储与用途 |
| --- | --- |
| 功能开关、用户设置、手工自动启用规则、排除规则 | `chrome.storage.sync`，可能由浏览器按账号设置同步到其他设备；包含用户配置的域名，不是开发者服务器收集的浏览历史 |
| 启用次数、当日计数及日期 | `chrome.storage.local`，只在本机展示；可关闭计数，不记录访问域名，不代表真实复制成功次数或成功率 |
| 最近最多 10 条简化诊断 | `chrome.storage.local`；固定错误码、模块以及可用时的时间和扩展版本；不含 URL、sender 对象、UA、页面正文、异常正文或堆栈 |
| 旧版本机配置副本 | 保留在本机，提供导出及用户确认恢复；同步设置优先，不静默用副本覆盖同步设置 |
| 旧版统计与域名交互记录 | 升级迁移时先在 `chrome.storage.local` 保留历史备份并校验，再移除对应 sync 副本；新代码停止新增域名访问统计和访问时间记录 |

旧版本可能把错误详情、统计及交互记录保存在 sync。迁移将诊断脱敏，丢弃旧反馈草稿内容，并把历史统计／交互记录移为本机备份。**若本机写入、校验或同步清理失败，尚未完成的同步副本会保留，设置页会提示重试。**不能保证浏览器账号的远端历史副本或其他仍运行旧版的设备立即同步删除。设置和手工规则不因隐私迁移被删除。

关闭计数只停止新增计数。删除数据可使用「设置 → 高级设置 → 清除所有数据」；该操作也删除设置、规则、简化诊断及历史备份。若任何存储操作失败，界面会报告失败，请重试并检查结果。需要保留配置时先导出；配置导出不包含旧访问历史或诊断。

## 用户主动打开的外部页面

“反馈”只在点击后打开 GitHub issue 草稿，自动填写扩展版本和空白模板，不自动附带浏览地址或诊断。用户自行编辑、放弃或提交；提交内容按 GitHub 的政策处理。帮助内容在扩展内显示，仓库及文档链接由用户主动打开。请不要在反馈中填写密码、令牌、私密正文或含敏感参数的网址。

## 权限与资源

保留 `storage`（上述配置及本机数据）和 `contextMenus`（右键功能）；未申请 `scripting`、`activeTab` 或剪贴板读写权限。现有 `<all_urls>` 范围用于普通网页的静态内容脚本和站点判断；排除规则与总关闭优先。页面可访问资源已收缩为随扩展打包的 `content/injector.js`，不对页面公开工具脚本和图标目录。

公开隐私 URL、商店数据声明、权限理由与最终包的一致性仍需发布前核验。

源码和反馈：[EasyCV 仓库](https://github.com/fenghuashao/EasyCV)、[GitHub Issues](https://github.com/fenghuashao/EasyCV/issues)。

---

# EasyCV Privacy Notice (local draft for the next version)

Updated: 2026-11-03. **This draft describes the local W1–W6 changes. The release version is not locked, and neither the store listing nor the public policy has been updated by this work.**

EasyCV adjusts selection, copy and paste restrictions in the page. It does not read or retain clipboard contents, or put page text, complete browsing URLs, query parameters, browser identifiers, exception text or stacks in diagnostics. There is no developer telemetry, advertising or automatic diagnostic-upload service.

- Settings, manual site rules and exclusions use `chrome.storage.sync`. Your browser may synchronize these through your account. Configured domain names are user settings, rather than automatically collected visit history.
- Activation counts and the current usage date use `chrome.storage.local`. Counting can be disabled. Counts do not measure successful copying or unlock success rates; new visited-domain and visit-time collection has stopped.
- Up to 10 minimal diagnostic entries stay in local storage: a fixed code, module, and timestamp/extension version when available. They do not contain URLs, sender objects, user-agent details or clipboard/page contents.
- Legacy local settings remain available for export and explicit restoration. Synced settings take priority. Recovery does not silently replace synced values.
- Legacy statistics and interaction records are backed up locally and verified before the sync copies are removed. Old diagnostic records are sanitized and old feedback draft contents are discarded. Settings and manual rules are retained.

Migration can fail when local writes, verification or sync removal fail. Unremoved sync copies remain available for retry, with a notice in Settings. Deletion of remote account history or data on another device still running an old version cannot be guaranteed immediately.

Settings → Advanced → Clear all data deletes settings, rules, local counts, diagnostics and legacy backups. Failures are reported for retry. Export settings first if you want to keep them; configuration exports exclude visit history and diagnostics. Disabling counts does not delete previously stored counts.

Feedback opens a GitHub issue draft only on your click, with the extension version and a blank template. No browsing URL or diagnostic bundle is attached automatically. You decide whether to edit, discard or submit; GitHub handles submitted content under its policies. Avoid passwords, tokens, private page text and sensitive URLs. Help is displayed inside the extension.

The extension retains `storage`, `contextMenus` and the existing `<all_urls>` scope. It does not request `scripting`, `activeTab` or clipboard permissions. Exclusions and the global off switch take priority. Only the packaged `content/injector.js` is exposed as a web-accessible resource. Public policy and store disclosures must still be checked against the final release.

[Source](https://github.com/fenghuashao/EasyCV) · [Contact](https://github.com/fenghuashao/EasyCV/issues)
