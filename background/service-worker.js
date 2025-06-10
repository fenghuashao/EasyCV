/**
 * EasyCV 后台服务工作者
 * 处理插件生命周期管理、跨标签页通信、存储管理
 */

// 导入工具类（注意：在service worker中需要使用importScripts）
importScripts('../utils/storage-utils.js', '../utils/message-utils.js');

class BackgroundManager {
  constructor() {
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

    // 设置默认设置
    try {
      const settings = await StorageUtils.getUserSettings();
      console.log('Current settings:', settings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }

    // 更新图标状态
    await this.updateIcon();
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
    const currentStatus = await StorageUtils.getPluginEnabled();
    const newStatus = data?.enabled ?? !currentStatus;

    await StorageUtils.setPluginEnabled(newStatus);
    await this.updateIcon();

    // 更新统计
    if (newStatus) {
      const stats = await StorageUtils.getStatistics();
      await StorageUtils.updateStatistics({
        totalActivations: stats.totalActivations + 1,
        lastUsed: new Date().toISOString()
      });
    }

    return { enabled: newStatus };
  }

  /**
   * 处理获取状态请求
   */
  async handleGetStatus() {
    const [enabled, forceMode, settings] = await Promise.all([
      StorageUtils.getPluginEnabled(),
      StorageUtils.getForceMode(),
      StorageUtils.getUserSettings()
    ]);

    return {
      enabled,
      forceMode,
      settings
    };
  }

  /**
   * 处理状态更新
   */
  async handleUpdateStatus(data) {
    if (data.hasOwnProperty('enabled')) {
      await StorageUtils.setPluginEnabled(data.enabled);
    }

    if (data.hasOwnProperty('forceMode')) {
      await StorageUtils.setForceMode(data.forceMode);
    }

    await this.updateIcon();
    return { success: true };
  }

  /**
   * 处理启用强力模式
   */
  async handleEnableForceMode(data) {
    await StorageUtils.setForceMode(true);

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

    return { forceMode: true };
  }

  /**
   * 处理禁用强力模式
   */
  async handleDisableForceMode() {
    await StorageUtils.setForceMode(false);

    await MessageUtils.broadcastToAllTabs(
      MessageUtils.MESSAGE_TYPES.DISABLE_FORCE_MODE
    );

    return { forceMode: false };
  }

  /**
   * 处理获取设置
   */
  async handleGetSettings() {
    return await StorageUtils.getUserSettings();
  }

  /**
   * 处理更新设置
   */
  async handleUpdateSettings(data) {
    await StorageUtils.updateUserSettings(data);
    return { success: true };
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
      const enabled = await StorageUtils.getPluginEnabled();
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
chrome.runtime.onInstalled.addListener((details) => {
  console.log('EasyCV installed:', details);

  if (details.reason === 'install') {
    // 首次安装，设置默认值
    StorageUtils.set({
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
      const autoEnableList = await StorageUtils.getAutoEnableList();

      // 检查是否在自动启用列表中
      const config = autoEnableList.find(item => item.domain === url.hostname);
      if (config) {
        console.log(`Auto-enabling for ${url.hostname}:`, config);

        // 更新插件设置以匹配自动开启配置
        await StorageUtils.setPluginSettings({
          copyEnabled: config.copyEnabled,
          pasteEnabled: config.pasteEnabled
        });

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