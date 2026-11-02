# 自动名单首次访问未即时解锁

状态：Windows 11 ARM64 / Chrome 156.0.8078.80，在候选 1.1.2 和正常商店安装的原 ID 1.1.1 **均已实际复现**。作为本轮新登记的既存行为单独记录，暂按 P2；不认定为 1.1.2 新增权限回归，也不默认为已经批准放行的 Popup 例外。

## 实际场景

通过 Options UI 添加一个自动域名，配置复制、粘贴均启用。保持全局 `plugin_enabled=true`，从实际 Popup 将复制/粘贴子开关关闭，刷新未列入名单的基准页面，确认限制仍有效。再首次打开自动名单域名，使用同一已知剪贴板文本实际 Ctrl+V。

| 版本 | 自动域名首次访问 | 刷新后 |
| --- | --- | --- |
| 1.1.2 | `chrome.localhost` 的 plain 对照粘贴成功，但受限 textarea/input 均为空，trusted paste 被取消；[原始结果](chrome-auto-enabled-real-page.json) | 约六分钟后的未刷新复测仍被取消；刷新同页后两处均实际粘入哨兵，[延迟与刷新对照](chrome-auto-delayed-stale-then-refresh.json) |
| 商店 1.1.1 | `store-auto.localhost` 同样 plain 成功、两处受限输入为空、trusted paste 被取消；[首次访问](store111-auto-first-visit.json) | 刷新同页后两处均粘入相同哨兵，[刷新绕行](store111-auto-refresh-workaround.json) |

1.1.2 [后续只读状态](chrome-auto-observation-after-tests-r2.json)显示自动名单保留、全局启用且复制/粘贴子设置已回到 true，但这些存储值不作为首访功能成功的证据。两版的真实输入均证实首访未即时应用，刷新可绕行。

## 原因边界

[相关运行资源](auto-path-source-comparison.json)与已核验的 1.1.1 CRX 逐字节相同。源码中 AutoEnableManager 在页面完成加载后更改全局子设置，并发送大写 `COPY_STATUS_CHANGED` / `PASTE_STATUS_CHANGED`；MessageUtils 的消息白名单使用小写值，且内容端也没有消费后台的 `state_updated` 广播。由此推断，首屏取得旧状态后，后续状态传播没有把解锁应用到当前页面；该推断与真实页面和旧版对照一致，没有冒称已采集完整事件链路跟踪。

本轮不修改产品代码。自动启用项与多标签/Popup 的状态传播缺陷相关，但验收中仍把各自实际页面结果分别列出；已知根因不等于自动启用 P0 已通过。
