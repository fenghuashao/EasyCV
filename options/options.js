/**
 * EasyCV Options 脚本
 * 处理选项页面的交互逻辑和设置管理
 */

// 导入工具类

/**
 * 项目支持链接配置
 * 仓库迁移或更名时仅需修改 REPO_BASE_URL，三个链接自动派生
 */
const REPO_BASE_URL = 'https://github.com/fenghuashao/EasyCV';
const SUPPORT_LINKS = {
  repo: REPO_BASE_URL,
  issues: `${REPO_BASE_URL}/issues`,
  docs: `${REPO_BASE_URL}/wiki`,
};

class OptionsManager {
  constructor() {
    this.currentTab = 'general';
    this.settings = {};
    this.whitelist = [];
    this.excludedList = [];
    this.statistics = {};

    this.init();
  }
  
  /**
   * 初始化选项页面
   */
  async init() {
    try {
      // 应用本地化文案（保留 HTML 内嵌文案作为兜底）
      I18nUtils.applyToPage();

      // 关于页版本号取自 manifest，避免硬编码过期
      const aboutVersion = document.getElementById('aboutVersion');
      if (aboutVersion) {
        aboutVersion.textContent = I18nUtils.t('version_label', chrome.runtime.getManifest().version);
      }

      // 绑定事件监听器
      this.bindEventListeners();
      
      // 加载数据
      await this.loadAllData();
      
      // 初始化UI
      this.initializeUI();
      
      console.log('Options page initialized successfully');
    } catch (error) {
      console.error('Failed to initialize options page:', error);
      this.showNotification(I18nUtils.t('init_failed'), 'error');
    }
  }
  
  /**
   * 绑定事件监听器
   */
  bindEventListeners() {
    // 侧边栏导航
    this.bindNavigationEvents();
    
    // 常规设置
    this.bindGeneralSettingsEvents();
    
    // 白名单管理
    this.bindWhitelistEvents();

    // 站点排除管理
    this.bindExcludedEvents();
    
    // 高级设置
    this.bindAdvancedSettingsEvents();
    
    // 关于页面
    this.bindAboutEvents();
    
    // 通知关闭按钮
    this.bindNotificationEvents();
  }
  
