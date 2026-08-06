/**
 * 监控和日志管理器
 * 负责状态变更日志记录、性能监控和健康检查
 */
class MonitoringManager {
  constructor(stateManager = null) {
    this.stateManager = stateManager;
    // 日志配置
    this.maxLogEntries = 1000; // 最大日志条目数
    this.logRotationSize = 500; // 日志轮转大小
    this.logs = [];
    
    // 性能监控
    this.performanceMetrics = {
      stateChanges: 0,
      errors: 0,
      warnings: 0,
      averageResponseTime: 0,
      lastHealthCheck: null
    };
    
    // 健康检查配置
    this.healthCheckInterval = 5 * 60 * 1000; // 5分钟
    this.healthCheckTimer = null;
    
    // 异常检测
    this.errorThreshold = 10; // 错误阈值
    this.warningThreshold = 5; // 警告阈值
    this.responseTimeThreshold = 1000; // 响应时间阈值(ms)
    
    this.startHealthCheck();
  }

  /**
   * 记录状态变更日志
   * @param {string} action - 操作类型
   * @param {Object} details - 详细信息
   * @param {string} level - 日志级别 (info, warn, error)
   */
  logStateChange(action, details = {}, level = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      action,
      details: JSON.parse(JSON.stringify(details)), // 深拷贝
      id: this.generateLogId()
    };

    this.logs.push(logEntry);
    this.performanceMetrics.stateChanges++;
    
    // 更新错误和警告计数
    if (level === 'error') {
      this.performanceMetrics.errors++;
    } else if (level === 'warn') {
      this.performanceMetrics.warnings++;
    }

    // 检查是否需要日志轮转
    this.checkLogRotation();
    
