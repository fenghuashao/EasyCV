const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const Builder = require('./build');
const Packager = require('./package');
const Cleaner = require('./clean');
const VersionManager = require('./bump-version');

/**
 * EasyCV 自动化部署脚本
 * 完整的构建、打包、发布流程
 */

class Deployer {
  constructor() {
    this.sourceDir = path.resolve(__dirname, '..');
    this.builder = new Builder();
    this.packager = new Packager();
    this.cleaner = new Cleaner();
    this.versionManager = new VersionManager();
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(`
🚀 EasyCV 自动化部署工具

用法:
  node scripts/deploy.js [选项]

选项:
  --clean              清理构建文件后退出
  --build-only         仅执行构建，不打包
  --package-only       仅执行打包（需要先构建）
  --bump <type>        更新版本号 (major|minor|patch)
  --dry-run           预览模式，不实际执行
  --skip-tests        跳过测试步骤
  --skip-validation   跳过验证步骤
  --help              显示此帮助信息

示例:
  node scripts/deploy.js                    # 完整部署流程
  node scripts/deploy.js --build-only       # 仅构建
  node scripts/deploy.js --bump minor       # 更新次版本号并部署
  node scripts/deploy.js --dry-run          # 预览部署流程
  node scripts/deploy.js --clean            # 清理构建文件
`);
  }

  /**
   * 解析命令行参数
   */
  parseArgs() {
    const args = process.argv.slice(2);
    
    return {
      clean: args.includes('--clean'),
      buildOnly: args.includes('--build-only'),
      packageOnly: args.includes('--package-only'),
      bump: args.includes('--bump') ? args[args.indexOf('--bump') + 1] : null,
      dryRun: args.includes('--dry-run'),
      skipTests: args.includes('--skip-tests'),
      skipValidation: args.includes('--skip-validation'),
      help: args.includes('--help') || args.includes('-h')
    };
  }

  /**
   * 验证环境
   */
  validateEnvironment() {
    console.log('🔍 验证部署环境...');
    
    // 检查必要文件
    const requiredFiles = [
      'manifest.json',
      'package.json'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(this.sourceDir, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`缺少必要文件: ${file}`);
      }
    }
    
    // 检查必要目录
    const requiredDirs = [
      'background',
      'content',
      'popup',
      'options',
      'utils',
      'icons'
    ];
    
    for (const dir of requiredDirs) {
      const dirPath = path.join(this.sourceDir, dir);
      if (!fs.existsSync(dirPath)) {
        console.log(`⚠️  警告: 目录不存在 ${dir}`);
      }
    }
    