  /**
   * 绑定通知事件
   */
  bindNotificationEvents() {
    document.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-action="close-notification"]');
      if (closeBtn) {
        const notification = closeBtn.closest('.notification');
        if (notification) {
          notification.classList.remove('show');
        }
      }
    });
  }
  
  /**
   * 绑定导航事件
   */
  bindNavigationEvents() {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const tabName = item.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }
  
  /**
   * 绑定常规设置事件
   */
  bindGeneralSettingsEvents() {
    // 启用复制
    const enableCopy = document.getElementById('enableCopy');
    if (enableCopy) {
      enableCopy.addEventListener('change', (e) => {
        this.updateSetting('copyEnabled', e.target.checked);
      });
    }
    
    // 启用粘贴
    const enablePaste = document.getElementById('enablePaste');
    if (enablePaste) {
      enablePaste.addEventListener('change', (e) => {
        this.updateSetting('pasteEnabled', e.target.checked);
      });
    }
    
    // 自动检测
    const autoDetect = document.getElementById('autoDetect');
    if (autoDetect) {
      autoDetect.addEventListener('change', (e) => {
        this.updateSetting('autoDetect', e.target.checked);
      });
    }
    
    // 强制模式
    const forceMode = document.getElementById('forceMode');
    if (forceMode) {
      forceMode.addEventListener('change', (e) => {
        this.updateSetting('forceMode', e.target.checked);
      });
    }
    
    // 显示通知
    const showNotifications = document.getElementById('showNotifications');
    if (showNotifications) {
      showNotifications.addEventListener('change', (e) => {
        this.updateSetting('showNotifications', e.target.checked);
      });
    }

    // 解锁成功后自动加入自动启用列表
    const autoAddToWhitelist = document.getElementById('autoAddToWhitelist');
    if (autoAddToWhitelist) {
      autoAddToWhitelist.addEventListener('change', (e) => {
        this.updateSetting('autoAddToWhitelist', e.target.checked);
      });
    }
    
    // 检测延迟
    const detectionDelay = document.getElementById('detectionDelay');
    if (detectionDelay) {
      detectionDelay.addEventListener('change', (e) => {
        this.updateSetting('detectionDelay', parseInt(e.target.value));
      });
    }
    
    // 重试次数
    const maxRetries = document.getElementById('maxRetries');
    if (maxRetries) {
      maxRetries.addEventListener('change', (e) => {
        this.updateSetting('maxRetries', parseInt(e.target.value));
      });
    }
  }
  
  /**
   * 绑定白名单事件
   */
  bindWhitelistEvents() {
    document.getElementById('cancelRuleEditBtn')?.addEventListener('click', () => this.cancelRuleEdit());
    // 添加白名单
    const addBtn = document.getElementById('addWhitelistBtn');
    const input = document.getElementById('whitelistInput');
    
    if (addBtn && input) {
      addBtn.addEventListener('click', () => {
        this.addWhitelistDomain(input.value.trim());
      });
      
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.addWhitelistDomain(input.value.trim());
        }
      });
    }
  }
  
  /**
   * 绑定站点排除事件
   */
  bindExcludedEvents() {
    const addBtn = document.getElementById('addExcludedBtn');
    const input = document.getElementById('excludedInput');

    if (addBtn && input) {
      addBtn.addEventListener('click', () => {
        this.addExcludedDomain(input.value.trim());
      });

      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.addExcludedDomain(input.value.trim());
        }
      });
    }

    // 删除按钮走事件委托且只绑定一次（renderExcludedList 每次渲染都会重建子节点，
    // 若随渲染重复绑定会让一次点击触发多次删除）
    const container = document.getElementById('excludedContainer');
    if (container) {
      container.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.action-btn-small.delete');
        if (deleteBtn) {
          const domain = deleteBtn.getAttribute('data-domain');
          if (domain) {
            this.removeExcludedDomain(domain);
          }
        }
      });
    }
  }

  /**
   * 绑定高级设置事件
   */
  bindAdvancedSettingsEvents() {
    // 调试模式
    const debugMode = document.getElementById('debugMode');
    if (debugMode) {
      debugMode.addEventListener('change', (e) => {
        this.updateSetting('debugMode', e.target.checked);
      });
    }
    
    // 性能监控
    const performanceMonitoring = document.getElementById('performanceMonitoring');
    if (performanceMonitoring) {
      performanceMonitoring.addEventListener('change', (e) => {
        this.updateSetting('performanceMonitoring', e.target.checked);
      });
    }
    
    document.getElementById('retryPrivacyMigrationBtn')?.addEventListener('click', () => this.retryPrivacyMigration());
    document.getElementById('exportRecoveryBtn')?.addEventListener('click', () => this.exportRecovery());
    document.getElementById('restoreRecoveryBtn')?.addEventListener('click', () => this.restoreRecovery());
    document.getElementById('enableStatistics')?.addEventListener('change', e => this.updateSetting('enableStatistics', e.target.checked));
    // 数据管理按钮
    const exportBtn = document.getElementById('exportSettingsBtn');
    const importBtn = document.getElementById('importSettingsBtn');
    const resetBtn = document.getElementById('resetSettingsBtn');
    const clearBtn = document.getElementById('clearDataBtn');
    
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportSettings());
    }
    
    if (importBtn) {
      importBtn.addEventListener('click', () => this.importSettings());
    }
    
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetSettings());
    }
    
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearAllData());
    }
    
    // 文件导入
    const fileInput = document.getElementById('importFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        this.handleFileImport(e.target.files[0]);
      });
    }
  }
  
  /**
   * 绑定关于页面事件
   */
  bindAboutEvents() {
    const githubLink = document.getElementById('githubLink');
    const issuesLink = document.getElementById('issuesLink');
    const wikiLink = document.getElementById('wikiLink');
    
    if (githubLink) {
      githubLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: SUPPORT_LINKS.repo });
      });
    }

    if (issuesLink) {
      issuesLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: SUPPORT_LINKS.issues });
      });
    }

    if (wikiLink) {
      wikiLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: SUPPORT_LINKS.docs });
      });
    }
  }
  
  /**
   * 切换标签页
   */
  switchTab(tabName) {
    // 更新菜单状态
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    this.currentTab = tabName;
    
    // 特殊处理
    if (tabName === 'statistics') {
      this.loadStatistics();
    }
  }
  
  /**
   * 加载所有数据
   */
  async loadAllData() {
    try {
      // 加载设置
      this.settings = await StorageUtils.getPluginSettings();
      
      // 加载白名单
      this.whitelist = await StorageUtils.getAutoEnableList();

      // 加载站点排除列表
      this.excludedList = await StorageUtils.getExcludedList();
      
      // 加载统计数据
      this.statistics = await StorageUtils.getStatistics();
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * 初始化UI
   */
  initializeUI() {
    this.refreshRecoveryNotice().catch(() => this.showNotification(I18nUtils.t('load_failed'), 'error'));
    // 设置表单值
    this.updateFormValues();
    
    // 渲染白名单
    this.renderWhitelist();

    // 渲染站点排除列表
    this.renderExcludedList();
    
    // 加载统计数据
    this.loadStatistics();
  }
  
  /**
   * 更新表单值
   */
  updateFormValues() {
    // 常规设置
    const enableCopy = document.getElementById('enableCopy');
    if (enableCopy) enableCopy.checked = this.settings.copyEnabled ?? true;
    
    const enablePaste = document.getElementById('enablePaste');
    if (enablePaste) enablePaste.checked = this.settings.pasteEnabled ?? true;
    
    const autoDetect = document.getElementById('autoDetect');
    if (autoDetect) autoDetect.checked = this.settings.autoDetect ?? true;
    
    const forceMode = document.getElementById('forceMode');
    if (forceMode) forceMode.checked = this.settings.forceMode ?? false;
    
    const showNotifications = document.getElementById('showNotifications');
    if (showNotifications) showNotifications.checked = this.settings.showNotifications ?? true;

    const autoAddToWhitelist = document.getElementById('autoAddToWhitelist');
    if (autoAddToWhitelist) autoAddToWhitelist.checked = this.settings.autoAddToWhitelist ?? false;
    
    const detectionDelay = document.getElementById('detectionDelay');
    if (detectionDelay) detectionDelay.value = this.settings.detectionDelay ?? 1000;
    
    const maxRetries = document.getElementById('maxRetries');
    if (maxRetries) maxRetries.value = this.settings.maxRetries ?? 3;
    
    const enableStatistics = document.getElementById('enableStatistics');
    if (enableStatistics) enableStatistics.checked = this.settings.enableStatistics !== false;
    // 高级设置
    const debugMode = document.getElementById('debugMode');
    if (debugMode) debugMode.checked = this.settings.debugMode ?? false;
    
    const performanceMonitoring = document.getElementById('performanceMonitoring');
    if (performanceMonitoring) performanceMonitoring.checked = this.settings.performanceMonitoring ?? false;
  }
  
  /**
   * 更新设置
   */
  async updateSetting(key, value) {
    try {
      await StorageUtils.setPluginSettings({ [key]: value });
      this.settings = await StorageUtils.getPluginSettings();
      this.updateFormValues();
      this.showNotification(I18nUtils.t('settings_saved'), 'success');
    } catch (error) {
      this.updateFormValues();
      this.showNotification(I18nUtils.t('save_failed'), 'error');
    }
  }
  
  /**
   * 添加自动解锁域名
   */
  async addWhitelistDomain(domain) {
    const isEditing = Boolean(this.editingDomain);
    try {
      domain = StorageUtils.normalizeDomain(domain, true);
      const config = { domain, copyEnabled: document.getElementById('enableCopyOption').checked,
        pasteEnabled: document.getElementById('enablePasteOption').checked };
      if (isEditing) await StorageUtils.replaceAutoEnableRule(this.editingDomain, config);
      else await StorageUtils.addToAutoEnableList(config);
      this.whitelist = await StorageUtils.getAutoEnableList();
      this.cancelRuleEdit();
      this.renderWhitelist();
      this.showNotification(I18nUtils.t(isEditing ? 'settings_saved' : 'domain_added'), 'success');
    } catch (error) {
      // The draft and persisted rule remain intact so the user can retry.
      this.showNotification(I18nUtils.t(isEditing ? 'update_failed' : 'add_failed'), 'error');
    }
  }

  cancelRuleEdit() {
    this.editingDomain = null;
    document.getElementById('whitelistInput').value = '';
    document.getElementById('enableCopyOption').checked = true;
    document.getElementById('enablePasteOption').checked = true;
    const button = document.getElementById('addWhitelistBtn');
    button.textContent = I18nUtils.t('add_btn');
    button.classList.remove('updating');
    const cancel = document.getElementById('cancelRuleEditBtn');
    if (cancel) cancel.hidden = true;
  }
  
  /**
   * 删除自动解锁域名
   */
  async removeWhitelistDomain(domain) {
    try {
      await StorageUtils.removeFromAutoEnableList(domain);
      this.whitelist = await StorageUtils.getAutoEnableList();
      if (this.editingDomain === domain) this.cancelRuleEdit();
      this.renderWhitelist();
      this.showNotification(I18nUtils.t('domain_deleted'), 'success');
    } catch (error) {
      this.showNotification(I18nUtils.t('delete_failed'), 'error');
    }
  }
  
  /**
   * 编辑自动解锁域名
   */
  async editWhitelistDomain(domain) {
    const config = this.whitelist.find(item => item.domain === domain);
    if (!config) return;
    
    // 高亮正在编辑的项目
    const editingItem = document.querySelector(`[data-domain="${this.escapeHTML(domain)}"]`);
    if (editingItem) {
      editingItem.classList.add('editing');
    }
    
    // 填充编辑表单
    const input = document.getElementById('whitelistInput');
    const copyOption = document.getElementById('enableCopyOption');
    const pasteOption = document.getElementById('enablePasteOption');
    const addBtn = document.getElementById('addWhitelistBtn');
    
    if (input) {
      input.value = domain;
      input.setAttribute('data-editing', domain);
    }
    if (copyOption) copyOption.checked = config.copyEnabled;
    if (pasteOption) pasteOption.checked = config.pasteEnabled;
    if (addBtn) {
      addBtn.textContent = I18nUtils.t('update_config_btn');
      addBtn.classList.add('updating');
    }

    // 显示编辑提示
    this.showNotification(I18nUtils.t('editing_config', domain), 'info');
    
    // Editing is an in-memory draft; only Save performs an atomic replacement.
    this.editingDomain = domain;
    const cancel = document.getElementById('cancelRuleEditBtn');
    if (cancel) cancel.hidden = false;
    
    // 滚动到添加表单
    const addForm = document.querySelector('.add-whitelist');
    if (addForm) {
      addForm.scrollIntoView({ behavior: 'smooth' });
      // 聚焦到输入框
      setTimeout(() => {
        if (input) input.focus();
      }, 300);
    }
  }
  
  /**
   * 渲染白名单
   */
  renderWhitelist() {
    const container = document.getElementById('whitelistContainer');
    if (!container) return;
    
    if (this.whitelist.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24">
            <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9L10,17Z"/>
          </svg>
          <p class="empty-text">${I18nUtils.t('empty_whitelist')}</p>
        </div>
      `;
      return;
    }

    const html = this.whitelist.map(config => {
      const { domain, copyEnabled, pasteEnabled } = config;
      let statusTags = '';
      let statusIcon = '';

      if (copyEnabled && pasteEnabled) {
        statusTags = `<span class="status-tag all">${I18nUtils.t('tag_all_unlocked')}</span>`;
        statusIcon = '<svg class="status-icon" viewBox="0 0 24 24"><path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.5,8L11,13.5L7.5,10L6,11.5L11,16.5Z"/></svg>';
      } else if (copyEnabled) {
        statusTags = `<span class="status-tag copy">${I18nUtils.t('tag_copy_only')}</span>`;
        statusIcon = '<svg class="status-icon" viewBox="0 0 24 24"><path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/></svg>';
      } else if (pasteEnabled) {
        statusTags = `<span class="status-tag paste">${I18nUtils.t('tag_paste_only')}</span>`;
        statusIcon = '<svg class="status-icon" viewBox="0 0 24 24"><path d="M19,20H5V4H7V7H17V4H19M12,2A1,1 0 0,1 13,3A1,1 0 0,1 12,4A1,1 0 0,1 11,3A1,1 0 0,1 12,2M19,2H14.82C14.4,0.84 13.3,0 12,0C10.7,0 9.6,0.84 9.18,2H5A2,2 0 0,0 3,4V20A2,2 0 0,0 5,22H19A2,2 0 0,0 21,20V4A2,2 0 0,0 19,2Z"/></svg>';
      }

      const featureList = [];
      if (copyEnabled) featureList.push(I18nUtils.t('feature_copy'));
      if (pasteEnabled) featureList.push(I18nUtils.t('feature_paste'));
      const featureText = I18nUtils.t('enabled_features', featureList.join(' + '));

      return `
        <div class="whitelist-item" data-domain="${this.escapeHTML(domain)}">
          <div class="whitelist-info">
            <div class="domain-header">
              ${statusIcon}
              <span class="whitelist-domain">${this.escapeHTML(domain)}</span>
            </div>
            <div class="whitelist-status">
              ${statusTags}
              <span class="feature-summary">${featureText}</span>
            </div>
          </div>
          <div class="whitelist-actions">
            <button class="action-btn-small edit" data-domain="${this.escapeHTML(domain)}" title="${I18nUtils.t('edit_title')}">
              <svg viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/></svg>
              ${I18nUtils.t('edit_btn')}
            </button>
            <button class="action-btn-small delete" data-domain="${this.escapeHTML(domain)}" title="${I18nUtils.t('delete_title')}">
              <svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>
              ${I18nUtils.t('delete_btn')}
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    container.innerHTML = html;
    
    // 添加事件委托处理编辑和删除按钮
    this.setupWhitelistEventListeners(container);
  }
  
  /**
   * 设置白名单事件监听器
   */
  setupWhitelistEventListeners(container) {
    this.boundWhitelistContainers ||= new WeakSet();
    if (this.boundWhitelistContainers.has(container)) return;
    this.boundWhitelistContainers.add(container);
    // 事件委托处理编辑按钮
    container.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.action-btn-small.edit');
      if (editBtn) {
        const domain = editBtn.getAttribute('data-domain');
        if (domain) {
          this.editWhitelistDomain(domain);
        }
        return;
      }
      
      // 事件委托处理删除按钮
      const deleteBtn = e.target.closest('.action-btn-small.delete');
      if (deleteBtn) {
        const domain = deleteBtn.getAttribute('data-domain');
        if (domain) {
          this.removeWhitelistDomain(domain);
        }
        return;
      }
    });
  }
  
  /**
   * 添加排除域名
   */
  async addExcludedDomain(domain) {
    if (!domain) {
      this.showNotification(I18nUtils.t('invalid_domain_empty'), 'warning');
      return;
    }

    if (!this.isValidDomain(domain)) {
      this.showNotification(I18nUtils.t('invalid_domain_format'), 'warning');
      return;
    }

    if (this.excludedList.includes(domain)) {
      this.showNotification(I18nUtils.t('domain_exists'), 'warning');
      return;
    }

    try {
      await StorageUtils.addToExcludedList(domain);
      this.excludedList = await StorageUtils.getExcludedList();

      const input = document.getElementById('excludedInput');
      if (input) input.value = '';

      this.renderExcludedList();
      this.showNotification(I18nUtils.t('domain_added'), 'success');
    } catch (error) {
      console.error('Failed to add excluded domain:', error);
      this.showNotification(I18nUtils.t('add_failed'), 'error');
    }
  }

  /**
   * 删除排除域名
   */
  async removeExcludedDomain(domain) {
    try {
      await StorageUtils.removeFromExcludedList(domain);
      this.excludedList = await StorageUtils.getExcludedList();

      this.renderExcludedList();
      this.showNotification(I18nUtils.t('domain_deleted'), 'success');
    } catch (error) {
      console.error('Failed to remove excluded domain:', error);
      this.showNotification(I18nUtils.t('delete_failed'), 'error');
    }
  }

  /**
   * 渲染站点排除列表
   */
  renderExcludedList() {
    const container = document.getElementById('excludedContainer');
    if (!container) return;

    if (this.excludedList.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24">
            <path d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z"/>
          </svg>
          <p class="empty-text">${I18nUtils.t('empty_excluded')}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.excludedList.map(domain => `
      <div class="whitelist-item" data-domain="${this.escapeHTML(domain)}">
        <div class="whitelist-info">
          <div class="domain-header">
            <span class="whitelist-domain">${this.escapeHTML(domain)}</span>
          </div>
        </div>
        <div class="whitelist-actions">
          <button class="action-btn-small delete" data-domain="${this.escapeHTML(domain)}" title="${I18nUtils.t('delete_title')}">
            <svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>
            ${I18nUtils.t('delete_btn')}
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * 验证域名格式
   */
  isValidDomain(domain) {
    try { StorageUtils.normalizeDomain(domain); return true; } catch { return false; }
  }

  escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  
  /**
   * 导出设置
   */
  async exportSettings() {
    try {
      const data = await StorageUtils.exportSettings();

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `easycv-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);

      this.showNotification(I18nUtils.t('settings_exported'), 'success');
    } catch (error) {
      console.error('Failed to export settings:', error);
      this.showNotification(I18nUtils.t('export_failed'), 'error');
    }
  }
  
  /**
   * 导入设置
   */
  importSettings() {
    const fileInput = document.getElementById('importFileInput');
    if (fileInput) {
      fileInput.click();
    }
  }
  
  /**
   * 处理文件导入
   */
  async handleFileImport(file) {
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error('File too large');
      const text = await file.text();
      if (text.length > 1000000) throw new Error('File too large');
      await StorageUtils.importConfiguration(JSON.parse(text));
      await this.loadAllData();
      this.cancelRuleEdit();
      this.updateFormValues();
      this.renderWhitelist();
      this.renderExcludedList();
      this.showNotification(I18nUtils.t('settings_imported'), 'success');
    } catch (error) {
      this.showNotification(I18nUtils.t('import_failed'), 'error');
    } finally {
      const input = document.getElementById('importFileInput');
      if (input) input.value = '';
    }
  }
  
  /**
   * 重置设置
   */
  async resetSettings() {
    if (!confirm(I18nUtils.t('confirm_reset'))) {
      return;
    }

    try {
      // 重置为默认设置
      const defaults = {
        enabled: true,
        copyEnabled: true,
        pasteEnabled: true,
        autoDetect: true,
        forceMode: false,
        showNotifications: true,
        autoAddToWhitelist: false,
        detectionDelay: 1000,
        maxRetries: 3,
        debugMode: false,
        performanceMonitoring: false
      };

      await StorageUtils.setPluginSettings(defaults);
      this.settings = await StorageUtils.getPluginSettings();

      // 更新UI
      this.updateFormValues();

      this.showNotification(I18nUtils.t('settings_reset'), 'success');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      this.showNotification(I18nUtils.t('reset_failed'), 'error');
    }
  }
  
  /**
   * 清除所有数据
   */
  async clearAllData() {
    if (!confirm(I18nUtils.t('confirm_clear'))) {
      return;
    }

    try {
      await StorageUtils.clear();
      this.cancelRuleEdit();

      // 重新加载数据
      await this.loadAllData();
      this.initializeUI();

      this.showNotification(I18nUtils.t('data_cleared'), 'success');
    } catch (error) {
      console.error('Failed to clear data:', error);
      this.showNotification(I18nUtils.t('clear_failed'), 'error');
    }
  }
  
  /**
   * 加载统计数据
   */
  async loadStatistics() {
    try {
      this.statistics = await StorageUtils.getStatistics();

      // 更新统计卡片（statistics 中真实存在的字段：sitesUnlocked / totalActivations）
      const totalSitesElement = document.getElementById('totalSitesCount');
      if (totalSitesElement) {
        totalSitesElement.textContent = this.statistics.todayUsage || 0;
      }

      const successfulElement = document.getElementById('successfulCount');
      if (successfulElement) {
        successfulElement.textContent = this.statistics.totalActivations || 0;
      }

      // 成功率暂无数据来源（未追踪尝试次数），显示占位符而非误导性的 0%
      const successRateElement = document.getElementById('successRate');
      if (successRateElement) {
        successRateElement.textContent = '—';
      }
      
      // 更新详细统计表格
      this.renderStatisticsTable();
      
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }
  
  /**
   * 渲染统计表格
   */
  renderStatisticsTable() {
    const tbody = document.getElementById('statsTableBody');
    if (tbody) tbody.textContent = I18nUtils.t('local_stats_notice');
  }

  async refreshRecoveryNotice() {
    const data = await StorageUtils.getRecoveryData();
    const panel = document.getElementById('localRecovery');
    if (panel) panel.hidden = Object.keys(data).length === 0;
    const pending = document.getElementById('privacyMigrationPending');
    if (pending) pending.hidden = !(await StorageUtils.hasPendingPrivacyMigration());
  }

  async retryPrivacyMigration() {
    try { await StorageUtils.migratePrivateData(); await this.refreshRecoveryNotice(); }
    catch { this.showNotification(I18nUtils.t('privacy_migration_pending'), 'error'); }
  }

  async exportRecovery() {
    try {
      const data = await StorageUtils.getRecoveryData();
      const url = URL.createObjectURL(new Blob([JSON.stringify({ schemaVersion: 1, kind: 'easycv-local-recovery', configuration: data }, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'easycv-local-recovery.json'; a.click();
      URL.revokeObjectURL(url);
    } catch { this.showNotification(I18nUtils.t('export_failed'), 'error'); }
  }

  async restoreRecovery() {
    if (!confirm(I18nUtils.t('confirm_restore_local'))) return;
    try {
      await StorageUtils.restoreLocalSettings();
      await this.loadAllData();
      this.initializeUI();
      this.showNotification(I18nUtils.t('settings_saved'), 'success');
    } catch { this.showNotification(I18nUtils.t('save_failed'), 'error'); }
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
      
      // 5秒后自动隐藏
      setTimeout(() => {
        notification.classList.remove('show');
      }, 5000);
    }
  }
}

// 全局实例
let optionsManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  optionsManager = new OptionsManager();
  
  // 导出到全局作用域供HTML调用
  window.optionsManager = optionsManager;
});

// 导出供其他模块使用
window.OptionsManager = OptionsManager;
