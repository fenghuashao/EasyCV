# EasyCV 隐私政策

生效日期：2026-11-03 ｜ 适用版本：EasyCV 1.1.1，以及 1.1.3 和之后包含同等数据处理方式的版本

EasyCV 帮助你在受到限制的网页上使用复制、粘贴、文字选择和右键菜单。下文先说明 1.1.3 的处理方式，1.1.1 的区别见「1.1.1 版本」。

## 1.1.3 如何处理数据

EasyCV 没有开发者服务器，没有遥测、广告或远程代码，也没有向开发者发送数据的接口。以下处理全部发生在你的浏览器中。

### 网页内容（Website content）

为检测并解除网页上的复制、粘贴、文字选择和右键限制，扩展会在你访问的普通网页上处理页面结构、内联事件处理器和样式，并在需要时向页面注入随扩展打包的脚本。扩展不读取或保存剪贴板内容，也不把网页正文、完整浏览地址或查询参数写入诊断。

### 浏览记录与站点规则（Web history）

扩展会读取**当前页面**的地址或域名，用于匹配你的站点规则、排除名单并显示当前页面状态。扩展不会自行建立浏览历史。

你手工配置的站点规则和排除名单保存在浏览器的 `chrome.storage.sync`，其中包含你填写的域名。浏览器可能按照你的账号设置把这些设置同步到你的其他设备；该同步由浏览器及其服务提供方处理，不经过 EasyCV 开发者服务器。

### 用户活动（User activity）

旧版本会在同步存储中记录站点交互记录（域名与时间）以及按站点统计的使用次数。1.1.3 不再新增这类记录；升级时会把这些历史数据迁移到本机备份（见下节），并在你的设备上保留，直到你手动删除。

### 启用计数、诊断与本机副本

- 启用次数、当日计数及日期保存在本机 `chrome.storage.local`，仅用于本机展示；可在设置中关闭计数。这些数字不表示实际复制成功次数或成功率。
- 最近最多 10 条简化诊断保存在本机，只包含固定错误码、模块以及可用时的时间和扩展版本；不包含浏览地址、页面正文、剪贴板内容、异常正文或堆栈。扩展没有自动上传诊断的服务。
- 保留在本机的旧版配置副本可由你导出并主动恢复。同步设置优先，不会被本机副本静默覆盖。

## 旧版本数据与迁移

旧版本可能将统计（含按站点计数）、站点交互记录、错误详情和反馈草稿保存在同步存储中。升级后，只有在你明确同意产品内的数据说明后，扩展才会启用网页功能并开始迁移：先把历史统计和交互记录备份到本机并校验，之后才移除对应的同步副本；旧诊断会被脱敏，旧反馈草稿内容会被丢弃。你的设置和手工规则不因这项迁移而删除。同意前，旧数据可能仍保留在同步存储中。

如果本机写入、校验或同步清理失败，未完成的同步副本会被保留，设置页面会提示重试。浏览器账号中的远端历史副本，以及仍在运行旧版的其他设备上的副本，不能保证立即删除。

## 你的选择

你可以在设置中关闭计数、编辑或删除站点规则，并使用「设置 → 高级设置 → 清除所有数据」删除扩展设置、规则、本机计数、诊断和历史备份。关闭计数只停止新增计数，不会自动删除已有计数。清除前如需保留配置请先导出；配置导出不包含旧访问历史或诊断。存储操作失败时请按界面提示重试。同步数据以及其他设备上的状态仍受浏览器自身的同步机制影响。

## 用户主动打开的外部页面

点击反馈时，扩展会打开 GitHub issue 草稿，预填扩展版本和空白模板，不自动附带浏览地址或诊断。是否编辑或提交由你决定；提交后由 GitHub 根据其政策处理。其他仓库和文档链接仅在你主动点击时打开。请不要在反馈中填写密码、令牌、私密正文或含敏感参数的网址。

## 权限与用途限制

`storage` 用于上述设置和本机数据；`contextMenus` 用于扩展右键快捷操作；网站访问范围用于在你访问的普通网页上判断规则并执行核心功能。你可以将站点加入排除名单或关闭总开关，浏览器内部页面等受保护页面不受支持。扩展不申请 `scripting`、`activeTab` 或剪贴板读写权限，随扩展提供的脚本全部打包在扩展内，不从网络加载或执行远程代码。

EasyCV 对从 Google API 获得的信息的使用和传输将遵守 Chrome Web Store 用户数据政策，包括 Limited Use 要求。

## 1.1.1 版本

1.1.1 的数据处理与上面的 1.1.3 不完全相同：

- 站点交互记录可能包含域名和时间；统计可能包含曾处理站点的域名。这些数据、设置和规则使用浏览器同步存储；同步不可用时可能写入本机存储。
- 错误报告可能包含完整网页地址、错误消息与堆栈、浏览器信息、时间和消息发送方信息，并可能通过浏览器账号同步。反馈记录也可能保存在浏览器存储中。
- 点击旧版反馈按钮时，扩展会把当前网页地址、浏览器信息及时间预填到 GitHub 反馈链接。打开链接时这些信息可能随网址发送给 GitHub，即使你没有提交反馈。不要在含敏感信息的网页上使用旧版反馈按钮；可以直接打开下方 Issues 链接。
- 该版本申请 `activeTab`、`storage`、`scripting`、`contextMenus` 及 `<all_urls>`。你可以在扩展设置中清除扩展数据、禁用或卸载扩展；浏览器同步和其他设备上的副本受浏览器自身行为影响。

