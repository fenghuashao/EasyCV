/**
 * EasyCV Popup 脚本
 * 处理弹窗界面的交互逻辑
 */

// 导入工具类
import { MessageUtils } from '../utils/message-utils.js';
import { StorageUtils } from '../utils/storage-utils.js';

class PopupManager {
  constructor() {
    this.currentTab = null;
    this.messageUtils = new MessageUtils();
    this.storageUtils = new StorageUtils();
    this.updateInterval = null;
    
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
      
      // 开始定期更新
      this.startPeriodicUpdate();
      
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
      
      // 设置主开关状态
      const mainToggle = document.getElementById('mainToggle');
      if (mainToggle) {
        mainToggle.checked = settings.enabled;
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
    // 主开关
    const mainToggle = document.getElementById('mainToggle');
    if (mainToggle) {
      mainToggle.addEventListener('change', (e) => {
        this.handleMainToggle(e.target.checked);
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
   * 处理主开关切换
   */
  async handleMainToggle(enabled) {
    try {
      this.showLoading(true);
      
      // 更新设置
      await this.storageUtils.setPluginSettings({ enabled });
      
      // 发送消息到background script
      await this.messageUtils.sendToBackground({
        type: 'TOGGLE_PLUGIN',
        enabled: enabled
      });
      
      // 发送消息到当前页面的content script
      if (this.currentTab) {
        try {
          await this.messageUtils.sendToContentScript(this.currentTab.id, {
            type: 'PLUGIN_STATUS_CHANGED',
            enabled: enabled
          });
        } catch (error) {
          console.log('Content script not available, will be injected when needed');
        }
      }
      
      // 更新页面状态
      await this.updatePageStatus();
      
      this.showNotification(
        enabled ? '插件已启用' : '插件已禁用',
        'success'
      );
      
    } catch (error) {
      console.error('Failed to toggle plugin:', error);
      this.showNotification('操作失败', 'error');
      
      // 恢复开关状态
      const mainToggle = document.getElementById('mainToggle');
      if (mainToggle) {
        mainToggle.checked = !enabled;
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
  openFeedbackPage() {
    chrome.tabs.create({
      url: 'https://github.com/your-username/easycv/issues'
    });
    window.close();
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
   * 清理资源
   */
  cleanup() {
    this.stopPeriodicUpdate();
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