    // 输出到控制台（开发模式）
    if (this.isDebugMode()) {
      console.log(`[StateMonitor] ${level.toUpperCase()}: ${action}`, details);
    }
  }

  /**
   * 记录性能指标
   * @param {string} operation - 操作名称
   * @param {number} duration - 执行时间(ms)
   * @param {boolean} success - 是否成功
   */
  recordPerformance(operation, duration, success = true) {
    // 更新平均响应时间
    const currentAvg = this.performanceMetrics.averageResponseTime;
    const totalOps = this.performanceMetrics.stateChanges;
    this.performanceMetrics.averageResponseTime = 
      (currentAvg * (totalOps - 1) + duration) / totalOps;

    // 检查响应时间是否超过阈值
    if (duration > this.responseTimeThreshold) {
      this.logStateChange('performance_warning', {
        operation,
        duration,
        threshold: this.responseTimeThreshold
      }, 'warn');
    }

    // 记录失败操作
    if (!success) {
      this.logStateChange('operation_failed', {
        operation,
        duration
      }, 'error');
    }
  }

  /**
   * 查询日志
   * @param {Object} filters - 过滤条件
   * @returns {Array} 匹配的日志条目
   */
  queryLogs(filters = {}) {
    let filteredLogs = [...this.logs];

    // 按级别过滤
    if (filters.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filters.level);
    }

    // 按操作类型过滤
    if (filters.action) {
      filteredLogs = filteredLogs.filter(log => 
        log.action.includes(filters.action)
      );
    }

    // 按时间范围过滤
    if (filters.startTime) {
      const startTime = new Date(filters.startTime);
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) >= startTime
      );
    }

    if (filters.endTime) {
      const endTime = new Date(filters.endTime);
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) <= endTime
      );
    }

    // 限制返回数量
    if (filters.limit) {
      filteredLogs = filteredLogs.slice(-filters.limit);
    }

    return filteredLogs;
  }

  /**
   * 执行健康检查
   * @returns {Object} 健康检查报告
   */
  async performHealthCheck() {
    const now = Date.now();
    const report = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      issues: [],
      metrics: { ...this.performanceMetrics }
    };

    // 检查错误率
    const totalOps = this.performanceMetrics.stateChanges;
    const errorRate = totalOps > 0 ? (this.performanceMetrics.errors / totalOps) * 100 : 0;
    
    if (errorRate > 10) { // 错误率超过10%
      report.status = 'unhealthy';
      report.issues.push({
        type: 'high_error_rate',
        severity: 'critical',
        message: `错误率过高: ${errorRate.toFixed(2)}%`,
        value: errorRate
      });
    } else if (errorRate > 5) { // 错误率超过5%
      report.status = 'warning';
      report.issues.push({
        type: 'elevated_error_rate',
        severity: 'warning',
        message: `错误率偏高: ${errorRate.toFixed(2)}%`,
        value: errorRate
      });
    }

    // 检查平均响应时间
    const avgResponseTime = this.performanceMetrics.averageResponseTime;
    if (avgResponseTime > this.responseTimeThreshold) {
      const severity = avgResponseTime > this.responseTimeThreshold * 2 ? 'critical' : 'warning';
      if (severity === 'critical') report.status = 'unhealthy';
      else if (report.status === 'healthy') report.status = 'warning';
      
      report.issues.push({
        type: 'slow_response',
        severity,
        message: `平均响应时间过长: ${avgResponseTime.toFixed(2)}ms`,
        value: avgResponseTime
      });
    }

    // 检查内存使用（如果有StateManager实例）
    if (this.stateManager) {
      const memoryUsage = this.stateManager.getMemoryUsage();
      const memoryKB = parseFloat(memoryUsage.estimatedKB);
      
      if (memoryKB > 1024) { // 超过1MB
        report.status = 'warning';
        report.issues.push({
          type: 'high_memory_usage',
          severity: 'warning',
          message: `内存使用过高: ${memoryKB}KB`,
          value: memoryKB
        });
      }
    }

    this.performanceMetrics.lastHealthCheck = now;
    
    // 记录健康检查结果
    this.logStateChange('health_check', {
      status: report.status,
      issueCount: report.issues.length,
      errorRate: errorRate.toFixed(2)
    }, report.status === 'healthy' ? 'info' : 'warn');

    return report;
  }

  /**
   * 获取性能报告
   * @returns {Object} 性能报告
   */
  getPerformanceReport() {
    const recentLogs = this.queryLogs({ limit: 100 });
    const errorLogs = recentLogs.filter(log => log.level === 'error');
    const warnLogs = recentLogs.filter(log => log.level === 'warn');

    return {
      timestamp: new Date().toISOString(),
      totalOperations: this.performanceMetrics.stateChanges,
      totalErrors: this.performanceMetrics.errors,
      totalWarnings: this.performanceMetrics.warnings,
      averageResponseTime: this.performanceMetrics.averageResponseTime,
      recentErrorRate: recentLogs.length > 0 ? 
        (errorLogs.length / recentLogs.length * 100).toFixed(2) : 0,
      recentWarningRate: recentLogs.length > 0 ? 
        (warnLogs.length / recentLogs.length * 100).toFixed(2) : 0,
      logCount: this.logs.length,
      lastHealthCheck: this.performanceMetrics.lastHealthCheck
    };
  }

  /**
   * 清理旧日志
   */
  clearOldLogs() {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7天前
    this.logs = this.logs.filter(log => 
      new Date(log.timestamp).getTime() > cutoffTime
    );
  }

  /**
   * 重置性能指标
   */
  resetMetrics() {
    this.performanceMetrics = {
      stateChanges: 0,
      errors: 0,
      warnings: 0,
      averageResponseTime: 0,
      lastHealthCheck: null
    };
    this.logs = [];
  }

  /**
   * 启动健康检查定时器
   */
  startHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckInterval);
  }

  /**
   * 停止健康检查
   */
  stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * 检查日志轮转
   */
  checkLogRotation() {
    if (this.logs.length > this.maxLogEntries) {
      // 保留最新的日志条目
      const keepCount = this.maxLogEntries - this.logRotationSize;
      this.logs = this.logs.slice(-keepCount);
      
      this.logStateChange('log_rotation', {
        removedCount: this.logs.length - keepCount,
        remainingCount: keepCount
      }, 'info');
    }
  }

  /**
   * 生成日志ID
   * @returns {string} 唯一日志ID
   */
  generateLogId() {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 检查是否为调试模式
   * @returns {boolean} 是否为调试模式
   */
  isDebugMode() {
    // Service Worker 环境无 process/localStorage 全局，引用即抛 ReferenceError，
    // 会中断所有经 logStateChange 的状态写入路径；调试输出默认关闭，
    // 后续如需开启应改从 chrome.storage 的 debugMode 设置读取
    return false;
  }

  /**
   * 导出日志数据
   * @param {Object} options - 导出选项
   * @returns {string} JSON格式的日志数据
   */
  exportLogs(options = {}) {
    const logs = this.queryLogs(options);
    const exportData = {
      exportTime: new Date().toISOString(),
      totalLogs: logs.length,
      performanceMetrics: this.performanceMetrics,
      logs: logs
    };
    
    return JSON.stringify(exportData, null, 2);
  }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MonitoringManager;
} else if (typeof self !== 'undefined') {
  // Service Worker 环境
  self.MonitoringManager = MonitoringManager;
} else if (typeof window !== 'undefined') {
  // 浏览器环境
  window.MonitoringManager = MonitoringManager;
}
