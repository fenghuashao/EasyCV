/**
 * EasyCV 内容脚本
 * 负责页面DOM操作、复制粘贴限制检测与解除
 */

// 复制/粘贴各自关联的限制性事件（启用时注册捕获阶段放行处理器，禁用时移除）
const COPY_EVENTS = ['selectstart', 'contextmenu', 'dragstart', 'copy'];
const PASTE_EVENTS = ['paste'];

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

    // 状态同步相关
    this.stateUpdateQueue = [];
    this.isProcessingQueue = false;
    this.stateLoadRetryCount = 0;
    this.maxRetryCount = 5; // 增加重试次数
    this.retryDelay = 1500; // 增加重试延迟
    this.stateLoadTimeout = 10000; // 增加超时时间到10秒
    this.lastKnownState = null;
    this.stateListeners = new Set();

    // SPA 路由感知相关
    this.lastKnownUrl = location.href;
    this.spaCheckTimer = null;

    this.initializeManager();
  }

  /**
   * 初始化管理器
   */
  async initializeManager() {
    try {
      console.log('Initializing CopyPasteManager...');
      console.log('Current URL:', window.location.href);
      console.log('Document readyState:', document.readyState);
      
      // 优化的状态加载流程（现在不会抛出错误）
      console.log('Loading settings with retry...');
      await this.loadSettingsWithRetry();
      console.log('Settings loaded successfully');

      // 设置消息监听
      console.log('Setting up message listeners...');
      this.setupMessageListeners();

      // 设置状态监听器
      console.log('Setting up state listeners...');
      this.setupStateListeners();

      // 检测页面限制
      console.log('Detecting page restrictions...');
      this.detectRestrictions();

      // 应用当前状态
      console.log('Applying current state...');
      await this.applyCurrentState();
      console.log('Current state applied successfully');

      // 监听DOM变化
      console.log('Setting up DOM observer...');
      this.setupDOMObserver();

      // 监听 SPA 路由变化
      this.setupSPAListener();

      console.log('EasyCV Content Script initialized with state management');
      console.log('Final state:', {
        isEnabled: this.isEnabled,
        copyEnabled: this.copyEnabled,
        pasteEnabled: this.pasteEnabled,
        forceMode: this.forceMode,
        initialized: true
      });
    } catch (error) {
      console.error('Failed to initialize CopyPasteManager:', error);
      console.error('Error stack:', error.stack);
      this.reportError(error);
      // 使用默认状态继续运行
      try {
        console.log('Attempting to apply default state...');
        await this.applyDefaultState();
        console.log('Default state applied successfully');
      } catch (applyError) {
        console.error('Failed to apply default state:', applyError);
      }
    }
  }

  /**
   * 加载设置（带重试机制）
   */
  async loadSettingsWithRetry() {
    for (let attempt = 0; attempt <= this.maxRetryCount; attempt++) {
      try {
        const response = await Promise.race([
          MessageUtils.sendToBackground(MessageUtils.MESSAGE_TYPES.GET_STATUS),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), this.stateLoadTimeout)
          )
        ]);

        if (response?.success && response.data) {
          const newState = {
            isEnabled: Boolean(response.data.enabled),
            copyEnabled: Boolean(response.data.copyEnabled !== false),
            pasteEnabled: Boolean(response.data.pasteEnabled !== false),
            forceMode: Boolean(response.data.forceMode)
          };

          // 添加调试日志
          console.log('Received response from background:', response);
          console.log('Constructed newState:', newState);

          // 验证状态
          if (this.validateState(newState)) {
            this.updateLocalState(newState);
            this.lastKnownState = { ...newState };
            console.log('State loaded successfully:', newState);
            return;
          } else {
            console.error('State validation failed:', {
              newState,
              validation: {
                isObject: typeof newState === 'object',
                hasIsEnabled: typeof newState.isEnabled === 'boolean',
                hasCopyEnabled: typeof newState.copyEnabled === 'boolean',
                hasPasteEnabled: typeof newState.pasteEnabled === 'boolean',
                hasForceMode: typeof newState.forceMode === 'boolean'
              }
            });
            throw new Error('Invalid state received');
          }
        } else {
          console.error('Invalid response from background:', response);
          throw new Error('Failed to get valid response');
        }
      } catch (error) {
        console.warn(`State load attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt < this.maxRetryCount) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        } else {
          console.error('All state load attempts failed, using last known state or defaults');
          // 优雅降级：使用最后已知状态或默认状态
          if (this.lastKnownState) {
            this.updateLocalState(this.lastKnownState);
            console.log('Using last known state:', this.lastKnownState);
          } else {
            // 使用默认状态
            const defaultState = {
              isEnabled: true,
              copyEnabled: true,
              pasteEnabled: true,
              forceMode: false
            };
            this.updateLocalState(defaultState);
            this.lastKnownState = { ...defaultState };
            console.log('Using default state:', defaultState);
          }
          // 不再抛出错误，而是继续执行
          return;
        }
      }
    }
  }

  /**
   * 验证状态对象
   */
  validateState(state) {
    return (
      typeof state === 'object' &&
      typeof state.isEnabled === 'boolean' &&
      typeof state.copyEnabled === 'boolean' &&
      typeof state.pasteEnabled === 'boolean' &&
      typeof state.forceMode === 'boolean'
    );
  }

  /**
   * 更新本地状态
   */
  updateLocalState(state) {
    this.isEnabled = state.isEnabled;
    this.copyEnabled = state.copyEnabled;
    this.pasteEnabled = state.pasteEnabled;
    this.forceMode = state.forceMode;
  }

  /**
   * 应用默认状态
   */
  async applyDefaultState() {
    const defaultState = {
      isEnabled: false,
      copyEnabled: true,
      pasteEnabled: true,
      forceMode: false
    };
    
    this.updateLocalState(defaultState);
    await this.applyCurrentState();
    console.log('Applied default state due to initialization failure');
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
            return await this.queueStateUpdate('TOGGLE_PLUGIN', data);

          case 'COPY_STATUS_CHANGED':
            return await this.queueStateUpdate('COPY_TOGGLE', data);

          case 'PASTE_STATUS_CHANGED':
            return await this.queueStateUpdate('PASTE_TOGGLE', data);

          case MessageUtils.MESSAGE_TYPES.ENABLE_FORCE_MODE:
            return await this.queueStateUpdate('FORCE_MODE_ENABLE', {});

          case MessageUtils.MESSAGE_TYPES.DISABLE_FORCE_MODE:
            return await this.queueStateUpdate('FORCE_MODE_DISABLE', {});

          case MessageUtils.MESSAGE_TYPES.UPDATE_STATUS:
            return await this.queueStateUpdate('UPDATE_STATUS', data);

          case 'STATE_BROADCAST':
            return await this.handleStateBroadcast(data);

          case MessageUtils.MESSAGE_TYPES.PING:
            return { success: true, message: 'Content script is available' };

          case 'FORCE_MODE_CHANGED':
            return await this.handleForceModeChanged(data);

          case 'REFRESH_DETECTION':
            return await this.handleRefreshDetection(data);

          case 'TEST_COPY':
            return await this.handleTestCopy(data);

          case 'GET_PAGE_STATUS':
            return await this.handleGetPageStatus(data);

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
      console.log('Current state before enabling:', {
        isEnabled: this.isEnabled,
        copyEnabled: this.copyEnabled,
        pasteEnabled: this.pasteEnabled,
        forceMode: this.forceMode
      });
      
      // 清理之前的性能数据
      this.clearPerformanceData();
      
      // 移除全局限制
      console.log('Removing global restrictions...');
      this.removeGlobalRestrictions();

      // 批量处理页面中的所有元素
      console.log('Processing all elements...');
      const allElements = document.querySelectorAll('*');
      this.scheduleElementProcessing(Array.from(allElements));

      // 恢复 DOM 观察器（disableCopyPaste 会将其销毁，重新启用时必须重建）
      if (!this.observer) {
        this.setupDOMObserver();
      }

      // 注入自定义脚本（用于处理更深层的限制）
      console.log('Injecting custom script...');
      if (document.documentElement.dataset.easycvInjected) {
        // injector 已在 main world 中，重新注入会被其防重复守卫跳过，
        // 必须经 postMessage 通知其恢复原型重写与动态保护
        window.postMessage({ type: 'EASYCV_ENABLE' }, '*');
      } else {
        this.injectCustomScript();
      }

      console.log('Copy-paste restrictions removed');
      
      // 验证注入是否成功（跨 world 信号走共享 DOM 的 dataset，理由同上）
      setTimeout(() => {
        if (document.documentElement.dataset.easycvInjected) {
          console.log('✓ Custom script injection verified successfully');
        } else {
          console.warn('⚠ Custom script injection may have failed - EasyCVInjected flag not found');
        }
      }, 100);
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

    // 通知 main world 的 injector 恢复原始函数（启停协议由 content script 单向触发，
    // 否则禁用后 main world 的原型重写与强制样式仍然残留）
    window.postMessage({ type: 'EASYCV_DISABLE' }, '*');

    // 停止DOM观察器
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // 移除启用时注册的捕获阶段放行处理器
    COPY_EVENTS.concat(PASTE_EVENTS).forEach(eventType => {
      document.removeEventListener(eventType, this.allowDefaultHandler, true);
    });
    
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
    if (this.copyEnabled) {
      COPY_EVENTS.forEach(eventType => {
        document.removeEventListener(eventType, this.preventDefaultHandler, true);
        document.addEventListener(eventType, this.allowDefaultHandler, true);
      });
    }

    if (this.pasteEnabled) {
      PASTE_EVENTS.forEach(eventType => {
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
    try {
      console.log('Creating injector script element...');
      const script = document.createElement('script');
      
      const injectorUrl = chrome.runtime.getURL('content/injector.js');
      console.log('Injector URL:', injectorUrl);
      
      script.src = injectorUrl;
      script.type = 'text/javascript';
      
      script.onload = () => {
        console.log('✓ Injector script loaded successfully');
        script.remove();
        
        // 验证注入是否成功（injector 在 main world 执行，与本 isolated world 的 window 隔离，
        // 注入成功信号经共享 DOM 的 dataset 传递）
        setTimeout(() => {
          if (document.documentElement.dataset.easycvInjected) {
            console.log('✓ EasyCVInjected flag confirmed');
          } else {
            console.error('✗ EasyCVInjected flag not found after injection');
          }
        }, 50);
      };
      
      script.onerror = (error) => {
        console.error('✗ Failed to load injector script:', error);
        console.error('Script src:', script.src);
      };
      
      const targetElement = document.head || document.documentElement;
      console.log('Appending script to:', targetElement.tagName);
      
      if (targetElement) {
        targetElement.appendChild(script);
        console.log('✓ Injector script element appended to DOM');
      } else {
        console.error('✗ No suitable parent element found for script injection');
      }
      
    } catch (error) {
      console.error('✗ Error in injectCustomScript:', error);
      console.error('Error stack:', error.stack);
    }
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
   * 监听 SPA 路由变化：软跳转不触发页面重载，
   * 重新渲染的组件可能恢复已解除的限制，需要在 URL 变化后重放解锁流程
   */
  setupSPAListener() {
    window.addEventListener('popstate', () => this.handleSPANavigation());

    // content script 无法直接拦截 history.pushState，通过 DOM 变化间接感知 URL 变更
    const urlCheckObserver = new MutationObserver(() => {
      if (location.href !== this.lastKnownUrl) {
        this.handleSPANavigation();
      }
    });
    urlCheckObserver.observe(document, { subtree: true, childList: true });
  }

  /**
   * SPA 导航处理：去抖后重放解锁（路由变化常伴随大规模 DOM 重建，合并短时多次触发）
   */
  handleSPANavigation() {
    const currentUrl = location.href;
    if (currentUrl === this.lastKnownUrl) return;
    this.lastKnownUrl = currentUrl;

    if (!this.isEnabled) return;

    clearTimeout(this.spaCheckTimer);
    this.spaCheckTimer = setTimeout(() => {
      console.log('SPA navigation detected, re-applying unlock:', currentUrl);
      // SPA 重渲染可能在已处理过的元素上重挂限制，清空去重缓存以允许重新处理
      this.processedElements = new WeakSet();
      this.enableCopyPaste();
    }, 300);
  }

  /**
   * 允许默认行为的事件处理器
   */
  allowDefaultHandler = (event) => {
    // 仅 contextmenu 维持捕获阻断：注入前已注册的站点定制菜单处理器若执行，
    // 其 preventDefault 会被 injector 中和，导致定制菜单与原生菜单双弹；
    // 阻断传播可保证原生菜单唯一弹出（代价是 B站类定制菜单失效，待站点排除列表兜底）。
    // 其余事件不再阻断传播——preventDefault 中和由 injector 运行时重写负责，
    // 此处阻断与 injector 冗余，且会让事件到不了站点目标阶段处理器（B站实测误伤）
    if (event.type === 'contextmenu') {
      event.stopPropagation();
    }
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

    await this.applyCurrentState();
    this.notifyStateListeners();

    return { success: true, enabled: this.isEnabled };
  }

  /**
   * 处理复制功能切换
   */
  async handleCopyToggle(data) {
    const newState = data?.enabled ?? !this.copyEnabled;
    this.copyEnabled = newState;

    // 重新应用设置
    await this.applyCurrentState();
    this.notifyStateListeners();

    return { success: true, copyEnabled: this.copyEnabled };
  }

  /**
   * 处理粘贴功能切换
   */
  async handlePasteToggle(data) {
    const newState = data?.enabled ?? !this.pasteEnabled;
    this.pasteEnabled = newState;

    // 重新应用设置
    await this.applyCurrentState();
    this.notifyStateListeners();

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

    await this.applyCurrentState();
    this.notifyStateListeners();
    
    console.log('Force mode enabled');
    return { success: true, forceMode: true };
  }

  /**
   * 处理禁用强力模式
   */
  async handleDisableForceMode() {
    this.forceMode = false;
    
    await this.applyCurrentState();
    this.notifyStateListeners();
    
    console.log('Force mode disabled');
    return { success: true, forceMode: false };
  }

  /**
   * 处理状态更新
   */
  async handleUpdateStatus(data) {
    if (data.changes) {
      // 处理存储变化
      const changes = data.changes;
      let stateChanged = false;

      if (changes[StorageUtils.STORAGE_KEYS.PLUGIN_ENABLED]) {
        this.isEnabled = changes[StorageUtils.STORAGE_KEYS.PLUGIN_ENABLED].newValue;
        stateChanged = true;
      }

      if (changes[StorageUtils.STORAGE_KEYS.FORCE_MODE]) {
        this.forceMode = changes[StorageUtils.STORAGE_KEYS.FORCE_MODE].newValue;
        stateChanged = true;
      }

      if (stateChanged) {
        await this.applyCurrentState();
        this.notifyStateListeners();
      }
    }

    return { success: true };
  }

  /**
   * 状态更新队列处理
   */
  async queueStateUpdate(type, data) {
    return new Promise((resolve, reject) => {
      this.stateUpdateQueue.push({
        type,
        data,
        resolve,
        reject,
        timestamp: Date.now()
      });

      this.processStateQueue();
    });
  }

  /**
   * 处理状态更新队列
   */
  async processStateQueue() {
    if (this.isProcessingQueue || this.stateUpdateQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.stateUpdateQueue.length > 0) {
        const update = this.stateUpdateQueue.shift();
        
        try {
          let result;
          switch (update.type) {
            case 'UPDATE_STATUS':
              result = await this.handleUpdateStatus(update.data);
              break;
            case 'TOGGLE_PLUGIN':
              result = await this.handleTogglePlugin(update.data);
              break;
            case 'COPY_TOGGLE':
              result = await this.handleCopyToggle(update.data);
              break;
            case 'PASTE_TOGGLE':
              result = await this.handlePasteToggle(update.data);
              break;
            case 'FORCE_MODE_ENABLE':
              result = await this.handleEnableForceMode();
              break;
            case 'FORCE_MODE_DISABLE':
              result = await this.handleDisableForceMode();
              break;
            default:
              throw new Error(`Unknown update type: ${update.type}`);
          }
          
          update.resolve(result);
        } catch (error) {
          console.error(`Failed to process state update ${update.type}:`, error);
          update.reject(error);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * 应用当前状态
   */
  async applyCurrentState() {
    try {
      if (this.isEnabled) {
        this.enableCopyPaste();
      } else {
        this.disableCopyPaste();
      }
      
      console.log('Current state applied:', {
        isEnabled: this.isEnabled,
        copyEnabled: this.copyEnabled,
        pasteEnabled: this.pasteEnabled,
        forceMode: this.forceMode
      });
    } catch (error) {
      console.error('Failed to apply current state:', error);
      throw error;
    }
  }

  /**
   * 设置状态监听器
   */
  setupStateListeners() {
    // 监听来自Background的状态广播
    this.addStateListener((state) => {
      console.log('State change detected:', state);
    });
  }

  /**
   * 添加状态监听器
   */
  addStateListener(listener) {
    this.stateListeners.add(listener);
  }

  /**
   * 移除状态监听器
   */
  removeStateListener(listener) {
    this.stateListeners.delete(listener);
  }

  /**
   * 通知状态监听器
   */
  notifyStateListeners() {
    const currentState = {
      isEnabled: this.isEnabled,
      copyEnabled: this.copyEnabled,
      pasteEnabled: this.pasteEnabled,
      forceMode: this.forceMode,
      timestamp: Date.now()
    };

    this.stateListeners.forEach(listener => {
      try {
        listener(currentState);
      } catch (error) {
        console.error('State listener error:', error);
      }
    });
  }

  /**
   * 处理状态广播
   */
  async handleStateBroadcast(data) {
    try {
      if (data && this.validateState(data)) {
        const oldState = {
          isEnabled: this.isEnabled,
          copyEnabled: this.copyEnabled,
          pasteEnabled: this.pasteEnabled,
          forceMode: this.forceMode
        };

        this.updateLocalState(data);
        
        // 只在状态真正改变时应用
        if (JSON.stringify(oldState) !== JSON.stringify(data)) {
          await this.applyCurrentState();
          this.notifyStateListeners();
          console.log('State updated from broadcast:', data);
        }
        
        return { success: true };
      } else {
        console.warn('Invalid state broadcast received:', data);
        return { success: false, error: 'Invalid state data' };
      }
    } catch (error) {
      console.error('Failed to handle state broadcast:', error);
      return { success: false, error: error.message };
    }
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
   * 处理获取页面状态
   */
  async handleGetPageStatus(data) {
    try {
      // 检测当前页面限制
      const restrictions = this.detectRestrictions();
      
      return {
        success: true,
        status: {
          isEnabled: this.isEnabled,
          copyEnabled: this.copyEnabled,
          pasteEnabled: this.pasteEnabled,
          forceMode: this.forceMode,
          restrictions,
          url: window.location.href,
          domain: window.location.hostname,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      console.error('Failed to get page status:', error);
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

    // 清理状态更新队列
    this.stateUpdateQueue.forEach(update => {
      update.reject(new Error('Manager is being cleaned up'));
    });
    this.stateUpdateQueue = [];
    
    // 清理状态监听器
    this.stateListeners.clear();
    
    // 清理定时器
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }

    this.disableCopyPaste();
    
    console.log('CopyPasteManager cleaned up');
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