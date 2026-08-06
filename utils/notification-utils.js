/**
 * 通知工具类
 * 处理插件内的通知显示
 */
class NotificationUtils {
  /**
   * 显示通知消息
   * @param {string} message - 通知消息
   * @param {string} type - 通知类型 ('success', 'error', 'warning', 'info')
   * @param {number} duration - 显示时长（毫秒），默认3000ms
   */
  static show(message, type = 'info', duration = 3000) {
    const notification = document.getElementById('notification');
    const messageElement = notification?.querySelector('.notification-message');
    
    if (!notification || !messageElement) {
      console.warn('Notification elements not found, falling back to console');
      console.log(`[${type.toUpperCase()}] ${message}`);
      return;
    }

    // 清除之前的类名
    notification.className = 'notification';
    
    // 设置消息内容
    messageElement.textContent = message;
    
    // 添加类型样式
    notification.classList.add(type);
    
    // 显示通知
    notification.classList.add('show');
    
    // 自动隐藏
    setTimeout(() => {
      this.hide();
    }, duration);
  }

  /**
   * 隐藏通知
   */
  static hide() {
    const notification = document.getElementById('notification');
    if (notification) {
      notification.classList.remove('show');
    }
  }

  /**
   * 显示成功通知
   * @param {string} message - 通知消息
   * @param {number} duration - 显示时长
   */
  static success(message, duration = 3000) {
    this.show(message, 'success', duration);
  }

  /**
   * 显示错误通知
   * @param {string} message - 通知消息
   * @param {number} duration - 显示时长
   */
  static error(message, duration = 5000) {
    this.show(message, 'error', duration);
  }

  /**
   * 显示警告通知
   * @param {string} message - 通知消息
   * @param {number} duration - 显示时长
   */
  static warning(message, duration = 4000) {
    this.show(message, 'warning', duration);
  }

  /**
   * 显示信息通知
   * @param {string} message - 通知消息
   * @param {number} duration - 显示时长
   */
  static info(message, duration = 3000) {
    this.show(message, 'info', duration);
  }
}

// 导出供其他模块使用
if (typeof window !== 'undefined') {
  window.NotificationUtils = NotificationUtils;
}
