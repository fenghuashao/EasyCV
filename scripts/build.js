const fs = require('fs');
const path = require('path');

/**
 * EasyCV 构建脚本
 * 将源文件复制到 dist 目录，准备发布
 */

class Builder {
  constructor() {
    this.sourceDir = path.resolve(__dirname, '..');
    this.distDir = path.resolve(__dirname, '..', 'dist');
    this.filesToCopy = [
      'manifest.json',
      'background/',
      'content/',
      'popup/',
      'options/',
      'utils/',
      'icons/'
    ];
  }

  /**
   * 确保目录存在
   */
  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 创建目录: ${dir}`);
    }
  }

  /**
   * 复制文件
   */
  copyFile(src, dest) {
    this.ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    console.log(`📄 复制文件: ${path.relative(this.sourceDir, src)} -> ${path.relative(this.sourceDir, dest)}`);
  }

  /**
   * 复制目录
   */
  copyDir(src, dest) {
    this.ensureDir(dest);
    
    const items = fs.readdirSync(src);
    
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      
      const stat = fs.statSync(srcPath);
      
      if (stat.isDirectory()) {
        this.copyDir(srcPath, destPath);
      } else {
        this.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * 清理构建目录
   */
  clean() {
    if (fs.existsSync(this.distDir)) {
      fs.rmSync(this.distDir, { recursive: true, force: true });
      console.log(`🧹 清理目录: ${this.distDir}`);
    }
  }

  /**
   * 验证manifest.json
   */
  validateManifest() {
    const manifestPath = path.join(this.sourceDir, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      throw new Error('❌ manifest.json 文件不存在');
    }
    
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      // 验证必要字段
      const requiredFields = ['name', 'version', 'manifest_version'];
      for (const field of requiredFields) {
        if (!manifest[field]) {
          throw new Error(`❌ manifest.json 缺少必要字段: ${field}`);
        }
      }
      
      console.log(`✅ Manifest 验证通过 - ${manifest.name} v${manifest.version}`);
      return manifest;
    } catch (error) {
      throw new Error(`❌ manifest.json 格式错误: ${error.message}`);
    }
  }

  /**
   * 构建项目
   */
  async build() {
    console.log('🚀 开始构建 EasyCV...');
    console.log('=' .repeat(50));
    
    try {
      // 验证manifest
      const manifest = this.validateManifest();
      
      // 清理旧的构建文件
      this.clean();
      
      // 创建dist目录
      this.ensureDir(this.distDir);
      
      // 复制文件和目录
      for (const item of this.filesToCopy) {
        const srcPath = path.join(this.sourceDir, item);
        const destPath = path.join(this.distDir, item);
        
        if (!fs.existsSync(srcPath)) {
          console.log(`⚠️  跳过不存在的文件/目录: ${item}`);
          continue;
        }
        
        const stat = fs.statSync(srcPath);
        
        if (stat.isDirectory()) {
          this.copyDir(srcPath, destPath);
        } else {
          this.copyFile(srcPath, destPath);
        }
      }
      
      // 生成构建信息
      const buildInfo = {
        version: manifest.version,
        buildTime: new Date().toISOString(),
        buildNumber: Date.now()
      };
      
      fs.writeFileSync(
        path.join(this.distDir, 'build-info.json'),
        JSON.stringify(buildInfo, null, 2)
      );
      
      console.log('=' .repeat(50));
      console.log(`✅ 构建完成!`);
      console.log(`📦 版本: ${manifest.version}`);
      console.log(`📁 输出目录: ${this.distDir}`);
      console.log(`⏰ 构建时间: ${buildInfo.buildTime}`);
      
    } catch (error) {
      console.error('❌ 构建失败:', error.message);
      process.exit(1);
    }
  }
}

// 执行构建
if (require.main === module) {
  const builder = new Builder();
  builder.build();
}

module.exports = Builder;