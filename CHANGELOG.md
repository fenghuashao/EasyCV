# Changelog

所有重要的项目更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [1.1.0] - 2026-08-06

### ✨ 新功能
- 站点排除列表（DEBT-08）：设置页新增「站点排除」管理，被排除站点完全休眠（优先级高于全局开关、自动启用与强力模式），是误伤场景的用户逃生通道；匹配支持子域覆盖（排除 bilibili.com 即覆盖 www.bilibili.com）；内置 accounts.google.com / login.live.com / appleid.apple.com 敏感账号域名默认排除（解除脚本不在账号登录页运行）；纳入设置导入导出
- t1 重写合并：标准国际化（_locales 中英双语）；Shadow DOM 穿透与 SPA 路由感知；popup 重构为单主按钮 + 高级折叠区；自动启用管理逻辑重构

### 🔒 拦截策略收敛（DEBT-03，基于 8 个真实站点双上下文回归实测）
- R1 拦截路径零异常：修复页面篡改全局 Map 的站点（道客巴巴）上 TypeError 穿透进页面脚本的问题
- R2 收窄注册吞没名单至 6 类纯限制事件，keydown/keyup 仅在组合键时中和、移除 mouseup——保住播放器快捷键等正常交互
- R3 移除 content 层冗余 stopPropagation；contextmenu 维持全拦截防止定制菜单与原生菜单双弹（其副作用由站点排除列表兜底）

### 🎨 资源与权限
- 补齐 partial / inactive 状态图标 8 个 PNG 及生成脚本（DEBT-04）
- 移除未使用的 management 权限，权限申请最小化

### 🐛 修复（随 t1 重写合并）
- 消息白名单拦截、禁用后原型重写残留、存储设置缺失等多项历史缺陷

### 🧪 工程化
- 新增 lint / 单元测试 / e2e / docs:check 验证链
- 真实站点回归脚本与 2026-08 实测证据归档（test/real-sites/，非门禁）
