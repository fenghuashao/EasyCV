import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Run the real CLI in an isolated repository without touching private profiles.
function checkDocs(t, content, { ignore = 'test/real-sites/.profile/\n', indexExtra = '', present = false } = {}) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'easycv-docs-check-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  for (const dir of ['scripts', 'docs', 'test/real-sites']) {
    fs.mkdirSync(path.join(fixture, dir), { recursive: true });
  }
  fs.copyFileSync(path.join(rootDir, 'scripts/check-docs.js'), path.join(fixture, 'scripts/check-docs.js'));
  fs.writeFileSync(path.join(fixture, '.gitignore'), ignore);
  fs.writeFileSync(path.join(fixture, 'docs/README.md'),
    '| [Evidence](./history.md) | Evidence Document | active |\n' + indexExtra);
  fs.writeFileSync(path.join(fixture, 'docs/history.md'), content);
  const profile = path.join(fixture, 'test/real-sites/.profile');
  if (present) fs.mkdirSync(profile);
  const result = spawnSync(process.execPath, [path.join(fixture, 'scripts/check-docs.js')], {
    cwd: fixture, encoding: 'utf8'
  });
  assert.ifError(result.error);
  assert.equal(fs.existsSync(profile), present, 'checker must not create a dummy profile');
  return { status: result.status, output: result.stdout + result.stderr };
}

for (const reference of ['test/real-sites/.profile/', '../test/real-sites/.profile/']) {
  test(`docs checker accepts absent ignored runtime directory in inline code: ${reference}`, (t) => {
    const result = checkDocs(t, `持久化 profile（\`${reference}\`，含真实 cookie 已 gitignore）。`);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /docs:check 通过/);
  });
}

test('docs checker accepts an existing runtime directory', (t) => {
  const result = checkDocs(t, '`test/real-sites/.profile/`', { present: true });
  assert.equal(result.status, 0, result.output);
});

const failures = [
  ['ordinary missing file alongside optional profile', '`test/real-sites/.profile/` and `test/real-sites/missing.mjs`', {}, 'test/real-sites/missing.mjs'],
  ['ordinary broken Markdown link', '[Missing](../test/real-sites/missing.mjs)', {}, 'test/real-sites/missing.mjs'],
  ['ordinary broken document link', '[Missing](../docs/missing.md)', {}, '../docs/missing.md'],
  ['runtime directory used as a Markdown link', '[Profile](../test/real-sites/.profile/)', {}, '../test/real-sites/.profile/'],
  ['runtime directory linked from index', '', { indexExtra: '[Profile](../test/real-sites/.profile/)\n' }, '../test/real-sites/.profile/', 2],
  ['missing child file under runtime directory', '`test/real-sites/.profile/missing.json`', {}, 'test/real-sites/.profile/missing.json'],
  ['similarly named directory', '`test/real-sites/.profile-backup/`', {}, 'test/real-sites/.profile-backup/'],
  ['runtime path without directory slash', '`test/real-sites/.profile`', {}, 'test/real-sites/.profile'],
  ['runtime directory in plain text', 'test/real-sites/.profile/', {}, 'test/real-sites/.profile/'],
  ['runtime directory no longer ignored', '`test/real-sites/.profile/`', { ignore: '' }, 'test/real-sites/.profile/'],
  ['other ignored directory', '`test/real-sites/output/`', { ignore: 'test/real-sites/output/\n' }, 'test/real-sites/output/']
];

for (const [name, content, options, expected, count = 1] of failures) {
  test(`docs checker still fails: ${name}`, (t) => {
    const result = checkDocs(t, content, options);
    assert.equal(result.status, 1, result.output);
    assert.ok(result.output.includes(`docs:check 发现 ${count} 个未处理问题`), result.output);
    assert.ok(result.output.includes(expected), result.output);
  });
}
