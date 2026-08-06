/**
 * 图标管理器
 * 提供智能图标状态管理，支持多种状态反馈和徽章显示
 */
class IconManager {
  constructor() {
    this.lastIconState = null;
    this.updateQueue = [];
    this.isUpdating = false;
    this.debounceTimer = null;
    
    // 图标状态定义
    this.ICON_STATES = {
      ACTIVE: 'active',        // 插件启用且功能正常
      PARTIAL: 'partial',      // 插件启用但部分功能受限
      INACTIVE: 'inactive',    // 插件禁用
      DEFAULT: 'default'       // 默认状态
    };
    
    // 图标文件映射
    this.ICON_FILES = {
      [this.ICON_STATES.ACTIVE]: 'icon-active',
      [this.ICON_STATES.PARTIAL]: 'icon-partial', 
      [this.ICON_STATES.INACTIVE]: 'icon-inactive',
      [this.ICON_STATES.DEFAULT]: 'icon-default'
    };
    
    // 徽章配置
    this.BADGE_CONFIG = {
      [this.ICON_STATES.ACTIVE]: { text: '', color: '#4CAF50' },
      [this.ICON_STATES.PARTIAL]: { text: '!', color: '#FF9800' },
      [this.ICON_STATES.INACTIVE]: { text: '', color: '#9E9E9E' },
      [this.ICON_STATES.DEFAULT]: { text: '', color: '#2196F3' }
    };
  }

  /**
   * 计算图标状态
   * @param {Object} pluginState - 插件状态对象
   * @returns {string} 图标状态
   */
  calculateIconState(pluginState) {
    const { pluginEnabled, forceMode, userSettings, domainConfig } = pluginState;
    
    // 插件未启用
    if (!pluginEnabled) {
      return this.ICON_STATES.INACTIVE;
    }
    
    // 强力模式下，显示为活跃状态
    if (forceMode) {
      return this.ICON_STATES.ACTIVE;
    }
    
    // 检查功能状态
    const copyEnabled = domainConfig?.copyEnabled ?? userSettings?.copyEnabled ?? true;
    const pasteEnabled = domainConfig?.pasteEnabled ?? userSettings?.pasteEnabled ?? true;
    
    // 完全启用
    if (copyEnabled && pasteEnabled) {
      return this.ICON_STATES.ACTIVE;
    }
    
    // 部分启用
    if (copyEnabled || pasteEnabled) {
      return this.ICON_STATES.PARTIAL;
    }
    
    // 功能被禁用但插件启用
    return this.ICON_STATES.DEFAULT;
  }

  /**
   * 获取图标路径
   * @param {string} iconState - 图标状态
   * @returns {Object} 图标路径对象
   */
  getIconPaths(iconState) {
    const iconPrefix = this.ICON_FILES[iconState] || this.ICON_FILES[this.ICON_STATES.DEFAULT];
    
    return {
      16: chrome.runtime.getURL(`icons/${iconPrefix}-16.png`),
      32: chrome.runtime.getURL(`icons/${iconPrefix}-32.png`),
      48: chrome.runtime.getURL(`icons/${iconPrefix}-48.png`),
      128: chrome.runtime.getURL(`icons/${iconPrefix}-128.png`)
    };
  }

