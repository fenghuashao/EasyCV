# EasyCV API设计文档

## 📋 文档概述

**项目名称**: EasyCV - 解除网页复制粘贴限制插件  
**API版本**: V1.0  
**文档版本**: 1.0.0  
**最后更新**: 2026年11月3日（设置读写及状态刷新协议）

## 🎯 API架构概览

EasyCV插件采用模块化架构，主要包含以下API模块：

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   DOM Utils     │    │ Message Utils   │    │ Storage Utils   │
│     API         │    │      API        │    │      API        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Service Worker │
                    │      API        │
                    └─────────────────┘
```

## 🔧 DOM Utils API

### 类: DOMUtils
**文件位置**: `utils/dom-utils.js`  
**职责**: 提供安全的DOM操作、事件处理、样式修改功能

#### 方法列表

##### removeEventListeners(element, eventTypes)
**功能**: 移除指定元素的事件监听器

**参数**:
- `element` (HTMLElement): 目标DOM元素
- `eventTypes` (Array<string>): 要移除的事件类型数组

**返回值**: `boolean` - 操作是否成功

**示例**:
```javascript
const success = DOMUtils.removeEventListeners(document.body, ['selectstart', 'contextmenu']);
```

##### modifyStyles(element, styles, backup = true)
**功能**: 修改元素样式属性

**参数**:
- `element` (HTMLElement): 目标DOM元素
- `styles` (Object): 样式属性对象
- `backup` (boolean): 是否备份原始样式

**返回值**: `Object` - 备份的原始样式对象

**示例**:
```javascript
const originalStyles = DOMUtils.modifyStyles(element, {
  'user-select': 'text',
  '-webkit-user-select': 'text'
}, true);
```

##### detectSelectionRestrictions(element)
**功能**: 检测元素是否存在选择限制

**参数**:
- `element` (HTMLElement): 要检测的DOM元素

**返回值**: `Object` - 检测结果对象
```javascript
{
  hasRestrictions: boolean,
  restrictionTypes: Array<string>,
  affectedProperties: Array<string>
}
```

##### restoreOriginalBehavior(element)
**功能**: 恢复元素的原始行为

**参数**:
- `element` (HTMLElement): 目标DOM元素

**返回值**: `boolean` - 恢复是否成功

##### traverseElements(root, callback, options = {})
**功能**: 遍历DOM元素树

**参数**:
- `root` (HTMLElement): 根元素
- `callback` (Function): 回调函数
- `options` (Object): 遍历选项

**选项参数**:
```javascript
{
  maxDepth: number,        // 最大遍历深度
  skipHidden: boolean,     // 是否跳过隐藏元素
  includeTextNodes: boolean // 是否包含文本节点
}
```

##### safeExecute(operation, fallback = null)
**功能**: 安全执行DOM操作

**参数**:
- `operation` (Function): 要执行的操作函数
- `fallback` (any): 失败时的回退值

**返回值**: `any` - 操作结果或回退值

##### isElementVisible(element)
**功能**: 检查元素是否可见

**参数**:
- `element` (HTMLElement): 目标DOM元素

**返回值**: `boolean` - 元素是否可见

##### getTextElements(container)
**功能**: 获取容器内的所有文本元素

**参数**:
- `container` (HTMLElement): 容器元素

**返回值**: `Array<HTMLElement>` - 文本元素数组

## 📡 Message Utils API

### 类: MessageUtils
**文件位置**: `utils/message-utils.js`  
**职责**: 处理Chrome Extension内部通信

#### 方法列表

##### sendToBackground(message)
**功能**: 向background script发送消息

**参数**:
- `message` (Object): 消息对象

**消息格式**:
```javascript
{
  type: string,           // 消息类型
  data: any,             // 消息数据
  timestamp: number,     // 时间戳
  tabId?: number         // 标签页ID（可选）
}
```

**返回值**: `Promise<any>` - 响应数据

##### sendToContent(tabId, message)
**功能**: 向content script发送消息

**参数**:
- `tabId` (number): 目标标签页ID
- `message` (Object): 消息对象

**返回值**: `Promise<any>` - 响应数据

##### addMessageListener(callback)
**功能**: 添加消息监听器

**参数**:
- `callback` (Function): 消息处理回调函数

**回调函数签名**:
```javascript
(message, sender, sendResponse) => {
  // 处理消息逻辑
  return true; // 异步响应
}
```

##### validateMessage(message)
**功能**: 验证消息格式

**参数**:
- `message` (any): 要验证的消息

**返回值**: `boolean` - 消息是否有效

##### getCurrentTabId()
**功能**: 获取当前标签页ID

**返回值**: `Promise<number>` - 当前标签页ID

##### broadcastToAllTabs(message)
**功能**: 向所有标签页广播消息

**参数**:
- `message` (Object): 要广播的消息

**返回值**: `Promise<Array>` - 所有响应结果数组

##### createResponse(success, data, error = null)
**功能**: 创建标准响应对象

**参数**:
- `success` (boolean): 操作是否成功
- `data` (any): 响应数据
- `error` (string): 错误信息（可选）

**返回值**: `Object` - 标准响应对象
```javascript
{
  success: boolean,
  data: any,
  error: string|null,
  timestamp: number
}
```

##### handleAsyncResponse(promise)
**功能**: 处理异步响应

**参数**:
- `promise` (Promise): 异步操作Promise

**返回值**: `Promise<Object>` - 标准响应对象

## 💾 Storage Utils API

### 类: StorageUtils
**文件位置**: `utils/storage-utils.js`  
**职责**: 管理Chrome Extension存储

#### 方法列表

##### get(keys)
**功能**: 获取存储数据

**参数**:
- `keys` (string|Array<string>|Object): 要获取的键

**返回值**: `Promise<Object>` - 存储数据

##### set(items)
**功能**: 设置存储数据

**参数**:
- `items` (Object): 要存储的数据对象

**返回值**: `Promise<void>`

##### remove(keys)
**功能**: 删除存储数据

**参数**:
- `keys` (string|Array<string>): 要删除的键

**返回值**: `Promise<void>`

##### clear()
**功能**: 清空所有存储数据

**返回值**: `Promise<void>`

##### getLocal(keys)
**功能**: 获取本地存储数据

**参数**:
- `keys` (string|Array<string>|Object): 要获取的键

**返回值**: `Promise<Object>` - 本地存储数据

##### setLocal(items)
**功能**: 设置本地存储数据

**参数**:
- `items` (Object): 要存储的数据对象

**返回值**: `Promise<void>`

#### 专用方法

##### getPluginSettings()
**功能**: 获取插件设置

`enabled`、`forceMode` 以独立存储键 `plugin_enabled`、`force_mode` 为准，覆盖旧 `user_settings` 对象中同名字段。名单通过专用 getter 读取。

**返回值**: `Promise<Object>` - 插件设置对象
```javascript
{
  enabled: boolean,
  forceMode: boolean,
  showNotifications: boolean,
  copyEnabled: boolean,
  pasteEnabled: boolean
}
```

##### setPluginSettings(settings)
**功能**: 设置插件配置

支持部分字段更新。设置页仅传入本次编辑字段，避免把页面打开时的旧快照覆盖到其他入口刚修改的设置。

**参数**:
- `settings` (Object): 插件设置对象

**返回值**: `Promise<void>`

##### getForceMode()
**功能**: 获取强力模式状态

**返回值**: `Promise<boolean>` - 强力模式是否启用

##### setForceMode(enabled)
**功能**: 设置强力模式状态

**参数**:
- `enabled` (boolean): 是否启用强力模式

**返回值**: `Promise<void>`

##### getAutoEnableList()
**功能**: 获取自动开启列表

**返回值**: `Promise<Array<string>>` - 域名列表

##### addToAutoEnableList(domain)
**功能**: 添加域名到自动开启列表

**参数**:
- `domain` (string): 要添加的域名

**返回值**: `Promise<void>`

##### removeFromAutoEnableList(domain)
**功能**: 从自动开启列表移除域名

**参数**:
- `domain` (string): 要移除的域名

**返回值**: `Promise<void>`

##### getUserSettings()
**功能**: 获取用户设置

**返回值**: `Promise<Object>` - 用户设置对象

##### setUserSettings(settings)
**功能**: 设置用户配置

**参数**:
- `settings` (Object): 用户设置对象

**返回值**: `Promise<void>`

##### getStats()
**功能**: 获取使用统计

**返回值**: `Promise<Object>` - 统计数据对象
```javascript
{
  totalUsage: number,
  successfulUnlocks: number,
  lastUsed: number,
  sitesUnlocked: Array<string>
}
```

##### updateStats(statsUpdate)
**功能**: 更新使用统计

**参数**:
- `statsUpdate` (Object): 统计更新数据

**返回值**: `Promise<void>`

## 🔄 Service Worker API

### 文件: service-worker.js
**文件位置**: `background/service-worker.js`  
**职责**: 管理插件生命周期、处理消息通信、管理存储

#### 消息类型定义

```javascript
const MESSAGE_TYPES = {
  // 功能控制
  TOGGLE_PLUGIN: 'toggle_plugin',
  ENABLE_FORCE_MODE: 'enable_force_mode',
  DISABLE_FORCE_MODE: 'disable_force_mode',
  
  // 状态查询
  GET_STATUS: 'get_status',
  GET_SETTINGS: 'get_settings',
  UPDATE_SETTINGS: 'update_settings',
  
  // 页面分析
  ANALYZE_PAGE: 'analyze_page',
  PAGE_ANALYSIS_RESULT: 'page_analysis_result',
  
  // 用户反馈
  SUBMIT_FEEDBACK: 'submit_feedback',
  
  // 自动开启
  CHECK_AUTO_ENABLE: 'check_auto_enable',
  ADD_TO_AUTO_LIST: 'add_to_auto_list',
  REMOVE_FROM_AUTO_LIST: 'remove_from_auto_list',
  
  // 统计数据
  UPDATE_STATS: 'update_stats',
  GET_STATS: 'get_stats',
  
  // 错误报告
  REPORT_ERROR: 'report_error'
};
```

#### 消息处理接口

##### 插件控制消息

**TOGGLE_PLUGIN**
```javascript
// 请求
{
  type: 'toggle_plugin',
  data: {
    enabled: boolean,
    tabId: number
  }
}

