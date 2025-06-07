/**
 * EasyCV DOM注入脚本
 * 在页面上下文中运行，处理更深层的JavaScript限制
 */

(function() {
  'use strict';
  
  // 防止重复注入
  if (window.easycvInjected) {
    return;
  }
  window.easycvInjected = true;
  
  console.log('EasyCV Injector script loaded');
  
  /**
   * 保存原始函数引用
   */
  const originalFunctions = {
    addEventListener: EventTarget.prototype.addEventListener,
    removeEventListener: EventTarget.prototype.removeEventListener,
    preventDefault: Event.prototype.preventDefault,
    stopPropagation: Event.prototype.stopPropagation,
    stopImmediatePropagation: Event.prototype.stopImmediatePropagation
  };
  
  /**
   * 需要拦截的事件类型
   */
  const interceptedEvents = [
    'selectstart',
    'contextmenu',
    'dragstart',
    'copy',
    'cut',
    'paste',
    'mousedown',
    'mouseup',
    'keydown',
    'keyup'
  ];
  
  /**
   * 被拦截的事件监听器存储
   */
  const interceptedListeners = new Map();
  
  /**
   * 重写addEventListener以拦截限制性事件监听器
   */
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    // 如果是我们要拦截的事件类型
    if (interceptedEvents.includes(type.toLowerCase())) {
      // 检查监听器是否可能是限制性的
      if (isRestrictiveListener(listener)) {
        console.log(`EasyCV: Intercepted restrictive ${type} listener`);
        
        // 存储被拦截的监听器
        if (!interceptedListeners.has(this)) {
          interceptedListeners.set(this, new Map());
        }
        interceptedListeners.get(this).set(type, { listener, options });
        
        // 不添加限制性监听器
        return;
      }
    }
    
    // 调用原始方法
    return originalFunctions.addEventListener.call(this, type, listener, options);
  };
  
  /**
   * 检查监听器是否是限制性的
   */
  function isRestrictiveListener(listener) {
    if (typeof listener === 'function') {
      const funcStr = listener.toString();
      
      // 检查是否包含阻止默认行为的代码
      const restrictivePatterns = [
        /preventDefault/i,
        /return\s+false/i,
        /stopPropagation/i,
        /stopImmediatePropagation/i
      ];
      
      return restrictivePatterns.some(pattern => pattern.test(funcStr));
    }
    
    return false;
  }
  
  /**
   * 重写Event.preventDefault以在特定情况下忽略
   */
  Event.prototype.preventDefault = function() {
    // 如果是我们关心的事件类型，检查是否应该允许
    if (interceptedEvents.includes(this.type.toLowerCase())) {
      console.log(`EasyCV: Prevented preventDefault on ${this.type} event`);
      return; // 不执行preventDefault
    }
    
    // 对其他事件正常执行
    return originalFunctions.preventDefault.call(this);
  };
  
  /**
   * 重写stopPropagation以在特定情况下忽略
   */
  Event.prototype.stopPropagation = function() {
    if (interceptedEvents.includes(this.type.toLowerCase())) {
      console.log(`EasyCV: Prevented stopPropagation on ${this.type} event`);
      return;
    }
    
    return originalFunctions.stopPropagation.call(this);
  };
  
  /**
   * 重写stopImmediatePropagation
   */
  Event.prototype.stopImmediatePropagation = function() {
    if (interceptedEvents.includes(this.type.toLowerCase())) {
      console.log(`EasyCV: Prevented stopImmediatePropagation on ${this.type} event`);
      return;
    }
    
    return originalFunctions.stopImmediatePropagation.call(this);
  };
  
  /**
   * 移除现有的限制性事件监听器
   */
  function removeExistingRestrictiveListeners() {
    const elements = document.querySelectorAll('*');
    
    elements.forEach(element => {
      interceptedEvents.forEach(eventType => {
        // 尝试移除可能的限制性监听器
        const inlineHandler = element[`on${eventType}`];
        if (inlineHandler && isRestrictiveListener(inlineHandler)) {
          console.log(`EasyCV: Removed restrictive inline ${eventType} handler`);
          element[`on${eventType}`] = null;
        }
      });
    });
  }
  
  /**
   * 重写常见的禁用函数
   */
  function overrideCommonDisableFunctions() {
    // 重写document.onselectstart
    Object.defineProperty(document, 'onselectstart', {
      get: function() { return null; },
      set: function(value) {
        console.log('EasyCV: Blocked attempt to set document.onselectstart');
        // 不设置限制性处理器
      },
      configurable: true
    });
    
    // 重写document.oncontextmenu
    Object.defineProperty(document, 'oncontextmenu', {
      get: function() { return null; },
      set: function(value) {
        console.log('EasyCV: Blocked attempt to set document.oncontextmenu');
      },
      configurable: true
    });
    
    // 重写document.ondragstart
    Object.defineProperty(document, 'ondragstart', {
      get: function() { return null; },
      set: function(value) {
        console.log('EasyCV: Blocked attempt to set document.ondragstart');
      },
      configurable: true
    });
  }
  
  /**
   * 监听DOM变化，处理动态添加的限制
   */
  function setupDynamicProtection() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 检查新添加的元素是否有限制性属性
            interceptedEvents.forEach(eventType => {
              const attrName = `on${eventType}`;
              if (node.hasAttribute(attrName)) {
                const handler = node.getAttribute(attrName);
                if (handler && (handler.includes('return false') || 
                               handler.includes('preventDefault'))) {
                  console.log(`EasyCV: Removed restrictive ${attrName} attribute from new element`);
                  node.removeAttribute(attrName);
                }
              }
            });
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: interceptedEvents.map(event => `on${event}`)
    });
  }
  
  /**
   * 强制启用文本选择
   */
  function forceEnableTextSelection() {
    // 创建样式表强制启用文本选择
    const style = document.createElement('style');
    style.textContent = `
      * {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
        -webkit-touch-callout: default !important;
      }
      
      /* 确保常见的文本元素可选择 */
      p, div, span, article, section, h1, h2, h3, h4, h5, h6,
      li, td, th, blockquote, pre, code {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
    `;
    
    // 添加到head，确保优先级
    (document.head || document.documentElement).appendChild(style);
  }
  
  /**
   * 恢复原始功能
   */
  function restoreOriginalFunctions() {
    // 恢复原始的事件方法
    EventTarget.prototype.addEventListener = originalFunctions.addEventListener;
    EventTarget.prototype.removeEventListener = originalFunctions.removeEventListener;
    Event.prototype.preventDefault = originalFunctions.preventDefault;
    Event.prototype.stopPropagation = originalFunctions.stopPropagation;
    Event.prototype.stopImmediatePropagation = originalFunctions.stopImmediatePropagation;
  }
  
  /**
   * 初始化注入器
   */
  function initializeInjector() {
    try {
      // 移除现有限制
      removeExistingRestrictiveListeners();
      
      // 重写常见禁用函数
      overrideCommonDisableFunctions();
      
      // 强制启用文本选择
      forceEnableTextSelection();
      
      // 设置动态保护
      setupDynamicProtection();
      
      console.log('EasyCV: Injector initialized successfully');
    } catch (error) {
      console.error('EasyCV: Injector initialization failed:', error);
    }
  }
  
  /**
   * 监听来自content script的消息
   */
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'EASYCV_DISABLE') {
      console.log('EasyCV: Disabling injector');
      restoreOriginalFunctions();
    } else if (event.data.type === 'EASYCV_ENABLE') {
      console.log('EasyCV: Re-enabling injector');
      initializeInjector();
    }
  });
  
  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeInjector);
  } else {
    initializeInjector();
  }
  
  // 导出控制函数到全局作用域（用于调试）
  window.easycvInjector = {
    restore: restoreOriginalFunctions,
    reinitialize: initializeInjector,
    interceptedListeners: interceptedListeners
  };
  
})();