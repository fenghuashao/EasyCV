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
  // content script 运行在 isolated world，与本 main world 的 window 互相隔离，
  // 跨 world 的注入成功信号必须走两边共享的 DOM；window flag 保留供防重复注入与页面侧检测使用
  document.documentElement.dataset.easycvInjected = 'true';
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
    stopImmediatePropagation: Event.prototype.stopImmediatePropagation,
    attachShadow: Element.prototype.attachShadow
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
  
  // 注入即视为激活；EASYCV_DISABLE / EASYCV_ENABLE 消息翻转此标志
  let injectorActive = true;

  /**
   * 重写addEventListener以拦截限制性事件监听器
   */
  const overriddenAddEventListener = function(type, listener, options) {
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
  const overriddenPreventDefault = function() {
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
  const overriddenStopPropagation = function() {
    if (interceptedEvents.includes(this.type.toLowerCase())) {
      console.log(`EasyCV: Prevented stopPropagation on ${this.type} event`);
      return;
    }
    
    return originalFunctions.stopPropagation.call(this);
  };
  
  /**
   * 重写stopImmediatePropagation
   */
  const overriddenStopImmediatePropagation = function() {
    if (interceptedEvents.includes(this.type.toLowerCase())) {
      console.log(`EasyCV: Prevented stopImmediatePropagation on ${this.type} event`);
      return;
    }

    return originalFunctions.stopImmediatePropagation.call(this);
  };

  /**
   * 应用原型级重写。必须在页面脚本注册监听器之前执行（document_start 时机），
   * 禁用后重新启用时需再次调用以恢复重写
   */
  function applyPrototypeOverrides() {
    EventTarget.prototype.addEventListener = overriddenAddEventListener;
    Event.prototype.preventDefault = overriddenPreventDefault;
    Event.prototype.stopPropagation = overriddenStopPropagation;
    Event.prototype.stopImmediatePropagation = overriddenStopImmediatePropagation;

    // Shadow DOM 穿透：外部样式与 querySelectorAll 都无法穿透 shadow 边界。
    // 包装 attachShadow 可同时覆盖 open 与 closed 模式——closed 的 root 无法
    // 经 element.shadowRoot 发现，但 attachShadow 的返回值即 root 本身
    Element.prototype.attachShadow = function(init) {
      const root = originalFunctions.attachShadow.call(this, init);
      if (injectorActive && root) {
        unlockShadowRoot(root);
      }
      return root;
    };
  }

  // 注入即应用（此时处于 document_start，页面脚本尚未注册限制性监听器）
  applyPrototypeOverrides();
  
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
  
  // on* 内联事件属性选择器（供 querySelectorAll 批量查找）
  const onAttributeSelector = interceptedEvents.map(event => `[on${event}]`).join(',');

  /**
   * 清理单个元素上的限制性 on* 属性/属性值
   */
  function cleanElementRestrictiveAttributes(el) {
    interceptedEvents.forEach(eventType => {
      const attrName = `on${eventType}`;
      try {
        if (el.hasAttribute && el.hasAttribute(attrName)) {
          const handler = el.getAttribute(attrName);
          if (handler && isRestrictiveListener(handler)) {
            el.removeAttribute(attrName);
          }
        }
        const propHandler = el[attrName];
        if (typeof propHandler === 'function' && isRestrictiveListener(propHandler)) {
          el[attrName] = null;
        }
      } catch (error) {
        console.warn(`EasyCV: Error cleaning ${attrName}:`, error);
      }
    });
  }

  /**
   * 清理新增节点及其后代（innerHTML 一次性插入的子树，后代 on* 属性不会单独触发 mutation）
   */
  function cleanRestrictiveAttributesOnNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    cleanElementRestrictiveAttributes(node);
    if (node.querySelectorAll) {
      node.querySelectorAll(onAttributeSelector).forEach(cleanElementRestrictiveAttributes);
    }
  }

  /**
   * 创建动态保护观察器：处理新增节点与已有节点的 on* 属性变更
   */
  function createProtectionObserver() {
    return new MutationObserver((mutations) => {
      try {
        for (const mutation of mutations) {
          try {
            if (mutation.type === 'attributes') {
              cleanElementRestrictiveAttributes(mutation.target);
            } else {
              mutation.addedNodes.forEach(cleanRestrictiveAttributesOnNode);
            }
          } catch (error) {
            console.warn('EasyCV: Error processing mutation:', error);
          }
        }
      } catch (error) {
        console.error('EasyCV: Error in mutation observer callback:', error);
      }
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

      dynamicObserver = createProtectionObserver();
      
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
   * Shadow DOM 穿透：已处理的 root 保留强引用，以便禁用时统一清理
   */
  const processedShadowRoots = new Set();
  const shadowObservers = new Map();
  const shadowSheets = new Map();

  function unlockShadowRoot(root) {
    if (!root || processedShadowRoots.has(root)) return;
    processedShadowRoots.add(root);

    try {
      // 全局样式穿不透 shadow 边界，必须在 root 内部注入。
      // 用 adoptedStyleSheets 而非 <style> 子元素：root.innerHTML 赋值会清空全部
      // 子节点（包括注入的 style），但 adoptedStyleSheets 不受其影响
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(`
        * {
          -webkit-user-select: text !important;
          user-select: text !important;
          pointer-events: auto !important;
        }
      `);
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      shadowSheets.set(root, sheet);

      // 清理已有的内联限制属性，并对 shadow 树挂动态保护
      if (root.querySelectorAll) {
        root.querySelectorAll(onAttributeSelector).forEach(cleanElementRestrictiveAttributes);
      }
      const observer = createProtectionObserver();
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: interceptedEvents.map(event => `on${event}`)
      });
      shadowObservers.set(root, observer);
    } catch (error) {
      console.warn('EasyCV: Failed to unlock shadow root:', error);
    }
  }

  /**
   * 处理注入前已存在的 shadow root（如声明式 Shadow DOM），含嵌套 shadow
   */
  function unlockExistingShadowRoots() {
    const walk = (node) => {
      if (!node) return;
      if (node.shadowRoot) {
        unlockShadowRoot(node.shadowRoot);
        walk(node.shadowRoot);
      }
      const children = node.children;
      if (children) {
        for (let i = 0; i < children.length; i++) {
          walk(children[i]);
        }
      }
    };

    try {
      walk(document.documentElement);
    } catch (error) {
      console.warn('EasyCV: Error walking existing shadow roots:', error);
    }
  }

  /**
   * 恢复原始功能（增强清理版本）
   */
  function restoreOriginalFunctions() {
    try {
      if (!injectorActive) return;
      injectorActive = false;

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
      if (originalFunctions.attachShadow) {
        Element.prototype.attachShadow = originalFunctions.attachShadow;
      }

      // 清理 shadow root 内的注入样式与观察器
      shadowObservers.forEach(observer => observer.disconnect());
      shadowObservers.clear();
      processedShadowRoots.forEach(root => {
        try {
          const sheet = shadowSheets.get(root);
          if (sheet) {
            root.adoptedStyleSheets = root.adoptedStyleSheets.filter(s => s !== sheet);
          }
        } catch (error) {
          console.warn('EasyCV: Error cleaning shadow root:', error);
        }
      });
      shadowSheets.clear();
      processedShadowRoots.clear();

      // 解除 document.on* 属性劫持（这些以 own property 形式定义在 document 上，
      // delete 后原型链上的原始描述符自然生效）
      ['onselectstart', 'oncontextmenu', 'ondragstart'].forEach(prop => {
        try { delete document[prop]; } catch (e) { /* 属性不可删除时忽略 */ }
      });
      
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
      // 禁用状态下不应执行（如禁用后才触发的 DOMContentLoaded 回调）
      if (!injectorActive) return;

      // 移除现有限制
      removeExistingRestrictiveListeners();
      
      // 重写常见禁用函数
      overrideCommonDisableFunctions();
      
      // 强制启用文本选择
      forceEnableTextSelection();

      // 处理注入前已存在的 shadow root
      unlockExistingShadowRoots();

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
      // 禁用后重新启用时，原型重写已被 restoreOriginalFunctions 还原，需要重新应用
      if (!injectorActive) {
        injectorActive = true;
        applyPrototypeOverrides();
      }
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