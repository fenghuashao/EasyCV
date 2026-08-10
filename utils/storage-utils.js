/**
 * 存储工具类
 * 处理插件的数据存储和同步
 */
class StorageUtils {
  /**
   * 存储键名常量
   */
  static STORAGE_KEYS = {
    PLUGIN_ENABLED: 'plugin_enabled',
    FORCE_MODE: 'force_mode',
    AUTO_ENABLE_LIST: 'auto_enable_list',
    EXCLUDED_LIST: 'excluded_list',
    USER_SETTINGS: 'user_settings',
    STATISTICS: 'statistics',
    LAST_UPDATE: 'last_update',
    INTERACTION_HISTORY: 'interaction_history'
  };

  /**
   * 默认设置
   */
  static DEFAULT_SETTINGS = {
    pluginEnabled: true,
    forceMode: false,
    autoEnableList: [],
    // 敏感账号登录页默认排除：injector 的原型重写暴露面不应覆盖高价值账号页
    // （依据 docs/测试报告-真实站点回归-2026-08.md R5）
    excludedList: ['accounts.google.com', 'login.live.com', 'appleid.apple.com'],
    showNotifications: true,
    enableStatistics: true,
    theme: 'auto',
    copyEnabled: true,
    pasteEnabled: true
  };

  /**
   * 获取存储数据
   * @param {string|Array<string>} keys - 存储键名
   * @returns {Promise<Object>} 存储数据
   */
  static async get(keys) {
    try {
      if (typeof keys === 'string') {
        keys = [keys];
      }

      const result = await chrome.storage.sync.get(keys);
      return result;
    } catch (error) {
      console.error('Failed to get storage data:', error);
      // 降级到本地存储
      return await chrome.storage.local.get(keys);
    }
  }

  /**
   * 设置存储数据
   * @param {Object} data - 要存储的数据
   * @returns {Promise<void>}
   */
  static async set(data) {
    try {
      await chrome.storage.sync.set(data);
    } catch (error) {
      console.error('Failed to set sync storage, falling back to local:', error);
      // 降级到本地存储
      await chrome.storage.local.set(data);
    }
  }

  /**
   * 删除存储数据
   * @param {string|Array<string>} keys - 要删除的键名
   * @returns {Promise<void>}
   */
  static async remove(keys) {
    try {
      await chrome.storage.sync.remove(keys);
    } catch (error) {
      console.error('Failed to remove from sync storage:', error);
      await chrome.storage.local.remove(keys);
    }
  }

