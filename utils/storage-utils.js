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
    USER_SETTINGS: 'user_settings',
    STATISTICS: 'statistics',
    LAST_UPDATE: 'last_update'
  };
  
  /**
   * 默认设置
   */
  static DEFAULT_SETTINGS = {
    pluginEnabled: true,
    forceMode: false,
    autoEnableList: [],
    showNotifications: true,
    enableStatistics: true,
    theme: 'auto'
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
   * @returns {Promise<Array<string>>} 域名列表
   */
  static async getAutoEnableList() {
    const result = await this.get(this.STORAGE_KEYS.AUTO_ENABLE_LIST);
    return result[this.STORAGE_KEYS.AUTO_ENABLE_LIST] ?? this.DEFAULT_SETTINGS.autoEnableList;
  }
  
  /**
   * 添加域名到自动启用列表
   * @param {string} domain - 域名
   * @returns {Promise<void>}
   */
  static async addToAutoEnableList(domain) {
    const list = await this.getAutoEnableList();
    if (!list.includes(domain)) {
      list.push(domain);
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
    const index = list.indexOf(domain);
    if (index > -1) {
      list.splice(index, 1);
      await this.set({ [this.STORAGE_KEYS.AUTO_ENABLE_LIST]: list });
    }
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
      version: '1.0.0'
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
}

// 导出工具类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageUtils;
}