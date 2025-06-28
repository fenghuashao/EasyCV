/**
 * 状态变更确认管理器
 * 实现可靠的状态变更确认机制，确保状态更新的可靠性
 */
class StateConfirmationManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    
    // 请求追踪
    this.pendingRequests = new Map(); // requestId -> RequestInfo
    this.requestHistory = new Map(); // requestId -> HistoryInfo
    this.failedRequests = new Map(); // requestId -> FailureInfo
    
    // 配置
    this.DEFAULT_TIMEOUT = 5000; // 5秒超时
    this.MAX_RETRY_COUNT = 3; // 最大重试次数
    this.RETRY_DELAY = 1000; // 重试延迟（毫秒）
    this.HISTORY_RETENTION = 24 * 60 * 60 * 1000; // 24小时历史保留
    
    // 统计信息
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeoutRequests: 0,
      retriedRequests: 0
    };
    
    // 启动定期清理
    this.startCleanupTimer();
  }

  /**
   * 生成唯一的请求ID
   * @param {string} operation - 操作类型
   * @returns {string} 请求ID
   */
  generateRequestId(operation = 'unknown') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${operation}_${timestamp}_${random}`;
  }

  /**
   * 执行带确认的状态变更
   * @param {Object} updates - 状态更新
   * @param {Object} options - 选项
   * @param {string} options.operation - 操作类型
   * @param {number} options.timeout - 超时时间
   * @param {boolean} options.autoRetry - 是否自动重试
   * @param {Function} options.onProgress - 进度回调
   * @returns {Promise<Object>} 确认结果
   */
  async executeWithConfirmation(updates, options = {}) {
    const {
      operation = 'state_update',
      timeout = this.DEFAULT_TIMEOUT,
      autoRetry = true,
      onProgress = null
    } = options;

    const requestId = this.generateRequestId(operation);
    
    try {
      this.stats.totalRequests++;
      
      // 创建请求信息
      const requestInfo = {
        requestId,
        operation,
        updates,
        startTime: Date.now(),
        timeout,
        autoRetry,
        retryCount: 0,
        status: 'pending',
        onProgress
      };
      
      this.pendingRequests.set(requestId, requestInfo);
      
      // 执行状态更新
      const result = await this.performStateUpdateWithTracking(requestInfo);
      
      // 记录成功
      this.recordSuccess(requestId, result);
      this.stats.successfulRequests++;
      
      return {
        success: true,
        requestId,
        result,
        duration: Date.now() - requestInfo.startTime
      };
      
    } catch (error) {
      // 记录失败
      this.recordFailure(requestId, error);
      
      // 尝试自动重试
      if (autoRetry && this.shouldRetry(requestId, error)) {
        return await this.retryRequest(requestId);
      }
      
      this.stats.failedRequests++;
      
      return {
        success: false,
        requestId,
        error: error.message,
        duration: Date.now() - (this.pendingRequests.get(requestId)?.startTime || Date.now())
      };
    } finally {
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * 执行带追踪的状态更新
   * @param {Object} requestInfo - 请求信息
   * @returns {Promise<Object>} 更新结果
   */
  async performStateUpdateWithTracking(requestInfo) {
    const { requestId, updates, timeout, onProgress } = requestInfo;
    
    // 更新状态为执行中
    requestInfo.status = 'executing';
    onProgress?.({ status: 'executing', requestId });
    
    // 执行状态更新
    const updatePromise = this.stateManager.updatePluginState(updates, requestId);
    
    // 设置超时处理
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
    });
    
    // 等待更新完成或超时
    const result = await Promise.race([updatePromise, timeoutPromise]);
    
    // 验证状态更新是否成功
    await this.verifyStateUpdate(requestId, updates, result);
    
    requestInfo.status = 'completed';
    onProgress?.({ status: 'completed', requestId, result });
    
    return result;
  }

  /**
   * 验证状态更新是否成功
   * @param {string} requestId - 请求ID
   * @param {Object} expectedUpdates - 期望的更新
   * @param {Object} actualResult - 实际结果
   */
  async verifyStateUpdate(requestId, expectedUpdates, actualResult) {
    // 获取当前状态
    const currentState = await this.stateManager.getPluginState();
    
    // 验证关键字段是否正确更新
    for (const [key, expectedValue] of Object.entries(expectedUpdates)) {
      if (key === 'userSettings') {
        // 验证用户设置
        for (const [settingKey, settingValue] of Object.entries(expectedValue)) {
          if (currentState.userSettings[settingKey] !== settingValue) {
            throw new Error(`State verification failed: ${settingKey} expected ${settingValue}, got ${currentState.userSettings[settingKey]}`);
          }
        }
      } else if (currentState[key] !== expectedValue) {
        throw new Error(`State verification failed: ${key} expected ${expectedValue}, got ${currentState[key]}`);
      }
    }
  }

  /**
   * 判断是否应该重试
   * @param {string} requestId - 请求ID
   * @param {Error} error - 错误信息
   * @returns {boolean} 是否应该重试
   */
  shouldRetry(requestId, error) {
    const requestInfo = this.pendingRequests.get(requestId);
    if (!requestInfo) return false;
    
    // 检查重试次数
    if (requestInfo.retryCount >= this.MAX_RETRY_COUNT) {
      return false;
    }
    
    // 检查错误类型
    const retryableErrors = [
      'timeout',
      'network',
      'storage',
      'temporary'
    ];
    
    return retryableErrors.some(type => 
      error.message.toLowerCase().includes(type)
    );
  }

  /**
   * 重试请求
   * @param {string} requestId - 请求ID
   * @returns {Promise<Object>} 重试结果
   */
  async retryRequest(requestId) {
    const requestInfo = this.pendingRequests.get(requestId);
    if (!requestInfo) {
      throw new Error(`Request ${requestId} not found for retry`);
    }
    
    requestInfo.retryCount++;
    this.stats.retriedRequests++;
    
    // 等待重试延迟
    await new Promise(resolve => 
      setTimeout(resolve, this.RETRY_DELAY * requestInfo.retryCount)
    );
    
    requestInfo.onProgress?.({ 
      status: 'retrying', 
      requestId, 
      retryCount: requestInfo.retryCount 
    });
    
    try {
      const result = await this.performStateUpdateWithTracking(requestInfo);
      
      this.recordSuccess(requestId, result);
      this.stats.successfulRequests++;
      
      return {
        success: true,
        requestId,
        result,
        retryCount: requestInfo.retryCount,
        duration: Date.now() - requestInfo.startTime
      };
      
    } catch (error) {
      // 如果还能重试，继续重试
      if (this.shouldRetry(requestId, error)) {
        return await this.retryRequest(requestId);
      }
      
      // 重试失败
      this.recordFailure(requestId, error);
      this.stats.failedRequests++;
      
      throw error;
    }
  }

  /**
   * 记录成功操作
   * @param {string} requestId - 请求ID
   * @param {Object} result - 操作结果
   */
  recordSuccess(requestId, result) {
    const requestInfo = this.pendingRequests.get(requestId);
    if (!requestInfo) return;
    
    this.requestHistory.set(requestId, {
      ...requestInfo,
      status: 'success',
      result,
      endTime: Date.now(),
      duration: Date.now() - requestInfo.startTime
    });
  }

  /**
   * 记录失败操作
   * @param {string} requestId - 请求ID
   * @param {Error} error - 错误信息
   */
  recordFailure(requestId, error) {
    const requestInfo = this.pendingRequests.get(requestId);
    if (!requestInfo) return;
    
    const failureInfo = {
      ...requestInfo,
      status: 'failed',
      error: error.message,
      errorStack: error.stack,
      endTime: Date.now(),
      duration: Date.now() - requestInfo.startTime
    };
    
    this.requestHistory.set(requestId, failureInfo);
    this.failedRequests.set(requestId, failureInfo);
    
    // 触发失败告警
    this.triggerFailureAlert(failureInfo);
  }

  /**
   * 触发失败告警
   * @param {Object} failureInfo - 失败信息
   */
  triggerFailureAlert(failureInfo) {
    console.error('State update failed:', {
      requestId: failureInfo.requestId,
      operation: failureInfo.operation,
      error: failureInfo.error || 'Unknown error',
      retryCount: failureInfo.retryCount,
      duration: failureInfo.duration
    });
    
    // 如果有错误堆栈，也输出详细信息
    if (failureInfo.errorStack) {
      console.error('Error stack:', failureInfo.errorStack);
    }
    
    // 可以在这里添加更多告警机制
    // 例如：发送到错误监控服务、显示用户通知等
  }

  /**
   * 获取请求状态
   * @param {string} requestId - 请求ID
   * @returns {Object|null} 请求状态
   */
  getRequestStatus(requestId) {
    // 先检查待处理请求
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      return {
        status: pending.status,
        operation: pending.operation,
        retryCount: pending.retryCount,
        duration: Date.now() - pending.startTime
      };
    }
    
    // 再检查历史记录
    const history = this.requestHistory.get(requestId);
    if (history) {
      return {
        status: history.status,
        operation: history.operation,
        retryCount: history.retryCount || 0,
        duration: history.duration
      };
    }
    
    return null;
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const successRate = this.stats.totalRequests > 0 
      ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      successRate: `${successRate}%`,
      pendingRequests: this.pendingRequests.size,
      failedRequestsCount: this.failedRequests.size
    };
  }

  /**
   * 获取失败的请求列表
   * @param {number} limit - 限制数量
   * @returns {Array} 失败请求列表
   */
  getFailedRequests(limit = 10) {
    return Array.from(this.failedRequests.values())
      .sort((a, b) => b.endTime - a.endTime)
      .slice(0, limit);
  }

  /**
   * 清理过期数据
   */
  cleanup() {
    const now = Date.now();
    
    // 清理过期的历史记录
    for (const [requestId, info] of this.requestHistory.entries()) {
      if (now - info.endTime > this.HISTORY_RETENTION) {
        this.requestHistory.delete(requestId);
      }
    }
    
    // 清理过期的失败记录
    for (const [requestId, info] of this.failedRequests.entries()) {
      if (now - info.endTime > this.HISTORY_RETENTION) {
        this.failedRequests.delete(requestId);
      }
    }
  }

  /**
   * 启动定期清理定时器
   */
  startCleanupTimer() {
    // 每小时清理一次
    setInterval(() => {
      try {
        this.cleanup();
      } catch (error) {
        console.error('StateConfirmationManager cleanup failed:', error);
      }
    }, 60 * 60 * 1000); // 1小时
  }

  /**
   * 强制取消请求
   * @param {string} requestId - 请求ID
   * @returns {boolean} 是否成功取消
   */
  cancelRequest(requestId) {
    const requestInfo = this.pendingRequests.get(requestId);
    if (!requestInfo) return false;
    
    requestInfo.status = 'cancelled';
    this.pendingRequests.delete(requestId);
    
    this.recordFailure(requestId, new Error('Request cancelled'));
    
    return true;
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeoutRequests: 0,
      retriedRequests: 0
    };
  }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StateConfirmationManager;
} else if (typeof window !== 'undefined') {
  window.StateConfirmationManager = StateConfirmationManager;
}