// 响应
{
  success: boolean,
  data: {
    isEnabled: boolean,
    tabId: number
  }
}
```

**ENABLE_FORCE_MODE / DISABLE_FORCE_MODE**
```javascript
// 请求
{
  type: 'enable_force_mode', // 或 'disable_force_mode'
  data: {
    tabId: number
  }
}

// 响应
{
  success: boolean,
  data: {
    forceMode: boolean
  }
}
```

##### 状态查询消息

**GET_STATUS**
```javascript
// 请求
{
  type: 'get_status',
  data: {
    domain?: string  // content.js 携带当前页主机名，供排除列表裁决（DEBT-08）
  }
}

// 响应
{
  success: boolean,
  data: {
    enabled: boolean,        // 命中排除列表的站点恒为 false（优先级高于全局开关）
    copyEnabled: boolean,
    pasteEnabled: boolean,
    forceMode: boolean,
    settings: Object,        // 用户设置快照
    domainConfig: Object|null, // 当前域名在自动启用名单中的配置（未配置为默认）
    excluded: boolean,       // 本站是否命中排除列表（DEBT-08）
    timestamp: number
  }
}
```

**状态刷新通知（1.1.2）**

状态变更通知使用 `MessageUtils.MESSAGE_TYPES` 的实际值：`state_updated`、`copy_status_changed`、`paste_status_changed`。内容端将这些通知入队后重新发送带当前域名的 `GET_STATUS`；`state_updated.data.newState` 是后台缓存结构，不能直接作为页面状态。存储广播 `update_status` 涉及主开关、强力模式、用户设置、自动名单或排除名单时同样重读本站状态。无关统计键不触发页面重应用。

**GET_SETTINGS**

```javascript
// 请求
{
  type: 'get_settings'
}

