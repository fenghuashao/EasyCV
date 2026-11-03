// Baseline build only, outside dist/releases. Refuse to overwrite any existing output.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../../..');
const Builder = require(path.join(root, 'scripts/build.js'));
const output = path.resolve(root, '.tmp/p0-p2-review-20261103-build');
if (!output.startsWith(root + path.sep) || fs.existsSync(output)) throw new Error('Unsafe or existing build output');
const builder = new Builder();
builder.distDir = output;
(async () => {
  await builder.build();
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const relative = path.relative(output, full);
        const data = fs.readFileSync(full);
        const same = relative === 'build-info.json' ? null : data.equals(fs.readFileSync(path.join(root, relative)));
        if (same === false) throw new Error(`Source/build mismatch: ${relative}`);
        files.push({ file: relative.replaceAll('\\', '/'), bytes: data.length,
          sha256: crypto.createHash('sha256').update(data).digest('hex'), matchesSource: same });
      }
    }
  }
  walk(output);
  fs.writeFileSync(path.join(__dirname, 'isolated-build.json'), JSON.stringify({ status: 'PASS', output,
    sourceHead: '9d378b5', node: process.version, fileCount: files.length,
    runtimeFilesMatchingSource: files.filter(x => x.matchesSource === true).length,
    releaseCandidate: false, defaultDistModified: false, files }, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
