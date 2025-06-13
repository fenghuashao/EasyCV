/**
 * Popup页面管理器
 * 负责处理插件弹窗的所有交互逻辑
 */
class PopupManager {
  constructor() {
    this.currentTab = null;
    this.updateInterval = null;
    this.isUpdating = false;
    
    // 状态管理相关属性
    this.currentState = null;
    this.pendingOperations = new Map();
    this.stateListeners = new Set();
    this.syncTimeout = 5000; // 5秒超时
    this.retryCount = 3;
    this.isInitialized = false;
  }

  /**
   * 初始化Popup管理器
   */
  async init() {
    try {
      // 获取当前标签页
      this.currentTab = await this.getCurrentTab();
      
      // 从Background Script加载完整状态
      await this.loadStateFromBackground();
      
      // 设置状态监听器
      this.setupStateListeners();
      
      // 初始化UI
      this.initializeUI();
      
      // 绑定事件监听器
      this.bindEventListeners();
      
      // 加载数据
      await this.loadData();
      
      // 应用自动开启配置
      await this.applyAutoEnableConfig();
      
      // 启动定期更新
      this.startPeriodicUpdate();
      
      this.isInitialized = true;
      
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      // 应用默认状态
      await this.applyDefaultState();
      this.isInitialized = true;
    }
  }

