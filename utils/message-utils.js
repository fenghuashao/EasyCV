/**
 * 消息传递工具类
 * 处理插件各组件间的通信
 */
class MessageUtils {
  /**
   * 消息类型常量
   */
  static MESSAGE_TYPES = {
    TOGGLE_PLUGIN: 'toggle_plugin',
    GET_STATUS: 'get_status',
    UPDATE_STATUS: 'update_status',
    ENABLE_FORCE_MODE: 'enable_force_mode',
    DISABLE_FORCE_MODE: 'disable_force_mode',
    GET_SETTINGS: 'get_settings',
    UPDATE_SETTINGS: 'update_settings',
    REPORT_ERROR: 'report_error',
    PAGE_ANALYZED: 'page_analyzed'
  };

  /**
   * 发送消息到后台脚本
   * @param {string} type - 消息类型
   * @param {Object} data - 消息数据
   * @returns {Promise} 响应Promise
   */
  static async sendToBackground(type, data = {}) {
    try {
      const message = {
        type,
        data,
        timestamp: Date.now()
      };

      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      console.error('Failed to send message to background:', error);
      throw error;
    }
  }

  /**
   * 发送消息到内容脚本
   * @param {number} tabId - 标签页ID
   * @param {string} type - 消息类型
   * @param {Object} data - 消息数据
   * @returns {Promise} 响应Promise
   */
  static async sendToContent(tabId, type, data = {}) {
    try {
      const message = {
        type,
        data,
        timestamp: Date.now()
      };

      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      console.error('Failed to send message to content script:', error);
      throw error;
    }
  }

  /**
   * 监听消息
   * @param {Function} handler - 消息处理函数
   */
  static addMessageListener(handler) {
    if (typeof handler !== 'function') {
      throw new Error('Message handler must be a function');
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        // 验证消息格式
        if (!this.isValidMessage(message)) {
          console.warn('Invalid message format:', message);
          return false;
        }

        // 调用处理函数
        const result = handler(message, sender, sendResponse);

        // 如果返回Promise，保持连接开放
        if (result instanceof Promise) {
          result
            .then(response => sendResponse({ success: true, data: response }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true; // 保持消息通道开放
        }

        return false;
      } catch (error) {
        console.error('Message handler error:', error);
        sendResponse({ success: false, error: error.message });
        return false;
      }
    });
  }

  /**
   * 验证消息格式
   * @param {Object} message - 消息对象
   * @returns {boolean} 是否有效
   */
  static isValidMessage(message) {
    return message &&
      typeof message === 'object' &&
      typeof message.type === 'string' &&
      Object.values(this.MESSAGE_TYPES).includes(message.type);
  }

  /**
   * 获取当前标签页ID
   * @returns {Promise<number>} 标签页ID
   */
  static async getCurrentTabId() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab?.id;
    } catch (error) {
      console.error('Failed to get current tab ID:', error);
      return null;
    }
  }

  /**
   * 广播消息到所有标签页
   * @param {string} type - 消息类型
   * @param {Object} data - 消息数据
   */
  static async broadcastToAllTabs(type, data = {}) {
    try {
      const tabs = await chrome.tabs.query({});
      const promises = tabs.map(tab =>
        this.sendToContent(tab.id, type, data).catch(error => {
          // 忽略无法发送的标签页（如chrome://页面）
          console.debug(`Failed to send to tab ${tab.id}:`, error);
        })
      );

      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Failed to broadcast message:', error);
    }
  }

  /**
   * 创建响应对象
   * @param {boolean} success - 是否成功
   * @param {*} data - 响应数据
   * @param {string} error - 错误信息
   * @returns {Object} 响应对象
   */
  static createResponse(success, data = null, error = null) {
    return {
      success,
      data,
      error,
      timestamp: Date.now()
    };
  }

  /**
   * 处理异步消息响应
   * @param {Promise} promise - 异步操作Promise
   * @param {Function} sendResponse - 响应函数
   */
  static handleAsyncResponse(promise, sendResponse) {
    promise
      .then(data => sendResponse(this.createResponse(true, data)))
      .catch(error => sendResponse(this.createResponse(false, null, error.message)));
  }
}

// 导出工具类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MessageUtils;
}