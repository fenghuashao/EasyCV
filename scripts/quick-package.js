const path = require('path');
const fs = require('fs');
const Builder = require('./build');
const Packager = require('./package');

/**
 * EasyCV 快速打包脚本
 * 面向开发自测场景：build + zip 一步完成，跳过正式发布流程中的
 * 发布说明生成、自动解压与测试/版本编排，产物只有一个 ZIP。
 * 文件名带 quick 标记与秒级时间戳，与正式发布包区分，避免误发。
 */

function timestamp(date) {
  const pad = n => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

async function main() {
  console.log('⚡ 快速打包 EasyCV（开发自测用途）');
  console.log('='.repeat(50));

  const builder = new Builder();
  const out = fs.mkdtempSync(path.join(builder.sourceDir, '.tmp-quick-'));
  builder.distDir = path.join(out, 'dist');
  await builder.build();

  const packager = new Packager();
  packager.distDir = builder.distDir;
  packager.outputDir = out;
  const versionInfo = packager.getVersionInfo();
  packager.ensureDir(packager.outputDir);

  const fileName = `EasyCV-v${versionInfo.version}-quick-${timestamp(new Date())}.zip`;
  const outputPath = path.join(packager.outputDir, fileName);
  const packageInfo = await packager.createZip(outputPath);

  console.log('='.repeat(50));
  console.log(`✅ 快速打包完成!`);
  console.log(`📦 版本: ${versionInfo.version}`);
  console.log(`📁 输出文件: ${path.relative(packager.sourceDir, packageInfo.path)}`);
  console.log(`💾 文件大小: ${packager.formatFileSize(packageInfo.size)}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ 快速打包失败:', error.message);
    process.exit(1);
  });
}
