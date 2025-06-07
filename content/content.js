/**
 * EasyCV 内容脚本
 * 负责页面DOM操作、复制粘贴限制检测与解除
 */

class CopyPasteManager {
  constructor() {
    this.isEnabled = false;
    this.forceMode = false;
    this.originalStyles = new Map();
    this.originalHandlers = new Map();
    this.observer = null;
    
    this.initializeManager();
  }
  
  /**
   * 初始化管理器
   */
  async initializeManager() {
    try {
      // 获取初始状态
      await this.loadSettings();
      
      // 设置消息监听
      this.setupMessageListeners();
      
      // 检测页面限制
      this.detectRestrictions();
      
      // 如果启用，开始处理
      if (this.isEnabled) {
        this.enableCopyPaste();
      }
      
      // 监听DOM变化
      this.setupDOMObserver();
      
      console.log('EasyCV Content Script initialized');
    } catch (error) {
      console.error('Failed to initialize CopyPasteManager:', error);
      this.reportError(error);
    }
  }
  
  /**
   * 加载设置
   */
  async loadSettings() {
    try {
      const response = await MessageUtils.sendToBackground(
        MessageUtils.MESSAGE_TYPES.GET_STATUS
      );
      
      if (response?.success) {
        this.isEnabled = response.data.enabled;
        this.forceMode = response.data.forceMode;
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }
  
  /**
   * 设置消息监听器
   */
  setupMessageListeners() {
    MessageUtils.addMessageListener(async (message, sender, sendResponse) => {
      const { type, data } = message;
      
      try {
        switch (type) {
          case MessageUtils.MESSAGE_TYPES.TOGGLE_PLUGIN:
            return await this.handleTogglePlugin(data);
            
          case MessageUtils.MESSAGE_TYPES.ENABLE_FORCE_MODE:
            return await this.handleEnableForceMode();
            
          case MessageUtils.MESSAGE_TYPES.DISABLE_FORCE_MODE:
            return await this.handleDisableForceMode();
            
          case MessageUtils.MESSAGE_TYPES.UPDATE_STATUS:
            return await this.handleUpdateStatus(data);
            
          default:
            return { success: false, error: 'Unknown message type' };
        }
      } catch (error) {
        console.error('Message handler error:', error);
        return { success: false, error: error.message };
      }
    });
  }
  
  /**
   * 检测页面限制
   */
  detectRestrictions() {
    const restrictions = DOMUtils.detectSelectionRestrictions();
    
    // 报告检测结果
    MessageUtils.sendToBackground(
      MessageUtils.MESSAGE_TYPES.PAGE_ANALYZED,
      {
        restrictions,
        domain: window.location.hostname,
        url: window.location.href
      }
    ).catch(error => {
      console.debug('Failed to report page analysis:', error);
    });
    
    return restrictions;
  }
  
  /**
   * 启用复制粘贴功能
   */
  enableCopyPaste() {
    try {
      // 移除全局限制
      this.removeGlobalRestrictions();
      
      // 处理所有文本元素
      const textElements = DOMUtils.getTextElements();
      textElements.forEach(element => {
        this.processElement(element);
      });
      
      // 注入自定义脚本（用于处理更深层的限制）
      this.injectCustomScript();
      
      console.log('Copy-paste restrictions removed');
    } catch (error) {
      console.error('Failed to enable copy-paste:', error);
      this.reportError(error);
    }
  }
  
  /**
   * 禁用复制粘贴功能（恢复原始状态）
   */
  disableCopyPaste() {
    try {
      // 恢复原始样式
      this.originalStyles.forEach((styles, element) => {
        Object.entries(styles).forEach(([property, value]) => {
          element.style.setProperty(property, value);
        });
      });
      
      // 恢复原始事件处理器
      this.originalHandlers.forEach((handlers, element) => {
        Object.entries(handlers).forEach(([event, handler]) => {
          if (handler) {
            element.addEventListener(event, handler);
          }
        });
      });
      
      // 清空记录
      this.originalStyles.clear();
      this.originalHandlers.clear();
      
      console.log('Original copy-paste restrictions restored');
    } catch (error) {
      console.error('Failed to disable copy-paste:', error);
    }
  }
  
  /**
   * 移除全局限制
   */
  removeGlobalRestrictions() {
    // 移除body和html的限制
    [document.body, document.documentElement].forEach(element => {
      if (element) {
        this.processElement(element);
      }
    });
    
    // 移除全局事件监听器
    const globalEvents = ['selectstart', 'contextmenu', 'dragstart', 'copy'];
    globalEvents.forEach(eventType => {
      document.removeEventListener(eventType, this.preventDefaultHandler, true);
      document.addEventListener(eventType, this.allowDefaultHandler, true);
    });
  }
  
  /**
   * 处理单个元素
   */
  processElement(element) {
    if (!element || element.dataset?.easycvProcessed) return;
    
    // 标记已处理
    element.dataset.easycvProcessed = 'true';
    
    // 保存原始样式
    this.saveOriginalStyles(element);
    
    // 移除CSS限制
    DOMUtils.modifyStyles(element, {
      'user-select': 'text',
      '-webkit-user-select': 'text',
      '-moz-user-select': 'text',
      '-ms-user-select': 'text',
      'pointer-events': 'auto'
    });
    
    // 移除事件限制
    this.removeEventRestrictions(element);
    
    // 强力模式处理
    if (this.forceMode) {
      this.applyForceMode(element);
    }
  }
  
  /**
   * 保存原始样式
   */
  saveOriginalStyles(element) {
    const computedStyle = window.getComputedStyle(element);
    const originalStyles = {
      'user-select': computedStyle.userSelect,
      '-webkit-user-select': computedStyle.webkitUserSelect,
      '-moz-user-select': computedStyle.MozUserSelect,
      '-ms-user-select': computedStyle.msUserSelect,
      'pointer-events': computedStyle.pointerEvents
    };
    
    this.originalStyles.set(element, originalStyles);
  }
  
  /**
   * 移除事件限制
   */
  removeEventRestrictions(element) {
    const events = ['selectstart', 'contextmenu', 'dragstart', 'copy', 'mousedown'];
    const originalHandlers = {};
    
    events.forEach(eventType => {
      // 保存原始处理器
      const originalHandler = element[`on${eventType}`];
      originalHandlers[eventType] = originalHandler;
      
      // 移除内联事件处理器
      element[`on${eventType}`] = null;
      element.removeAttribute(`on${eventType}`);
      
      // 添加我们的处理器
      element.addEventListener(eventType, this.allowDefaultHandler, true);
    });
    
    this.originalHandlers.set(element, originalHandlers);
  }
  
  /**
   * 应用强力模式
   */
  applyForceMode(element) {
    // 强制移除所有可能的限制
    DOMUtils.modifyStyles(element, {
      '-webkit-touch-callout': 'default',
      '-webkit-user-select': 'text !important',
      '-khtml-user-select': 'text !important',
      '-moz-user-select': 'text !important',
      '-ms-user-select': 'text !important',
      'user-select': 'text !important',
      'pointer-events': 'auto !important'
    });
    
    // 移除所有可能的属性
    const restrictiveAttrs = [
      'onselectstart', 'ondragstart', 'oncontextmenu',
      'oncopy', 'oncut', 'onpaste', 'onmousedown'
    ];
    
    restrictiveAttrs.forEach(attr => {
      element.removeAttribute(attr);
    });
  }
  
  /**
   * 注入自定义脚本
   */
  injectCustomScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/injector.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }
  
  /**
   * 设置DOM观察器
   */
  setupDOMObserver() {
    this.observer = new MutationObserver((mutations) => {
      if (!this.isEnabled) return;
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 处理新添加的元素
            this.processElement(node);
            
            // 处理子元素
            DOMUtils.traverseElements(node, (element) => {
              this.processElement(element);
            });
          }
        });
      });
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  /**
   * 允许默认行为的事件处理器
   */
  allowDefaultHandler = (event) => {
    // 不阻止默认行为
    event.stopPropagation();
    return true;
  };
  
  /**
   * 阻止默认行为的事件处理器
   */
  preventDefaultHandler = (event) => {
    event.preventDefault();
    event.stopPropagation();
    return false;
  };
  
  /**
   * 处理插件开关切换
   */
  async handleTogglePlugin(data) {
    const newState = data?.enabled ?? !this.isEnabled;
    this.isEnabled = newState;
    
    if (this.isEnabled) {
      this.enableCopyPaste();
    } else {
      this.disableCopyPaste();
    }
    
    return { success: true, enabled: this.isEnabled };
  }
  
  /**
   * 处理启用强力模式
   */
  async handleEnableForceMode() {
    this.forceMode = true;
    
    if (this.isEnabled) {
      // 重新处理所有元素
      const allElements = document.querySelectorAll('*');
      allElements.forEach(element => {
        this.applyForceMode(element);
      });
    }
    
    return { success: true, forceMode: true };
  }
  
  /**
   * 处理禁用强力模式
   */
  async handleDisableForceMode() {
    this.forceMode = false;
    return { success: true, forceMode: false };
  }
  
  /**
   * 处理状态更新
   */
  async handleUpdateStatus(data) {
    if (data.changes) {
      // 处理存储变化
      const changes = data.changes;
      
      if (changes[StorageUtils.STORAGE_KEYS.PLUGIN_ENABLED]) {
        this.isEnabled = changes[StorageUtils.STORAGE_KEYS.PLUGIN_ENABLED].newValue;
        
        if (this.isEnabled) {
          this.enableCopyPaste();
        } else {
          this.disableCopyPaste();
        }
      }
      
      if (changes[StorageUtils.STORAGE_KEYS.FORCE_MODE]) {
        this.forceMode = changes[StorageUtils.STORAGE_KEYS.FORCE_MODE].newValue;
      }
    }
    
    return { success: true };
  }
  
  /**
   * 报告错误
   */
  reportError(error) {
    MessageUtils.sendToBackground(
      MessageUtils.MESSAGE_TYPES.REPORT_ERROR,
      {
        message: error.message,
        stack: error.stack,
        url: window.location.href,
        timestamp: new Date().toISOString()
      }
    ).catch(console.error);
  }
  
  /**
   * 清理资源
   */
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    this.disableCopyPaste();
  }
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (window.copyPasteManager) {
    window.copyPasteManager.cleanup();
  }
});

// 初始化管理器
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.copyPasteManager = new CopyPasteManager();
  });
} else {
  window.copyPasteManager = new CopyPasteManager();
}