const fs = require('fs');
const path = require('path');

/**
 * EasyCV 清理脚本
 * 清理构建文件、临时文件和缓存
 */

class Cleaner {
  constructor() {
    this.sourceDir = path.resolve(__dirname, '..');
    this.dirsToClean = [
      'dist',
      'node_modules/.cache',
      '.tmp'
    ];
    this.filesToClean = [
      'build-info.json',
      '*.log',
      '.DS_Store',
      'Thumbs.db'
    ];
  }

  /**
   * 删除目录
   */
  removeDir(dirPath) {
    if (fs.existsSync(dirPath)) {
      const stat = fs.statSync(dirPath);
      if (stat.isDirectory()) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        console.log(`🗑️  删除目录: ${path.relative(this.sourceDir, dirPath)}`);
        return true;
      }
    }
    return false;
  }

  /**
   * 删除文件
   */
  async removeFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return 0;
      }
      const stats = fs.statSync(filePath);
      const size = stats.size;
      fs.unlinkSync(filePath);
      console.log(`🗑️  删除文件: ${path.relative(this.sourceDir, filePath)}`);
      return size;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      return 0;
    }
  }

  /**
   * 查找匹配的文件
   */
  findMatchingFiles(dir, pattern) {
    const files = [];
    
    if (!fs.existsSync(dir)) {
      return files;
    }
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isFile()) {
        // 简单的通配符匹配
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          if (regex.test(item)) {
            files.push(itemPath);
          }
        } else if (item === pattern) {
          files.push(itemPath);
        }
      } else if (stat.isDirectory() && !item.startsWith('.')) {
        // 递归搜索子目录
        files.push(...this.findMatchingFiles(itemPath, pattern));
      }
    }
    
    return files;
  }

  /**
   * 计算清理的文件大小
   */
  calculateSize(paths) {
    let totalSize = 0;
    
    for (const itemPath of paths) {
      if (fs.existsSync(itemPath)) {
        const stat = fs.statSync(itemPath);
        if (stat.isFile()) {
          totalSize += stat.size;
        } else if (stat.isDirectory()) {
          totalSize += this.calculateDirSize(itemPath);
        }
      }
    }
    
    return totalSize;
  }

  /**
   * 计算目录大小
   */
  calculateDirSize(dirPath) {
    let totalSize = 0;
    
    if (!fs.existsSync(dirPath)) {
      return 0;
    }
    
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        if (fs.existsSync(itemPath)) {
          const stats = fs.statSync(itemPath);
          
          if (stats.isDirectory()) {
            totalSize += this.calculateDirSize(itemPath);
          } else {
            totalSize += stats.size;
          }
        }
      }
    } catch (error) {
      // 忽略访问错误
    }
    
    return totalSize;
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 执行清理
   */
  async clean(options = {}) {
    console.log('🧹 开始清理 EasyCV...');
    console.log('=' .repeat(50));
    
    const itemsToClean = [];
    let cleanedCount = 0;
    
    try {
      // 收集要清理的目录
      for (const dir of this.dirsToClean) {
        const dirPath = path.resolve(this.sourceDir, dir);
        if (fs.existsSync(dirPath)) {
          itemsToClean.push(dirPath);
        }
      }
      
      // 收集要清理的文件
      for (const filePattern of this.filesToClean) {
        const matchingFiles = this.findMatchingFiles(this.sourceDir, filePattern);
        itemsToClean.push(...matchingFiles);
      }
      
      if (itemsToClean.length === 0) {
        console.log('✨ 没有需要清理的文件');
        return;
      }
      
      // 计算总大小
      const totalSize = this.calculateSize(itemsToClean);
      
      console.log(`📋 发现 ${itemsToClean.length} 个项目需要清理`);
      console.log(`💾 预计释放空间: ${this.formatFileSize(totalSize)}`);
      
      if (options.dryRun) {
        console.log('\n🔍 预览模式 - 将要清理的项目:');
        for (const item of itemsToClean) {
          const stat = fs.statSync(item);
          const relativePath = path.relative(this.sourceDir, item);
          console.log(`   ${stat.isDirectory() ? '📁' : '📄'} ${relativePath} (${this.formatFileSize(stat.isDirectory() ? this.calculateDirSize(item) : stat.size)})`);
        }
        return;
      }
      
      console.log('\n🗑️  正在清理...');
      
      // 执行清理
      for (const item of itemsToClean) {
        try {
          const stat = fs.statSync(item);
          if (stat.isDirectory()) {
            if (this.removeDir(item)) {
              cleanedCount++;
            }
          } else {
            if (await this.removeFile(item)) {
              cleanedCount++;
            }
          }
        } catch (error) {
          console.error(`❌ 清理 ${path.relative(this.sourceDir, item)} 失败: ${error.message}`);
          // 继续清理其他项目，不中断整个流程
        }
      }
      
      console.log('=' .repeat(50));
      console.log(`✅ 清理完成!`);
      console.log(`🗑️  清理项目: ${cleanedCount}/${itemsToClean.length}`);
      console.log(`💾 释放空间: ${this.formatFileSize(totalSize)}`);
      
    } catch (error) {
      console.error('❌ 清理失败:', error.message);
      process.exit(1);
    }
  }
}

// 执行清理
if (require.main === module) {
  const cleaner = new Cleaner();
  
  // 检查命令行参数
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run') || args.includes('-n')
  };
  
  if (options.dryRun) {
    console.log('🔍 运行预览模式...');
  }
  
  cleaner.clean(options);
}

module.exports = Cleaner;