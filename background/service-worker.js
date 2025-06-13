/**
 * EasyCV 后台服务工作者
 * 处理插件生命周期管理、跨标签页通信、存储管理
 */

// 导入工具类（注意：在service worker中需要使用importScripts）
importScripts('../utils/storage-utils.js', '../utils/message-utils.js');

/**
 * 状态管理器
 * 统一管理插件的所有状态，提供原子性操作和一致性保证
 */
class StateManager {
  constructor() {
    this.stateCache = new Map();
    this.pendingOperations = new Map();
    this.listeners = new Set();
    this.initialized = false;
  }

  /**
   * 初始化状态管理器
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // 预加载关键状态到缓存
      await this.preloadStates();
      
      // 设置存储监听器
      this.setupStorageListener();
      
      this.initialized = true;
      console.log('StateManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize StateManager:', error);
      throw error;
    }
  }

  /**
   * 预加载关键状态
   */
  async preloadStates() {
    const keys = [
      StorageUtils.STORAGE_KEYS.PLUGIN_ENABLED,
      StorageUtils.STORAGE_KEYS.FORCE_MODE,
      StorageUtils.STORAGE_KEYS.USER_SETTINGS,
      StorageUtils.STORAGE_KEYS.AUTO_ENABLE_LIST
    ];
    
    const data = await StorageUtils.get(keys);
    
    // 缓存状态数据
    this.stateCache.set('pluginEnabled', data[StorageUtils.STORAGE_KEYS.PLUGIN_ENABLED] ?? StorageUtils.DEFAULT_SETTINGS.pluginEnabled);
    this.stateCache.set('forceMode', data[StorageUtils.STORAGE_KEYS.FORCE_MODE] ?? StorageUtils.DEFAULT_SETTINGS.forceMode);
    this.stateCache.set('userSettings', { ...StorageUtils.DEFAULT_SETTINGS, ...data[StorageUtils.STORAGE_KEYS.USER_SETTINGS] });
    this.stateCache.set('autoEnableList', data[StorageUtils.STORAGE_KEYS.AUTO_ENABLE_LIST] ?? StorageUtils.DEFAULT_SETTINGS.autoEnableList);
  }

  /**
   * 设置存储监听器
   */
  setupStorageListener() {
    StorageUtils.addStorageListener((changes, areaName) => {
      // 更新缓存
      for (const [key, change] of Object.entries(changes)) {
        switch (key) {
          case StorageUtils.STORAGE_KEYS.PLUGIN_ENABLED:
            this.stateCache.set('pluginEnabled', change.newValue);
            break;
          case StorageUtils.STORAGE_KEYS.FORCE_MODE:
            this.stateCache.set('forceMode', change.newValue);
            break;
          case StorageUtils.STORAGE_KEYS.USER_SETTINGS:
            this.stateCache.set('userSettings', change.newValue);
            break;
          case StorageUtils.STORAGE_KEYS.AUTO_ENABLE_LIST:
            this.stateCache.set('autoEnableList', change.newValue);
            break;
        }
      }
      
      // 通知监听器
      this.notifyListeners({ changes, areaName });
    });
  }

  /**
   * 获取插件状态（统一接口）
   * @param {string} domain - 可选的域名，用于获取特定域名的状态
   * @returns {Promise<Object>} 完整的插件状态
   */
  async getPluginState(domain = null) {
    await this.ensureInitialized();
    
    const baseState = {
      pluginEnabled: this.stateCache.get('pluginEnabled'),
      forceMode: this.stateCache.get('forceMode'),
      userSettings: this.stateCache.get('userSettings'),
      timestamp: Date.now()
    };
    
    // 如果指定了域名，获取该域名的特定配置
    if (domain) {
      const autoEnableList = this.stateCache.get('autoEnableList');
      const domainConfig = autoEnableList.find(item => item.domain === domain);
      
      baseState.domainConfig = domainConfig || {
        domain,
        copyEnabled: baseState.userSettings.copyEnabled,
        pasteEnabled: baseState.userSettings.pasteEnabled
      };
    }
    
    return baseState;
  }

  /**
   * 原子性更新插件状态
   * @param {Object} updates - 状态更新对象
   * @param {string} operationId - 操作ID，用于防止重复操作
   * @returns {Promise<Object>} 更新后的状态
   */
  async updatePluginState(updates, operationId = null) {
    await this.ensureInitialized();
    
    // 防止重复操作
    if (operationId && this.pendingOperations.has(operationId)) {
      return await this.pendingOperations.get(operationId);
    }
    
    const operation = this.performStateUpdate(updates);
    
    if (operationId) {
      this.pendingOperations.set(operationId, operation);
      
      // 操作完成后清理
      operation.finally(() => {
        this.pendingOperations.delete(operationId);
      });
    }
    
    return await operation;
  }

