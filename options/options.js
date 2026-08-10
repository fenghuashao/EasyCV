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
      console.error('Failed to load data:', error);
    }
  }
  
  /**
   * 初始化UI
   */
  initializeUI() {
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
      this.settings[key] = value;
      await StorageUtils.setPluginSettings(this.settings);

      // 无需显式通知 background：StateManager 的 storage 监听器会自动同步缓存

      this.showNotification(I18nUtils.t('settings_saved'), 'success');
    } catch (error) {
      console.error('Failed to update setting:', error);
      this.showNotification(I18nUtils.t('save_failed'), 'error');
    }
  }
  
  /**
   * 添加自动解锁域名
   */
  async addWhitelistDomain(domain) {
    if (!domain) {
      this.showNotification(I18nUtils.t('invalid_domain_empty'), 'warning');
      return;
    }

    // 验证域名格式
    if (!this.isValidDomain(domain)) {
      this.showNotification(I18nUtils.t('invalid_domain_format'), 'warning');
      return;
    }

    // 检查是否已存在
    if (this.whitelist.find(item => item.domain === domain)) {
      this.showNotification(I18nUtils.t('domain_exists'), 'warning');
      return;
    }

    // 获取精细化控制选项
    const copyEnabled = document.getElementById('enableCopyOption').checked;
    const pasteEnabled = document.getElementById('enablePasteOption').checked;

    if (!copyEnabled && !pasteEnabled) {
      this.showNotification(I18nUtils.t('select_at_least_one'), 'warning');
      return;
    }
    
    try {
      const config = {
        domain,
        copyEnabled,
        pasteEnabled
      };
      
      // 检查是否为编辑模式
      const input = document.getElementById('whitelistInput');
      const isEditing = input && input.hasAttribute('data-editing');
      const editingDomain = isEditing ? input.getAttribute('data-editing') : null;
      
      this.whitelist.push(config);
      await StorageUtils.set({ [StorageUtils.STORAGE_KEYS.AUTO_ENABLE_LIST]: this.whitelist });
      
      // 清空输入框和重置选项
      if (input) {
        input.value = '';
        input.removeAttribute('data-editing');
      }
      document.getElementById('enableCopyOption').checked = true;
      document.getElementById('enablePasteOption').checked = true;
      
      // 重置按钮状态
      const addBtn = document.getElementById('addWhitelistBtn');
      if (addBtn) {
        addBtn.textContent = I18nUtils.t('add_btn');
        addBtn.classList.remove('updating');
      }

      // 移除编辑高亮
      const editingItems = document.querySelectorAll('.whitelist-item.editing');
      editingItems.forEach(item => item.classList.remove('editing'));

      // 重新渲染列表
      this.renderWhitelist();

      if (isEditing && editingDomain) {
        this.showNotification(I18nUtils.t('config_updated', editingDomain), 'success');
      } else {
        this.showNotification(I18nUtils.t('domain_added'), 'success');
      }
    } catch (error) {
      console.error('Failed to add whitelist domain:', error);
      this.showNotification(I18nUtils.t(isEditing ? 'update_failed' : 'add_failed'), 'error');
    }
  }
  
  /**
   * 删除自动解锁域名
   */
  async removeWhitelistDomain(domain) {
    try {
      this.whitelist = this.whitelist.filter(item => item.domain !== domain);
      await StorageUtils.set({ [StorageUtils.STORAGE_KEYS.AUTO_ENABLE_LIST]: this.whitelist });
      
      // 重新渲染列表
      this.renderWhitelist();

      this.showNotification(I18nUtils.t('domain_deleted'), 'success');
    } catch (error) {
      console.error('Failed to remove whitelist domain:', error);
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
    const editingItem = document.querySelector(`[data-domain="${domain}"]`);
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
    
    // 先删除原配置
    await this.removeWhitelistDomain(domain);
    
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
        <div class="whitelist-item" data-domain="${domain}">
          <div class="whitelist-info">
            <div class="domain-header">
              ${statusIcon}
              <span class="whitelist-domain">${domain}</span>
            </div>
            <div class="whitelist-status">
              ${statusTags}
              <span class="feature-summary">${featureText}</span>
            </div>
          </div>
          <div class="whitelist-actions">
            <button class="action-btn-small edit" data-domain="${domain}" title="${I18nUtils.t('edit_title')}">
              <svg viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/></svg>
              ${I18nUtils.t('edit_btn')}
            </button>
            <button class="action-btn-small delete" data-domain="${domain}" title="${I18nUtils.t('delete_title')}">
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
      this.excludedList.push(domain);
      await StorageUtils.setExcludedList(this.excludedList);

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
      this.excludedList = this.excludedList.filter(item => item !== domain);
      await StorageUtils.setExcludedList(this.excludedList);

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
      <div class="whitelist-item" data-domain="${domain}">
        <div class="whitelist-info">
          <div class="domain-header">
            <span class="whitelist-domain">${domain}</span>
          </div>
        </div>
        <div class="whitelist-actions">
          <button class="action-btn-small delete" data-domain="${domain}" title="${I18nUtils.t('delete_title')}">
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
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  }
  
  /**
   * 导出设置
   */
  async exportSettings() {
    try {
      const data = {
        settings: this.settings,
        whitelist: this.whitelist,
        excludedList: this.excludedList,
        exportDate: new Date().toISOString(),
        version: '1.1.0'
      };
      
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
      const text = await file.text();
      const data = JSON.parse(text);
      
      // 验证数据格式
      if (!data.settings || !data.whitelist) {
        throw new Error('Invalid file format');
      }
      
      // 导入设置
      this.settings = { ...this.settings, ...data.settings };
      await StorageUtils.setPluginSettings(this.settings);
      
      // 导入白名单
      this.whitelist = data.whitelist;
      await StorageUtils.setAutoEnableList(this.whitelist);

      // 导入站点排除列表（旧版导出文件无此字段时跳过，保留现状）
      if (Array.isArray(data.excludedList)) {
        this.excludedList = data.excludedList;
        await StorageUtils.setExcludedList(this.excludedList);
      }

      // 更新UI
      this.updateFormValues();
      this.renderWhitelist();
      this.renderExcludedList();
      
      this.showNotification(I18nUtils.t('settings_imported'), 'success');
    } catch (error) {
      console.error('Failed to import settings:', error);
      this.showNotification(I18nUtils.t('import_failed'), 'error');
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
      this.settings = {
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

      await StorageUtils.setPluginSettings(this.settings);

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
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();

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
        totalSitesElement.textContent = (this.statistics.sitesUnlocked || []).length;
      }

      const successfulElement = document.getElementById('successfulCount');
      if (successfulElement) {
        successfulElement.textContent = this.statistics.totalActivations || 0;
      }

      // 成功率暂无数据来源（未追踪尝试次数），显示占位符而非误导性的 0%
      const successRateElement = document.getElementById('successRate');
      if (successRateElement) {
        const total = this.statistics.totalAttempts || 0;
        successRateElement.textContent = total > 0
          ? `${Math.round((this.statistics.successfulAttempts / total) * 100)}%`
          : '—';
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
    if (!tbody) return;
    
    const siteStats = this.statistics.siteStats || {};
    const sites = Object.keys(siteStats);
    
    if (sites.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${I18nUtils.t('empty_stats')}</td></tr>`;
      return;
    }
    
    const html = sites.map(site => {
      const stats = siteStats[site];
      const successRate = stats.attempts > 0 ? Math.round((stats.successes / stats.attempts) * 100) : 0;
      const lastVisit = new Date(stats.lastVisit).toLocaleDateString();
      
      return `
        <tr>
          <td>${site}</td>
          <td>${stats.visits || 0}</td>
          <td>${stats.attempts || 0}</td>
          <td>${successRate}%</td>
          <td>${lastVisit}</td>
        </tr>
      `;
    }).join('');
    
    tbody.innerHTML = html;
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