const fs = require('fs');
const path = require('path');

/**
 * EasyCV 版本管理脚本
 * 自动更新 package.json 和 manifest.json 中的版本号
 */

class VersionManager {
  constructor() {
    this.sourceDir = path.resolve(__dirname, '..');
    this.packageJsonPath = path.join(this.sourceDir, 'package.json');
    this.manifestJsonPath = path.join(this.sourceDir, 'manifest.json');
  }

  /**
   * 解析版本号
   */
  parseVersion(version) {
    const parts = version.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      throw new Error(`无效的版本号格式: ${version}`);
    }
    return {
      major: parts[0],
      minor: parts[1],
      patch: parts[2]
    };
  }

  /**
   * 格式化版本号
   */
  formatVersion(versionObj) {
    return `${versionObj.major}.${versionObj.minor}.${versionObj.patch}`;
  }

  /**
   * 增加版本号
   */
  bumpVersion(currentVersion, type) {
    const version = this.parseVersion(currentVersion);
    
    switch (type) {
      case 'major':
        version.major++;
        version.minor = 0;
        version.patch = 0;
        break;
      case 'minor':
        version.minor++;
        version.patch = 0;
        break;
      case 'patch':
        version.patch++;
        break;
      default:
        throw new Error(`无效的版本类型: ${type}。支持的类型: major, minor, patch`);
    }
    
    return this.formatVersion(version);
  }

  /**
   * 读取当前版本
   */
  getCurrentVersion() {
    // 优先从 package.json 读取
    if (fs.existsSync(this.packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      return packageJson.version;
    }
    
    // 从 manifest.json 读取
    if (fs.existsSync(this.manifestJsonPath)) {
      const manifest = JSON.parse(fs.readFileSync(this.manifestJsonPath, 'utf8'));
      return manifest.version;
    }
    
    throw new Error('未找到版本信息文件');
  }

  /**
   * 更新 package.json
   */
  updatePackageJson(newVersion) {
    if (!fs.existsSync(this.packageJsonPath)) {
      console.log('⚠️  package.json 不存在，跳过更新');
      return false;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    const oldVersion = packageJson.version;
    
    packageJson.version = newVersion;
    
    fs.writeFileSync(this.packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`📦 更新 package.json: ${oldVersion} -> ${newVersion}`);
    
    return true;
  }

  /**
   * 更新 manifest.json
   */
  updateManifestJson(newVersion) {
    if (!fs.existsSync(this.manifestJsonPath)) {
      console.log('⚠️  manifest.json 不存在，跳过更新');
      return false;
    }
    
    const manifest = JSON.parse(fs.readFileSync(this.manifestJsonPath, 'utf8'));
    const oldVersion = manifest.version;
    
    manifest.version = newVersion;
    
    fs.writeFileSync(this.manifestJsonPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`🔧 更新 manifest.json: ${oldVersion} -> ${newVersion}`);
    
    return true;
  }

  /**
   * 生成更新日志条目
   */
  generateChangelogEntry(oldVersion, newVersion, type) {
    const date = new Date().toISOString().split('T')[0];
    const typeEmoji = {
      major: '🚀',
      minor: '✨',
      patch: '🐛'
    };
    
    const typeDescription = {
      major: '重大更新',
      minor: '功能更新',
      patch: '问题修复'
    };
    
    return `## [${newVersion}] - ${date}

### ${typeEmoji[type]} ${typeDescription[type]}
- 版本从 ${oldVersion} 更新到 ${newVersion}
- TODO: 添加具体的更新内容

`;
  }

  /**
   * 更新 CHANGELOG.md
   */
  updateChangelog(oldVersion, newVersion, type) {
    const changelogPath = path.join(this.sourceDir, 'CHANGELOG.md');
    const entry = this.generateChangelogEntry(oldVersion, newVersion, type);
    
    if (fs.existsSync(changelogPath)) {
      const content = fs.readFileSync(changelogPath, 'utf8');
      const lines = content.split('\n');
      
      // 找到第一个版本条目的位置
      let insertIndex = lines.findIndex(line => line.startsWith('## ['));
      if (insertIndex === -1) {
        // 如果没有找到版本条目，在文件末尾添加
        insertIndex = lines.length;
      }
      
      // 插入新的版本条目
      lines.splice(insertIndex, 0, ...entry.split('\n'));
      
      fs.writeFileSync(changelogPath, lines.join('\n'));
      console.log(`📝 更新 CHANGELOG.md`);
    } else {
      // 创建新的 CHANGELOG.md
      const header = `# Changelog\n\n所有重要的项目更改都将记录在此文件中。\n\n格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。\n\n`;
      fs.writeFileSync(changelogPath, header + entry);
      console.log(`📝 创建 CHANGELOG.md`);
    }
  }

  /**
   * 执行版本更新
   */
  async bump(type = 'patch', options = {}) {
    console.log(`🔄 开始版本更新 (${type})...`);
    console.log('=' .repeat(50));
    
    try {
      // 获取当前版本
      const currentVersion = this.getCurrentVersion();
      console.log(`📋 当前版本: ${currentVersion}`);
      
      // 计算新版本
      const newVersion = this.bumpVersion(currentVersion, type);
      console.log(`🎯 目标版本: ${newVersion}`);
      
      if (options.dryRun) {
        console.log('\n🔍 预览模式 - 不会实际修改文件');
        console.log(`   package.json: ${currentVersion} -> ${newVersion}`);
        console.log(`   manifest.json: ${currentVersion} -> ${newVersion}`);
        return;
      }
      
      console.log('\n📝 正在更新文件...');
      
      // 更新文件
      this.updatePackageJson(newVersion);
      this.updateManifestJson(newVersion);
      
      // 更新 CHANGELOG
      if (!options.skipChangelog) {
        this.updateChangelog(currentVersion, newVersion, type);
      }
      
      console.log('=' .repeat(50));
      console.log(`✅ 版本更新完成!`);
      console.log(`🏷️  新版本: ${newVersion}`);
      console.log(`📈 更新类型: ${type}`);
      
      if (!options.skipGit) {
        console.log('\n💡 建议执行以下 Git 命令:');
        console.log(`   git add .`);
        console.log(`   git commit -m "chore: bump version to ${newVersion}"`);
        console.log(`   git tag v${newVersion}`);
      }
      
    } catch (error) {
      console.error('❌ 版本更新失败:', error.message);
      process.exit(1);
    }
  }
}

// 执行版本更新
if (require.main === module) {
  const versionManager = new VersionManager();
  
  // 解析命令行参数
  const args = process.argv.slice(2);
  const type = args[0] || 'patch';
  
  const options = {
    dryRun: args.includes('--dry-run') || args.includes('-n'),
    skipChangelog: args.includes('--skip-changelog'),
    skipGit: args.includes('--skip-git')
  };
  
  if (!['major', 'minor', 'patch'].includes(type)) {
    console.error('❌ 无效的版本类型。支持的类型: major, minor, patch');
    process.exit(1);
  }
  
  if (options.dryRun) {
    console.log('🔍 运行预览模式...');
  }
  
  versionManager.bump(type, options);
}

module.exports = VersionManager;