/**
 * EasyCV 内容脚本
 * 负责页面DOM操作、复制粘贴限制检测与解除
 */

class CopyPasteManager {
  constructor() {
    this.isEnabled = false;
    this.copyEnabled = true;
    this.pasteEnabled = true;
    this.forceMode = false;
    this.originalStyles = new Map();
    this.originalHandlers = new Map();
    this.observer = null;
    
    // 性能优化相关
    this.processedElements = new WeakSet();
    this.pendingElements = new Set();
    this.processingTimer = null;
    this.batchSize = 50; // 批量处理大小
    this.debounceDelay = 100; // 防抖延迟
    this.lastProcessTime = 0;
    this.performanceMetrics = {
      processedCount: 0,
      totalTime: 0,
      averageTime: 0
    };

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
        this.copyEnabled = response.data.copyEnabled !== false;
        this.pasteEnabled = response.data.pasteEnabled !== false;
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

          case 'COPY_STATUS_CHANGED':
            return await this.handleCopyToggle(data);

          case 'PASTE_STATUS_CHANGED':
            return await this.handlePasteToggle(data);

          case MessageUtils.MESSAGE_TYPES.ENABLE_FORCE_MODE:
            return await this.handleEnableForceMode();

          case MessageUtils.MESSAGE_TYPES.DISABLE_FORCE_MODE:
            return await this.handleDisableForceMode();

          case MessageUtils.MESSAGE_TYPES.UPDATE_STATUS:
            return await this.handleUpdateStatus(data);

          case MessageUtils.MESSAGE_TYPES.PING:
            return { success: true, message: 'Content script is available' };

          case 'FORCE_MODE_CHANGED':
            return await this.handleForceModeChanged(data);

          case 'REFRESH_DETECTION':
            return await this.handleRefreshDetection(data);

          case 'TEST_COPY':
            return await this.handleTestCopy(data);

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
      console.log('启用复制粘贴功能');
      
      // 清理之前的性能数据
      this.clearPerformanceData();
      
      // 移除全局限制
      this.removeGlobalRestrictions();

      // 批量处理页面中的所有元素
      const allElements = document.querySelectorAll('*');
      this.scheduleElementProcessing(Array.from(allElements));

      // 注入自定义脚本（用于处理更深层的限制）
      this.injectCustomScript();

      console.log('Copy-paste restrictions removed');
    } catch (error) {
      console.error('Failed to enable copy-paste:', error);
      this.reportError(error);
    }
  }

  /**
   * 禁用复制粘贴功能
   */
  disableCopyPaste() {
    console.log('禁用复制粘贴功能');
    
    // 停止DOM观察器
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    // 清理性能数据和待处理队列
    this.clearPerformanceData();
    
    // 恢复所有元素的原始状态
    this.originalStyles.forEach((styles, element) => {
      if (element && element.isConnected) {
        Object.keys(styles).forEach(property => {
          element.style.setProperty(property, styles[property], 'important');
        });
      }
    });
    
    // 恢复原始事件处理器
    this.originalHandlers.forEach((handlers, element) => {
      if (element && element.isConnected) {
        Object.keys(handlers).forEach(event => {
          element[event] = handlers[event];
        });
      }
    });
    
    // 清空缓存
    this.originalStyles.clear();
    this.originalHandlers.clear();
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

    // 根据独立设置移除全局事件监听器
    const copyEvents = ['selectstart', 'contextmenu', 'dragstart', 'copy'];
    const pasteEvents = ['paste'];
    
    if (this.copyEnabled) {
      copyEvents.forEach(eventType => {
        document.removeEventListener(eventType, this.preventDefaultHandler, true);
        document.addEventListener(eventType, this.allowDefaultHandler, true);
      });
    }
    
    if (this.pasteEnabled) {
      pasteEvents.forEach(eventType => {
        document.removeEventListener(eventType, this.preventDefaultHandler, true);
        document.addEventListener(eventType, this.allowDefaultHandler, true);
      });
    }
  }

  /**
   * 处理单个元素（优化版本）
   */
  processElement(element) {
    if (!element || this.processedElements.has(element)) return;

    const startTime = performance.now();

    try {
      // 标记已处理
      this.processedElements.add(element);
      element.dataset.easycvProcessed = 'true';

      // 保存原始样式
      this.saveOriginalStyles(element);

      // 根据独立设置来处理CSS限制
      if (this.copyEnabled) {
        DOMUtils.modifyStyles(element, {
          'user-select': 'text',
          '-webkit-user-select': 'text',
          '-moz-user-select': 'text',
          '-ms-user-select': 'text',
          'pointer-events': 'auto'
        });
      }

      // 移除事件限制（根据独立设置）
      this.removeEventRestrictions(element);

      // 强力模式处理
      if (this.forceMode) {
        this.applyForceMode(element);
      }

      // 更新性能指标
      this.updatePerformanceMetrics(performance.now() - startTime);
    } catch (error) {
      console.warn('Failed to process element:', error);
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
      '-moz-user-select': computedStyle.mozUserSelect,
      '-ms-user-select': computedStyle.msUserSelect,
      'pointer-events': computedStyle.pointerEvents
    };

    this.originalStyles.set(element, originalStyles);
  }

  /**
   * 移除事件限制
   */
  removeEventRestrictions(element) {
    const copyEvents = ['selectstart', 'contextmenu', 'dragstart', 'copy', 'mousedown'];
    const pasteEvents = ['paste'];
    const originalHandlers = {};

    // 处理复制相关事件
    if (this.copyEnabled) {
      copyEvents.forEach(eventType => {
        // 保存原始处理器
        const originalHandler = element[`on${eventType}`];
        originalHandlers[eventType] = originalHandler;

        // 移除内联事件处理器
        element[`on${eventType}`] = null;
        element.removeAttribute(`on${eventType}`);

        // 添加我们的处理器
        element.addEventListener(eventType, this.allowDefaultHandler, true);
      });
    }

    // 处理粘贴相关事件
    if (this.pasteEnabled) {
      pasteEvents.forEach(eventType => {
        // 保存原始处理器
        const originalHandler = element[`on${eventType}`];
        originalHandlers[eventType] = originalHandler;

        // 移除内联事件处理器
        element[`on${eventType}`] = null;
        element.removeAttribute(`on${eventType}`);

        // 添加我们的处理器
        element.addEventListener(eventType, this.allowDefaultHandler, true);
      });
    }

    this.originalHandlers.set(element, originalHandlers);
  }

  /**
   * 应用强力模式
   */
  applyForceMode(element) {
    // 根据独立设置应用强力模式
    if (this.copyEnabled) {
      // 强制移除复制相关的限制
      DOMUtils.modifyStyles(element, {
        '-webkit-touch-callout': 'default',
        '-webkit-user-select': 'text !important',
        '-khtml-user-select': 'text !important',
        '-moz-user-select': 'text !important',
        '-ms-user-select': 'text !important',
        'user-select': 'text !important',
        'pointer-events': 'auto !important'
      });

      // 移除复制相关的属性
      const copyAttrs = [
        'onselectstart', 'ondragstart', 'oncontextmenu',
        'oncopy', 'oncut', 'onmousedown'
      ];

      copyAttrs.forEach(attr => {
        element.removeAttribute(attr);
      });
    }

    if (this.pasteEnabled) {
      // 移除粘贴相关的属性
      const pasteAttrs = ['onpaste'];

      pasteAttrs.forEach(attr => {
        element.removeAttribute(attr);
      });
    }
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
   * 设置DOM观察器（优化版本）
   */
  setupDOMObserver() {
    this.observer = new MutationObserver((mutations) => {
      if (!this.isEnabled) return;

      const elementsToProcess = new Set();

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            elementsToProcess.add(node);
            
            // 收集子元素
            const childElements = node.querySelectorAll('*');
            childElements.forEach(child => elementsToProcess.add(child));
          }
        });
      });

      // 批量处理元素
      if (elementsToProcess.size > 0) {
        this.scheduleElementProcessing(Array.from(elementsToProcess));
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      // 优化观察器配置
      attributes: false,
      attributeOldValue: false,
      characterData: false,
      characterDataOldValue: false
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
   * 处理复制功能切换
   */
  async handleCopyToggle(data) {
    const newState = data?.enabled ?? !this.copyEnabled;
    this.copyEnabled = newState;

    // 重新应用设置
    this.updateCopyPasteSettings();

    return { success: true, copyEnabled: this.copyEnabled };
  }

  /**
   * 处理粘贴功能切换
   */
  async handlePasteToggle(data) {
    const newState = data?.enabled ?? !this.pasteEnabled;
    this.pasteEnabled = newState;

    // 重新应用设置
    this.updateCopyPasteSettings();

    return { success: true, pasteEnabled: this.pasteEnabled };
  }

  /**
   * 更新复制粘贴设置
   */
  updateCopyPasteSettings() {
    // 如果插件整体启用，则根据独立设置来控制功能
    if (this.isEnabled) {
      this.enableCopyPaste();
    }
  }

  /**
   * 处理启用强力模式
   */
  async handleEnableForceMode() {
    this.forceMode = true;

    if (this.isEnabled) {
      // 重新处理所有元素，应用强力模式
      const allElements = document.querySelectorAll('*');
      allElements.forEach(element => {
        this.processElement(element);
      });
      
      // 重新注入自定义脚本以确保强力模式生效
      this.injectCustomScript();
      
      console.log('Force mode enabled and applied to all elements');
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
   * 调度元素处理（防抖机制）
   */
  scheduleElementProcessing(elements) {
    // 添加到待处理队列
    elements.forEach(el => this.pendingElements.add(el));

    // 清除之前的定时器
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }

    // 设置防抖定时器
    this.processingTimer = setTimeout(() => {
      this.processBatchElements();
    }, this.debounceDelay);
  }

  /**
   * 批量处理元素
   */
  processBatchElements() {
    if (this.pendingElements.size === 0) return;

    const elements = Array.from(this.pendingElements);
    this.pendingElements.clear();

    // 分批处理以避免阻塞主线程
    const processBatch = (startIndex) => {
      const endIndex = Math.min(startIndex + this.batchSize, elements.length);
      
      for (let i = startIndex; i < endIndex; i++) {
        const element = elements[i];
        if (element && element.isConnected) {
          this.processElement(element);
        }
      }

      // 如果还有元素需要处理，使用requestIdleCallback或setTimeout继续
      if (endIndex < elements.length) {
        if (window.requestIdleCallback) {
          requestIdleCallback(() => processBatch(endIndex));
        } else {
          setTimeout(() => processBatch(endIndex), 0);
        }
      }
    };

    processBatch(0);
  }

  /**
   * 更新性能指标
   */
  updatePerformanceMetrics(processingTime) {
    this.performanceMetrics.processedCount++;
    this.performanceMetrics.totalTime += processingTime;
    this.performanceMetrics.averageTime = 
      this.performanceMetrics.totalTime / this.performanceMetrics.processedCount;

    // 定期输出性能统计（仅在开发模式）
    if (this.performanceMetrics.processedCount % 100 === 0) {
      console.debug('CopyPaste Performance:', {
        processed: this.performanceMetrics.processedCount,
        avgTime: this.performanceMetrics.averageTime.toFixed(2) + 'ms',
        totalTime: this.performanceMetrics.totalTime.toFixed(2) + 'ms'
      });
    }
  }

  /**
   * 清理性能数据
   */
  clearPerformanceData() {
    this.processedElements = new WeakSet();
    this.pendingElements.clear();
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }
    this.performanceMetrics = {
      processedCount: 0,
      totalTime: 0,
      averageTime: 0
    };
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
   * 处理强制模式变更
   */
  async handleForceModeChanged(data) {
    try {
      const { forceMode } = data;
      this.forceMode = forceMode;
      
      if (forceMode) {
        this.enableCopyPaste();
      } else {
        this.disableCopyPaste();
      }
      
      return { success: true, forceMode: this.forceMode };
    } catch (error) {
      console.error('Failed to handle force mode change:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 处理刷新检测
   */
  async handleRefreshDetection(data) {
    try {
      // 重新检测页面限制
      this.detectRestrictions();
      
      // 如果启用，重新应用设置
      if (this.isEnabled) {
        this.enableCopyPaste();
      }
      
      return { success: true, message: 'Detection refreshed' };
    } catch (error) {
      console.error('Failed to handle refresh detection:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 处理测试复制
   */
  async handleTestCopy(data) {
    try {
      // 检查当前复制状态
      const canCopy = this.copyEnabled && this.isEnabled;
      
      return { 
        success: true, 
        canCopy,
        copyEnabled: this.copyEnabled,
        pasteEnabled: this.pasteEnabled,
        isEnabled: this.isEnabled,
        forceMode: this.forceMode
      };
    } catch (error) {
      console.error('Failed to handle test copy:', error);
      return { success: false, error: error.message };
    }
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