# EasyCV 隐私政策

生效日期：2026-11-01

EasyCV（以下简称"本扩展"）尊重并保护用户隐私。本政策说明本扩展如何处理信息。

## 我们不收集任何数据

本扩展不收集、存储（在开发者服务器上）、传输或共享任何用户数据，包括但不限于：浏览历史、页面内容、个人身份信息、位置信息。本扩展没有任何遥测、统计上报或广告组件，代码中不存在任何网络请求。

## 本地存储说明

以下数据仅保存在你的浏览器中（chrome.storage.sync / chrome.storage.local，由浏览器提供，可能通过你的 Google 账号同步，不经过开发者）：

- 扩展设置（功能开关、自动解锁名单、站点排除列表）
- 使用统计（处理站点数、激活次数，仅本地展示）
- 错误报告与用户反馈草稿（仅本地保留最近 10/20 条，供你排查问题时参考，不会自动发送）

你可以随时在扩展设置页「高级设置 → 清除所有数据」删除以上全部内容，或卸载扩展自动清除。

后续优化源码的反馈入口（尚未包含在锁定的 1.1.2 ZIP）：用户主动点击后打开 GitHub issue 草稿，仅自动填写扩展版本及空白模板，不自动附带浏览地址、查询参数或浏览器明细。你可以编辑、放弃或自行提交草稿；提交内容由 GitHub 按其政策处理。帮助指南直接在扩展内显示。

## 权限说明

1.1.2 移除未使用的 `scripting` 与冗余的 `activeTab` 权限。保留 `storage`（设置、自动启用与排除列表、统计的浏览器存储）和 `contextMenus`（右键操作）。保留 `<all_urls>` 网站访问范围，用于任意普通网页的静态 Content Script、自动解锁及标签页 URL 识别；页面脚本通过扩展内的 web-accessible resource 加载。商店权限说明应与此一致。

## 开源可审计

本扩展全部源代码以 MIT 协议公开：https://github.com/fenghuashao/EasyCV ，欢迎审查。

## 联系我们

隐私相关问题请通过 GitHub Issues 反馈：https://github.com/fenghuashao/EasyCV/issues

---

# EasyCV Privacy Policy

Effective date: 2026-11-01

EasyCV ("the extension") respects your privacy.

## We collect nothing

The extension does not collect, store (on any developer server), transmit, or share any user data — including browsing history, page content, personal identity, or location. It contains no telemetry, analytics, or ads, and makes no network requests of any kind.

## What stays in your browser

The following data lives only in your browser's own chrome.storage (synced by your Google account, never touching the developer):

- Extension settings (toggles, auto-unlock list, site exclusion list)
- Usage statistics shown locally
- Recent error reports & feedback drafts (last 10/20 entries, local only, never sent automatically)

You can wipe everything via Settings → Advanced → Clear all data, or by uninstalling.

The feedback flow in the next development iteration (not included in the locked 1.1.2 ZIP) opens a GitHub issue draft only when you click Feedback. It pre-fills the extension version and a blank template, without browsing URLs, query parameters or browser details. You can edit, discard or submit it yourself; submitted content is handled by GitHub under its policies. Help is shown locally in the extension.

## Permissions

Version 1.1.2 removes unused `scripting` and redundant `activeTab`. It retains `storage` for settings, lists and local statistics, and `contextMenus` for context menu actions. `<all_urls>` remains for static content scripts, automatic unlocking and tab URL identification on ordinary web pages. The page script is loaded from a packaged web-accessible resource.

## Open source

Fully auditable under MIT: https://github.com/fenghuashao/EasyCV
