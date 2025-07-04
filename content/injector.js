/**
 * EasyCV DOM注入脚本
 * 在页面上下文中运行，处理更深层的JavaScript限制
 */

(function() {
  'use strict';
  
  // 防止重复注入
  if (window.EasyCVInjected) {
    console.log('EasyCV Injector already loaded, skipping...');
    return;
  }
  
  console.log('Starting EasyCV Injector initialization...');
  console.log('Current URL:', window.location.href);
  console.log('Document readyState:', document.readyState);
  
  window.EasyCVInjected = true;
  console.log('✓ EasyCVInjected flag set to true');
  console.log('EasyCV Injector script loaded');
  
  /**
   * 保存原始函数引用
   */
  console.log('Saving original function references...');
  const originalFunctions = {
    addEventListener: EventTarget.prototype.addEventListener,
    removeEventListener: EventTarget.prototype.removeEventListener,
    preventDefault: Event.prototype.preventDefault,
    stopPropagation: Event.prototype.stopPropagation,
    stopImmediatePropagation: Event.prototype.stopImmediatePropagation
  };
  console.log('✓ Original functions saved');
  
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
   * 检查监听器是否是限制性的（增强安全版本）
   */
  function isRestrictiveListener(listener) {
    if (!listener) return false;
    
    try {
      if (typeof listener === 'function') {
        const funcStr = listener.toString();
        
        // 检查是否包含阻止默认行为的代码
        const restrictivePatterns = [
          /preventDefault/i,
          /return\s+false/i,
          /stopPropagation/i,
          /stopImmediatePropagation/i,
          // 添加更多限制性模式
          /event\.returnValue\s*=\s*false/i,
          /cancelBubble\s*=\s*true/i
        ];
        
        return restrictivePatterns.some(pattern => pattern.test(funcStr));
      }
      
      if (typeof listener === 'string') {
        // 处理字符串形式的事件处理器
        const restrictivePatterns = [
          /preventDefault/i,
          /return\s+false/i,
          /event\.returnValue\s*=\s*false/i
        ];
        
        return restrictivePatterns.some(pattern => pattern.test(listener));
      }
    } catch (error) {
      console.warn('EasyCV: Error checking listener restrictiveness:', error);
      // 出错时保守处理，认为是限制性的
      return true;
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
   * 移除现有的限制性事件监听器（增强安全版本）
   */
  function removeExistingRestrictiveListeners() {
    try {
      // 限制查询范围，避免性能问题
      const selectors = [
        'body', 'html', 'div', 'p', 'span', 'article', 'section',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th'
      ];
      
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          
          elements.forEach(element => {
            if (!element || !element.nodeType) return;
            
            interceptedEvents.forEach(eventType => {
              try {
                const handlerProperty = `on${eventType}`;
                const inlineHandler = element[handlerProperty];
                
                if (inlineHandler && isRestrictiveListener(inlineHandler)) {
                  console.log(`EasyCV: Removed restrictive inline ${eventType} handler`);
                  element[handlerProperty] = null;
                }
                
                // 同时检查属性形式的处理器
                if (element.hasAttribute(handlerProperty)) {
                  const attrHandler = element.getAttribute(handlerProperty);
                  if (attrHandler && isRestrictiveListener(attrHandler)) {
                    console.log(`EasyCV: Removed restrictive ${handlerProperty} attribute`);
                    element.removeAttribute(handlerProperty);
                  }
                }
              } catch (error) {
                console.warn(`EasyCV: Error processing ${eventType} on element:`, error);
              }
            });
          });
        } catch (error) {
          console.warn(`EasyCV: Error querying ${selector} elements:`, error);
        }
      });
    } catch (error) {
      console.error('EasyCV: Error in removeExistingRestrictiveListeners:', error);
    }
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
   * 监听DOM变化，处理动态添加的限制（增强安全版本）
   */
  let dynamicObserver = null;
  
  function setupDynamicProtection() {
    try {
      // 如果已有观察器，先断开连接
      if (dynamicObserver) {
        dynamicObserver.disconnect();
      }
      
      dynamicObserver = new MutationObserver((mutations) => {
        try {
          // 限制处理的变化数量，避免性能问题
          const maxMutations = 50;
          const limitedMutations = mutations.slice(0, maxMutations);
          
          limitedMutations.forEach((mutation) => {
            try {
              mutation.addedNodes.forEach((node) => {
                if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
                
                // 检查新添加的元素是否有限制性属性
                interceptedEvents.forEach(eventType => {
                  try {
                    const attrName = `on${eventType}`;
                    
                    // 检查属性形式的处理器
                    if (node.hasAttribute && node.hasAttribute(attrName)) {
                      const handler = node.getAttribute(attrName);
                      if (handler && isRestrictiveListener(handler)) {
                        console.log(`EasyCV: Removed restrictive ${attrName} attribute from new element`);
                        node.removeAttribute(attrName);
                      }
                    }
                    
                    // 检查属性形式的处理器
                    if (node[attrName] && isRestrictiveListener(node[attrName])) {
                      console.log(`EasyCV: Removed restrictive ${attrName} property from new element`);
                      node[attrName] = null;
                    }
                  } catch (error) {
                    console.warn(`EasyCV: Error processing ${eventType} on new element:`, error);
                  }
                });
              });
            } catch (error) {
              console.warn('EasyCV: Error processing mutation:', error);
            }
          });
        } catch (error) {
          console.error('EasyCV: Error in mutation observer callback:', error);
        }
      });
      
      // 确保document.body存在
      if (document.body) {
        dynamicObserver.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: interceptedEvents.map(event => `on${event}`)
        });
      } else {
        // 如果body还不存在，等待DOM加载
        document.addEventListener('DOMContentLoaded', () => {
          if (document.body && dynamicObserver) {
            dynamicObserver.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: interceptedEvents.map(event => `on${event}`)
            });
          }
        });
      }
    } catch (error) {
      console.error('EasyCV: Error setting up dynamic protection:', error);
    }
  }
  
  /**
   * 强制启用文本选择（增强版本）
   */
  function forceEnableTextSelection() {
    try {
      // 检查是否已经注入过样式
      if (document.querySelector('style[data-easycv-injected="text-selection"]')) {
        return;
      }
      
      // 创建样式表强制启用文本选择
      const style = document.createElement('style');
      style.setAttribute('data-easycv-injected', 'text-selection');
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
        
        /* 确保输入元素正常工作 */
        input, textarea, select {
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
          user-select: text !important;
          pointer-events: auto !important;
        }
      `;
      
      // 添加到head，确保优先级
      const target = document.head || document.documentElement;
      if (target) {
        target.appendChild(style);
        console.log('EasyCV: Text selection styles injected');
      }
    } catch (error) {
      console.error('EasyCV: Error injecting text selection styles:', error);
    }
  }
  
  /**
   * 恢复原始功能（增强清理版本）
   */
  function restoreOriginalFunctions() {
    try {
      // 停止动态观察器
      if (dynamicObserver) {
        dynamicObserver.disconnect();
        dynamicObserver = null;
      }
      
      // 恢复原始的事件方法
      if (originalFunctions.addEventListener) {
        EventTarget.prototype.addEventListener = originalFunctions.addEventListener;
      }
      if (originalFunctions.removeEventListener) {
        EventTarget.prototype.removeEventListener = originalFunctions.removeEventListener;
      }
      if (originalFunctions.preventDefault) {
        Event.prototype.preventDefault = originalFunctions.preventDefault;
      }
      if (originalFunctions.stopPropagation) {
        Event.prototype.stopPropagation = originalFunctions.stopPropagation;
      }
      if (originalFunctions.stopImmediatePropagation) {
        Event.prototype.stopImmediatePropagation = originalFunctions.stopImmediatePropagation;
      }
      
      // 清理拦截的监听器映射
      interceptedListeners.clear();
      
      // 移除注入的样式
      const injectedStyles = document.querySelectorAll('style[data-easycv-injected]');
      injectedStyles.forEach(style => {
        try {
          style.remove();
        } catch (error) {
          console.warn('EasyCV: Error removing injected style:', error);
        }
      });
      
      console.log('EasyCV: Original functions restored and cleanup completed');
    } catch (error) {
      console.error('EasyCV: Error restoring original functions:', error);
    }
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
  
  console.log('✓ EasyCV Injector initialization completed successfully');
  console.log('✓ All event interceptors are active');
  console.log('✓ Global easycvInjector object available for debugging');
  
})();