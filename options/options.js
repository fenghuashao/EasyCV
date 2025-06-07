/**
 * EasyCV Options 脚本
 * 处理选项页面的交互逻辑和设置管理
 */

// 导入工具类
import { StorageUtils } from '../utils/storage-utils.js';
import { MessageUtils } from '../utils/message-utils.js';

class OptionsManager {
  constructor() {
    this.storageUtils = new StorageUtils();
    this.messageUtils = new MessageUtils();
    this.currentTab = 'general';
    this.settings = {};
    this.whitelist = [];
    this.statistics = {};
    
    this.init();
  }
  
  /**
   * 初始化选项页面
   */
  async init() {
    try {
      // 绑定事件监听器
      this.bindEventListeners();
      
      // 加载数据
      await this.loadAllData();
      
      // 初始化UI
      this.initializeUI();
      
      console.log('Options page initialized successfully');
    } catch (error) {
      console.error('Failed to initialize options page:', error);
      this.showNotification('初始化失败', 'error');
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
    
    // 高级设置
    this.bindAdvancedSettingsEvents();
    
    // 关于页面
    this.bindAboutEvents();
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
    // 启用插件
    const enablePlugin = document.getElementById('enablePlugin');
    if (enablePlugin) {
      enablePlugin.addEventListener('change', (e) => {
        this.updateSetting('enabled', e.target.checked);
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
        chrome.tabs.create({ url: 'https://github.com/your-username/easycv' });
      });
    }
    
    if (issuesLink) {
      issuesLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://github.com/your-username/easycv/issues' });
      });
    }
    
    if (wikiLink) {
      wikiLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://github.com/your-username/easycv/wiki' });
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
      this.settings = await this.storageUtils.getPluginSettings();
      
      // 加载白名单
      this.whitelist = await this.storageUtils.getAutoEnableList();
      
      // 加载统计数据
      this.statistics = await this.storageUtils.getStatistics();
      
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
    
    // 加载统计数据
    this.loadStatistics();
  }
  