  /**
   * 清空所有存储数据
   * @returns {Promise<void>}
   */
  static async clear() {
    try {
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }

  /**
   * 获取插件启用状态
   * @returns {Promise<boolean>} 是否启用
   */
  static async getPluginEnabled() {
    const result = await this.get(this.STORAGE_KEYS.PLUGIN_ENABLED);
    return result[this.STORAGE_KEYS.PLUGIN_ENABLED] ?? this.DEFAULT_SETTINGS.pluginEnabled;
  }

  /**
   * 设置插件启用状态
   * @param {boolean} enabled - 是否启用
   * @returns {Promise<void>}
   */
  static async setPluginEnabled(enabled) {
    await this.set({ [this.STORAGE_KEYS.PLUGIN_ENABLED]: enabled });
  }

  /**
   * 获取强力模式状态
   * @returns {Promise<boolean>} 是否启用强力模式
   */
  static async getForceMode() {
    const result = await this.get(this.STORAGE_KEYS.FORCE_MODE);
    return result[this.STORAGE_KEYS.FORCE_MODE] ?? this.DEFAULT_SETTINGS.forceMode;
  }

  /**
   * 设置强力模式状态
   * @param {boolean} enabled - 是否启用强力模式
   * @returns {Promise<void>}
   */
  static async setForceMode(enabled) {
    await this.set({ [this.STORAGE_KEYS.FORCE_MODE]: enabled });
  }

  /**
   * 获取自动启用列表
   * @returns {Promise<Array<Object>>} 域名配置列表
   */
  static async getAutoEnableList() {
    const result = await this.get(this.STORAGE_KEYS.AUTO_ENABLE_LIST);
    const list = result[this.STORAGE_KEYS.AUTO_ENABLE_LIST] ?? this.DEFAULT_SETTINGS.autoEnableList;

    // 兼容旧版本的字符串数组格式
    if (list.length > 0 && typeof list[0] === 'string') {
      return list.map(domain => ({
        domain,
        copyEnabled: true,
        pasteEnabled: true
      }));
    }

    return list;
  }

  /**
   * 添加域名到自动启用列表
   * @param {string|Object} domainOrConfig - 域名字符串或配置对象
   * @param {boolean} copyEnabled - 是否启用复制（当第一个参数为字符串时使用）
   * @param {boolean} pasteEnabled - 是否启用粘贴（当第一个参数为字符串时使用）
   * @returns {Promise<void>}
   */
  static async addToAutoEnableList(domainOrConfig, copyEnabled = true, pasteEnabled = true) {
    const list = await this.getAutoEnableList();

    let config;
    if (typeof domainOrConfig === 'string') {
      config = {
        domain: domainOrConfig,
        copyEnabled,
        pasteEnabled
      };
    } else {
      config = domainOrConfig;
    }

    // 检查是否已存在该域名
    const existingIndex = list.findIndex(item => item.domain === config.domain);
    if (existingIndex === -1) {
      list.push(config);
      await this.set({ [this.STORAGE_KEYS.AUTO_ENABLE_LIST]: list });
    }
  }

  /**
   * 从自动启用列表移除域名
   * @param {string} domain - 域名
   * @returns {Promise<void>}
   */
  static async removeFromAutoEnableList(domain) {
    const list = await this.getAutoEnableList();
    const index = list.findIndex(item => item.domain === domain);
    if (index > -1) {
      list.splice(index, 1);
      await this.set({ [this.STORAGE_KEYS.AUTO_ENABLE_LIST]: list });
    }
  }

  /**
   * 更新自动启用列表中域名的配置
   * @param {string} domain - 域名
   * @param {boolean} copyEnabled - 是否启用复制
   * @param {boolean} pasteEnabled - 是否启用粘贴
   * @returns {Promise<void>}
   */
  static async updateAutoEnableConfig(domain, copyEnabled, pasteEnabled) {
    const list = await this.getAutoEnableList();
    const index = list.findIndex(item => item.domain === domain);
    if (index > -1) {
      list[index].copyEnabled = copyEnabled;
      list[index].pasteEnabled = pasteEnabled;
      await this.set({ [this.STORAGE_KEYS.AUTO_ENABLE_LIST]: list });
    }
  }

  /**
   * 获取特定域名的自动启用配置
   * @param {string} domain - 域名
   * @returns {Promise<Object|null>} 配置对象或null
   */
  static async getAutoEnableConfig(domain) {
    const list = await this.getAutoEnableList();
    return list.find(item => item.domain === domain) || null;
  }

  /**
   * 设置自动启用列表（静态方法）
   * @param {Array<Object>} list - 域名配置列表
   * @returns {Promise<void>}
   */
  static async setAutoEnableList(list) {
    await StorageUtils.set({ [StorageUtils.STORAGE_KEYS.AUTO_ENABLE_LIST]: list });
  }

  /**
   * 获取站点排除列表
   * 键缺席时回落到默认敏感域名；用户清空（存入空数组）则尊重用户选择
   * @returns {Promise<Array<string>>} 域名列表
   */
  static async getExcludedList() {
    const result = await this.get(this.STORAGE_KEYS.EXCLUDED_LIST);
    const list = result[this.STORAGE_KEYS.EXCLUDED_LIST] ?? this.DEFAULT_SETTINGS.excludedList;
    return Array.isArray(list) ? list : [];
  }

  /**
   * 添加域名到站点排除列表
   * @param {string} domain - 域名
   * @returns {Promise<void>}
   */
  static async addToExcludedList(domain) {
    const list = await this.getExcludedList();
    if (!list.includes(domain)) {
      list.push(domain);
      await this.set({ [this.STORAGE_KEYS.EXCLUDED_LIST]: list });
    }
  }

  /**
   * 从站点排除列表移除域名
   * @param {string} domain - 域名
   * @returns {Promise<void>}
   */
  static async removeFromExcludedList(domain) {
    const list = await this.getExcludedList();
    const index = list.indexOf(domain);
    if (index > -1) {
      list.splice(index, 1);
      await this.set({ [this.STORAGE_KEYS.EXCLUDED_LIST]: list });
    }
  }

  /**
   * 设置站点排除列表
   * @param {Array<string>} list - 域名列表
   * @returns {Promise<void>}
   */
  static async setExcludedList(list) {
    await this.set({ [this.STORAGE_KEYS.EXCLUDED_LIST]: list });
  }

  /**
   * 判断主机名是否被排除列表命中（纯函数，供 background/content 共用判定语义）
   * 精确匹配或子域后缀匹配：排除 bilibili.com 即覆盖 www.bilibili.com；
   * 按点分段拼接避免误伤相似域名（排除 google.com 不覆盖 notgoogle.com）
   * @param {string} hostname - 主机名
   * @param {Array<string>} excludedList - 排除域名列表
   * @returns {boolean} 是否被排除
   */
  static isDomainExcluded(hostname, excludedList) {
    if (!hostname || !Array.isArray(excludedList)) return false;
    const host = String(hostname).toLowerCase();
    return excludedList.some(entry => {
      const domain = String(entry).toLowerCase();
      return host === domain || host.endsWith('.' + domain);
    });
  }

  /**
   * 获取用户设置
   * @returns {Promise<Object>} 用户设置对象
   */
  static async getUserSettings() {
    const result = await this.get(this.STORAGE_KEYS.USER_SETTINGS);
    return { ...this.DEFAULT_SETTINGS, ...result[this.STORAGE_KEYS.USER_SETTINGS] };
  }

  /**
   * 更新用户设置
   * @param {Object} settings - 设置对象
   * @returns {Promise<void>}
   */
  static async updateUserSettings(settings) {
    const currentSettings = await this.getUserSettings();
    const newSettings = { ...currentSettings, ...settings };
    await this.set({ [this.STORAGE_KEYS.USER_SETTINGS]: newSettings });
  }

  /**
   * 获取统计数据
   * @returns {Promise<Object>} 统计数据
   */
  static async getStatistics() {
    const result = await this.get(this.STORAGE_KEYS.STATISTICS);
    return result[this.STORAGE_KEYS.STATISTICS] ?? {
      totalActivations: 0,
      sitesUnlocked: [],
      lastUsed: null
    };
  }

  /**
   * 更新统计数据
   * @param {Object} stats - 统计数据
   * @returns {Promise<void>}
   */
  static async updateStatistics(stats) {
    const currentStats = await this.getStatistics();
    const newStats = { ...currentStats, ...stats };
    await this.set({ [this.STORAGE_KEYS.STATISTICS]: newStats });
  }

  /**
   * 监听存储变化
   * @param {Function} callback - 回调函数
   */
  static addStorageListener(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Storage listener must be a function');
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
      callback(changes, areaName);
    });
  }

  /**
   * 导出所有设置
   * @returns {Promise<Object>} 所有设置数据
   */
  static async exportSettings() {
    const allKeys = Object.values(this.STORAGE_KEYS);
    const data = await this.get(allKeys);
    return {
      ...data,
      exportTime: new Date().toISOString(),
      version: '1.1.0'
    };
  }

  /**
   * 导入设置
   * @param {Object} data - 设置数据
   * @returns {Promise<void>}
   */
  static async importSettings(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid import data');
    }

    // 验证数据格式
    const validKeys = Object.values(this.STORAGE_KEYS);
    const importData = {};

    validKeys.forEach(key => {
      if (data.hasOwnProperty(key)) {
        importData[key] = data[key];
      }
    });

    await this.set(importData);
  }

  /**
   * 获取插件设置（静态方法）
   * @returns {Promise<Object>} 插件设置对象
   */
  static async getPluginSettings() {
    const [enabled, forceMode, userSettings] = await Promise.all([
      this.getPluginEnabled(),
      this.getForceMode(),
      this.getUserSettings()
    ]);

    return {
      enabled,
      forceMode,
      ...userSettings
    };
  }

  /**
   * 设置插件配置（静态方法）
   * @param {Object} settings - 插件设置对象
   * @returns {Promise<void>}
   */
  static async setPluginSettings(settings) {
    const updates = [];

    if (settings.hasOwnProperty('enabled')) {
      updates.push(StorageUtils.setPluginEnabled(settings.enabled));
    }

    if (settings.hasOwnProperty('forceMode')) {
      updates.push(StorageUtils.setForceMode(settings.forceMode));
    }

    // 处理其他用户设置，包括复制粘贴控制与检测/调试选项
    const userSettingsKeys = [
      'showNotifications', 'enableStatistics', 'theme', 'copyEnabled', 'pasteEnabled',
      'autoDetect', 'detectionDelay', 'maxRetries', 'debugMode', 'performanceMonitoring',
      'autoAddToWhitelist'
    ];
    const userSettingsUpdate = {};
    let hasUserSettings = false;

    userSettingsKeys.forEach(key => {
      if (settings.hasOwnProperty(key)) {
        userSettingsUpdate[key] = settings[key];
        hasUserSettings = true;
      }
    });

    if (hasUserSettings) {
      updates.push(StorageUtils.updateUserSettings(userSettingsUpdate));
    }

    await Promise.all(updates);
  }

  /**
   * 获取交互历史记录
   * @returns {Promise<Object>} 交互历史记录
   */
  static async getInteractionHistory() {
    try {
      const result = await StorageUtils.get(StorageUtils.STORAGE_KEYS.INTERACTION_HISTORY);
      return result[StorageUtils.STORAGE_KEYS.INTERACTION_HISTORY] || {};
    } catch (error) {
      console.error('Failed to get interaction history:', error);
      return {};
    }
  }

  /**
   * 设置交互历史记录
   * @param {Object} history - 交互历史记录
   * @returns {Promise<void>}
   */
  static async setInteractionHistory(history) {
    try {
      await StorageUtils.set({
        [StorageUtils.STORAGE_KEYS.INTERACTION_HISTORY]: history
      });
    } catch (error) {
      console.error('Failed to set interaction history:', error);
      throw error;
    }
  }
}