  /**
   * 执行状态更新
   * @param {Object} updates - 状态更新对象
   * @returns {Promise<Object>} 更新后的状态
   */
  async performStateUpdate(updates) {
    const storageUpdates = {};
    const cacheUpdates = new Map();
    
    // 处理各种状态更新
    if (updates.hasOwnProperty('pluginEnabled')) {
      storageUpdates[StorageUtils.STORAGE_KEYS.PLUGIN_ENABLED] = updates.pluginEnabled;
      cacheUpdates.set('pluginEnabled', updates.pluginEnabled);
    }
    
    if (updates.hasOwnProperty('forceMode')) {
      storageUpdates[StorageUtils.STORAGE_KEYS.FORCE_MODE] = updates.forceMode;
      cacheUpdates.set('forceMode', updates.forceMode);
    }
    
    if (updates.userSettings) {
      const currentSettings = this.stateCache.get('userSettings');
      const newSettings = { ...currentSettings, ...updates.userSettings };
      storageUpdates[StorageUtils.STORAGE_KEYS.USER_SETTINGS] = newSettings;
      cacheUpdates.set('userSettings', newSettings);
    }
    
    if (updates.autoEnableList) {
      storageUpdates[StorageUtils.STORAGE_KEYS.AUTO_ENABLE_LIST] = updates.autoEnableList;
      cacheUpdates.set('autoEnableList', updates.autoEnableList);
    }
    
    // 原子性存储更新
    if (Object.keys(storageUpdates).length > 0) {
      await StorageUtils.set(storageUpdates);
      
      // 更新缓存
      for (const [key, value] of cacheUpdates) {
        this.stateCache.set(key, value);
      }
    }
    
    // 返回更新后的完整状态
    return await this.getPluginState();
  }

  /**
   * 添加状态变更监听器
   * @param {Function} listener - 监听器函数
   */
  addStateListener(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
    }
  }

  /**
   * 移除状态变更监听器
   * @param {Function} listener - 监听器函数
   */
  removeStateListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   * @param {Object} event - 事件对象
   */
  notifyListeners(event) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('State listener error:', error);
      }
    }
  }

  /**
   * 确保状态管理器已初始化
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * 获取状态缓存快照（用于调试）
   * @returns {Object} 状态缓存快照
   */
  getStateSnapshot() {
    const snapshot = {};
    for (const [key, value] of this.stateCache) {
      snapshot[key] = value;
    }
    return snapshot;
  }
}

class BackgroundManager {
  constructor() {
    // 创建状态管理器实例
    this.stateManager = new StateManager();
    
    this.initializeExtension();
    this.setupMessageHandlers();
    this.setupStorageSync();
    this.setupContextMenus();
  }

  /**
   * 初始化插件
   */
  async initializeExtension() {
    console.log('EasyCV Background Service Worker initialized');

    try {
      // 初始化状态管理器
      await this.stateManager.initialize();
      
      // 获取当前状态
      const state = await this.stateManager.getPluginState();
      console.log('Current plugin state:', state);
      
      // 更新图标状态
      await this.updateIcon();
    } catch (error) {
      console.error('Failed to initialize extension:', error);
    }
  }

