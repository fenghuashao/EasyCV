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
      // 应用本地化文案（保留 HTML 内嵌文案作为兜底）
      I18nUtils.applyToPage();

      // 版本号取自 manifest，避免硬编码过期
      const versionBadge = document.getElementById('versionBadge');
      if (versionBadge) {
        versionBadge.textContent = `v${chrome.runtime.getManifest().version}`;
      }

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
      
      // 启动定期更新
      this.startPeriodicUpdate();

      // 立即刷新一次页面状态，避免首次打开停留在「检测中」直至下个 30 秒周期
      await this.updatePageStatus();

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
        const response = await MessageUtils.sendToBackground(
          MessageUtils.MESSAGE_TYPES.GET_COMPLETE_STATE,
          {}
        );
        
        if (response && response.success && response.data && response.data.state) {
          this.currentState = response.data.state;
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

    // 更新主按钮：复制与粘贴全开时视为"已解锁"
    const bothEnabled = state.copyEnabled !== false && state.pasteEnabled !== false;
    const mainUnlockBtn = document.getElementById('mainUnlockBtn');
    const mainUnlockText = document.getElementById('mainUnlockText');
    if (mainUnlockBtn && mainUnlockText) {
      mainUnlockBtn.classList.toggle('active', bothEnabled);
      mainUnlockText.textContent = I18nUtils.t(bothEnabled ? 'main_lock_off' : 'main_unlock');
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
   * 使用增强确认机制更新状态
   * @param {Object} updates - 状态更新
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 确认结果
   */
  async updateStateWithConfirmation(updates, options = {}) {
    const requestId = options.requestId || this.generateRequestId();
    
    try {
      // 发送带确认的状态更新请求
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_PLUGIN_STATE_WITH_CONFIRMATION',
        updates,
        options: {
          ...options,
          requestId,
          operation: options.operation || 'popup_update',
          timeout: options.timeout || 5000,
          autoRetry: options.autoRetry !== false
        }
      });
      
      if (!response.success) {
        throw new Error(response.error || '状态更新失败');
      }

      await this.updatePageStatus();
      
      return response;
      
    } catch (error) {
      console.error('状态确认更新失败:', error);
      throw error;
    }
  }

  /**
   * 生成请求ID
   * @returns {string} 请求ID
   */
  generateRequestId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `popup_${timestamp}_${random}`;
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
      version: chrome.runtime.getManifest().version
    };
    
    this.currentState = defaultState;
    this.updateUIFromState(defaultState);
    
    console.log('Applied default state:', defaultState);
  }

  /**
   * 绑定事件监听器
   */
  bindEventListeners() {
    // 主解锁按钮
    const mainUnlockBtn = document.getElementById('mainUnlockBtn');
    if (mainUnlockBtn) {
      mainUnlockBtn.addEventListener('click', () => this.handleMainToggle());
    }

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
   * 处理主按钮切换：一键同时开启/关闭复制与粘贴解锁
   */
  async handleMainToggle() {
    const mainUnlockBtn = document.getElementById('mainUnlockBtn');
    const bothEnabled = this.currentState?.copyEnabled !== false && this.currentState?.pasteEnabled !== false;
    const target = !bothEnabled;

    // 乐观更新UI
    this.updateUIState({ copyEnabled: target, pasteEnabled: target });
    if (mainUnlockBtn) mainUnlockBtn.disabled = true;

    try {
      const result = await this.updateStateWithConfirmation(
        { copyEnabled: target, pasteEnabled: target },
        {
          operation: 'main_unlock_toggle',
          timeout: 5000,
          autoRetry: true
        }
      );

      if (result.success) {
        NotificationUtils.show(I18nUtils.t(target ? 'unlock_active' : 'unlock_closed'), 'success');

        // 开启"自动加入"设置时，手动解锁成功的站点直接进入自动启用列表
        if (target && this.currentTab?.url) {
          try {
            const settings = await StorageUtils.getUserSettings();
            if (settings.autoAddToWhitelist) {
              const domain = new URL(this.currentTab.url).hostname;
              await StorageUtils.addToAutoEnableList(domain);
              this.updateAutoEnableButton();
            }
          } catch (error) {
            console.warn('自动加入自动启用列表失败:', error);
          }
        }
      } else {
        throw new Error(result.error || '状态更新失败');
      }
    } catch (error) {
      console.error('Failed to toggle main unlock:', error);

      // 回滚UI状态
      this.updateUIState({ copyEnabled: !target, pasteEnabled: !target });
      NotificationUtils.show(I18nUtils.t('unlock_toggle_failed'), 'error');
    } finally {
      if (mainUnlockBtn) mainUnlockBtn.disabled = false;
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
      // 使用新的确认机制更新状态
      const result = await this.updateStateWithConfirmation(
        { copyEnabled: newCopyState },
        {
          operation: 'toggle_copy',
          timeout: 5000,
          autoRetry: true
        }
      );
      
      if (result.success) {
        // 显示成功通知
        NotificationUtils.show(I18nUtils.t(newCopyState ? 'copy_enabled' : 'copy_disabled'), 'success');
      } else {
        throw new Error(result.error || '状态更新失败');
      }
      
    } catch (error) {
      console.error('Failed to toggle copy:', error);
      
      // 回滚UI状态
      this.updateUIState({ copyEnabled: !newCopyState });
      copyToggle.checked = !newCopyState;
      
      // 显示错误通知
      NotificationUtils.show(I18nUtils.t('copy_toggle_failed'), 'error');
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
      // 使用新的确认机制更新状态
      const result = await this.updateStateWithConfirmation(
        { pasteEnabled: newPasteState },
        {
          operation: 'toggle_paste',
          timeout: 5000,
          autoRetry: true
        }
      );
      
      if (result.success) {
        // 显示成功通知
        NotificationUtils.show(I18nUtils.t(newPasteState ? 'paste_enabled' : 'paste_disabled'), 'success');
      } else {
        throw new Error(result.error || '状态更新失败');
      }
      
    } catch (error) {
      console.error('Failed to toggle paste:', error);
      
      // 回滚UI状态
      this.updateUIState({ pasteEnabled: !newPasteState });
      pasteToggle.checked = !newPasteState;
      
      // 显示错误通知
      NotificationUtils.show(I18nUtils.t('paste_toggle_failed'), 'error');
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
      // 使用新的确认机制更新状态
      const result = await this.updateStateWithConfirmation(
        { forceMode: newForceMode },
        {
          operation: 'toggle_force_mode',
          timeout: 5000,
          autoRetry: true
        }
      );
      
      if (result.success) {
        // 显示成功通知
        NotificationUtils.show(I18nUtils.t(newForceMode ? 'force_mode_enabled' : 'force_mode_disabled'), 'success');
      } else {
        throw new Error(result.error || '状态更新失败');
      }
      
    } catch (error) {
      console.error('Failed to toggle force mode:', error);
      
      // 回滚UI状态
      this.updateUIState({ forceMode: !newForceMode });
      forceMode.checked = !newForceMode;
      
      // 显示错误通知
      NotificationUtils.show(I18nUtils.t('force_toggle_failed'), 'error');
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
        type: MessageUtils.MESSAGE_TYPES.REFRESH_DETECTION
      });
      
      if (response && response.success) {
        await this.updatePageStatus();
        NotificationUtils.show(I18nUtils.t('refresh_success'), 'success');
      } else {
        throw new Error('刷新检测失败');
      }
    } catch (error) {
      console.error('刷新检测失败:', error);
      NotificationUtils.show(I18nUtils.t('refresh_failed'), 'error');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * 检查页面复制开关；消息成功不代表真实剪贴板操作成功。
   */
  async handleTestCopy() {
    try {
      // 发送测试复制消息到content script
      const response = await MessageUtils.sendToContentScript(this.currentTab.id, {
        type: MessageUtils.MESSAGE_TYPES.TEST_COPY
      });
      
      if (response?.success && typeof response.canCopy === 'boolean') {
        NotificationUtils.show(I18nUtils.t(response.canCopy ? 'copy_check_enabled' : 'copy_check_disabled'), 'info');
      } else {
        throw new Error(response?.error || '测试复制失败');
      }
    } catch (error) {
      console.error('测试复制失败:', error);
      NotificationUtils.show(I18nUtils.t('test_copy_failed'), 'error');
    }
  }

  /**
   * 处理添加到自动开启
   */
  async handleAddToAutoEnable() {
    if (!this.currentTab || !this.currentTab.url) {
      NotificationUtils.show(I18nUtils.t('cannot_get_page_info'), 'error');
      return;
    }

    try {
      const url = new URL(this.currentTab.url);
      const domain = url.hostname;

      // 自动启用列表元素为 {domain, copyEnabled, pasteEnabled} 对象，须按对象查询
      const existingConfig = await StorageUtils.getAutoEnableConfig(domain);
      if (existingConfig) {
        NotificationUtils.show(I18nUtils.t('already_in_auto_list'), 'info');
        return;
      }

      await StorageUtils.addToAutoEnableList(domain);

      // 更新按钮状态
      this.updateAutoEnableButton();

      NotificationUtils.show(I18nUtils.t('added_to_auto_list', domain), 'success');
    } catch (error) {
      console.error('添加自动开启失败:', error);
      NotificationUtils.show(I18nUtils.t('add_failed'), 'error');
    }
  }

  /**
   * 仅普通网页与获准访问的本地文件可能有内容脚本；商店禁止注入。
   */
  getSupportedPageUrl() {
    try {
      const url = new URL(this.currentTab?.url || '');
      if (!['http:', 'https:', 'file:'].includes(url.protocol)) return null;
      if (url.hostname === 'chromewebstore.google.com' ||
          (url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore'))) return null;
      return url;
    } catch (error) {
      return null;
    }
  }

  setPageStatus(key, indicatorClass) {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    if (indicator) indicator.className = `status-indicator ${indicatorClass}`;
    if (text) text.textContent = I18nUtils.t(key);
  }

  setPageActionsEnabled(enabled) {
    for (const id of ['refreshBtn', 'testCopyBtn']) {
      const button = document.getElementById(id);
      if (button) button.disabled = !enabled;
    }
  }

  /**
   * 使用内容脚本的真实 status 信封显示启用态，不将开关或检测结果当作复制成功。
   */
  async updatePageStatus() {
    this.setPageActionsEnabled(false);
    const url = this.getSupportedPageUrl();
    const currentUrlElement = document.getElementById('currentUrl');
    if (currentUrlElement) {
      currentUrlElement.textContent = url ? (url.hostname || I18nUtils.t('local_file')) : '';
      currentUrlElement.style.display = url ? '' : 'none';
    }
    if (!url) {
      this.setPageStatus('status_unsupported', 'inactive');
      return;
    }

    try {
      const [settings, excluded] = await Promise.all([
        StorageUtils.getPluginSettings(), StorageUtils.getExcludedList()
      ]);
      if (StorageUtils.isDomainExcluded(url.hostname, excluded)) {
        this.setPageStatus('status_excluded', 'inactive');
        return;
      }
      if (settings.enabled === false) {
        this.setPageStatus('status_plugin_disabled', 'disabled');
        return;
      }

      const response = await MessageUtils.sendToContentScript(this.currentTab.id,
        { type: MessageUtils.MESSAGE_TYPES.GET_PAGE_STATUS }, { retries: 0, silent: true });
      const status = response?.success ? response.status : null;
      if (!status || ['isEnabled', 'copyEnabled', 'pasteEnabled'].some(key => typeof status[key] !== 'boolean')) {
        this.setPageStatus('status_page_unavailable', 'warning');
        return;
      }
      this.setPageActionsEnabled(true);
      if (!status.isEnabled || (!status.copyEnabled && !status.pasteEnabled)) {
        this.setPageStatus('status_inactive', 'inactive');
      } else if (status.copyEnabled && status.pasteEnabled) {
        this.setPageStatus('status_active', 'active');
      } else {
        this.setPageStatus('status_partial', 'warning');
      }
    } catch (error) {
      console.error('更新页面状态失败:', error);
      this.setPageStatus('status_page_unavailable', 'warning');
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
      const stats = await StorageUtils.getStatistics();
      
      // 更新总网站数（statistics 中以 sitesUnlocked 数组记录）
      const totalSitesElement = document.getElementById('totalSites');
      if (totalSitesElement) {
        totalSitesElement.textContent = (stats.sitesUnlocked || []).length;
      }

      // 更新今日使用次数（对应 HTML 中的 #todayCount）
      const todayCountElement = document.getElementById('todayCount');
      if (todayCountElement) {
        todayCountElement.textContent = stats.todayUsage || 0;
      }
      
      // 更新成功率
      const successRateElement = document.getElementById('successRate');
      if (successRateElement) {
        const total = stats.totalAttempts;
        const successes = stats.successfulAttempts;
        successRateElement.textContent = Number.isFinite(total) && total > 0 &&
          Number.isFinite(successes) && successes >= 0 && successes <= total
          ? `${Math.round((successes / total) * 100)}%` : '—';
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

  // 自动启用逻辑已移至统一的AutoEnableManager处理

  /**
   * 打开反馈页面
   */
  openFeedbackPage() {
    // 只打开待审阅草稿；不自动把浏览地址、查询参数或浏览器明细发送给外部网站。
    const url = new URL('https://github.com/fenghuashao/EasyCV/issues/new');
    url.searchParams.set('title', I18nUtils.t('feedback_issue_title'));
    url.searchParams.set('body', I18nUtils.t('feedback_issue_body', chrome.runtime.getManifest().version));
    chrome.tabs.create({ url: url.href });
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
    // CSS 约定：.loading-overlay 默认 display:none，加 .show 后 display:flex
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.toggle('show', show);
    }
  }

  /**
   * 更新自动开启按钮状态
   */
  async updateAutoEnableButton() {
    const addToAutoBtn = document.getElementById('addToAutoBtn');
    const addToAutoBtnText = document.getElementById('addToAutoBtnText');
    if (!addToAutoBtn) return;
    addToAutoBtn.disabled = true;
    addToAutoBtn.classList.toggle('disabled', true);

    try {
      const url = this.getSupportedPageUrl();
      if (!url?.hostname) {
        addToAutoBtn.disabled = true;
        addToAutoBtn.classList.toggle('disabled', true);
        return;
      }
      const domain = url.hostname;

      const [existingConfig, excluded] = await Promise.all([
        StorageUtils.getAutoEnableConfig(domain), StorageUtils.getExcludedList()
      ]);
      const isInList = !!existingConfig;
      const isDisabled = isInList || StorageUtils.isDomainExcluded(domain, excluded);

      if (addToAutoBtnText) {
        addToAutoBtnText.textContent = I18nUtils.t(isInList ? 'btn_in_auto_list' : 'add_to_auto');
      }
      addToAutoBtn.disabled = isDisabled;
      addToAutoBtn.classList.toggle('disabled', isDisabled);
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
    const panel = document.getElementById('helpPanel');
    const button = document.getElementById('helpBtn');
    if (!panel) return;
    panel.hidden = !panel.hidden;
    if (button) button.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) panel.scrollIntoView({ block: 'nearest' });
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