    console.log('✅ 环境验证通过');
  }

  /**
   * 运行测试
   */
  async runTests() {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT; // A nested invocation must run real child tests as well.
    for (const [name, args] of [
      ['syntax', ['scripts/lint.js']],
      ['unit', ['--test', 'test/unit/*.test.mjs']],
      ['docs', ['scripts/check-docs.js']]
    ]) {
      const result = spawnSync(process.execPath, args, { cwd: this.sourceDir, stdio: 'inherit', windowsHide: true, env });
      if (result.error || result.status !== 0) throw Error(`${name} check failed (exit ${result.status})`);
    }
    console.log('Local checks passed; browser/upgrade acceptance: NOT_RUN');
  }

  /**
   * 生成部署报告
   */
  generateDeployReport(results) {
    const reportPath = path.join(this.outputDir, 'deploy-report.json');
    
    const report = {
      deployTime: new Date().toISOString(),
      version: results.version,
      buildSuccess: results.buildSuccess,
      packageSuccess: results.packageSuccess,
      packagePath: results.packagePath,
      packageSize: results.packageSize,
      steps: results.steps,
      browserAcceptance: 'NOT_RUN',
      storeReady: false,
      duration: results.duration
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
    console.log(`📊 生成部署报告: ${path.relative(this.sourceDir, reportPath)}`);
    
    return reportPath;
  }

  /**
   * 执行完整部署流程
   */
  async deploy(options = {}) {
    const startTime = Date.now();
    this.outputDir = fs.mkdtempSync(path.join(this.sourceDir, '.tmp-deploy-'));
    this.builder.distDir = path.join(this.outputDir, 'dist');
    this.packager.distDir = this.builder.distDir;
    this.packager.outputDir = this.outputDir;
    const steps = [];
    const results = {
      buildSuccess: false,
      packageSuccess: false,
      steps: steps
    };
    
    try {
      console.log('🚀 开始 EasyCV 自动化部署');
      console.log('=' .repeat(60));
      
      // 验证环境
      if (!options.skipValidation) {
        steps.push({ name: '环境验证', status: 'running', startTime: Date.now() });
        this.validateEnvironment();
        steps[steps.length - 1].status = 'success';
        steps[steps.length - 1].duration = Date.now() - steps[steps.length - 1].startTime;
      }
      
      // 运行测试
      if (!options.skipTests) {
        steps.push({ name: '运行测试', status: 'running', startTime: Date.now() });
        await this.runTests();
        steps[steps.length - 1].status = 'success';
        steps[steps.length - 1].duration = Date.now() - steps[steps.length - 1].startTime;
      }
      
      // 更新版本
      if (options.bump) {
        steps.push({ name: '版本更新', status: 'running', startTime: Date.now() });
        await this.versionManager.bump(options.bump, { skipGit: true });
        steps[steps.length - 1].status = 'success';
        steps[steps.length - 1].duration = Date.now() - steps[steps.length - 1].startTime;
      }
      
      // 获取版本信息
      results.version = this.versionManager.getCurrentVersion();
      
      // 构建项目
      steps.push({ name: '项目构建', status: 'running', startTime: Date.now() });
      await this.builder.build();
      results.buildSuccess = true;
      steps[steps.length - 1].status = 'success';
      steps[steps.length - 1].duration = Date.now() - steps[steps.length - 1].startTime;
      
      if (options.buildOnly) {
        console.log('✅ 仅构建模式完成');
        return results;
      }
      
      // 打包项目
      steps.push({ name: '项目打包', status: 'running', startTime: Date.now() });
      const packageInfo = await this.packager.package();
      results.packageSuccess = true;
      results.packagePath = packageInfo.path;
      results.packageSize = packageInfo.size;
      steps[steps.length - 1].status = 'success';
      steps[steps.length - 1].duration = Date.now() - steps[steps.length - 1].startTime;
      
      // 计算总耗时
      results.duration = Date.now() - startTime;
      
      // 生成部署报告
      this.generateDeployReport(results);
      
      console.log('=' .repeat(60));
      console.log('🎉 部署完成!');
      console.log(`📦 版本: ${results.version}`);
      console.log(`📁 发布包: ${path.relative(this.sourceDir, results.packagePath)}`);
      console.log(`💾 文件大小: ${this.formatFileSize(results.packageSize)}`);
      console.log(`⏱️  总耗时: ${this.formatDuration(results.duration)}`);
      
      return results;
      
    } catch (error) {
      console.error('❌ 部署失败:', error.message);
      
      // 更新失败步骤状态
      if (steps.length > 0) {
        const lastStep = steps[steps.length - 1];
        if (lastStep.status === 'running') {
          lastStep.status = 'failed';
          lastStep.error = error.message;
        }
      }
      
      results.duration = Date.now() - startTime;
      this.generateDeployReport(results);
      
      throw error;
    }
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
   * 格式化持续时间
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}分${seconds % 60}秒`;
    }
    return `${seconds}秒`;
  }
}

// 执行部署
if (require.main === module) {
  const deployer = new Deployer();
  const options = deployer.parseArgs();
  
  if (options.help) {
    deployer.showHelp();
    process.exit(0);
  }
  
  if (options.clean) {
    console.log('🧹 执行清理操作...');
    deployer.cleaner.clean().then(() => {
      console.log('✅ 清理完成');
    });
    return;
  }
  
  if (options.packageOnly) {
    console.log('📦 仅执行打包...');
    deployer.packager.package().then(() => {
      console.log('✅ 打包完成');
    });
    return;
  }
  
  if (options.dryRun) {
    console.log('🔍 预览模式 - 不会实际执行操作');
    console.log('将要执行的步骤:');
    console.log('1. 环境验证');
    if (!options.skipTests) console.log('2. 运行测试');
    if (options.bump) console.log(`3. 版本更新 (${options.bump})`);
    console.log('4. 清理构建');
    console.log('5. 项目构建');
    if (!options.buildOnly) console.log('6. 项目打包');
    return;
  }
  
  // 执行部署
  deployer.deploy(options).catch(() => { process.exitCode = 1; });
}

module.exports = Deployer;