  /**
   * 设置消息处理器
   */
  setupMessageHandlers() {
    MessageUtils.addMessageListener(async (message, sender, sendResponse) => {
      const { type, data } = message;

      try {
        switch (type) {
          case MessageUtils.MESSAGE_TYPES.TOGGLE_PLUGIN:
            return await this.handleTogglePlugin(data);

          case MessageUtils.MESSAGE_TYPES.GET_STATUS:
            return await this.handleGetStatus();

          case MessageUtils.MESSAGE_TYPES.UPDATE_STATUS:
            return await this.handleUpdateStatus(data);

          case MessageUtils.MESSAGE_TYPES.ENABLE_FORCE_MODE:
            return await this.handleEnableForceMode(data);

          case MessageUtils.MESSAGE_TYPES.DISABLE_FORCE_MODE:
            return await this.handleDisableForceMode();

          case MessageUtils.MESSAGE_TYPES.GET_SETTINGS:
            return await this.handleGetSettings();

          case MessageUtils.MESSAGE_TYPES.UPDATE_SETTINGS:
            return await this.handleUpdateSettings(data);

          case MessageUtils.MESSAGE_TYPES.REPORT_ERROR:
            return await this.handleReportError(data, sender);

          case 'SUBMIT_FEEDBACK':
            return await this.handleSubmitFeedback(data, sender);

          case MessageUtils.MESSAGE_TYPES.PAGE_ANALYZED:
            return await this.handlePageAnalyzed(data, sender);

          case MessageUtils.MESSAGE_TYPES.COPY_STATUS_CHANGED:
            return await this.handleCopyStatusChanged(data);

          case MessageUtils.MESSAGE_TYPES.PASTE_STATUS_CHANGED:
            return await this.handlePasteStatusChanged(data);

          default:
            throw new Error(`Unknown message type: ${type}`);
        }
      } catch (error) {
        console.error('Message handler error:', error);
        throw error;
      }
    });
  }

  /**
   * 设置存储同步
   */
  setupStorageSync() {
    StorageUtils.addStorageListener((changes, areaName) => {
      console.log('Storage changed:', changes, areaName);

      // 如果插件状态改变，更新图标
      if (changes[StorageUtils.STORAGE_KEYS.PLUGIN_ENABLED]) {
        this.updateIcon();
      }

      // 广播设置变更到所有标签页
      MessageUtils.broadcastToAllTabs(
        MessageUtils.MESSAGE_TYPES.UPDATE_STATUS,
        { changes, areaName }
      );
    });
  }

