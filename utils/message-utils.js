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
    PAGE_ANALYZED: 'page_analyzed',
    COPY_STATUS_CHANGED: 'copy_status_changed',
    PASTE_STATUS_CHANGED: 'paste_status_changed',
    STATE_UPDATED: 'state_updated',
    GET_COMPLETE_STATE: 'get_complete_state',
    UPDATE_PLUGIN_STATE_WITH_CONFIRMATION: 'UPDATE_PLUGIN_STATE_WITH_CONFIRMATION',
    PING: 'ping'
  };

  /**
   * 发送消息到后台脚本
   * @param {string} type - 消息类型
   * @param {Object} data - 消息数据
   * @param {Object} options - 选项配置
   * @returns {Promise} 响应Promise
   */
  static async sendToBackground(type, data = {}, options = {}) {
    const { retries = 2, timeout = 5000 } = options;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const message = {
          type,
          data,
          timestamp: Date.now()
        };

        // 检查runtime是否可用
        if (!chrome.runtime || !chrome.runtime.sendMessage) {
          throw new Error('Chrome runtime not available');
        }

        // 添加超时控制
        const response = await Promise.race([
          chrome.runtime.sendMessage(message),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Background script timeout')), timeout)
          )
        ]);

        return response;
      } catch (error) {
        const isLastAttempt = attempt === retries;
        
        // 检查是否是扩展上下文失效
        if (error.message.includes('Extension context invalidated')) {
          console.warn('Extension context invalidated, cannot send message');
          throw error;
        }
        
        if (isLastAttempt) {
          console.error(`Failed to send message to background after ${retries + 1} attempts:`, error);
          throw error;
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  /**
   * 发送消息到内容脚本
   * @param {number} tabId - 标签页ID
   * @param {string} type - 消息类型
   * @param {Object} data - 消息数据
   * @param {Object} options - 选项配置
   * @param {number} options.retries - 重试次数，默认2次
   * @param {number} options.timeout - 超时时间，默认1000ms
   * @param {boolean} options.silent - 静默模式，默认false
   * @returns {Promise} 响应Promise
   */
  static async sendToContent(tabId, type, data = {}, options = {}) {
    const { retries = 2, timeout = 1000, silent = false } = options;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // 首先检查标签页是否存在且活跃
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (!tab || tab.discarded) {
          throw new Error('Tab not available or discarded');
        }

        const message = {
          type,
          data,
          timestamp: Date.now()
        };

        return await chrome.tabs.sendMessage(tabId, message);
      } catch (error) {
        const isLastAttempt = attempt === retries;
        
        if (isLastAttempt) {
          if (!silent) {
            console.warn(`Failed to send message to content script after ${retries + 1} attempts:`, error.message);
          }
          // 优雅降级：返回默认响应而不是抛出错误
          return { success: false, error: 'Content script unavailable', degraded: true };
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, timeout * (attempt + 1)));
      }
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
            // 处理器返回值自带 success 字段时按原样透传：
            // 统一包装会把业务失败（如带确认的状态更新协议返回 success:false）
            // 再包一层为 success:true，导致调用方把失败误判为成功
            .then(response => sendResponse(
              response && typeof response === 'object' && 'success' in response
                ? response
                : { success: true, data: response }
            ))
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
   * 检测Content Script是否可用
   * @param {number} tabId - 标签页ID
   * @returns {Promise<boolean>} 是否可用
   */
  static async isContentScriptAvailable(tabId) {
    try {
      const response = await this.sendToContent(
        tabId, 
        this.MESSAGE_TYPES.PING, 
        {}, 
        { retries: 0, timeout: 500, silent: true }
      );
      return !response?.degraded;
    } catch {
      return false;
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

  /**
   * 发送消息到内容脚本（sendToContent的别名）
   * @param {number} tabId - 标签页ID
   * @param {Object} message - 消息对象
   * @param {Object} options - 选项配置
   * @returns {Promise} 响应Promise
   */
  static async sendToContentScript(tabId, message, options = {}) {
    return await this.sendToContent(tabId, message.type, message.data || {}, options);
  }
}