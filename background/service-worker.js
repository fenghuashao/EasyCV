/**
 * EasyCV 后台服务工作者
 * 处理插件生命周期管理、跨标签页通信、存储管理
 */

// 导入工具类（注意：在service worker中需要使用importScripts）
importScripts('../utils/storage-utils.js', '../utils/message-utils.js', '../utils/i18n-utils.js', 'icon-manager.js', 'auto-enable-manager.js', 'state-confirmation-manager.js', 'monitoring-manager.js');
StorageUtils.configureMutationHost();

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
    
    // 性能优化相关
    this.batchUpdateQueue = new Map();
    this.batchUpdateTimer = null;
    this.batchUpdateDelay = 100; // 100ms批处理延迟
    this.storageAccessCount = 0;
    this.cacheHitCount = 0;
    this.lastPerformanceReport = Date.now();
    
    // 防抖机制
    this.debouncedOperations = new Map();
    
    // 监控和日志管理（传递this作为stateManager引用）
    this.monitoringManager = new MonitoringManager(this);
  }

  /**
   * 初始化状态管理器
   */
  async initialize() {
    if (this.initialized) return;

    if (this.initializing) return this.initializing;
    this.initializing = (async () => {
      await this.preloadStates();
      this.setupStorageListener();
      this.initialized = true;
    })();
    try { await this.initializing; }
    finally { this.initializing = null; }
  }

  /**
   * 预加载关键状态
   */
  async preloadStates() {
    const keys = [
      StorageUtils.STORAGE_KEYS.PLUGIN_ENABLED,
      StorageUtils.STORAGE_KEYS.FORCE_MODE,
      StorageUtils.STORAGE_KEYS.USER_SETTINGS,
      StorageUtils.STORAGE_KEYS.AUTO_ENABLE_LIST,
      StorageUtils.STORAGE_KEYS.EXCLUDED_LIST
    ];

    const data = await StorageUtils.get(keys);
    this.storageAccessCount++;

    StorageUtils.validateConfigurationKeys(data);
    // 缓存状态数据
    this.stateCache.set('pluginEnabled', data[StorageUtils.STORAGE_KEYS.PLUGIN_ENABLED] ?? StorageUtils.DEFAULT_SETTINGS.pluginEnabled);
    this.stateCache.set('forceMode', data[StorageUtils.STORAGE_KEYS.FORCE_MODE] ?? StorageUtils.DEFAULT_SETTINGS.forceMode);
    StorageUtils.validateSettings(data.user_settings ?? {});
    this.stateCache.set('userSettings', { ...StorageUtils.DEFAULT_SETTINGS, ...data.user_settings });
    this.stateCache.set('autoEnableList', StorageUtils.normalizeAutoEnableList(data.auto_enable_list ?? []));
    this.stateCache.set('excludedList', StorageUtils.normalizeExcludedList(data.excluded_list ?? StorageUtils.DEFAULT_SETTINGS.excludedList));
  }

  /**
   * 设置存储监听器
   */
  setupStorageListener() {
    StorageUtils.addStorageListener(async (changes, areaName) => {
      if (areaName !== 'sync') return;
      if (!await StorageUtils.hasPrivacyConsent()) return;
      // Reads refresh the cache from authoritative storage, including deleted keys.
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
    await this.preloadStates();

    // State is refreshed from storage; do not report this as a cache hit.
    
    const baseState = {
      pluginEnabled: this.stateCache.get('pluginEnabled'),
      forceMode: this.stateCache.get('forceMode'),
      userSettings: this.stateCache.get('userSettings'),
      autoEnableList: this.stateCache.get('autoEnableList'),
      timestamp: Date.now()
    };

    // 如果指定了域名，获取该域名的特定配置
    if (domain) {
      const autoEnableList = this.stateCache.get('autoEnableList');
      const domainConfig = StorageUtils.matchAutoEnableRule(domain, autoEnableList);

      baseState.domainConfig = domainConfig || {
        domain,
        copyEnabled: baseState.userSettings.copyEnabled,
        pasteEnabled: baseState.userSettings.pasteEnabled
      };

      // 排除列表（DEBT-08）：命中即本站休眠，优先级高于全局开关与自动启用
      baseState.excluded = StorageUtils.isDomainExcluded(domain, this.stateCache.get('excludedList'));
    }

    return baseState;
  }

  /**
   * 原子性更新插件状态
   * @param {Object} updates - 状态更新对象
   * @param {string} operationId - 操作ID，用于防止重复操作
   * @param {Object} options - 选项 {batch: boolean, debounce: number}
   * @returns {Promise<Object>} 更新后的状态
   */
  async updatePluginState(updates, operationId = null, options = {}) {
    await this.ensureInitialized();

    // 防止重复操作
    if (operationId && this.pendingOperations.has(operationId)) {
      return await this.pendingOperations.get(operationId);
    }

    // 如果启用批处理
    if (options.batch) {
      return await this.batchUpdateState(updates, operationId);
    }

    // 如果启用防抖
    if (options.debounce && options.debounce > 0) {
      return await this.debounceUpdateState(updates, operationId, options.debounce);
    }

    const operation = this.performStateUpdate(updates);

    if (operationId) {
      this.pendingOperations.set(operationId, operation);

      // 操作完成后清理
      operation.then(() => this.pendingOperations.delete(operationId),
        () => this.pendingOperations.delete(operationId));
    }

    return await operation;
  }

  /**
   * 带确认机制的状态更新
   * @param {Object} updates - 状态更新对象
   * @param {Object} options - 确认选项
   * @returns {Promise<Object>} 确认结果
   */
  async updatePluginStateWithConfirmation(updates, options = {}) {
    if (this.backgroundManager?.stateConfirmationManager) {
      return await this.backgroundManager.stateConfirmationManager.executeWithConfirmation(updates, options);
    }
    
    // 降级到普通更新
    const result = await this.updatePluginState(updates, options.requestId);
    return {
      success: true,
      requestId: options.requestId || 'fallback',
      result
    };
  }

  /**
   * 批处理状态更新
   * @param {Object} updates - 状态更新对象
   * @param {string} operationId - 操作ID
   * @returns {Promise<Object>} 更新后的状态
   */
  async batchUpdateState(updates, operationId) {
    return new Promise((resolve, reject) => {
      // 将更新添加到批处理队列
      this.batchUpdateQueue.set(operationId || Symbol(), { updates, resolve, reject });

      // 如果没有正在进行的批处理，启动新的批处理
      if (!this.batchUpdateTimer) {
        this.batchUpdateTimer = setTimeout(() => {
          this.processBatchUpdates();
        }, this.batchUpdateDelay);
      }
    });
  }

  /**
   * 防抖状态更新
   * @param {Object} updates - 状态更新对象
   * @param {string} operationId - 操作ID
   * @param {number} delay - 防抖延迟
   * @returns {Promise<Object>} 更新后的状态
   */
  async debounceUpdateState(updates, operationId, delay) {
    const key = operationId || 'default';
    
    // 清除之前的防抖操作
    if (this.debouncedOperations.has(key)) {
      clearTimeout(this.debouncedOperations.get(key).timer);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(async () => {
        try {
          const result = await this.performStateUpdate(updates);
          this.debouncedOperations.delete(key);
          resolve(result);
        } catch (error) {
          this.debouncedOperations.delete(key);
          reject(error);
        }
      }, delay);

      this.debouncedOperations.set(key, { timer, resolve, reject });
    });
  }

  /**
   * 处理批处理更新
   */
  async processBatchUpdates() {
    const updates = Array.from(this.batchUpdateQueue.values());
    this.batchUpdateQueue.clear();
    this.batchUpdateTimer = null;

    if (updates.length === 0) return;

    try {
      // 合并所有更新
      const mergedUpdates = {};
      for (const { updates: update } of updates) {
        const previousSettings = mergedUpdates.userSettings;
        Object.assign(mergedUpdates, update);
        if (update.userSettings) {
          mergedUpdates.userSettings = { ...previousSettings, ...update.userSettings };
        }
      }

      // 执行合并后的更新
      const result = await this.performStateUpdate(mergedUpdates);

      // 通知所有等待的操作
      for (const { resolve } of updates) {
        resolve(result);
      }
    } catch (error) {
      // 通知所有等待的操作失败
      for (const { reject } of updates) {
        reject(error);
      }
    }
  }

  /**
   * 执行状态更新
   * @param {Object} updates - 状态更新对象
   * @returns {Promise<Object>} 更新后的状态
   */
  async performStateUpdate(updates) {
    const startTime = Date.now();
    try {
      await StorageUtils.mutate('state', updates);
      this.storageAccessCount++;
      const state = await this.getPluginState();
      this.monitoringManager.logStateChange('state_update', { success: true });
      this.monitoringManager.recordPerformance('state_update', Date.now() - startTime, true);
      return state;
    } catch (error) {
      this.monitoringManager.logStateChange('state_update', { success: false }, 'error');
      this.monitoringManager.recordPerformance('state_update', Date.now() - startTime, false);
      throw error;
    }
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

  /**
   * 获取性能指标
   * @returns {Object} 性能指标
   */
  getPerformanceMetrics() {
    const totalRequests = this.storageAccessCount + this.cacheHitCount;
    const cacheHitRate = totalRequests > 0 ? (this.cacheHitCount / totalRequests * 100).toFixed(2) : 0;
    
    return {
      storageAccessCount: this.storageAccessCount,
      cacheHitCount: this.cacheHitCount,
      cacheHitRate: `${cacheHitRate}%`,
      pendingOperationsCount: this.pendingOperations.size,
      batchQueueSize: this.batchUpdateQueue.size,
      debouncedOperationsCount: this.debouncedOperations.size,
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * 获取内存使用情况
   * @returns {Object} 内存使用情况
   */
  getMemoryUsage() {
    const cacheSize = this.stateCache.size;
    let estimatedMemory = 0;
    
    // 估算缓存占用的内存
    for (const [key, value] of this.stateCache) {
      estimatedMemory += JSON.stringify({ key, value }).length * 2; // 粗略估算
    }
    
    return {
      cacheEntries: cacheSize,
      estimatedBytes: estimatedMemory,
      estimatedKB: (estimatedMemory / 1024).toFixed(2)
    };
  }

  /**
   * 重置性能计数器
   */
  resetPerformanceCounters() {
    this.storageAccessCount = 0;
    this.cacheHitCount = 0;
  }

  /**
   * 清理过期的防抖操作
   */
  cleanupExpiredOperations() {
    // 清理已完成的防抖操作
    for (const [key, operation] of this.debouncedOperations) {
      if (!operation.timer) {
        this.debouncedOperations.delete(key);
      }
    }
  }

  /**
   * 获取监控和日志数据
   * @param {Object} filters - 日志过滤条件
   * @returns {Object} 监控数据
   */
  getMonitoringData(filters = {}) {
    return {
      logs: this.monitoringManager.queryLogs(filters),
      performanceReport: this.monitoringManager.getPerformanceReport(),
      stateMetrics: this.getPerformanceMetrics()
    };
  }

  /**
   * 执行健康检查
   * @returns {Promise<Object>} 健康检查报告
   */
  async performHealthCheck() {
    return await this.monitoringManager.performHealthCheck();
  }

  /**
   * 导出监控日志
   * @param {Object} options - 导出选项
   * @returns {string} JSON格式的日志数据
   */
  exportMonitoringLogs(options = {}) {
    return this.monitoringManager.exportLogs(options);
  }

  /**
   * 重置监控指标
   */
  resetMonitoringMetrics() {
    this.monitoringManager.resetMetrics();
    this.resetPerformanceCounters();
  }

  /**
   * 获取综合性能指标（包含StateManager和MonitoringManager的指标）
   * @returns {Object} 综合性能指标
   */
  getComprehensiveMetrics() {
    const stateMetrics = this.getPerformanceMetrics();
    const monitoringReport = this.monitoringManager.getPerformanceReport();
    
    return {
      timestamp: new Date().toISOString(),
      stateManager: stateMetrics,
      monitoring: monitoringReport,
      system: {
        pendingOperations: this.pendingOperations.size,
        batchQueueSize: this.batchUpdateQueue.size,
        debouncedOperations: this.debouncedOperations.size,
        cacheSize: this.stateCache.size
      }
    };
  }
}

class BackgroundManager {
  constructor() {
    // 创建状态管理器实例
    this.stateManager = new StateManager();

    // 创建图标管理器实例
    this.iconManager = new IconManager();
    
    // 创建自动启用管理器实例
    this.autoEnableManager = new AutoEnableManager(this.stateManager);
    
    // 创建状态确认管理器实例
    this.stateConfirmationManager = new StateConfirmationManager(this.stateManager);
    
    // 设置StateManager的backgroundManager引用
    this.stateManager.backgroundManager = this;
    
    // 设置AutoEnableManager的定期清理
    this.setupAutoEnableCleanup();

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
      if (!await StorageUtils.hasPrivacyConsent()) return;
      await seedMissingDefaults();
      if (!await StorageUtils.hasPrivacyConsent()) return;
      // Best-effort startup privacy migration; a failure preserves sync originals for retry.
      await StorageUtils.migratePrivateData().catch(() => console.warn('Local privacy migration pending'));
      await this.stateManager.initialize();

      // 获取当前状态
      const state = await this.stateManager.getPluginState();
      // Settings and site rules are not printed to the worker console.

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
        if (!await StorageUtils.hasPrivacyConsent()) {
          return { success: false, error: 'CONSENT_REQUIRED' };
        }
        switch (type) {
          case MessageUtils.MESSAGE_TYPES.STORAGE_MUTATION:
            if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) {
              throw new Error('Settings mutations require an extension page');
            }
            return { success: true, data: await StorageUtils.mutate(data.operation, data.data) };
          case MessageUtils.MESSAGE_TYPES.TOGGLE_PLUGIN:
            return await this.handleTogglePlugin(data);

          case MessageUtils.MESSAGE_TYPES.GET_STATUS:
            return await this.handleGetStatus(data);

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

          case MessageUtils.MESSAGE_TYPES.SUBMIT_FEEDBACK:
            return await this.handleSubmitFeedback(data, sender);

          case MessageUtils.MESSAGE_TYPES.PAGE_ANALYZED:
            return await this.handlePageAnalyzed(data, sender);

          case MessageUtils.MESSAGE_TYPES.COPY_STATUS_CHANGED:
            return await this.handleCopyStatusChanged(data);

          case MessageUtils.MESSAGE_TYPES.PASTE_STATUS_CHANGED:
            return await this.handlePasteStatusChanged(data);

          case MessageUtils.MESSAGE_TYPES.UPDATE_PLUGIN_STATE_WITH_CONFIRMATION:
            return await this.handleUpdatePluginStateWithConfirmation(message);

          case MessageUtils.MESSAGE_TYPES.GET_COMPLETE_STATE:
            return await this.handleGetCompleteState(data);

          // 监控和性能相关消息
          case MessageUtils.MESSAGE_TYPES.GET_PERFORMANCE_METRICS:
            const metrics = this.stateManager.getComprehensiveMetrics();
            return { success: true, data: metrics };

          case MessageUtils.MESSAGE_TYPES.GET_MONITORING_DATA:
            const monitoringData = this.stateManager.getMonitoringData(data?.filters);
            return { success: true, data: monitoringData };

          case MessageUtils.MESSAGE_TYPES.PERFORM_HEALTH_CHECK:
            const healthReport = await this.stateManager.performHealthCheck();
            return { success: true, data: healthReport };

          case MessageUtils.MESSAGE_TYPES.EXPORT_MONITORING_LOGS:
            const exportData = this.stateManager.exportMonitoringLogs(data?.options);
            return { success: true, data: exportData };

          case MessageUtils.MESSAGE_TYPES.RESET_MONITORING_METRICS:
            this.stateManager.resetMonitoringMetrics();
            return { success: true, message: 'Metrics reset successfully' };

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
    StorageUtils.addStorageListener(async (changes, areaName) => {
      if (areaName === 'local' && Object.hasOwn(changes, 'privacy_notice_ack')) {
        if (changes.privacy_notice_ack.newValue === StorageUtils.PRIVACY_NOTICE_VERSION) this.initializeExtension();
        else {
          this.stateManager.stateCache.clear();
          this.autoEnableManager.clearDomainCache();
        }
        return;
      }
      if (areaName !== 'sync') return;
      if (!await StorageUtils.hasPrivacyConsent()) return;
      if (['statistics', 'interaction_history', 'errorReports', 'userFeedback'].some(key => changes[key]?.newValue !== undefined)) {
        StorageUtils.migratePrivateData().catch(() => console.warn('Local privacy migration pending'));
      }
      const keys = Object.keys(changes).filter(key => StorageUtils.CONFIG_KEYS.includes(key));
      if (!keys.length) return;
      if (keys.includes('plugin_enabled')) this.updateIcon();
      MessageUtils.broadcastToAllTabs(MessageUtils.MESSAGE_TYPES.UPDATE_STATUS, {
        changes: Object.fromEntries(keys.map(key => [key, { changed: true }])), areaName
      });
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
        title: I18nUtils.t('context_toggle', undefined, '启用/禁用 EasyCV'),
        contexts: ['page', 'selection']
      });

      chrome.contextMenus.create({
        id: 'easycv-force-mode',
        title: I18nUtils.t('context_force_mode', undefined, '启用强力模式'),
        contexts: ['page', 'selection']
      });

      chrome.contextMenus.create({
        id: 'easycv-add-to-auto',
        title: I18nUtils.t('context_add_to_auto', undefined, '添加到自动启用列表'),
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
    const operationId = `toggle_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const updatedState = await this.stateManager.updatePluginState(
      { pluginEnabled: newStatus },
      operationId
    );

    await this.updateIcon();

    if (newStatus) await StorageUtils.recordActivation().catch(() => {});

    return { enabled: updatedState.pluginEnabled, state: updatedState };
  }

  /**
   * 处理获取状态请求
   */
  async handleGetStatus(data) {
    try {
      // 使用StateManager获取统一状态
      const domain = data?.domain || null;
      const state = await this.stateManager.getPluginState(domain);

      // 确保所有必需的字段都有有效值；排除站点强制 enabled=false（DEBT-08 逃生通道）
      const responseData = {
        enabled: Boolean(state.pluginEnabled) && !state.excluded,
        copyEnabled: Boolean((state.domainConfig || state.userSettings)?.copyEnabled !== false),
        pasteEnabled: Boolean((state.domainConfig || state.userSettings)?.pasteEnabled !== false),
        forceMode: Boolean(state.forceMode),
        settings: state.userSettings || {},
        domainConfig: state.domainConfig || null,
        excluded: Boolean(state.excluded),
        timestamp: state.timestamp || Date.now()
      };

      // 添加调试日志


      return {
        success: true,
        data: responseData
      };
    } catch (error) {
      console.error('Failed to get status:', error);
      
      return { success: false, error: 'STATUS_UNAVAILABLE' };
    }
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
    const operationId = `update_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const updatedState = await this.stateManager.updatePluginState(updates, operationId);

    await this.updateIcon();
    return { success: true, state: updatedState };
  }

  /**
   * 处理启用强力模式
   */
  async handleEnableForceMode(data) {
    // 使用StateManager进行原子性状态更新
    const operationId = `enable_force_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
    const operationId = `disable_force_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
   * 处理获取完整状态
   */
  async handleGetCompleteState(data) {
    try {
      const state = await this.stateManager.getPluginState();
      return {
        state: {
          isEnabled: state.pluginEnabled,
          copyEnabled: state.userSettings?.copyEnabled ?? true,
          pasteEnabled: state.userSettings?.pasteEnabled ?? true,
          forceMode: state.forceMode,
          userSettings: state.userSettings,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      console.error('Failed to get complete state:', error);
      throw error; // 让addMessageListener处理错误包装
    }
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
    const operationId = `update_settings_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const updatedState = await this.stateManager.updatePluginState(
      { userSettings: data },
      operationId
    );

    return { success: true, settings: updatedState.userSettings };
  }

  /**
   * 处理错误报告
   */
  async handleReportError() {
    await StorageUtils.recordDiagnostic();
    return { received: true };
  }

  /**
   * 处理用户反馈提交
   */
  async handleSubmitFeedback() {
    // Feedback is a user-edited GitHub draft. Do not persist arbitrary page payloads.
    return { success: false, error: 'Use the feedback link to compose your report' };
  }

  /**
   * 处理页面分析结果
   */
  async handlePageAnalyzed() {
    // Page detection is not proof of success and must not create browsing records.
    return { received: true };
  }

  /**
   * 处理右键菜单点击
   */
  async handleContextMenuClick(info, tab) {
    try {
      if (!await StorageUtils.hasPrivacyConsent()) return;
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
    // 统一走StateManager路径，避免与performStateUpdate的缓存产生双写竞争
    await this.stateManager.updatePluginState(
      { copyEnabled: data.enabled },
      `copy_status_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );

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
    // 统一走StateManager路径，避免与performStateUpdate的缓存产生双写竞争
    await this.stateManager.updatePluginState(
      { pasteEnabled: data.enabled },
      `paste_status_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );

    // 广播到所有标签页
    await MessageUtils.broadcastToAllTabs(
      MessageUtils.MESSAGE_TYPES.PASTE_STATUS_CHANGED,
      { enabled: data.enabled }
    );

    return { success: true };
  }

  /**
   * 处理带确认机制的状态更新
   */
  async handleUpdatePluginStateWithConfirmation(message) {
    try {
      const { updates, options } = message;
      
      // 使用StateManager的带确认更新方法
      const result = await this.stateManager.updatePluginStateWithConfirmation(updates, options);
      
      // 更新图标状态
      await this.updateIcon();
      
      // 如果更新成功，广播状态变更
      if (result.success) {
        await MessageUtils.broadcastToAllTabs(
          MessageUtils.MESSAGE_TYPES.STATE_UPDATED,
          {
            requestId: result.requestId
          }
        );
      }
      
      return result;
      
    } catch (error) {
      console.error('带确认的状态更新失败:', error);
      return {
        success: false,
        error: error.message,
        requestId: message.options?.requestId
      };
    }
  }

  /**
   * 更新插件图标
   */
  async updateIcon() {
    try {
      const state = await this.stateManager.getPluginState();
      await this.iconManager.updateIcon(state);
    } catch (error) {
      console.error('Failed to update icon:', error);
    }
  }

  /**
   * 设置AutoEnableManager的定期清理
   */
  setupAutoEnableCleanup() {
    // 每5分钟清理一次过期数据
    setInterval(() => {
      try {
        this.autoEnableManager.cleanup();
      } catch (error) {
        console.error('AutoEnableManager cleanup failed:', error);
      }
    }, 5 * 60 * 1000); // 5分钟
  }
}

// Seed only missing defaults after consent; preserve existing user rules.
async function seedMissingDefaults() {
  try {
    // Perform the read and write in the same worker mutation queue as user edits.
    await StorageUtils.mutate('seedDefaults');
  } catch (error) {
    console.warn('EasyCV default seeding skipped:', error);
  }
}

// 监听插件安装和启动
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('EasyCV installed:', details);
  if (details.reason !== 'install' && details.reason !== 'update') return;
  if (!await StorageUtils.hasPrivacyConsent()) {
    // The extension-owned onboarding page allows the user to decide later.
    if (chrome.tabs?.create) await chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html?onboarding=1') });
    return;
  }
  await seedMissingDefaults();
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && await StorageUtils.hasPrivacyConsent() && tab.url) {
    // 使用统一的AutoEnableManager处理自动启用
    await backgroundManager.autoEnableManager.checkAndApplyAutoEnable(tabId, tab.url);
  }
});

// 初始化后台管理器
const backgroundManager = new BackgroundManager();
