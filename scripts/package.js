const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

/**
 * EasyCV 打包脚本
 * 将 dist 目录打包成 ZIP 文件，用于发布
 */

class Packager {
  constructor() {
    this.sourceDir = path.resolve(__dirname, '..');
    this.distDir = path.resolve(__dirname, '..', 'dist');
    this.outputDir = path.resolve(__dirname, '..', 'releases');
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
   * 获取版本信息
   */
  getVersionInfo() {
    const manifestPath = path.join(this.distDir, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      throw new Error('❌ 构建目录中未找到 manifest.json，请先运行构建命令');
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return {
      version: manifest.version,
      name: manifest.name
    };
  }

  /**
   * 计算文件大小
   */
  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 创建ZIP包
   */
  async createZip(outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // 最高压缩级别
      });

      output.on('close', () => {
        const size = this.formatFileSize(archive.pointer());
        console.log(`✅ 打包完成: ${path.basename(outputPath)} (${size})`);
        resolve({
          path: outputPath,
          size: archive.pointer()
        });
      });

      output.on('error', reject);
      archive.on('error', reject);

      archive.pipe(output);

      // 添加dist目录中的所有文件
      archive.directory(this.distDir, false);

      archive.finalize();
    });
  }

  /**
   * 生成发布说明
   */
  generateReleaseNotes(versionInfo, packageInfo) {
    const releaseNotes = `# EasyCV v${versionInfo.version} 发布包

## 📦 包信息
- **版本**: ${versionInfo.version}
- **文件名**: ${path.basename(packageInfo.path)}
- **文件大小**: ${this.formatFileSize(packageInfo.size)}
- **打包时间**: ${new Date().toLocaleString('zh-CN')}

## 🚀 安装方法

### Chrome 浏览器
1. 下载 \`${path.basename(packageInfo.path)}\` 文件
2. 解压到本地文件夹
3. 打开 Chrome 浏览器，访问 \`chrome://extensions/\`
4. 开启"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择解压后的文件夹

### Edge 浏览器
1. 下载 \`${path.basename(packageInfo.path)}\` 文件
2. 解压到本地文件夹
3. 打开 Edge 浏览器，访问 \`edge://extensions/\`
4. 开启"开发人员模式"
5. 点击"加载解压缩的扩展"
6. 选择解压后的文件夹

## 📋 功能特性
- ✅ 一键解除网页复制粘贴限制
- ✅ 强力模式深度解除限制
- ✅ 自动开启列表管理
- ✅ 简洁易用的用户界面
- ✅ 支持多种网站类型

## 🔧 技术规格
- **Manifest 版本**: V3
- **支持浏览器**: Chrome 88+, Edge 88+
- **权限要求**: activeTab, storage, scripting

---
*此发布包由自动化脚本生成*
`;

    const notesPath = path.join(this.outputDir, `EasyCV-v${versionInfo.version}-README.md`);
    fs.writeFileSync(notesPath, releaseNotes);
    console.log(`📝 生成发布说明: ${path.basename(notesPath)}`);
    
    return notesPath;
  }

  /**
   * 执行打包
   */
  async package() {
    console.log('📦 开始打包 EasyCV...');
    console.log('=' .repeat(50));
    
    try {
      // 检查dist目录
      if (!fs.existsSync(this.distDir)) {
        throw new Error('❌ 构建目录不存在，请先运行 npm run build');
      }
      
      // 获取版本信息
      const versionInfo = this.getVersionInfo();
      console.log(`📋 准备打包: ${versionInfo.name} v${versionInfo.version}`);
      
      // 确保输出目录存在
      this.ensureDir(this.outputDir);
      
      // 生成文件名
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `EasyCV-v${versionInfo.version}-${timestamp}.zip`;
      const outputPath = path.join(this.outputDir, fileName);
      
      // 如果文件已存在，添加序号
      let finalOutputPath = outputPath;
      let counter = 1;
      while (fs.existsSync(finalOutputPath)) {
        const baseName = path.basename(outputPath, '.zip');
        const dirName = path.dirname(outputPath);
        finalOutputPath = path.join(dirName, `${baseName}-${counter}.zip`);
        counter++;
      }
      
      // 创建ZIP包
      console.log(`🗜️  正在压缩文件...`);
      const packageInfo = await this.createZip(finalOutputPath);
      
      // 生成发布说明
      const notesPath = this.generateReleaseNotes(versionInfo, packageInfo);
      
      console.log('=' .repeat(50));
      console.log(`✅ 打包完成!`);
      console.log(`📦 版本: ${versionInfo.version}`);
      console.log(`📁 输出文件: ${path.relative(this.sourceDir, packageInfo.path)}`);
      console.log(`📝 发布说明: ${path.relative(this.sourceDir, notesPath)}`);
      console.log(`💾 文件大小: ${this.formatFileSize(packageInfo.size)}`);
      
      return packageInfo;
      
    } catch (error) {
      console.error('❌ 打包失败:', error.message);
      process.exit(1);
    }
  }
}

// 执行打包
if (require.main === module) {
  const packager = new Packager();
  packager.package();
}

module.exports = Packager;