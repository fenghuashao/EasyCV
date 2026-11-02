# 本轮发现：Options 强制模式刷新显示不一致

状态：Windows Edge 156.0.4314.58 和 Chrome 156.0.8078.80 / 候选 1.1.2 **实际 UI 均已复现**。随后在同一 Windows、同版本 Chrome 中，正常商店安装的原 ID 1.1.1 也完成同样复现。按 P2 / 既存设置一致性问题单独登记，不认定为 1.1.2 新增权限回归，也不自动纳入已获讨论的 Popup 历史缺陷例外。

## 实际步骤与证据

1. 在独立 Edge Profile 加载锁定 ZIP 的原样解压目录，版本 1.1.2。
2. Options 常规设置中勾选 `#forceMode`，将通知设为 false、检测延迟设为 1500、重试设为 5。
3. UI 当时为 forceMode=true；后台 `force_mode=true`，而 `user_settings.forceMode=false`。见 [edge-nondefault-settings.json](edge-nondefault-settings.json)。所有写入均来自 UI，没有手工写存储。
4. 刷新 Options。通知 false、检测参数 1500/5 正确回读，**强制模式控件显示 false**。见 [edge-settings-refresh-observation.json](edge-settings-refresh-observation.json)。
5. 刷新后再只读核对：后台 `force_mode` 仍为 true、该控件仍为 false；自动名单与排除名单已正常保存。见 [edge-saved-lists-and-force-mismatch.json](edge-saved-lists-and-force-mismatch.json)。

初次等待隐藏 checkbox 的自动化步骤超时，已保留为 [edge-settings-lists-refresh.json](edge-settings-lists-refresh.json)；实际页面仍正常加载，最终 UI 和字段观察以上述两份补充记录为准。该等待失败不作为产品加载失败。

Chrome 对应步骤将通知设为 false、检测延迟设为 1700、重试设为 6，并添加 `chrome.localhost` 与 `blocked.localhost` 自动名单以及后一域名的排除项。[刷新前](chrome-settings-before-refresh.json)强制模式为 true，[刷新后](chrome-settings-lists-refresh.json)控件为 false、独立键仍为 true。随后从真正 action Popup 开关强力模式也得到相同分裂状态。正常关闭浏览器、确认该测试 Profile 进程归零后，以同一 Profile 原安装重启，[设置页 UI](chrome-restart-restored-full-ui.json)仍显示 false，而独立键仍为 true，其他非默认项和名单完整保留；[重启后真实粘贴](chrome-restart-real-paste-r2.json)及[复制/选择](chrome-restart-real-copy-paste-select.json)有效，不以独立键代替功能判断。

## 原商店 1.1.1 Windows 对照

[实际安装身份](store111-installed-identity-r2.json)：原 ID `bnbmgiidicjdbnmkmdnjeelhijnlhnjb`、1.1.1、`FROM_STORE / ENABLED`，独立 `chrome-store-profile`，正常从 Chrome Web Store 安装，无 manifest key、ID 或包文件修改。

同一 Windows 11 ARM64 / Chrome 156.0.8078.80：Options 勾选强制模式后，[刷新前](store111-force-ui-before-refresh.json)控件 true、独立键 true、旧嵌套键 false；[刷新后](store111-force-ui-after-refresh.json)控件 false、独立键仍为 true。故现在既有运行资源字节对照，也有真实 Windows 旧版 UI 对照，能够把该观察归为既存缺陷。

## 静态原因与判断边界

[StorageUtils.getPluginSettings](../../../../utils/storage-utils.js) 返回 `{enabled, forceMode, ...userSettings}`，后展开的旧 `userSettings.forceMode` 覆盖刚读取的独立字段。该文件及 Options 运行资源与已核验 1.1.1 原包的运行字节相同，且上述真实旧版 UI 对照复现同一行为；静态原因与实际观察一致。

[Options.updateSetting](../../../../options/options.js) 会将整个 `this.settings` 交给 `setPluginSettings`。因此，刷新后的陈旧 forceMode 还有可能在下一次无关设置保存时回写独立键；这是源码推断，**尚未用实际 UI 操作验证该后续覆盖，不声称已发生**。

本轮不修改业务代码、默认值、存储格式或锁定候选。此观察会影响“全部设置均正确回读”的验收判断；强力模式的实际网页效果及正常重启后表现需分别记录，不能因存储为 true 就判功能通过。
