/**
 * 自动启用管理器
 * 统一处理所有自动启用逻辑，消除重复代码
 */
class AutoEnableManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.domainCache = new Map(); // 域名匹配缓存
    this.processingTabs = new Set(); // 正在处理的标签页
    this.lastProcessTime = new Map(); // 防抖处理
    
    // 缓存过期时间（5分钟）
    this.CACHE_EXPIRE_TIME = 5 * 60 * 1000;
    // 防抖延迟（100ms）
    this.DEBOUNCE_DELAY = 100;

    // Options/右键菜单直接保存名单时也要失效缓存，包括此前未命中的域名。
    this.stateManager.addStateListener(({ changes }) => {
      if (changes?.[StorageUtils.STORAGE_KEYS.AUTO_ENABLE_LIST]) this.clearDomainCache();
    });
  }

  /**
   * 检查并应用自动启用配置
   * @param {number} tabId - 标签页ID
   * @param {string} url - 页面URL
   * @param {Object} options - 选项
   * @param {boolean} options.force - 是否强制处理
   * @param {boolean} options.skipDebounce - 是否跳过防抖
   * @returns {Promise<boolean>} 是否应用了自动启用
   */
  async checkAndApplyAutoEnable(tabId, url, options = {}) {
    const { force = false, skipDebounce = false } = options;
    
    try {
      // 验证输入参数
      if (!tabId || !url) {
        console.debug('AutoEnableManager: Invalid parameters');
        return false;
      }

      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) return false;
      const domain = urlObj.hostname;

      // 排除列表（DEBT-08）优先级高于自动启用名单：命中即跳过，
      // 避免用户刚把误伤站点排除又被自动启用配置拉回启用态
      const state = await this.stateManager.getPluginState(domain);
      if (state.excluded || !state.pluginEnabled) {

        return false;
      }

      // 防抖处理
      if (!skipDebounce && !force) {
        const lastTime = this.lastProcessTime.get(tabId);
        const now = Date.now();
        if (lastTime && (now - lastTime) < this.DEBOUNCE_DELAY) {
          return false;
        }
        this.lastProcessTime.set(tabId, now);
      }

      // 避免重复处理
      if (this.processingTabs.has(tabId) && !force) {
        return false;
      }

      this.processingTabs.add(tabId);

      try {
        // 获取域名配置（使用缓存）
        const config = await this.getDomainConfig(domain);
        if (!config) {
          return false;
        }



        // 应用自动启用配置
        const success = await this.applyAutoEnableConfig(tabId, config);
        
        if (success) {
          // 记录交互历史
          // No automatic domain/timestamp history is recorded.
          
          // 更新图标状态
          if (this.stateManager.backgroundManager) {
            await this.stateManager.backgroundManager.updateIcon();
          }
        }

        return success;
      } finally {
        this.processingTabs.delete(tabId);
      }
    } catch (error) {
      console.error('AutoEnableManager: Failed to process auto-enable:', error);
      this.processingTabs.delete(tabId);
      return false;
    }
  }

  /**
   * 获取域名配置（带缓存）
   * @param {string} domain - 域名
   * @returns {Promise<Object|null>} 域名配置
   */
  async getDomainConfig(domain) {
    // 检查缓存
    const cached = this.domainCache.get(domain);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_EXPIRE_TIME) {
      return cached.config;
    }

    try {
      // 从StateManager获取配置
      const state = await this.stateManager.getPluginState();
      const autoEnableList = state.autoEnableList || [];
      
      // 查找匹配的域名配置
      const config = StorageUtils.matchAutoEnableRule(domain, autoEnableList);

      // 更新缓存
      this.domainCache.set(domain, {
        config: config || null,
        timestamp: Date.now()
      });

      return config || null;
    } catch (error) {
      console.error('AutoEnableManager: Failed to get domain config:', error);
      return null;
    }
  }

  /**
   * 应用自动启用配置
   * @param {number} tabId - 标签页ID
   * @param {Object} config - 域名配置
   * @returns {Promise<boolean>} 是否成功应用
   */
  async applyAutoEnableConfig(tabId, config) {
    try {
      // The rule is resolved by GET_STATUS for this domain. Never write global defaults.
      await MessageUtils.sendToContent(tabId, MessageUtils.MESSAGE_TYPES.STATE_UPDATED, {}, { silent: true });
      return true;
    } catch (error) { return false; }
  }

  /**
   * 记录交互历史
   * @param {string} domain - 域名
   */
  async recordInteraction() {
    // Retained as a no-op for older callers; browsing history is no longer collected.
  }

  /**
   * 清除域名缓存
   * @param {string} domain - 域名（可选，不传则清除所有）
   */
  clearDomainCache(domain = null) {
    if (domain) {
      this.domainCache.delete(domain);
    } else {
      this.domainCache.clear();
    }
  }

  /**
   * 更新自动启用配置
   * @param {string} domain - 域名
   * @param {Object} config - 配置
   */
  async updateAutoEnableConfig(domain, config) {
    try {
      // 清除相关缓存
      this.clearDomainCache(domain);
      
      const list = await StorageUtils.getAutoEnableList();
      if (list.some(item => item.domain === domain)) await StorageUtils.replaceAutoEnableRule(domain, { domain, ...config });
      else await StorageUtils.addToAutoEnableList({ domain, ...config });

      return true;
    } catch (error) {
      console.error('AutoEnableManager: Failed to update config:', error);
      return false;
    }
  }

  /**
   * 移除自动启用配置
   * @param {string} domain - 域名
   */
  async removeAutoEnableConfig(domain) {
    try {
      // 清除相关缓存
      this.clearDomainCache(domain);
      
      await StorageUtils.removeFromAutoEnableList(domain);

      return true;
    } catch (error) {
      console.error('AutoEnableManager: Failed to remove config:', error);
      return false;
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return {
      cacheSize: this.domainCache.size,
      processingTabs: this.processingTabs.size,
      lastProcessTimes: this.lastProcessTime.size
    };
  }

  /**
   * 清理过期数据
   */
  cleanup() {
    const now = Date.now();
    
    // 清理过期缓存
    for (const [domain, data] of this.domainCache.entries()) {
      if ((now - data.timestamp) > this.CACHE_EXPIRE_TIME) {
        this.domainCache.delete(domain);
      }
    }
    
    // 清理过期的防抖记录
    for (const [tabId, timestamp] of this.lastProcessTime.entries()) {
      if ((now - timestamp) > this.DEBOUNCE_DELAY * 10) {
        this.lastProcessTime.delete(tabId);
      }
    }
  }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutoEnableManager;
} else if (typeof window !== 'undefined') {
  window.AutoEnableManager = AutoEnableManager;
}
