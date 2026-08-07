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
   * 注册吞没名单：命中源码正则的监听器直接不予注册，破坏性最强，只保留纯限制向事件。
   * B站实测 keydown/mousedown 类吞没是播放器快捷键等功能的主要死因，故退出本名单；
   * mouseup 无主流站点用于复制限制，整体移除
   */
  const swallowEvents = [
    'selectstart',
    'contextmenu',
    'dragstart',
    'copy',
    'cut',
    'paste'
  ];

  /**
   * 运行时中和名单：preventDefault/stopPropagation 失效化，非破坏性（监听器照常执行）。
   * 比吞没名单多 mousedown/keydown/keyup，用于击穿运行时才生效的限制
   * （mousedown 级选择封锁、Ctrl+C/V/X 快捷键封锁）
   */
  const neutralizeEvents = [...swallowEvents, 'mousedown', 'keydown', 'keyup'];

  // on* 内联事件属性选择器与名称列表（供 querySelectorAll 与 MutationObserver attributeFilter）
  const onAttributeSelector = swallowEvents.map(event => `[on${event}]`).join(',');
  const onAttributeNames = swallowEvents.map(event => `on${event}`);

  /**
   * 判断事件是否应被运行时中和。该判断运行在页面事件分发栈内，必须零异常（fail-open）
   */
  function shouldNeutralize(event) {
    try {
      const type = String(event.type).toLowerCase();
      if (!neutralizeEvents.includes(type)) return false;

      // keydown/keyup 仅在组合键时中和：精准击穿 Ctrl+C/V/X 封锁（文库类），
      // 放行播放器空格/方向键等单键 preventDefault（B站实测误伤来源）
      if (type === 'keydown' || type === 'keyup') {
        return Boolean(event.ctrlKey || event.metaKey);
      }

      // mousedown 中和用于击穿 mousedown 级选择封锁；目标在输入域内时不中和，
      // 保护输入框与富文本编辑器工具栏的焦点保持（toolbar 靠 mousedown preventDefault 防失焦）
      if (type === 'mousedown') {
        const target = event.target;
        return !(target && typeof target.closest === 'function'
          && target.closest('input, textarea, [contenteditable]'));
      }

      return true;
    } catch (error) {
      console.warn('EasyCV: Error in neutralize check, failing open:', error);
      return false;
    }
  }
  
  /**
   * 内建集合构造容错：页面可能把全局 Map/Set 替换为非原生实现
   * （道客巴巴实测：构造可用但 .has/.set 抛 TypeError；更激进的实现构造即抛错）。
   * 失败降级为 null，相关记录功能在使用处判空跳过——绝不让异常穿透进页面调用栈
   */
  function tryConstruct(Ctor, label) {
    try {
      return new Ctor();
    } catch (error) {
      console.warn(`EasyCV: ${label} unavailable, related bookkeeping disabled:`, error);
      return null;
    }
  }

  /**
   * 被拦截的事件监听器存储（仅调试用途：禁用时清理、经 window.easycvInjector 暴露）。
   * 存取失败只丢调试信息，拦截决策本身绝不抛错
   */
  const interceptedListeners = tryConstruct(Map, 'Map');

  // isRestrictiveListener 的 fail-open 计数（避免页面篡改内建对象时重复刷屏）
  let restrictiveCheckErrorCount = 0;
  
  // 注入即视为激活；EASYCV_DISABLE / EASYCV_ENABLE 消息翻转此标志
  let injectorActive = true;

  /**
   * 重写addEventListener以拦截限制性事件监听器
   */
  const overriddenAddEventListener = function(type, listener, options) {
    // String() coercion 与原生 WebIDL 行为一致（原生会把 null 等转为字符串），
    // 避免拦截判断本身比原生方法先抛错
    if (swallowEvents.includes(String(type).toLowerCase())) {
      // 检查监听器是否可能是限制性的
      if (isRestrictiveListener(listener)) {
        console.log(`EasyCV: Intercepted restrictive ${type} listener`);

        // 存储被拦截的监听器（仅调试记录）。页面篡改 Map 时此处的 TypeError 若穿透进
        // 页面自身 addEventListener 调用栈，会炸断页面脚本块（道客巴巴 P0 实证），
        // 因此整个存储块容错：记录失败不影响吞没决策
        try {
          if (interceptedListeners) {
            if (!interceptedListeners.has(this)) {
              interceptedListeners.set(this, new Map());
            }
            interceptedListeners.get(this).set(type, { listener, options });
          }
        } catch (error) {
          console.warn('EasyCV: Failed to record intercepted listener (swallow still applied):', error);
        }

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
      // fail-open：出错不吞。运行时中和（preventDefault/stopPropagation 重写）对该监听器
      // 仍兜底其限制行为，误吞的代价（页面功能丢失）大于漏吞
      restrictiveCheckErrorCount++;
      if (restrictiveCheckErrorCount === 1) {
        console.warn('EasyCV: Error checking listener restrictiveness, failing open (further errors counted silently):', error);
      }
      return false;
    }
    
    return false;
  }
  
  /**
   * 重写Event.preventDefault以在特定情况下忽略
   */
  const overriddenPreventDefault = function() {
    if (shouldNeutralize(this)) {
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
    if (shouldNeutralize(this)) {
      console.log(`EasyCV: Prevented stopPropagation on ${this.type} event`);
      return;
    }

    return originalFunctions.stopPropagation.call(this);
  };

  /**
   * 重写stopImmediatePropagation
   */
  const overriddenStopImmediatePropagation = function() {
    if (shouldNeutralize(this)) {
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
            
            swallowEvents.forEach(eventType => {
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
   * 清理单个元素上的限制性 on* 属性/属性值
   */
  function cleanElementRestrictiveAttributes(el) {
    swallowEvents.forEach(eventType => {
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
          attributeFilter: onAttributeNames
        });
      } else {
        // 如果body还不存在，等待DOM加载
        document.addEventListener('DOMContentLoaded', () => {
          if (document.body && dynamicObserver) {
            dynamicObserver.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: onAttributeNames
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
   * Shadow DOM 穿透：已处理的 root 保留强引用，以便禁用时统一清理。
   * 内建集合经容错构造（见 tryConstruct），记录不可用时 shadow 解锁本身不受影响
   */
  const processedShadowRoots = tryConstruct(Set, 'Set');
  const shadowObservers = tryConstruct(Map, 'Map');
  const shadowSheets = tryConstruct(Map, 'Map');

  function unlockShadowRoot(root) {
    if (!root) return;

    try {
      if (processedShadowRoots) {
        if (processedShadowRoots.has(root)) return;
        processedShadowRoots.add(root);
      }
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
      if (shadowSheets) shadowSheets.set(root, sheet);

      // 清理已有的内联限制属性，并对 shadow 树挂动态保护
      if (root.querySelectorAll) {
        root.querySelectorAll(onAttributeSelector).forEach(cleanElementRestrictiveAttributes);
      }
      const observer = createProtectionObserver();
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: onAttributeNames
      });
      if (shadowObservers) shadowObservers.set(root, observer);
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

      // 清理 shadow root 内的注入样式与观察器（内建集合可能被页面篡改或为 null，
      // 独立容错避免中断后续的 document.on* 解除与注入样式移除）
      try {
        if (shadowObservers) {
          shadowObservers.forEach(observer => observer.disconnect());
          shadowObservers.clear();
        }
        if (processedShadowRoots) {
          processedShadowRoots.forEach(root => {
            try {
              const sheet = shadowSheets && shadowSheets.get(root);
              if (sheet) {
                root.adoptedStyleSheets = root.adoptedStyleSheets.filter(s => s !== sheet);
              }
            } catch (error) {
              console.warn('EasyCV: Error cleaning shadow root:', error);
            }
          });
          processedShadowRoots.clear();
        }
        if (shadowSheets) shadowSheets.clear();
      } catch (error) {
        console.warn('EasyCV: Error cleaning shadow bookkeeping:', error);
      }

      // 解除 document.on* 属性劫持（这些以 own property 形式定义在 document 上，
      // delete 后原型链上的原始描述符自然生效）
      ['onselectstart', 'oncontextmenu', 'ondragstart'].forEach(prop => {
        try { delete document[prop]; } catch (e) { /* 属性不可删除时忽略 */ }
      });
      
      // 清理拦截的监听器映射（页面可能篡改 Map，单独容错以免中断后续样式清理）
      if (interceptedListeners) {
        try { interceptedListeners.clear(); } catch (e) { /* 调试记录丢弃即可 */ }
      }
      
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