/**
 * 国际化工具类
 * 封装 chrome.i18n，环境无关（service worker / popup / options 均可使用）
 */
class I18nUtils {
  /**
   * 获取消息（带兜底）
   * @param {string} key - 消息 key
   * @param {string|string[]} [substitutions] - 占位符替换值
   * @param {string} [fallback] - 消息缺失时的兜底文案（缺省返回 key 本身，便于排查漏配）
   * @returns {string} 本地化文案
   */
  static t(key, substitutions, fallback) {
    try {
      const message = chrome.i18n.getMessage(key, substitutions);
      if (message) return message;
    } catch (error) {
      console.warn(`I18nUtils: failed to get message "${key}":`, error);
    }
    return fallback !== undefined ? fallback : key;
  }

  /**
   * 将 data-i18n 系列属性应用到页面（保留 HTML 中的原始文案作为兜底）
   * - data-i18n: 元素文本
   * - data-i18n-placeholder: 输入框占位文本
   * - data-i18n-title: title 属性（悬停提示）
   * - data-i18n-aria-label: 无障碍名称
   * @param {ParentNode} [root] - 扫描根节点，默认 document
   */
  static applyToPage(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(element => {
      const message = this.t(element.getAttribute('data-i18n'), undefined, '');
      if (message) element.textContent = message;
    });

    root.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const message = this.t(element.getAttribute('data-i18n-placeholder'), undefined, '');
      if (message) element.placeholder = message;
    });

    root.querySelectorAll('[data-i18n-title]').forEach(element => {
      const message = this.t(element.getAttribute('data-i18n-title'), undefined, '');
      if (message) element.title = message;
    });

    root.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
      const message = this.t(element.getAttribute('data-i18n-aria-label'), undefined, '');
      if (message) element.setAttribute('aria-label', message);
    });

    // 使用实际消息包的语言。未支持的 UI 语言由 Chrome 回退到英文，
    // 不能用 getUILanguage() 把英文内容标记成其他语言。
    try {
      document.documentElement.lang = this.t('ui_language', undefined, 'en');
      document.documentElement.dir = 'ltr';
    } catch (error) {
      // 非关键路径，忽略
    }
  }
}

// 兼容多环境导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = I18nUtils;
} else if (typeof self !== 'undefined') {
  self.I18nUtils = I18nUtils;
}
