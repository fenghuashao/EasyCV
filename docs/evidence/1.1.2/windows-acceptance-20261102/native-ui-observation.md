# Windows 原生 UI 观察与人工协作

范围：本次 Windows 11 ARM64 中的独立 Chrome/Edge Profile。`NATIVE_UI_GATE = PASS`，下列已实际执行动作标注 FA 人工协作。Chrome 覆盖三个菜单动作和受限网页菜单恢复，Edge 覆盖工具栏 Popup、全局菜单关闭/恢复的 smoke。原生界面截图在本次对话的 CUA 工具记录中；本目录没有另存该截图文件，不将缺失截图写成已交付附件。

## 工具栏与真实 action Popup

- Chrome：FA 从右上角拼图打开 EasyCV。FX 的原生截图观察到工具栏下的实际 Popup、EasyCV 标题及 `v1.1.2`、主按钮和高级选项；不是普通标签页中打开 `popup.html`。
- Edge：FA 从拼图打开 Popup，FX 的原生截图同样观察到 `v1.1.2` 与真实面板。该时全局开关被关闭，面板显示“插件已禁用”，与后续只读状态一致。
- Popup 内主按钮、强力选项的自动化使用真正 `chrome.action.openPopup()` 创建的 `POPUP / tabId=-1` 上下文，通过 CDP 鼠标输入操作；与上述物理工具栏打开步骤分别记录。网页功能由真实 Ctrl+C/Ctrl+V 和事件/落地文本验证，不能单凭 Popup 状态通过。
- [Chrome 原生 Popup 后的 CDP 探测](chrome-native-toolbar-popup-observed.json)未找到仍存活的 Popup 目标，属于未取得该次程序回读；真实打开的证据是先前已观察到的原生截图和 FA 操作。没有把该探测写成成功。

## 原生右键菜单与页面闭环

Chrome 和 Edge 均由真实鼠标右键打开浏览器原生菜单，FX 的 CUA 截图可见 EasyCV 菜单项；由 FA 点击子菜单。没有调用或模拟 `contextMenus.onClicked` 处理器。

| 浏览器 | 关闭后 | 恢复后 | 独立验证 |
| --- | --- | --- | --- |
| Chrome | `plugin_enabled=false`；刷新后受限 textarea/input 均为空，trusted paste 被取消 | `plugin_enabled=true`；刷新后两处均粘入 `EASYCV_CHROME_NATIVE_MENU_20261102`，trusted paste 未取消 | [关闭](chrome-native-menu-off-real-page.json)、[恢复](chrome-native-menu-on-real-page.json) |
| Edge | `plugin_enabled=false`；刷新后两处为空，plain 对照粘贴成功，两个受限 paste 被取消 | `plugin_enabled=true`；刷新后 plain 与两处受限输入均出现 `EASYCV_EDGE_NATIVE_MENU_20261102`，三次 trusted paste 未取消 | [关闭状态](edge-native-menu-after-assist.json)、[关闭页面](edge-native-menu-off-real-page.json)、[恢复状态](edge-native-menu-restored-state.json)、[恢复页面](edge-native-menu-on-real-page.json) |

Edge 第一次人工协作请求包含强力菜单动作，但最终回读证实只发生全局开关切换、`force_mode` 仍为 false。**因此该次只证明全局菜单动作，不能列为强力菜单入口通过。** 当前 smoke 的原生菜单闭环使用上表中的全局关闭/恢复结果。

Chrome 随后由 FA 实际选择另外两项：强力模式从 false 变为 true，`menu.localhost` 加入自动名单，并在重新打开的 Options 中实际渲染为“全部解锁”；[菜单后 UI/状态](chrome-native-force-and-add-auto-state-r2.json)。刷新该真实页面后，plain 对照及四类受限输入均粘入 `EASYCV_CHROME_NATIVE_ALL_ENTRIES_20261102`，五次 trusted paste 均未取消；[实际页面](chrome-native-force-mode-real-page-final.json)。这验证菜单动作及该模式下的页面可用性，不声称强力模式修复了已复现的历史 Popup 缺陷。第一次回读遇到原 Options 标签已关闭，已重新枚举标签并打开 Options；[旧标签失败记录](chrome-native-force-and-add-auto-confirmed.json)不作为产品失败。

Chrome 另补实际网页禁止右键的负对照：在本次 loopback fixture 通过普通 `contextmenu` 监听器调用 `preventDefault()`，没有修改产品或合成该事件。域名同时在自动名单和排除名单时，真实右键事件 `isTrusted=true/defaultPrevented=true`，CUA 观察不到原生菜单；从 Options 删除排除项、刷新后，同样的网页监听器被扩展拦截，原生右键菜单实际恢复。四类受限粘贴也从失败变成精确文本成功；重新添加排除项后限制再次恢复。见 [名单与菜单恢复对照](site-lists-and-native-context-summary.json)。

## 加载与输入边界

FA 分别在本次独立 Edge、Chrome 的开发模式中选择原样解压候选目录，随后 FX 核对扩展版本、身份与真实网页功能。Chrome 官方 ARM64 MSI 也由 FA 完成交互向导；没有操作私人 Profile。

Parallels 原生点击/键盘未可靠传递给 Windows 控件，相关不可达步骤由 FA 完成。跨浏览器切换还会出现 DOM `hasFocus=true` 但实际剪贴板按键未送达的情形：空白对照和 paste 事件均为空时废弃该轮键盘结果。两浏览器的最终有效结果均另有真实事件与精确文本断言，见 [重启与功能对照](restart-functional-comparison.json)。这类工具输入失败不计作产品失败。