  /**
   * 设置右键菜单
   */
  async setupContextMenus() {
    try {
      // 清除现有菜单
      await chrome.contextMenus.removeAll();

      // 创建主菜单
      chrome.contextMenus.create({
        id: 'easycv-toggle',
        title: '启用/禁用 EasyCV',
        contexts: ['page', 'selection']
      });

      chrome.contextMenus.create({
        id: 'easycv-force-mode',
        title: '启用强力模式',
        contexts: ['page', 'selection']
      });

      chrome.contextMenus.create({
        id: 'easycv-add-to-auto',
        title: '添加到自动启用列表',
        contexts: ['page']
      });

      // 监听菜单点击
      chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        await this.handleContextMenuClick(info, tab);
      });
    } catch (error) {
      console.error('Failed to setup context menus:', error);
    }
  }

  /**
   * 处理插件开关切换
   */
  async handleTogglePlugin(data) {
    const currentState = await this.stateManager.getPluginState();
    const newStatus = data?.enabled ?? !currentState.pluginEnabled;

    // 使用StateManager进行原子性状态更新
    const operationId = `toggle_${Date.now()}`;
    const updatedState = await this.stateManager.updatePluginState(
      { pluginEnabled: newStatus },
      operationId
    );

    await this.updateIcon();

    // 更新统计
    if (newStatus) {
      const stats = await StorageUtils.getStatistics();
      await StorageUtils.updateStatistics({
        totalActivations: stats.totalActivations + 1,
        lastUsed: new Date().toISOString()
      });
    }

    return { enabled: updatedState.pluginEnabled, state: updatedState };
  }

  /**
   * 处理获取状态请求
   */
  async handleGetStatus(data) {
    // 使用StateManager获取统一状态
    const domain = data?.domain || null;
    const state = await this.stateManager.getPluginState(domain);

    return {
      enabled: state.pluginEnabled,
      forceMode: state.forceMode,
      settings: state.userSettings,
      domainConfig: state.domainConfig,
      timestamp: state.timestamp
    };
  }

  /**
   * 处理状态更新
   */
  async handleUpdateStatus(data) {
    const updates = {};
    
    if (data.hasOwnProperty('enabled')) {
      updates.pluginEnabled = data.enabled;
    }

    if (data.hasOwnProperty('forceMode')) {
      updates.forceMode = data.forceMode;
    }
    
    if (data.userSettings) {
      updates.userSettings = data.userSettings;
    }

    // 使用StateManager进行原子性更新
    const operationId = `update_${Date.now()}`;
    const updatedState = await this.stateManager.updatePluginState(updates, operationId);

    await this.updateIcon();
    return { success: true, state: updatedState };
  }

  /**
   * 处理启用强力模式
   */
  async handleEnableForceMode(data) {
    // 使用StateManager进行原子性状态更新
    const operationId = `enable_force_${Date.now()}`;
    const updatedState = await this.stateManager.updatePluginState(
      { forceMode: true },
      operationId
    );

    // 如果指定了标签页，只对该标签页启用
    if (data?.tabId) {
      try {
        // 先尝试发送消息到content script
        await MessageUtils.sendToContent(
          data.tabId,
          MessageUtils.MESSAGE_TYPES.ENABLE_FORCE_MODE
        );
      } catch (error) {
        // 如果content script不可用（比如页面刚刷新），忽略错误
        // 强力模式状态已保存，页面重新加载时会自动应用
        console.log('Content script not available, force mode will be applied on page load');
      }
    } else {
      // 广播到所有标签页
      await MessageUtils.broadcastToAllTabs(
        MessageUtils.MESSAGE_TYPES.ENABLE_FORCE_MODE
      );
    }

    return { forceMode: updatedState.forceMode, state: updatedState };
  }

  /**
   * 处理禁用强力模式
   */
  async handleDisableForceMode() {
    // 使用StateManager进行原子性状态更新
    const operationId = `disable_force_${Date.now()}`;
    const updatedState = await this.stateManager.updatePluginState(
      { forceMode: false },
      operationId
    );

    await MessageUtils.broadcastToAllTabs(
      MessageUtils.MESSAGE_TYPES.DISABLE_FORCE_MODE
    );

    return { forceMode: updatedState.forceMode, state: updatedState };
  }

  /**
   * 处理获取设置
   */
  async handleGetSettings() {
    const state = await this.stateManager.getPluginState();
    return state.userSettings;
  }

  /**
   * 处理更新设置
   */
  async handleUpdateSettings(data) {
    // 使用StateManager进行原子性设置更新
    const operationId = `update_settings_${Date.now()}`;
    const updatedState = await this.stateManager.updatePluginState(
      { userSettings: data },
      operationId
    );
    
    return { success: true, settings: updatedState.userSettings };
  }

  /**
   * 处理错误报告
   */
  async handleReportError(data, sender) {
    const errorReport = {
      error: data,
      sender: sender,
      timestamp: new Date().toISOString(),
      url: data.url || sender.tab?.url || 'unknown',
      userAgent: navigator.userAgent
    };

    console.error('Error reported from content script:', errorReport);

    // 保存错误报告到本地存储（用于反馈时参考）
    try {
      const existingReports = await StorageUtils.get('errorReports') || { errorReports: [] };
      const reports = existingReports.errorReports || [];

      // 只保留最近的10个错误报告
      reports.push(errorReport);
      if (reports.length > 10) {
        reports.shift();
      }

      await StorageUtils.set({ errorReports: reports });
    } catch (error) {
      console.error('Failed to save error report:', error);
    }

    return { received: true };
  }

  /**
   * 处理用户反馈提交
   */
  async handleSubmitFeedback(data, sender) {
    const feedbackData = {
      ...data.data,
      tabId: sender.tab?.id,
      timestamp: new Date().toISOString()
    };

    console.log('User feedback submitted:', feedbackData);

    // 保存反馈数据到本地存储
    try {
      const existingFeedback = await StorageUtils.get('userFeedback') || { userFeedback: [] };
      const feedback = existingFeedback.userFeedback || [];

      feedback.push(feedbackData);

      // 只保留最近的20个反馈记录
      if (feedback.length > 20) {
        feedback.shift();
      }

      await StorageUtils.set({ userFeedback: feedback });

      // 可以在这里添加发送到服务器的逻辑
      // await this.sendFeedbackToServer(feedbackData);

    } catch (error) {
      console.error('Failed to save feedback:', error);
    }

    return { success: true };
  }

  /**
   * 处理页面分析结果
   */
  async handlePageAnalyzed(data, sender) {
    const { restrictions, domain } = data;

    // 更新统计信息
    if (restrictions && Object.values(restrictions).some(Boolean)) {
      const stats = await StorageUtils.getStatistics();
      const sitesUnlocked = stats.sitesUnlocked || [];

      if (!sitesUnlocked.includes(domain)) {
        sitesUnlocked.push(domain);
        await StorageUtils.updateStatistics({ sitesUnlocked });
      }
    }

    return { received: true };
  }

  /**
   * 处理右键菜单点击
   */
  async handleContextMenuClick(info, tab) {
    try {
      switch (info.menuItemId) {
        case 'easycv-toggle':
          await this.handleTogglePlugin({});
          break;

        case 'easycv-force-mode':
          await this.handleEnableForceMode({ tabId: tab.id });
          break;

        case 'easycv-add-to-auto':
          const url = new URL(tab.url);
          await StorageUtils.addToAutoEnableList(url.hostname);
          break;
      }
    } catch (error) {
      console.error('Context menu handler error:', error);
    }
  }

  /**
   * 处理复制状态变更
   */
  async handleCopyStatusChanged(data) {
    const settings = await StorageUtils.getPluginSettings();
    settings.copyEnabled = data.enabled;
    await StorageUtils.setPluginSettings(settings);

    // 广播到所有标签页
    await MessageUtils.broadcastToAllTabs(
      MessageUtils.MESSAGE_TYPES.COPY_STATUS_CHANGED,
      { enabled: data.enabled }
    );

    return { success: true };
  }

  /**
   * 处理粘贴状态变更
   */
  async handlePasteStatusChanged(data) {
    const settings = await StorageUtils.getPluginSettings();
    settings.pasteEnabled = data.enabled;
    await StorageUtils.setPluginSettings(settings);

    // 广播到所有标签页
    await MessageUtils.broadcastToAllTabs(
      MessageUtils.MESSAGE_TYPES.PASTE_STATUS_CHANGED,
      { enabled: data.enabled }
    );

    return { success: true };
  }

  /**
   * 更新插件图标
   */
  async updateIcon() {
    try {
      const state = await this.stateManager.getPluginState();
      const enabled = state.pluginEnabled;
      const iconPrefix = enabled ? 'icon-active' : 'icon-default';

      await chrome.action.setIcon({
        path: {
          16: chrome.runtime.getURL(`icons/${iconPrefix}-16.png`),
          32: chrome.runtime.getURL(`icons/${iconPrefix}-32.png`),
          48: chrome.runtime.getURL(`icons/${iconPrefix}-48.png`),
          128: chrome.runtime.getURL(`icons/${iconPrefix}-128.png`)
        }
      });

      await chrome.action.setTitle({
        title: `EasyCV - ${enabled ? '已启用' : '已禁用'}`
      });
    } catch (error) {
      console.error('Failed to update icon:', error);
    }
  }
}