  /**
   * 更新表单值
   */
  updateFormValues() {
    // 常规设置
    const enablePlugin = document.getElementById('enablePlugin');
    if (enablePlugin) enablePlugin.checked = this.settings.enabled ?? true;
    
    const autoDetect = document.getElementById('autoDetect');
    if (autoDetect) autoDetect.checked = this.settings.autoDetect ?? true;
    
    const forceMode = document.getElementById('forceMode');
    if (forceMode) forceMode.checked = this.settings.forceMode ?? false;
    
    const showNotifications = document.getElementById('showNotifications');
    if (showNotifications) showNotifications.checked = this.settings.showNotifications ?? true;
    
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
      await this.storageUtils.setPluginSettings(this.settings);
      
      // 通知background script设置已更改
      await this.messageUtils.sendToBackground({
        type: 'SETTINGS_UPDATED',
        settings: this.settings
      });
      
      this.showNotification('设置已保存', 'success');
    } catch (error) {
      console.error('Failed to update setting:', error);
      this.showNotification('保存失败', 'error');
    }
  }
  
  /**
   * 添加白名单域名
   */
  async addWhitelistDomain(domain) {
    if (!domain) {
      this.showNotification('请输入有效的域名', 'warning');
      return;
    }
    
    // 验证域名格式
    if (!this.isValidDomain(domain)) {
      this.showNotification('域名格式不正确', 'warning');
      return;
    }
    
    // 检查是否已存在
    if (this.whitelist.includes(domain)) {
      this.showNotification('域名已存在', 'warning');
      return;
    }
    
    try {
      this.whitelist.push(domain);
      await this.storageUtils.setAutoEnableList(this.whitelist);
      
      // 清空输入框
      const input = document.getElementById('whitelistInput');
      if (input) input.value = '';
      
      // 重新渲染列表
      this.renderWhitelist();
      
      this.showNotification('域名已添加', 'success');
    } catch (error) {
      console.error('Failed to add whitelist domain:', error);
      this.showNotification('添加失败', 'error');
    }
  }
  
  /**
   * 删除白名单域名
   */
  async removeWhitelistDomain(domain) {
    try {
      this.whitelist = this.whitelist.filter(d => d !== domain);
      await this.storageUtils.setAutoEnableList(this.whitelist);
      
      // 重新渲染列表
      this.renderWhitelist();
      
      this.showNotification('域名已删除', 'success');
    } catch (error) {
      console.error('Failed to remove whitelist domain:', error);
      this.showNotification('删除失败', 'error');
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
          <p class="empty-text">暂无白名单网站</p>
        </div>
      `;
      return;
    }
    
    const html = this.whitelist.map(domain => `
      <div class="whitelist-item">
        <span class="whitelist-domain">${domain}</span>
        <div class="whitelist-actions">
          <button class="action-btn-small delete" onclick="optionsManager.removeWhitelistDomain('${domain}')">
            删除
          </button>
        </div>
      </div>
    `).join('');
    
    container.innerHTML = html;
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
        exportDate: new Date().toISOString(),
        version: '1.0.0'
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
      
      this.showNotification('设置已导出', 'success');
    } catch (error) {
      console.error('Failed to export settings:', error);
      this.showNotification('导出失败', 'error');
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
      await this.storageUtils.setPluginSettings(this.settings);
      
      // 导入白名单
      this.whitelist = data.whitelist;
      await this.storageUtils.setAutoEnableList(this.whitelist);
      
      // 更新UI
      this.updateFormValues();
      this.renderWhitelist();
      
      this.showNotification('设置已导入', 'success');
    } catch (error) {
      console.error('Failed to import settings:', error);
      this.showNotification('导入失败，请检查文件格式', 'error');
    }
  }
  
  /**
   * 重置设置
   */
  async resetSettings() {
    if (!confirm('确定要重置所有设置吗？此操作不可撤销。')) {
      return;
    }
    
    try {
      // 重置为默认设置
      this.settings = {
        enabled: true,
        autoDetect: true,
        forceMode: false,
        showNotifications: true,
        detectionDelay: 1000,
        maxRetries: 3,
        debugMode: false,
        performanceMonitoring: false
      };
      
      await this.storageUtils.setPluginSettings(this.settings);
      
      // 更新UI
      this.updateFormValues();
      
      this.showNotification('设置已重置', 'success');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      this.showNotification('重置失败', 'error');
    }
  }
  
  /**
   * 清除所有数据
   */
  async clearAllData() {
    if (!confirm('确定要清除所有数据吗？包括设置、白名单和统计数据。此操作不可撤销。')) {
      return;
    }
    
    try {
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
      
      // 重新加载数据
      await this.loadAllData();
      this.initializeUI();
      
      this.showNotification('所有数据已清除', 'success');
    } catch (error) {
      console.error('Failed to clear data:', error);
      this.showNotification('清除失败', 'error');
    }
  }
  
  /**
   * 加载统计数据
   */
  async loadStatistics() {
    try {
      this.statistics = await this.storageUtils.getStatistics();
      
      // 更新统计卡片
      const totalSitesElement = document.getElementById('totalSitesCount');
      if (totalSitesElement) {
        totalSitesElement.textContent = this.statistics.totalSites || 0;
      }
      
      const successfulElement = document.getElementById('successfulCount');
      if (successfulElement) {
        successfulElement.textContent = this.statistics.successfulAttempts || 0;
      }
      
      const successRateElement = document.getElementById('successRate');
      if (successRateElement) {
        const total = this.statistics.totalAttempts || 0;
        const success = this.statistics.successfulAttempts || 0;
        const rate = total > 0 ? Math.round((success / total) * 100) : 0;
        successRateElement.textContent = `${rate}%`;
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
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">暂无统计数据</td></tr>';
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