升级到 1.1.3 后，扩展不再新增旧式站点交互记录，并按上文所述在你同意后处理旧数据。

## 变更与联系方式

政策变更会随新版本在本页面更新。隐私相关问题请通过 GitHub Issues 反馈：https://github.com/fenghuashao/EasyCV/issues

源码与可审计实现：https://github.com/fenghuashao/EasyCV

---

# EasyCV Privacy Policy

Effective date: 2026-11-03 | Applies to: EasyCV 1.1.1, and 1.1.3 and later versions with the same data handling

EasyCV helps you use copy, paste, text selection and the context menu on web pages that restrict them. The following sections describe 1.1.3; differences for 1.1.1 are described below.

## How 1.1.3 handles data

EasyCV has no developer server, no telemetry, no advertising and no remote code, and no interface that sends data to the developer. All of the handling below happens in your browser.

### Website content

To detect and remove copy, paste, text-selection and right-click restrictions, the extension processes page structure, inline event handlers and styles on the regular pages you visit, and injects a packaged script into the page when needed. The extension does not read or store clipboard contents, and never puts page text, complete browsing addresses or query parameters into diagnostics.

### Web history and site rules

The extension reads the **current page's** address or domain to match your site rules and exclusion list and to show the current page status. The extension does not build a browsing history of its own.

The site rules and exclusions you configure manually are stored in the browser's `chrome.storage.sync`, and they include the domains you type. Your browser may synchronize these settings across your devices according to your account settings. That synchronization is handled by the browser and its service provider, not by an EasyCV developer server.

### User activity

Older versions stored site interaction records (domain and time) and per-site usage counts in synchronized storage. Version 1.1.3 no longer records them; on upgrade it migrates that history to a local backup (see below), where it stays on your device until you delete it.

### Activation counts, diagnostics and the local copy

- Activation counts, today's count and the date are stored on the device in `chrome.storage.local` for display only. Counting can be disabled in Settings. These numbers do not measure successful copies or an unlock success rate.
- Up to ten minimal diagnostic records stay on the device. They contain a fixed error code, module, and timestamp and extension version when available; they do not include browsing addresses, page text, clipboard contents, exception text or stacks. EasyCV has no automatic diagnostic upload service.
- A legacy local configuration copy can be exported and explicitly restored by you. Synchronized settings take priority and are not silently overwritten by that copy.

## Legacy data and migration

Older versions may have stored statistics (including per-site counts), site interaction records, error details and feedback drafts in synchronized storage. After you explicitly agree to the in-product notice, the extension enables page features and starts migration: it first backs up legacy statistics and interaction records locally and verifies the copy before trying to remove the corresponding synchronized entries. Old diagnostics are sanitized and old feedback-draft contents are discarded. Your settings and manually configured rules are not deleted by this migration. Until you agree, old data may remain in synchronized storage.

If a local write, verification or synchronized-storage removal fails, the unfinished synchronized copies remain and Settings provides a retry notice. Immediate deletion of copies in your browser account, or on other devices still running an older version, cannot be guaranteed.

## Your choices

You can disable counting, edit or remove site rules, and use Settings → Advanced → Clear all data to delete extension settings, rules, local counts, diagnostics and legacy backups. Disabling counting stops new counts but does not erase existing ones. Export configuration first if you want to keep it; configuration exports exclude legacy visit history and diagnostics. Retry if the interface reports a storage failure. Synchronized data and other devices remain subject to the browser's synchronization behaviour.

## External pages you choose to open

When you choose Feedback, EasyCV opens a GitHub issue draft with the extension version and an empty template; it does not automatically attach a browsing address or diagnostics. You decide whether to edit or submit it. GitHub handles submitted information under its own policies. Other repository and documentation links open only when you choose them. Please do not include passwords, tokens, private page text or URLs with sensitive parameters in feedback.

## Permissions and Limited Use

`storage` supports the settings and local data described above; `contextMenus` provides extension shortcuts in the context menu; website access is used to match rules and perform the core feature on the regular pages you visit. You can exclude a site or turn the extension off entirely; browser-protected pages are not supported. The extension does not request `scripting`, `activeTab` or clipboard permissions, and every script it runs is packaged inside the extension rather than loaded or executed from the network.

EasyCV's use and transfer of information received from Google APIs will comply with the Chrome Web Store User Data Policy, including its Limited Use requirements.

## Version 1.1.1

Version 1.1.1 differs from 1.1.3 in these respects:

- Site interaction records may include domains and times, and statistics may include domains of sites processed. These records, settings and rules use browser sync storage, with local storage as a fallback when sync is unavailable.
- Error reports may include full page addresses, error messages and stacks, browser information, timestamps and message sender information, and may sync through your browser account. Feedback records may also be stored in browser storage.
- When you open the old feedback link, it pre-fills the current page address, browser information and time in a GitHub URL. GitHub may receive that information when the link is opened, even if you do not submit the issue. Avoid the old feedback button on pages with sensitive information; you can open the Issues link below directly.
- This version requests `activeTab`, `storage`, `scripting`, `contextMenus` and `<all_urls>`. You can clear extension data in Settings, disable or uninstall the extension; synchronized copies and other devices remain subject to browser behaviour.

After upgrading to 1.1.3, the extension stops adding the old site interaction records and handles legacy data as described above after you agree.

## Changes and contact

Changes to this notice are published on this page together with the relevant version. Privacy questions can be raised through GitHub Issues: https://github.com/fenghuashao/EasyCV/issues

Source and auditable implementation: https://github.com/fenghuashao/EasyCV
