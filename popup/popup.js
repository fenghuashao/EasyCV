/**
 * EasyCV Popup 脚本
 * 处理弹窗界面的交互逻辑
 */

// 导入工具类

class PopupManager {
  constructor() {
    this.currentTab = null;
    this.messageUtils = new MessageUtils();
    this.storageUtils = new StorageUtils();
    this.updateInterval = null;
    this.lastFailedOperation = null; // 记录最近的操作失败类型
    this.autoCloseTimer = null; // 自动关闭定时器
    this.userInteracted = false; // 用户是否已交互

    this.init();
  }

  /**
   * 初始化弹窗
   */
  async init() {
    try {
      // 获取当前标签页
      await this.getCurrentTab();

      // 初始化UI
      await this.initializeUI();

      // 绑定事件监听器
      this.bindEventListeners();

      // 加载数据
      await this.loadData();

      // 检查并应用自动开启配置
      await this.applyAutoEnableConfig();

      // 开始定期更新
      this.startPeriodicUpdate();

      // 设置自动关闭定时器（如果用户无交互）
      this.setAutoCloseTimer(10000); // 10秒后自动关闭

      console.log('Popup initialized successfully');
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.showNotification('初始化失败', 'error');
    }
  }

  /**
   * 获取当前标签页
   */
  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;

