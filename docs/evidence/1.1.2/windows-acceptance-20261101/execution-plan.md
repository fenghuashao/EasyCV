# Windows 实测执行卡（待环境就绪；本文件不是通过证据）

候选只使用 `releases/permission-recheck-20261101/EasyCV-v1.1.2-20261031.zip`，SHA256 `6a2f2478e847ff06d6b7a35dbe01b543d2cd00ab52df7f96d2763d758e77782a`。
Windows 重装由 FA 操作；FX 不创建、删除、修复虚拟机，不修改 VM/浏览器企业策略、安全选项或个人 Profile。

## 环境与安装

1. 记录实际 Windows 版本、架构及 Chrome/Edge 版本；若是 ARM64，明确不等同于 x64 覆盖。
2. 每个浏览器使用独立、新建的 `--user-data-dir`，不登录、不启用同步；只启动本次测试路径。升级用 Chrome Profile 与候选独立安装 Profile 分开。
3. 将固定 ZIP 复制到测试目录，Windows `Get-FileHash -Algorithm SHA256` 再核对，解压后加载；不重建、不重新打包、不改 manifest/key。
4. 在浏览器原生扩展管理页核对 1.1.2 和启用状态，从工具栏打开实际 action Popup。扩展标签页不代替 Popup。
5. 本地 HTTP fixture 使用既有 `test/fixtures/permission-fix.html` 和 `popup-paste-triage-20261101/mechanisms.html`；真实网页选不需登录的公开页面。仅 localhost 监听，若无法传递测试资源则记录限制，不开放额外网络或修改 VM 共享配置。

## Chrome P0 / Edge smoke 的真实断言

| 项目 | 动作与必须观察的结果 |
| --- | --- |
| 安装/加载 | 原生管理页已安装、已启用、版本 1.1.2；工具栏实际 Popup 可打开 |
| Popup 主开关 | 点击实际主按钮；同时观察受限输入框行为。区分复制/粘贴子开关与全局 `plugin_enabled`，不能仅凭按钮文字称全局开关通过 |
| 强力模式 | 实际点击；用复杂限制页再尝试复制/粘贴，不能以 force_mode 或 injector 存在判成功 |
| 复制 | 先复制明确测试哨兵到普通输入框建立对照，再从受限文本 Ctrl+C、粘贴到普通框；核对实际文本，不能读取未知私人剪贴板 |
| 粘贴 | 已知测试哨兵 Ctrl+V 到受限 textarea/input，记录输入值；先在禁用/排除且刷新后的页面确认限制确实有效 |
| 选择 | 鼠标拖选受限文本，实际 selection 与可见高亮一致；合成 selectstart 不代替拖选 |
| 自动启用 | UI 添加测试域名、配置复制/粘贴，重新导航该域名，操作实际页面；观察未列入域名的对照 |
| 域名排除 | UI 添加测试域名，刷新后限制恢复；同域同时列入自动名单时仍排除；移除后刷新再解锁 |
| 右键菜单 | 在网页右键并实际选择 EasyCV 全局开关、强力模式、添加自动启用；另验证被站点禁用的原生网页菜单恢复 |
| 设置保存 | Options 修改非默认通知、检测参数及开关，添加/删除名单；等待保存、刷新、重开 UI 回读，结合真实页面检查 |
| 多标签 | A/B 两个已加载受限页，A 的 Popup 切换后直接在 B 进行实际操作；未刷新结果与刷新后结果分列，不能绕过已知同步缺陷 |
| 重启 | 正常退出本次测试浏览器，确认该 Profile 对应进程退出，再以同一 user-data-dir 启动；不卸载、不重新 loadExtension；回读 UI/名单并重复真实操作 |

Edge 至少覆盖安装、原生 Popup/右键、真实复制粘贴、非默认设置与名单保存及一次正常重启。Windows 原生项与既有 macOS 证据分开计。

## 已知 Popup 缺陷（两版同条件对照）

使用既有机制页，不改页面属性或直接调用 content 方法来刷通过：

1. Popup 关闭复制/粘贴，刷新含已有 `textarea/input onpaste="return false"` 的页面。
2. Popup 主按钮重新开启，在不刷新情况下实际 Ctrl+V，记录是否仍被阻止。
3. 开强力模式再粘贴，记录结果，不预设能补救。
4. 开启状态刷新页面，再粘贴；分别记录强力模式开/关。
5. 1.1.1 与 1.1.2 结果分别记录。历史共同缺陷单独登记 `ECV-POST-112-01`；不同结果才进一步调查新增回归。

## 同 ID 升级与持久化

1. Chrome 独立升级 Profile 从官方商店正常安装 1.1.1，核对 `bnbmgiidicjdbnmkmdnjeelhijnlhnjb`；下载 CRX 身份确认不等同于已安装。
2. 等首次安装初始化完成；通过 UI 写入非默认 `plugin_enabled`、`force_mode`、`user_settings.copyEnabled/pasteEnabled/showNotifications` 及检测参数；UI 添加自动启用名单（含每域名子开关）及自定义排除名单，保留默认敏感域名。保存正常设置出口，不手工复制存储。
3. 保留同一个安装、Profile 和数据目录；只接受已核实来源/签名且同一原 ID 的真实更新。记录升级前后版本与浏览器原生安装状态；若能观察真实 onInstalled/update，可作为附加证据，禁止合成事件。
4. 更新前与更新后分别记录上述设置/完整名单；真实复制、粘贴、选择、自动启用、排除优先级、Popup、右键与多标签复验。存储快照只做交叉核对。
5. 正常退出、同 Profile 重启，再完整回读并操作页面。区分候选独立安装重启通过和商店升级后的重启通过。
6. 当前官方请求仍返回 1.1.1；没有已建立的可信 1.1.2 更新来源时，升级保持 NOT_VERIFIED。禁止卸载重装、写 key/改 ID、搬运存储、编辑浏览器 Preferences 或放宽安装策略。

每项留存浏览器/OS 版本、URL、动作、预期/实际、截图或原始观察、是否刷新和对应版本。未执行写 NOT_RUN；证据不足写 NOT_VERIFIED；不因新 Win11 安装完成就认为扩展验收完成。
