const fs = require('fs');
const path = require('path');

class DocsChecker {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.docsDir = path.join(this.rootDir, 'docs');
    this.indexPath = path.join(this.docsDir, 'README.md');
    this.baselinePath = path.join(__dirname, 'docs-check-baseline.json');
    this.findings = [];
    this.seen = new Set();
    this.baseline = this.loadBaseline();
    this.repoRootEntries = fs.readdirSync(this.rootDir);
    this.placeholderPatterns = [
      {
        regex: /your-org/gi,
        suggestion: '将占位仓库标识替换为真实仓库 owner/repo，或在未来态文档中明确标注。'
      }
    ];
  }

  loadBaseline() {
    if (!fs.existsSync(this.baselinePath)) {
      return [];
    }

    const raw = fs.readFileSync(this.baselinePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.suppressions || [];
  }

  run() {
    this.checkIndexLinks();
    this.scanTrackedDocs();

    const { activeFindings, suppressedFindings } = this.partitionFindings();

    if (activeFindings.length === 0) {
      console.log('✅ docs:check 通过');

      if (suppressedFindings.length > 0) {
        console.log(`ℹ️  当前有 ${suppressedFindings.length} 个已知文档问题通过 baseline 暂时接受：`);
        suppressedFindings.forEach((finding) => {
          console.log(`   - [${finding.type}] ${finding.file}: ${finding.value}`);
        });
      }

      return;
    }

    console.error(`❌ docs:check 发现 ${activeFindings.length} 个未处理问题：`);
    activeFindings.forEach((finding, index) => {
      console.error(`${index + 1}. [${finding.type}] ${finding.file}`);
      if (typeof finding.line === 'number') {
        console.error(`   行号: ${finding.line}`);
      }
      console.error(`   命中内容: ${finding.value}`);
      console.error(`   说明: ${finding.message}`);
      console.error(`   建议: ${finding.suggestion}`);
    });

    if (suppressedFindings.length > 0) {
      console.error(`ℹ️  另外还有 ${suppressedFindings.length} 个已知问题已在 baseline 中登记。`);
    }

    process.exit(1);
  }

  checkIndexLinks() {
    if (!fs.existsSync(this.indexPath)) {
      this.addFinding({
        type: 'index',
        file: this.toRepoPath(this.indexPath),
        line: 1,
        value: 'docs/README.md',
        message: '文档索引入口不存在。',
        suggestion: '创建 docs/README.md，并把它作为统一入口维护。'
      });
      return;
    }

    const content = fs.readFileSync(this.indexPath, 'utf8');
    const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const rawTarget = match[1].trim();

      if (!rawTarget || this.isExternalTarget(rawTarget)) {
        continue;
      }

      const target = decodeURIComponent(rawTarget.split('#')[0]);
      const resolvedPath = path.resolve(path.dirname(this.indexPath), target);
      const line = this.getLineNumber(content, match.index);

      if (!fs.existsSync(resolvedPath)) {
        this.addFinding({
          type: 'index',
          file: this.toRepoPath(this.indexPath),
          line,
          value: rawTarget,
          message: '文档索引引用了不存在的本地文件。',
          suggestion: '修正 docs/README.md 中的链接路径，或补齐缺失文件。'
        });
      }
    }
  }

  scanTrackedDocs() {
    const files = this.getTrackedFiles();

    files.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativeFile = this.toRepoPath(filePath);
      this.checkPlaceholders(relativeFile, content);
      this.checkPathReferences(relativeFile, content);
    });
  }

  toRepoPath(targetPath) {
    return path.relative(this.rootDir, targetPath).replace(/\\/g, '/');
  }

  getLineNumber(content, index) {
    return content.slice(0, index).split(/\r?\n/).length;
  }

  getTrackedFiles() {
    const tracked = new Set([this.indexPath]);
    const content = fs.readFileSync(this.indexPath, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line) => {
      if (!line.startsWith('| [')) {
        return;
      }

      const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
      if (cells.length < 3) {
        return;
      }

      const linkMatch = cells[0].match(/\[[^\]]+\]\(([^)]+)\)/);
      const role = cells[1];
      const status = cells[2];

      if (!linkMatch || status !== 'active' || role === 'Asset') {
        return;
      }

      const target = decodeURIComponent(linkMatch[1].split('#')[0]);
      const resolved = path.resolve(path.dirname(this.indexPath), target);

      if (fs.existsSync(resolved)) {
        tracked.add(resolved);
      }
    });

    return Array.from(tracked);
  }

  checkPlaceholders(relativeFile, content) {
    this.placeholderPatterns.forEach(({ regex, suggestion }) => {
      let match;
      while ((match = regex.exec(content)) !== null) {
        this.addFinding({
          type: 'placeholder',
          file: relativeFile,
          line: this.getLineNumber(content, match.index),
          value: match[0],
          message: '文档中仍然存在明显的占位内容。',
          suggestion
        });
      }
      regex.lastIndex = 0;
    });
  }

  checkPathReferences(relativeFile, content) {
    const pathRegex = /(^|[\s"'`(])((?:\.\.\/|\.\/)?[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+(?:\.[A-Za-z0-9_.-]+)?\/?)/gm;
    let match;

    while ((match = pathRegex.exec(content)) !== null) {
      const candidate = match[2];
      const normalizedCandidate = candidate.replace(/[),.;]+$/, '');

      if (!this.isRepoPathCandidate(normalizedCandidate)) {
        continue;
      }

      const resolvedPath = this.resolveRepoPath(relativeFile, normalizedCandidate);
      if (!resolvedPath || fs.existsSync(resolvedPath)) {
        continue;
      }

      const candidateIndex = match.index + match[1].length;
      if (this.isOptionalRuntimeDirectory(normalizedCandidate, resolvedPath, content, candidateIndex)) {
        continue;
      }

      this.addFinding({
        type: 'path',
        file: relativeFile,
        line: this.getLineNumber(content, match.index + match[1].length),
        value: normalizedCandidate,
        message: '文档引用了仓库内不存在的路径。',
        suggestion: '修正文档中的仓库路径，或在后续实现中补齐对应文件/目录。'
      });
    }
  }

  isOptionalRuntimeDirectory(candidate, resolvedPath, content, index) {
    // context.mjs creates this private profile on demand; only its inline-code
    // directory mention is optional. Links, child files and other paths stay checked.
    const runtimeDir = 'test/real-sites/.profile/';
    if (!candidate.endsWith('/') || this.toRepoPath(resolvedPath) !== runtimeDir.slice(0, -1)) {
      return false;
    }

    if (content[index - 1] !== '`' || content[index + candidate.length] !== '`') {
      return false;
    }

    const ignorePath = path.join(this.rootDir, '.gitignore');
    return fs.existsSync(ignorePath) && fs.readFileSync(ignorePath, 'utf8')
      .split(/\r?\n/).some((line) => line.trim() === runtimeDir);
  }

  isExternalTarget(target) {
    return /^(https?:\/\/|chrome:\/\/|mailto:|#)/i.test(target);
  }

  isRepoPathCandidate(candidate) {
    if (!candidate.includes('/')) {
      return false;
    }

    if (/^(https?:\/\/|chrome:\/\/|mailto:)/i.test(candidate)) {
      return false;
    }

    if (candidate.includes('${')) {
      return false;
    }

    if (/^[A-Za-z]:\\/.test(candidate)) {
      return false;
    }

    const firstSegment = candidate.replace(/^(\.\/|\.\.\/)+/, '').split('/')[0];
    const knownPrefixes = new Set([
      ...this.repoRootEntries,
      'src',
      'assets',
      'tests',
      '.github',
      'releases',
      'node_modules'
    ]);

    if (!knownPrefixes.has(firstSegment)) {
      return false;
    }

    if (!candidate.endsWith('/') && !/\.[A-Za-z0-9_.-]+$/.test(candidate)) {
      return false;
    }

    return true;
  }

  resolveRepoPath(relativeFile, candidate) {
    if (candidate.startsWith('./') || candidate.startsWith('../')) {
      return path.resolve(path.dirname(path.join(this.rootDir, relativeFile)), candidate);
    }

    return path.resolve(this.rootDir, candidate);
  }

  partitionFindings() {
    const activeFindings = [];
    const suppressedFindings = [];

    this.findings.forEach((finding) => {
      const isSuppressed = this.baseline.some((entry) =>
        entry.type === finding.type &&
        entry.file === finding.file &&
        entry.value === finding.value
      );

      if (isSuppressed) {
        suppressedFindings.push(finding);
      } else {
        activeFindings.push(finding);
      }
    });

    return { activeFindings, suppressedFindings };
  }

  addFinding(finding) {
    const key = `${finding.type}|${finding.file}|${finding.value}`;
    if (this.seen.has(key)) {
      return;
    }

    this.seen.add(key);
    this.findings.push(finding);
  }
}

if (require.main === module) {
  const checker = new DocsChecker();
  checker.run();
}

module.exports = DocsChecker;