// 监听插件安装和启动
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('EasyCV installed:', details);

  if (details.reason === 'install') {
    // 首次安装，设置默认值
    // 注意：这里仍使用StorageUtils直接设置，因为StateManager可能还未初始化
    await StorageUtils.set({
      [StorageUtils.STORAGE_KEYS.PLUGIN_ENABLED]: true,
      [StorageUtils.STORAGE_KEYS.FORCE_MODE]: false,
      [StorageUtils.STORAGE_KEYS.AUTO_ENABLE_LIST]: [],
      [StorageUtils.STORAGE_KEYS.USER_SETTINGS]: StorageUtils.DEFAULT_SETTINGS
    });
  }
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      const url = new URL(tab.url);
      // 使用StateManager获取当前状态
      const state = await backgroundManager.stateManager.getPluginState();
      const autoEnableList = state.domainConfig || [];

      // 检查是否在自动启用列表中
      const config = autoEnableList.find(item => item.domain === url.hostname);
      if (config) {
        console.log(`Auto-enabling for ${url.hostname}:`, config);

        // 使用StateManager更新插件设置以匹配自动开启配置
        const operationId = `auto_enable_${url.hostname}_${Date.now()}`;
        await backgroundManager.stateManager.updatePluginState({
          userSettings: {
            ...state.userSettings,
            copyEnabled: config.copyEnabled,
            pasteEnabled: config.pasteEnabled
          }
        }, operationId);

        // 根据配置发送相应的启用消息
        if (config.copyEnabled) {
          chrome.tabs.sendMessage(tabId, {
            type: MessageUtils.MESSAGE_TYPES.COPY_STATUS_CHANGED,
            enabled: true
          }).catch(() => {
            // 忽略错误，可能是内容脚本还未加载
          });
        }

        if (config.pasteEnabled) {
          chrome.tabs.sendMessage(tabId, {
            type: MessageUtils.MESSAGE_TYPES.PASTE_STATUS_CHANGED,
            enabled: true
          }).catch(() => {
            // 忽略错误，可能是内容脚本还未加载
          });
        }

        // 更新图标状态
        backgroundManager.updateIcon();
      }
    } catch (error) {
      // 忽略无效URL
      console.debug('Invalid URL or failed to process tab update:', error);
    }
  }
});

// 初始化后台管理器
const backgroundManager = new BackgroundManager();