  /**
   * 获取图标标题
   * 使用完整消息模板而非字符串拼接：拼接文案的语序在其他语言中可能不成立
   * @param {string} iconState - 图标状态
   * @param {Object} pluginState - 插件状态
   * @returns {string} 图标标题
   */
  getIconTitle(iconState, pluginState) {
    const { forceMode, userSettings, domainConfig } = pluginState;

    switch (iconState) {
      case this.ICON_STATES.ACTIVE:
        return forceMode
          ? I18nUtils.t('icon_title_active_force', undefined, 'EasyCV - 已启用（强力模式）')
          : I18nUtils.t('icon_title_active', undefined, 'EasyCV - 已启用');
      case this.ICON_STATES.PARTIAL: {
        const copyEnabled = domainConfig?.copyEnabled ?? userSettings?.copyEnabled ?? true;
        const pasteEnabled = domainConfig?.pasteEnabled ?? userSettings?.pasteEnabled ?? true;
        if (copyEnabled && !pasteEnabled) {
          return I18nUtils.t('icon_title_partial_copy', undefined, 'EasyCV - 部分启用（仅复制）');
        }
        if (!copyEnabled && pasteEnabled) {
          return I18nUtils.t('icon_title_partial_paste', undefined, 'EasyCV - 部分启用（仅粘贴）');
        }
        return I18nUtils.t('icon_title_partial', undefined, 'EasyCV - 部分启用');
      }
      case this.ICON_STATES.INACTIVE:
        return I18nUtils.t('icon_title_inactive', undefined, 'EasyCV - 已禁用');
      case this.ICON_STATES.DEFAULT:
      default:
        return I18nUtils.t('icon_title_default', undefined, 'EasyCV - 待激活');
    }
  }

  /**
   * 获取徽章配置
   * @param {string} iconState - 图标状态
   * @returns {Object} 徽章配置
   */
  getBadgeConfig(iconState) {
    return this.BADGE_CONFIG[iconState] || this.BADGE_CONFIG[this.ICON_STATES.DEFAULT];
  }

  /**
   * 更新图标（带防抖）
   * @param {Object} pluginState - 插件状态
   * @param {boolean} immediate - 是否立即更新
   */
  updateIcon(pluginState, immediate = false) {
    if (immediate) {
      this.performIconUpdate(pluginState);
      return;
    }
    
    // 防抖处理
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.performIconUpdate(pluginState);
    }, 200); // 200ms 防抖延迟
  }

  /**
   * 执行图标更新
   * @param {Object} pluginState - 插件状态
   */
  async performIconUpdate(pluginState) {
    try {
      // 防止重复更新
      if (this.isUpdating) {
        this.updateQueue.push(pluginState);
        return;
      }
      
      this.isUpdating = true;
      
      const iconState = this.calculateIconState(pluginState);
      
      // 检查是否需要更新
      if (this.lastIconState === iconState) {
        this.isUpdating = false;
        this.processQueue();
        return;
      }
      
      // 更新图标
      const iconPaths = this.getIconPaths(iconState);
      await chrome.action.setIcon({ path: iconPaths });
      
      // 更新标题
      const title = this.getIconTitle(iconState, pluginState);
      await chrome.action.setTitle({ title });
      
      // 更新徽章
      const badgeConfig = this.getBadgeConfig(iconState);
      await chrome.action.setBadgeText({ text: badgeConfig.text });
      await chrome.action.setBadgeBackgroundColor({ color: badgeConfig.color });
      
      this.lastIconState = iconState;
      
      console.log(`Icon updated to state: ${iconState}`);
      
    } catch (error) {
      console.error('Failed to update icon:', error);
    } finally {
      this.isUpdating = false;
      this.processQueue();
    }
  }

  /**
   * 处理更新队列
   */
  async processQueue() {
    if (this.updateQueue.length > 0) {
      const latestState = this.updateQueue.pop();
      this.updateQueue = []; // 清空队列，只处理最新状态
      await this.performIconUpdate(latestState);
    }
  }

  /**
   * 立即更新图标状态
   * @param {Object} pluginState - 插件状态
   */
  async updateIconImmediate(pluginState) {
    await this.performIconUpdate(pluginState);
  }

  /**
   * 重置图标状态
   */
  reset() {
    this.lastIconState = null;
    this.updateQueue = [];
    this.isUpdating = false;
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * 获取当前图标状态
   * @returns {string|null} 当前图标状态
   */
  getCurrentIconState() {
    return this.lastIconState;
  }

  /**
   * 检查图标状态是否需要更新
   * @param {Object} pluginState - 插件状态
   * @returns {boolean} 是否需要更新
   */
  needsUpdate(pluginState) {
    const newIconState = this.calculateIconState(pluginState);
    return this.lastIconState !== newIconState;
  }
}

// 导出IconManager类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IconManager;
}