  /**
   * 从Background Script加载完整状态
   */
  async loadStateFromBackground() {
    let retryCount = 0;
    
    while (retryCount < this.retryCount) {
      try {
        const response = await MessageUtils.sendToBackground({
          type: 'GET_COMPLETE_STATE'
        });
        
        if (response && response.state) {
          this.currentState = response.state;
          console.log('State loaded from background:', this.currentState);
          return;
        }
        
        throw new Error('Invalid state response');
        
      } catch (error) {
        retryCount++;
        console.warn(`Failed to load state (attempt ${retryCount}):`, error);
        
        if (retryCount < this.retryCount) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }
    
    throw new Error('Failed to load state after multiple attempts');
  }

  /**
   * 设置状态监听器
   */
  setupStateListeners() {
    // 监听来自Background的状态广播
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'STATE_BROADCAST') {
        this.handleStateBroadcast(message.state, message.requestId);
      }
      return false;
    });
  }

  /**
   * 处理状态广播
   */
  handleStateBroadcast(newState, requestId) {
    console.log('Received state broadcast:', newState, requestId);
    
    // 更新本地状态
    this.currentState = newState;
    
    // 更新UI（如果不是来自当前popup的操作）
    if (!this.pendingOperations.has(requestId)) {
      this.updateUIFromState(newState);
    }
    
    // 处理待确认的操作
    if (requestId && this.pendingOperations.has(requestId)) {
      const operation = this.pendingOperations.get(requestId);
      operation.resolve(newState);
    }
    
    // 通知状态监听器
    this.notifyStateListeners(newState);
  }

  /**
   * 初始化UI界面
   */
  initializeUI() {
    if (this.currentState) {
      this.updateUIFromState(this.currentState);
    } else {
      this.applyDefaultState();
    }
  }

  /**
   * 根据状态更新UI
   */
  updateUIFromState(state) {
    if (!state) return;
    
    // 更新复制开关
    const copyToggle = document.getElementById('copyToggle');
    if (copyToggle) {
      copyToggle.checked = state.copyEnabled !== false;
    }
    
    // 更新粘贴开关
    const pasteToggle = document.getElementById('pasteToggle');
    if (pasteToggle) {
      pasteToggle.checked = state.pasteEnabled !== false;
    }
    
    // 更新强制模式开关
    const forceMode = document.getElementById('forceMode');
    if (forceMode) {
      forceMode.checked = state.forceMode || false;
    }
    
    // 更新插件启用状态
    const pluginToggle = document.getElementById('pluginToggle');
    if (pluginToggle) {
      pluginToggle.checked = state.pluginEnabled !== false;
    }
    
    console.log('UI updated from state:', state);
  }

  /**
   * 更新UI状态（乐观更新）
   */
  updateUIState(changes) {
    // 更新本地状态缓存
    if (this.currentState) {
      this.currentState = { ...this.currentState, ...changes };
    } else {
      this.currentState = { 
        pluginEnabled: true,
        copyEnabled: true,
        pasteEnabled: true,
        forceMode: false,
        ...changes 
      };
    }
    
    // 更新UI
    this.updateUIFromState(this.currentState);
  }

  /**
   * 等待状态同步确认
   */
  async waitForStateSync(expectedState, requestId) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingOperations.delete(requestId);
        reject(new Error('状态同步超时'));
      }, this.syncTimeout);
      
      // 存储待确认的操作
      this.pendingOperations.set(requestId, {
        expectedState,
        resolve: (state) => {
          clearTimeout(timeoutId);
          this.pendingOperations.delete(requestId);
          resolve(state);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          this.pendingOperations.delete(requestId);
          reject(error);
        }
      });
    });
  }

  /**
   * 添加状态监听器
   */
  addStateListener(listener) {
    this.stateListeners.add(listener);
  }

  /**
   * 移除状态监听器
   */
  removeStateListener(listener) {
    this.stateListeners.delete(listener);
  }

  /**
   * 通知状态监听器
   */
  notifyStateListeners(state) {
    this.stateListeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('State listener error:', error);
      }
    });
  }

  /**
   * 应用默认状态
   */
  async applyDefaultState() {
    const defaultState = {
      pluginEnabled: true,
      copyEnabled: true,
      pasteEnabled: true,
      forceMode: false,
      timestamp: Date.now(),
      version: '1.0.0'
    };
    
    this.currentState = defaultState;
    this.updateUIFromState(defaultState);
    
    console.log('Applied default state:', defaultState);
  }

  /**
   * 绑定事件监听器
   */
  bindEventListeners() {
    // 复制开关
    const copyToggle = document.getElementById('copyToggle');
    if (copyToggle) {
      copyToggle.addEventListener('change', () => this.handleCopyToggle());
    }

    // 粘贴开关
    const pasteToggle = document.getElementById('pasteToggle');
    if (pasteToggle) {
      pasteToggle.addEventListener('change', () => this.handlePasteToggle());
    }

    // 强制模式开关
    const forceMode = document.getElementById('forceMode');
    if (forceMode) {
      forceMode.addEventListener('change', () => this.handleForceModeToggle());
    }

    // 刷新检测按钮
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.handleRefreshDetection());
    }

    // 添加到自动开启按钮
    const addToAutoBtn = document.getElementById('addToAutoBtn');
    if (addToAutoBtn) {
      addToAutoBtn.addEventListener('click', () => this.handleAddToAutoEnable());
    }

    // 测试复制按钮
    const testCopyBtn = document.getElementById('testCopyBtn');
    if (testCopyBtn) {
      testCopyBtn.addEventListener('click', () => this.handleTestCopy());
    }

    // 设置按钮
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.handleSettings());
    }

    // 帮助按钮
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => this.handleHelp());
    }

    // 反馈按钮
    const feedbackBtn = document.getElementById('feedbackBtn');
    if (feedbackBtn) {
      feedbackBtn.addEventListener('click', () => this.openFeedbackPage());
    }
  }

  /**
   * 处理复制开关切换
   */
  async handleCopyToggle() {
    const copyToggle = document.getElementById('copyToggle');
    const newCopyState = copyToggle.checked;
    const requestId = `copy_${Date.now()}`;
    
    // 乐观更新UI
    this.updateUIState({ copyEnabled: newCopyState });
    
    try {
      // 发送状态变更请求到Background Script
      await MessageUtils.sendToBackground({
        type: 'UPDATE_STATE',
        changes: { copyEnabled: newCopyState },
        requestId: requestId
      });
      
      // 等待状态同步确认
      await this.waitForStateSync({ copyEnabled: newCopyState }, requestId);
      
      // 显示成功通知
      NotificationUtils.show(newCopyState ? '复制功能已开启' : '复制功能已关闭', 'success');
      
    } catch (error) {
      console.error('Failed to toggle copy:', error);
      
      // 回滚UI状态
      this.updateUIState({ copyEnabled: !newCopyState });
      copyToggle.checked = !newCopyState;
      
      // 显示错误通知
      NotificationUtils.show('复制开关切换失败，请重试', 'error');
    }
  }

  /**
   * 处理粘贴开关切换
   */
  async handlePasteToggle() {
    const pasteToggle = document.getElementById('pasteToggle');
    const newPasteState = pasteToggle.checked;
    const requestId = `paste_${Date.now()}`;
    
    // 乐观更新UI
    this.updateUIState({ pasteEnabled: newPasteState });
    
    try {
      // 发送状态变更请求到Background Script
      await MessageUtils.sendToBackground({
        type: 'UPDATE_STATE',
        changes: { pasteEnabled: newPasteState },
        requestId: requestId
      });
      
      // 等待状态同步确认
      await this.waitForStateSync({ pasteEnabled: newPasteState }, requestId);
      
      // 显示成功通知
      NotificationUtils.show(newPasteState ? '粘贴功能已开启' : '粘贴功能已关闭', 'success');
      
    } catch (error) {
      console.error('Failed to toggle paste:', error);
      
      // 回滚UI状态
      this.updateUIState({ pasteEnabled: !newPasteState });
      pasteToggle.checked = !newPasteState;
      
      // 显示错误通知
      NotificationUtils.show('粘贴开关切换失败，请重试', 'error');
    }
  }

  /**
   * 处理强制模式开关切换
   */
  async handleForceModeToggle() {
    const forceMode = document.getElementById('forceMode');
    const newForceMode = forceMode.checked;
    const requestId = `force_${Date.now()}`;
    
    // 乐观更新UI
    this.updateUIState({ forceMode: newForceMode });
    
    try {
      // 发送状态变更请求到Background Script
      await MessageUtils.sendToBackground({
        type: 'UPDATE_STATE',
        changes: { forceMode: newForceMode },
        requestId: requestId
      });
      
      // 等待状态同步确认
      await this.waitForStateSync({ forceMode: newForceMode }, requestId);
      
      // 显示成功通知
      NotificationUtils.show(newForceMode ? '强制模式已开启' : '强制模式已关闭', 'success');
      
    } catch (error) {
      console.error('Failed to toggle force mode:', error);
      
      // 回滚UI状态
      this.updateUIState({ forceMode: !newForceMode });
      forceMode.checked = !newForceMode;
      
      // 显示错误通知
      NotificationUtils.show('强制模式切换失败，请重试', 'error');
    }
  }

  /**
   * 处理刷新检测
   */
  async handleRefreshDetection() {
    try {
      this.showLoading(true);
      
      // 发送刷新检测消息到content script
      const response = await MessageUtils.sendToContentScript(this.currentTab.id, {
        type: 'REFRESH_DETECTION'
      });
      
      if (response && response.success) {
        await this.updatePageStatus();
        NotificationUtils.show('检测已刷新', 'success');
      } else {
        throw new Error('刷新检测失败');
      }
    } catch (error) {
      console.error('刷新检测失败:', error);
      NotificationUtils.show('刷新检测失败，请重试', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * 处理测试复制
   */
  async handleTestCopy() {
    try {
      // 发送测试复制消息到content script
      const response = await MessageUtils.sendToContentScript(this.currentTab.id, {
        type: 'TEST_COPY'
      });
      
      if (response && response.success) {
        NotificationUtils.show('测试复制成功！', 'success');
      } else {
        throw new Error(response?.error || '测试复制失败');
      }
    } catch (error) {
      console.error('测试复制失败:', error);
      NotificationUtils.show('测试复制失败，请检查页面是否支持', 'error');
    }
  }

  /**
   * 处理添加到自动开启
   */
  async handleAddToAutoEnable() {
    if (!this.currentTab || !this.currentTab.url) {
      NotificationUtils.show('无法获取当前页面信息', 'error');
      return;
    }

    try {
      const url = new URL(this.currentTab.url);
      const domain = url.hostname;
      
      // 检查是否已经在自动开启列表中
      const autoEnableList = await storageUtils.getAutoEnableList();
      if (autoEnableList.includes(domain)) {
        NotificationUtils.show('该网站已在自动开启列表中', 'info');
        return;
      }
      
      // 添加到自动开启列表
      autoEnableList.push(domain);
      await storageUtils.setAutoEnableList(autoEnableList);
      
      // 更新按钮状态
      this.updateAutoEnableButton();
      
      NotificationUtils.show(`已将 ${domain} 添加到自动开启列表`, 'success');
    } catch (error) {
      console.error('添加自动开启失败:', error);
      NotificationUtils.show('添加失败，请重试', 'error');
    }
  }

  /**
   * 更新页面状态显示
   */
  async updatePageStatus() {
    if (!this.currentTab) return;
    
    try {
      // 获取插件设置
      const settings = await storageUtils.getPluginSettings();
      const isPluginEnabled = settings.pluginEnabled !== false;
      
      // 检查是否为自动开启网站的首次交互
      const isFirstInteraction = await this.checkFirstInteraction();
      
      // 获取页面状态
      let pageStatus = null;
      try {
        const response = await MessageUtils.sendToContentScript(this.currentTab.id, {
          type: 'GET_PAGE_STATUS'
        });
        pageStatus = response;
      } catch (error) {
        console.warn('无法获取页面状态:', error);
      }
      
      // 更新状态指示器
      const statusIndicator = document.getElementById('statusIndicator');
      const statusText = document.getElementById('statusText');
      
      if (statusIndicator && statusText) {
        if (!isPluginEnabled) {
          statusIndicator.className = 'status-indicator disabled';
          statusText.textContent = '插件已禁用';
        } else if (isFirstInteraction) {
          statusIndicator.className = 'status-indicator warning';
          statusText.textContent = '首次访问，需要刷新页面';
        } else if (pageStatus && pageStatus.isActive) {
          if (pageStatus.hasRestrictions) {
            statusIndicator.className = 'status-indicator warning';
            statusText.textContent = '已激活（检测到限制）';
          } else {
            statusIndicator.className = 'status-indicator active';
            statusText.textContent = '已激活';
          }
        } else {
          statusIndicator.className = 'status-indicator inactive';
          statusText.textContent = '未激活';
        }
      }
    } catch (error) {
      console.error('更新页面状态失败:', error);
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
      console.error('加载数据失败:', error);
    }
  }

  /**
   * 加载统计数据
   */
  async loadStatistics() {
    try {
      const stats = await storageUtils.getStatistics();
      
      // 更新总网站数
      const totalSitesElement = document.getElementById('totalSites');
      if (totalSitesElement) {
        totalSitesElement.textContent = stats.totalSites || 0;
      }
      
      // 更新今日使用次数
      const todayUsageElement = document.getElementById('todayUsage');
      if (todayUsageElement) {
        todayUsageElement.textContent = stats.todayUsage || 0;
      }
      
      // 更新成功率
      const successRateElement = document.getElementById('successRate');
      if (successRateElement) {
        const rate = stats.totalAttempts > 0 ? 
          Math.round((stats.successfulAttempts / stats.totalAttempts) * 100) : 0;
        successRateElement.textContent = `${rate}%`;
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }

  /**
   * 启动定期更新
   */
  startPeriodicUpdate() {
    // 每30秒更新一次页面状态
    this.updateInterval = setInterval(() => {
      if (!this.isUpdating) {
        this.isUpdating = true;
        this.updatePageStatus().finally(() => {
          this.isUpdating = false;
        });
      }
    }, 30000);
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
   * 获取当前标签页
   */
  async getCurrentTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0]);
      });
    });
  }

  /**
   * 检查是否为首次交互
   */
  async checkFirstInteraction() {
    if (!this.currentTab || !this.currentTab.url) return false;
    
    try {
      const url = new URL(this.currentTab.url);
      const domain = url.hostname;
      
      const autoEnableList = await storageUtils.getAutoEnableList();
      const interactionHistory = await storageUtils.getInteractionHistory();
      
      return autoEnableList.includes(domain) && !interactionHistory[domain];
    } catch (error) {
      console.error('检查首次交互失败:', error);
      return false;
    }
  }

  /**
   * 应用自动开启配置
   */
  async applyAutoEnableConfig() {
    if (!this.currentTab || !this.currentTab.url) return;
    
    try {
      const url = new URL(this.currentTab.url);
      const domain = url.hostname;
      
      const autoEnableList = await storageUtils.getAutoEnableList();
      if (autoEnableList.includes(domain)) {
        // 标记为已交互
        const interactionHistory = await storageUtils.getInteractionHistory();
        interactionHistory[domain] = Date.now();
        await storageUtils.setInteractionHistory(interactionHistory);
        
        // 发送自动开启消息到content script
        try {
          await MessageUtils.sendToContentScript(this.currentTab.id, {
            type: 'AUTO_ENABLE'
          });
        } catch (error) {
          console.warn('自动开启失败:', error);
        }
      }
    } catch (error) {
      console.error('应用自动开启配置失败:', error);
    }
  }

  /**
   * 打开反馈页面
   */
  openFeedbackPage() {
    const currentUrl = this.currentTab ? this.currentTab.url : '';
    const lastFailedOp = this.getLastFailedOperation();
    
    const feedbackUrl = `https://github.com/your-repo/issues/new?` +
      `title=用户反馈&` +
      `body=**当前页面:** ${encodeURIComponent(currentUrl)}%0A` +
      `**操作类型:** ${encodeURIComponent(lastFailedOp || '无')}%0A` +
      `**问题描述:** %0A%0A` +
      `**浏览器信息:** ${encodeURIComponent(navigator.userAgent)}%0A` +
      `**时间:** ${encodeURIComponent(new Date().toISOString())}`;
    
    chrome.tabs.create({ url: feedbackUrl });
  }

  /**
   * 获取最近失败的操作
   */
  getLastFailedOperation() {
    try {
      return localStorage.getItem('lastFailedOperation') || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 记录失败的操作
   */
  recordFailedOperation(operation) {
    try {
      localStorage.setItem('lastFailedOperation', operation);
    } catch (error) {
      console.warn('无法记录失败操作:', error);
    }
  }

  /**
   * 显示/隐藏加载状态
   */
  showLoading(show) {
    const loadingElements = document.querySelectorAll('.loading');
    loadingElements.forEach(element => {
      element.style.display = show ? 'block' : 'none';
    });
  }

  /**
   * 更新自动开启按钮状态
   */
  async updateAutoEnableButton() {
    const addToAutoBtn = document.getElementById('addToAutoBtn');
    if (!addToAutoBtn || !this.currentTab || !this.currentTab.url) return;
    
    try {
      const url = new URL(this.currentTab.url);
      const domain = url.hostname;
      
      const autoEnableList = await storageUtils.getAutoEnableList();
      const isInList = autoEnableList.includes(domain);
      
      addToAutoBtn.textContent = isInList ? '已在自动开启列表' : '添加到自动开启';
      addToAutoBtn.disabled = isInList;
      addToAutoBtn.className = isInList ? 'btn btn-secondary disabled' : 'btn btn-primary';
    } catch (error) {
      console.error('更新自动开启按钮失败:', error);
    }
  }

  /**
   * 处理设置按钮点击
   */
  handleSettings() {
    chrome.runtime.openOptionsPage();
  }

  /**
   * 处理帮助按钮点击
   */
  handleHelp() {
    chrome.tabs.create({ url: 'https://github.com/your-repo/wiki' });
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.stopPeriodicUpdate();
    this.stateListeners.clear();
    this.pendingOperations.clear();
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
  const popupManager = new PopupManager();
  await popupManager.init();
  
  // 页面卸载时清理资源
  window.addEventListener('beforeunload', () => {
    popupManager.cleanup();
  });
});

// 导出供其他模块使用
window.PopupManager = PopupManager;