      // 更新页面URL显示
      const urlElement = document.getElementById('currentUrl');
      if (urlElement && tab) {
        const url = new URL(tab.url);
        urlElement.textContent = url.hostname;
        urlElement.title = tab.url;
      }
    } catch (error) {
      console.error('Failed to get current tab:', error);
    }
  }

  /**
   * 初始化UI状态
   */
  async initializeUI() {
    try {
      // 加载插件设置
      const settings = await this.storageUtils.getPluginSettings();

      // 设置复制开关状态
      const copyToggle = document.getElementById('copyToggle');
      if (copyToggle) {
        copyToggle.checked = settings.copyEnabled !== false; // 默认启用
      }

      // 设置粘贴开关状态
      const pasteToggle = document.getElementById('pasteToggle');
      if (pasteToggle) {
        pasteToggle.checked = settings.pasteEnabled !== false; // 默认启用
      }

      // 设置强制模式状态
      const forceMode = document.getElementById('forceMode');
      if (forceMode) {
        forceMode.checked = settings.forceMode;
      }

      // 更新页面状态
      await this.updatePageStatus();

    } catch (error) {
      console.error('Failed to initialize UI:', error);
    }
  }

  /**
   * 绑定事件监听器
   */
  bindEventListeners() {
    // 添加用户交互检测
    this.setupUserInteractionDetection();

    // 复制开关
    const copyToggle = document.getElementById('copyToggle');
    if (copyToggle) {
      copyToggle.addEventListener('change', (e) => {
        this.handleCopyToggle(e.target.checked);
      });
    }

    // 粘贴开关
    const pasteToggle = document.getElementById('pasteToggle');
    if (pasteToggle) {
      pasteToggle.addEventListener('change', (e) => {
        this.handlePasteToggle(e.target.checked);
      });
    }

    // 强制模式开关
    const forceMode = document.getElementById('forceMode');
    if (forceMode) {
      forceMode.addEventListener('change', (e) => {
        this.handleForceModeToggle(e.target.checked);
      });
    }

    // 刷新检测按钮
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.handleRefreshDetection();
      });
    }

    // 添加到自动开启按钮
    const addToAutoBtn = document.getElementById('addToAutoBtn');
    if (addToAutoBtn) {
      addToAutoBtn.addEventListener('click', () => {
        this.handleAddToAutoEnable();
      });
    }

    // 测试复制按钮
    const testCopyBtn = document.getElementById('testCopyBtn');
    if (testCopyBtn) {
      testCopyBtn.addEventListener('click', () => {
        this.handleTestCopy();
      });
    }

    // 设置按钮
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.openOptionsPage();
      });
    }

    // 帮助按钮
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        this.openHelpPage();
      });
    }

    // 反馈按钮
    const feedbackBtn = document.getElementById('feedbackBtn');
    if (feedbackBtn) {
      feedbackBtn.addEventListener('click', () => {
        this.openFeedbackPage();
      });
    }
  }

  /**
   * 处理复制开关切换
   */
  async handleCopyToggle(enabled) {
    try {
      this.showLoading(true);

      // 更新设置
      await this.storageUtils.setPluginSettings({ copyEnabled: enabled });

      // 发送消息到background script
      await this.messageUtils.sendToBackground({
        type: 'TOGGLE_COPY',
        enabled: enabled
      });

      // 发送消息到当前页面的content script
      if (this.currentTab) {
        try {
          await this.messageUtils.sendToContentScript(this.currentTab.id, {
            type: 'COPY_STATUS_CHANGED',
            enabled: enabled
          });
        } catch (error) {
          console.log('Content script not available, will be injected when needed');
        }
      }

      // 更新页面状态
      await this.updatePageStatus();

      this.showNotification(
        enabled ? '复制功能已启用' : '复制功能已禁用',
        'success'
      );

    } catch (error) {
      console.error('Failed to toggle copy:', error);
      this.showNotification('复制功能操作失败', 'error');
      
      // 记录操作失败类型
      await this.recordFailedOperation('复制失败');

      // 恢复开关状态
      const copyToggle = document.getElementById('copyToggle');
      if (copyToggle) {
        copyToggle.checked = !enabled;
      }
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * 处理粘贴开关切换
   */
  async handlePasteToggle(enabled) {
    try {
      this.showLoading(true);

      // 更新设置
      await this.storageUtils.setPluginSettings({ pasteEnabled: enabled });

      // 发送消息到background script
      await this.messageUtils.sendToBackground({
        type: 'TOGGLE_PASTE',
        enabled: enabled
      });

      // 发送消息到当前页面的content script
      if (this.currentTab) {
        try {
          await this.messageUtils.sendToContentScript(this.currentTab.id, {
            type: 'PASTE_STATUS_CHANGED',
            enabled: enabled
          });
        } catch (error) {
          console.log('Content script not available, will be injected when needed');
        }
      }

      // 更新页面状态
      await this.updatePageStatus();

      this.showNotification(
        enabled ? '粘贴功能已启用' : '粘贴功能已禁用',
        'success'
      );

    } catch (error) {
      console.error('Failed to toggle paste:', error);
      this.showNotification('粘贴功能操作失败', 'error');
      
      // 记录操作失败类型
      await this.recordFailedOperation('粘贴失败');

      // 恢复开关状态
      const pasteToggle = document.getElementById('pasteToggle');
      if (pasteToggle) {
        pasteToggle.checked = !enabled;
      }
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * 处理强制模式切换
   */
  async handleForceModeToggle(forceMode) {
    try {
      // 更新设置
      await this.storageUtils.setPluginSettings({ forceMode });

      // 发送消息到background script
      await this.messageUtils.sendToBackground({
        type: 'TOGGLE_FORCE_MODE',
        forceMode: forceMode
      });

      // 如果启用强力模式，刷新当前页面
      if (forceMode && this.currentTab) {
        try {
          // 刷新页面
          await chrome.tabs.reload(this.currentTab.id);
          
          // 显示刷新提示
          this.showNotification('强力模式已启用，页面正在刷新...', 'success');
          
          // 设置自动关闭定时器，用户交互可以取消
          this.setAutoCloseTimer(1500);
          
          return;
        } catch (error) {
          console.error('Failed to reload page:', error);
          // 如果刷新失败，继续正常流程
        }
      }

      // 发送消息到当前页面的content script
      if (this.currentTab) {
        try {
          await this.messageUtils.sendToContentScript(this.currentTab.id, {
            type: 'FORCE_MODE_CHANGED',
            forceMode: forceMode
          });
        } catch (error) {
          console.log('Content script not available');
        }
      }

      this.showNotification(
        forceMode ? '强制模式已启用' : '强制模式已禁用',
        'success'
      );

    } catch (error) {
      console.error('Failed to toggle force mode:', error);
      this.showNotification('操作失败', 'error');
    }
  }

  /**
   * 处理刷新检测
   */
  async handleRefreshDetection() {
    try {
      this.showLoading(true);

      if (this.currentTab) {
        // 重新注入content script
        await chrome.scripting.executeScript({
          target: { tabId: this.currentTab.id },
          files: ['content/content.js']
        });

        // 发送刷新检测消息
        await this.messageUtils.sendToContentScript(this.currentTab.id, {
          type: 'REFRESH_DETECTION'
        });

        // 更新页面状态
        setTimeout(() => {
          this.updatePageStatus();
        }, 1000);

        this.showNotification('检测已刷新', 'success');
      }

    } catch (error) {
      console.error('Failed to refresh detection:', error);
      this.showNotification('刷新失败', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * 处理测试复制
   */
  async handleTestCopy() {
    try {
      if (this.currentTab) {
        // 发送测试复制消息
        const response = await this.messageUtils.sendToContentScript(this.currentTab.id, {
          type: 'TEST_COPY'
        });

        if (response && response.success) {
          this.showNotification('复制功能正常', 'success');
        } else {
          this.showNotification('复制功能受限', 'warning');
        }
      }

    } catch (error) {
      console.error('Failed to test copy:', error);
      this.showNotification('测试失败', 'error');
    }
  }

  /**
   * 处理添加到自动开启列表
   */
  async handleAddToAutoEnable() {
    try {
      if (!this.currentTab || !this.currentTab.url) {
        this.showNotification('无法获取当前页面信息', 'error');
        return;
      }

      const url = new URL(this.currentTab.url);
      const domain = url.hostname;

      // 检查是否已在列表中
      const autoEnableList = await this.storageUtils.getAutoEnableList();
    if (autoEnableList.find(item => item.domain === domain)) {
      this.showNotification('该网站已在自动开启列表中', 'info');
      return;
    }

    // 添加到自动开启列表（默认全部解锁）
    await this.storageUtils.addToAutoEnableList(domain, true, true);

      this.showNotification(`已将 ${domain} 添加到自动开启列表`, 'success');

      // 更新按钮状态
      this.updateAutoEnableButton();

    } catch (error) {
      console.error('Failed to add to auto enable list:', error);
      this.showNotification('添加失败', 'error');
    }
  }

  /**
   * 更新页面状态
   */
  async updatePageStatus() {
    try {
      const statusIndicator = document.getElementById('statusIndicator');
      const statusText = document.getElementById('statusText');

      if (!statusIndicator || !statusText || !this.currentTab) {
        return;
      }

      // 检查插件是否启用
      const settings = await this.storageUtils.getPluginSettings();
      if (!settings.enabled) {
        statusIndicator.className = 'status-indicator';
        statusText.textContent = '插件已禁用';
        return;
      }

      // 检查是否为自动开启网站的首次交互
      const autoEnableStatus = await this.checkAutoEnableFirstInteraction();
      if (autoEnableStatus) {
        statusIndicator.className = autoEnableStatus.className;
        statusText.textContent = autoEnableStatus.text;
        return;
      }

      try {
        // 发送状态检查消息到content script
        const response = await this.messageUtils.sendToContentScript(this.currentTab.id, {
          type: 'GET_PAGE_STATUS'
        });

        if (response) {
          if (response.active) {
            statusIndicator.className = 'status-indicator active';
            statusText.textContent = '正在保护';
          } else if (response.restrictions) {
            statusIndicator.className = 'status-indicator warning';
            statusText.textContent = '检测到限制';
          } else {
            statusIndicator.className = 'status-indicator';
            statusText.textContent = '无需处理';
          }
        } else {
          statusIndicator.className = 'status-indicator';
          statusText.textContent = '未检测';
        }

      } catch (error) {
        // Content script可能未注入
        statusIndicator.className = 'status-indicator';
        statusText.textContent = '等待检测';
      }

    } catch (error) {
      console.error('Failed to update page status:', error);
    }
  }

  /**
   * 加载数据
   */
  async loadData() {
    try {
      // 加载统计数据
      await this.loadStatistics();

      // 更新自动开启按钮状态
      await this.updateAutoEnableButton();

    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }

  /**
   * 加载统计数据
   */
  async loadStatistics() {
    try {
      const stats = await this.storageUtils.getStatistics();

      // 更新总网站数
      const totalSitesElement = document.getElementById('totalSites');
      if (totalSitesElement) {
        totalSitesElement.textContent = stats.totalSites || 0;
      }

      // 更新今日使用次数
      const todayCountElement = document.getElementById('todayCount');
      if (todayCountElement) {
        const today = new Date().toDateString();
        const todayCount = stats.dailyUsage?.[today] || 0;
        todayCountElement.textContent = todayCount;
      }

      // 计算成功率
      const successRateElement = document.getElementById('successRate');
      if (successRateElement) {
        const total = stats.totalAttempts || 0;
        const success = stats.successfulAttempts || 0;
        const rate = total > 0 ? Math.round((success / total) * 100) : 0;
        successRateElement.textContent = `${rate}%`;
      }

    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }

  /**
   * 开始定期更新
   */
  startPeriodicUpdate() {
    // 每5秒更新一次页面状态
    this.updateInterval = setInterval(() => {
      this.updatePageStatus();
    }, 5000);
  }

  /**
   * 停止定期更新
   */
  stopPeriodicUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * 打开选项页面
   */
  openOptionsPage() {
    chrome.runtime.openOptionsPage();
    window.close();
  }

  /**
   * 打开帮助页面
   */
  openHelpPage() {
    chrome.tabs.create({
      url: 'https://github.com/your-username/easycv/wiki'
    });
    window.close();
  }

  /**
   * 打开反馈页面
   */
  async openFeedbackPage() {
    try {
      // 获取当前页面信息
      const currentUrl = this.currentTab ? this.currentTab.url : 'unknown';
      
      // 获取最近的操作失败类型（如果有的话）
      const lastFailedOperation = await this.getLastFailedOperation();
      
      // 构建反馈URL，包含页面信息
      const feedbackData = {
        url: currentUrl,
        operation: lastFailedOperation || 'general',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      };
      
      // 将反馈数据发送到background script进行处理
      await this.messageUtils.sendToBackground({
        type: 'SUBMIT_FEEDBACK',
        data: feedbackData
      });
      
      // 打开反馈页面
      chrome.tabs.create({
        url: `https://github.com/your-username/easycv/issues/new?title=问题反馈&body=页面URL: ${encodeURIComponent(currentUrl)}%0A操作类型: ${lastFailedOperation || '一般问题'}%0A时间: ${encodeURIComponent(new Date().toLocaleString())}`
      });
      
      window.close();
    } catch (error) {
      console.error('Failed to open feedback page:', error);
      // 如果出错，仍然打开基本的反馈页面
      chrome.tabs.create({
        url: 'https://github.com/your-username/easycv/issues'
      });
      window.close();
    }
   }

  /**
   * 获取最近的操作失败类型
   */
  async getLastFailedOperation() {
    try {
      // 从存储中获取最近的失败操作记录
      const result = await this.storageUtils.get('lastFailedOperation');
      return result.lastFailedOperation || this.lastFailedOperation;
    } catch (error) {
      console.error('Failed to get last failed operation:', error);
      return this.lastFailedOperation;
    }
  }

  /**
   * 记录操作失败类型
   */
  async recordFailedOperation(operationType) {
    try {
      this.lastFailedOperation = operationType;
      await this.storageUtils.set({ lastFailedOperation: operationType });
      console.log('Recorded failed operation:', operationType);
    } catch (error) {
      console.error('Failed to record failed operation:', error);
    }
  }

  /**
   * 显示加载状态
   */
  showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      if (show) {
        loadingOverlay.classList.add('show');
      } else {
        loadingOverlay.classList.remove('show');
      }
    }
  }

  /**
   * 更新自动开启按钮状态
   */
  async updateAutoEnableButton() {
    try {
      const addToAutoBtn = document.getElementById('addToAutoBtn');
      if (!addToAutoBtn || !this.currentTab) {
        return;
      }

      const url = new URL(this.currentTab.url);
      const domain = url.hostname;
      const autoEnableList = await this.storageUtils.getAutoEnableList();

      const config = autoEnableList.find(item => item.domain === domain);
      
      if (config) {
        let statusText = '已在自动开启列表';
        if (config.copyEnabled && config.pasteEnabled) {
          statusText += '（全部解锁）';
        } else if (config.copyEnabled) {
          statusText += '（仅复制）';
        } else if (config.pasteEnabled) {
          statusText += '（仅粘贴）';
        }
        
        addToAutoBtn.textContent = statusText;
        addToAutoBtn.disabled = true;
        addToAutoBtn.classList.add('disabled');
      } else {
        addToAutoBtn.innerHTML = `
          <svg class="btn-icon" viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          添加到自动开启
        `;
        addToAutoBtn.disabled = false;
        addToAutoBtn.classList.remove('disabled');
      }
    } catch (error) {
      console.error('Failed to update auto enable button:', error);
    }
  }

  /**
   * 显示通知消息
   */
  showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const messageElement = notification?.querySelector('.notification-message');

    if (notification && messageElement) {
      // 设置消息内容
      messageElement.textContent = message;

      // 设置类型样式
      notification.className = `notification ${type}`;

      // 显示通知
      notification.classList.add('show');

      // 3秒后自动隐藏
      setTimeout(() => {
        notification.classList.remove('show');
      }, 3000);
    }
  }

  /**
   * 应用自动开启配置
   */
  async applyAutoEnableConfig() {
    try {
      if (!this.currentTab) {
        return;
      }

      const url = new URL(this.currentTab.url);
      const domain = url.hostname;
      const autoEnableList = await this.storageUtils.getAutoEnableList();
      
      // 检查是否在自动开启列表中
      const config = autoEnableList.find(item => item.domain === domain);
      if (config) {
        console.log(`Applying auto-enable config for ${domain}:`, config);
        
        // 更新插件设置以匹配自动开启配置
        await this.storageUtils.setPluginSettings({
          copyEnabled: config.copyEnabled,
          pasteEnabled: config.pasteEnabled
        });
        
        // 更新UI状态
        await this.updateUIFromSettings();
        
        // 发送消息到background script
        await this.messageUtils.sendToBackground({
          type: 'AUTO_ENABLE_APPLIED',
          domain: domain,
          config: config
        });
      }
    } catch (error) {
      console.error('Failed to apply auto enable config:', error);
    }
  }

  /**
   * 检查自动开启网站的首次交互状态
   */
  async checkAutoEnableFirstInteraction() {
    try {
      if (!this.currentTab) {
        return null;
      }

      const url = new URL(this.currentTab.url);
      const domain = url.hostname;
      const autoEnableList = await this.storageUtils.getAutoEnableList();
      
      // 检查是否在自动开启列表中
      const config = autoEnableList.find(item => item.domain === domain);
      if (!config) {
        return null;
      }

      // 获取当前插件设置
      const settings = await this.storageUtils.getPluginSettings();
      
      // 检查功能是否已按配置启用
      const copyMatches = config.copyEnabled === settings.copyEnabled;
      const pasteMatches = config.pasteEnabled === settings.pasteEnabled;
      
      if (copyMatches && pasteMatches) {
        // 功能已按自动开启配置激活
        let statusText = '自动开启成功';
        if (config.copyEnabled && config.pasteEnabled) {
          statusText += '（全部解锁）';
        } else if (config.copyEnabled) {
          statusText += '（仅复制）';
        } else if (config.pasteEnabled) {
          statusText += '（仅粘贴）';
        }
        
        return {
          className: 'status-indicator active',
          text: statusText
        };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to check auto enable first interaction:', error);
      return null;
    }
  }

  /**
   * 设置用户交互检测
   */
  setupUserInteractionDetection() {
    // 监听各种用户交互事件
    const interactionEvents = ['click', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    
    interactionEvents.forEach(eventType => {
      document.addEventListener(eventType, () => {
        this.markUserInteracted();
      }, { passive: true });
    });
  }

  /**
   * 标记用户已交互
   */
  markUserInteracted() {
    if (!this.userInteracted) {
      this.userInteracted = true;
      // 取消自动关闭定时器
      if (this.autoCloseTimer) {
        clearTimeout(this.autoCloseTimer);
        this.autoCloseTimer = null;
        console.log('User interaction detected, auto-close timer cancelled');
      }
    }
  }

  /**
   * 设置自动关闭定时器
   */
  setAutoCloseTimer(delay = 5000) {
    // 如果用户已经交互过，不设置自动关闭
    if (this.userInteracted) {
      return;
    }

    // 清除现有定时器
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
    }

    // 设置新的自动关闭定时器
    this.autoCloseTimer = setTimeout(() => {
      if (!this.userInteracted) {
        console.log('Auto-closing popup after', delay, 'ms');
        window.close();
      }
    }, delay);
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.stopPeriodicUpdate();
    
    // 清理自动关闭定时器
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  const popupManager = new PopupManager();

  // 页面卸载时清理资源
  window.addEventListener('beforeunload', () => {
    popupManager.cleanup();
  });
});

// 导出供其他模块使用
window.PopupManager = PopupManager;