// 响应
{
  success: boolean,
  data: {
    isEnabled: boolean,
    forceMode: boolean,
    showNotifications: boolean,
    autoEnableList: Array<string>
  }
}
```

##### 自动开启管理

**ADD_TO_AUTO_LIST**
```javascript
// 请求
{
  type: 'add_to_auto_list',
  data: {
    domain: string
  }
}

// 响应
{
  success: boolean,
  data: {
    autoEnableList: Array<string>
  }
}
```

##### 统计数据

**UPDATE_STATS**
```javascript
// 请求
{
  type: 'update_stats',
  data: {
    action: string,        // 'unlock', 'enable', 'disable'
    domain: string,
    timestamp: number
  }
}

// 响应
{
  success: boolean,
  data: {
    totalUsage: number,
    successfulUnlocks: number
  }
}
```

## 🎨 Content Script API

### 文件: content.js
**文件位置**: `content/content.js`  
**职责**: 页面内容操作、限制检测和解除

#### 类: CopyPasteManager

##### 主要方法

**init()**
- 初始化管理器
- 设置消息监听
- 开始DOM监听

**enable()**
- 启用复制粘贴功能
- 移除页面限制
- 注入解除脚本

**disable()**
- 禁用功能
- 恢复原始行为

**enableForceMode()**
- 启用强力模式
- 深度DOM操作
- 高级限制解除

**analyzePageRestrictions()**
- 分析页面限制类型
- 返回检测结果

## 🔧 Injector Script API

### 文件: injector.js
**文件位置**: `content/injector.js`  
**职责**: 页面上下文中的深层限制拦截

#### 主要功能

**事件拦截**
- 覆盖 `addEventListener`
- 拦截限制性事件监听器
- 阻止 `preventDefault` 调用

**样式强制**
- 强制启用文本选择
- 覆盖CSS限制
- 动态样式保护

**动态保护**
- `MutationObserver` 监听
- 实时移除新增限制
- 持续保护机制

## 📋 错误处理规范

### 错误类型

```javascript
const ERROR_TYPES = {
  DOM_ACCESS_ERROR: 'dom_access_error',
  PERMISSION_ERROR: 'permission_error',
  STORAGE_ERROR: 'storage_error',
  COMMUNICATION_ERROR: 'communication_error',
  VALIDATION_ERROR: 'validation_error'
};
```

### 错误响应格式

```javascript
{
  success: false,
  error: {
    type: string,
    message: string,
    code: number,
    details: Object
  },
  timestamp: number
}
```

## 🔒 安全规范

### 权限控制
- 最小权限原则
- 动态权限请求
- 权限状态检查

### 数据验证
- 输入参数验证
- 消息格式验证
- 域名白名单检查

### 错误处理
- 异常捕获机制
- 错误日志记录
- 用户友好提示

---

**文档维护**: 本文档随代码实现同步更新  
**版本控制**: 遵循语义化版本规范  
**最后更新**: 2026年11月3日（设置读写及状态刷新协议）
