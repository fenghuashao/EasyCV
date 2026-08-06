/**
 * 语法检查脚本
 * 对所有扩展 JS 文件执行 node --check（项目无打包器，语法错误只能在运行前拦截）
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const scanDirs = ['background', 'content', 'popup', 'options', 'utils', 'scripts', 'test'];

function collectJsFiles(dir) {
  const absoluteDir = path.join(rootDir, dir);
  if (!fs.existsSync(absoluteDir)) return [];

  const files = [];
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const entryPath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(path.relative(rootDir, entryPath)));
    } else if (/\.(js|mjs|cjs)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
}

const files = scanDirs.flatMap(collectJsFiles);
let failed = 0;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed++;
    console.error(`❌ ${path.relative(rootDir, file)}`);
    console.error(result.stderr.trim());
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${files.length} 个文件语法检查失败`);
  process.exit(1);
}

console.log(`✅ ${files.length} 个文件语法检查通过`);
