/**
 * DOM操作工具类
 * 提供安全的DOM操作、事件处理、样式修改等功能
 */
class DOMUtils {
  /**
   * 移除元素的事件监听器（安全增强版本）
   * @param {Element} element - 目标元素
   * @param {Array<string>} events - 事件类型数组
   */
  static removeEventListeners(element, events) {
    if (!element || !element.nodeType || !Array.isArray(events)) {
      console.warn('DOMUtils.removeEventListeners: Invalid parameters');
      return;
    }

    try {
      // 检查元素是否仍在DOM中
      if (!element.isConnected) {
        console.warn('DOMUtils.removeEventListeners: Element not connected to DOM');
        return;
      }

      // 检查是否有父节点
      if (!element.parentNode) {
        console.warn('DOMUtils.removeEventListeners: Element has no parent node');
        return;
      }

      // 保存原始元素的引用和位置信息
      const parent = element.parentNode;
      const nextSibling = element.nextSibling;

      // 克隆元素（深度克隆以保持子元素）
      const newElement = element.cloneNode(true);

      // 清理特定事件的内联处理器
      events.forEach(eventType => {
        try {
          const handlerProperty = `on${eventType.toLowerCase()}`;
          if (newElement[handlerProperty]) {
            newElement[handlerProperty] = null;
          }
          if (newElement.hasAttribute(handlerProperty)) {
            newElement.removeAttribute(handlerProperty);
          }
        } catch (error) {
          console.warn(`DOMUtils: Error cleaning ${eventType} handler:`, error);
        }
      });

      // 替换元素
      if (nextSibling) {
        parent.insertBefore(newElement, nextSibling);
      } else {
        parent.appendChild(newElement);
      }
      parent.removeChild(element);

      console.log(`DOMUtils: Successfully removed event listeners for events: ${events.join(', ')}`);
      return newElement;
    } catch (error) {
      console.error('DOMUtils.removeEventListeners: Error occurred:', error);
      return element; // 返回原始元素以防止破坏
    }
  }

  /**
   * 修改元素的CSS属性
   * @param {Element} element - 目标元素
   * @param {Object} styles - 样式对象
   */
  static modifyStyles(element, styles) {
    if (!element || typeof styles !== 'object') return;

    Object.entries(styles).forEach(([property, value]) => {
      try {
        element.style.setProperty(property, value, 'important');
      } catch (error) {
        console.warn(`Failed to set style ${property}:`, error);
      }
    });
  }

  /**
   * 检测文本选择限制
   * @param {Element} element - 检测的元素
   * @returns {Object} 检测结果
   */
  static detectSelectionRestrictions(element = document.body) {
    const restrictions = {
      userSelect: false,
      contextMenu: false,
      selectStart: false,
      dragStart: false,
      copy: false
    };

    // 检查CSS user-select属性
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.userSelect === 'none') {
      restrictions.userSelect = true;
    }

    // 检查是否禁用了右键菜单
    if (element.oncontextmenu === null ||
      element.getAttribute('oncontextmenu') === 'return false') {
      restrictions.contextMenu = true;
    }

    return restrictions;
  }

  /**
   * 恢复元素的原始行为
   * @param {Element} element - 目标元素
   */
  static restoreOriginalBehavior(element) {
    if (!element) return;

    // 恢复文本选择
    this.modifyStyles(element, {
      'user-select': 'text',
      '-webkit-user-select': 'text',
      '-moz-user-select': 'text',
      '-ms-user-select': 'text'
    });

    // 移除禁用属性
    element.removeAttribute('onselectstart');
    element.removeAttribute('ondragstart');
    element.removeAttribute('oncontextmenu');

    // 移除禁用事件监听器
    const events = ['selectstart', 'dragstart', 'contextmenu', 'copy'];
    this.removeEventListeners(element, events);
  }

  /**
   * 递归处理所有子元素
   * @param {Element} rootElement - 根元素
   * @param {Function} callback - 处理函数
   */
  static traverseElements(rootElement, callback) {
    if (!rootElement || typeof callback !== 'function') return;

    // 处理当前元素
    callback(rootElement);

    // 递归处理子元素
    Array.from(rootElement.children).forEach(child => {
      this.traverseElements(child, callback);
    });
  }

  /**
   * 安全地执行DOM操作
   * @param {Function} operation - DOM操作函数
   * @param {string} errorMessage - 错误信息
   */
  static safeExecute(operation, errorMessage = 'DOM operation failed') {
    try {
      return operation();
    } catch (error) {
      console.error(errorMessage, error);
      return null;
    }
  }

  /**
   * 检查元素是否可见
   * @param {Element} element - 目标元素
   * @returns {boolean} 是否可见
   */
  static isElementVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0';
  }

  /**
   * 获取页面中所有文本元素
   * @returns {Array<Element>} 文本元素数组
   */
  static getTextElements() {
    const textSelectors = [
      'p', 'div', 'span', 'article', 'section',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'li', 'td', 'th', 'blockquote', 'pre'
    ];

    const elements = [];
    textSelectors.forEach(selector => {
      const found = document.querySelectorAll(selector);
      elements.push(...Array.from(found));
    });

    return elements.filter(el => this.isElementVisible(el));
  }
}