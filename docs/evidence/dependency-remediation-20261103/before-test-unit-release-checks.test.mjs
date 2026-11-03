import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const Builder = require('../../scripts/build.js');
const Packager = require('../../scripts/package.js');
const Deployer = require('../../scripts/deploy.js');
const VersionManager = require('../../scripts/bump-version.js');
const { runtimePaths, verifyBuild, verifyZip, verifyVersions, validateVersion } = require('../../scripts/release-checks.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'easycv-local-tests-'));
  t.after(() => {
    const absolute = path.resolve(dir);
    if (path.dirname(absolute) !== path.resolve(os.tmpdir()) || !path.basename(absolute).startsWith('easycv-local-tests-')) throw Error('Unsafe cleanup target');
    fs.rmSync(absolute, { recursive: true });
  });
  for (const name of [...runtimePaths, 'package.json', 'package-lock.json']) fs.cpSync(path.join(root, name), path.join(dir, name), { recursive: true });
  const builder = Object.assign(new Builder(), { sourceDir: dir, distDir: path.join(dir, 'build') });
  const packager = Object.assign(new Packager(), { sourceDir: dir, distDir: builder.distDir, outputDir: dir });
  return { dir, builder, packager };
}

test('fresh build and ZIP match every source file; overwrites, stale builds and corrupt ZIPs are rejected', async t => {
  const { dir, builder, packager } = fixture(t);
  await builder.build();
  const zip = path.join(dir, 'test-only.zip');
  await packager.createZip(zip);
  const result = verifyZip(dir, builder.distDir, zip);
  assert.equal(result.storeReady, false);
  assert.equal(result.fileCount, Object.keys(result.files).length);
  await assert.rejects(packager.createZip(zip), /already exists/);
  await assert.rejects(builder.build(), /already exists/);
  const corrupted = fs.readFileSync(zip); corrupted[60] ^= 0xff;
  fs.writeFileSync(path.join(dir, 'corrupt.zip'), corrupted);
  assert.throws(() => verifyZip(dir, builder.distDir, path.join(dir, 'corrupt.zip')));
  fs.appendFileSync(path.join(dir, 'content/content.js'), '\n// changed source');
  assert.throws(() => verifyBuild(dir, builder.distDir), /Stale|mismatch/);
  await assert.rejects(packager.createZip(path.join(dir, 'stale.zip')), /Stale|mismatch/);
  assert.equal(fs.existsSync(path.join(dir, 'stale.zip')), false);
});

test('unexpected build entries and unapproved permission changes block packaging', async t => {
  const { dir, builder } = fixture(t);
  await builder.build();
  fs.writeFileSync(path.join(builder.distDir, 'private.json'), '{}');
  assert.throws(() => verifyBuild(dir, builder.distDir), /unexpected|mismatch/);
  fs.unlinkSync(path.join(builder.distDir, 'private.json'));
  const file = path.join(dir, 'manifest.json'); const manifest = JSON.parse(fs.readFileSync(file));
  manifest.permissions.push('scripting'); fs.writeFileSync(file, JSON.stringify(manifest));
  assert.throws(() => verifyBuild(dir, builder.distDir), /permission/);
});

test('version operation synchronizes manifest/package/both lock fields in an isolated fixture', t => {
  const { dir } = fixture(t);
  const manager = Object.assign(new VersionManager(), { sourceDir: dir,
    packageJsonPath: path.join(dir, 'package.json'), manifestJsonPath: path.join(dir, 'manifest.json') });
  const version = manager.bumpVersion(verifyVersions(dir).version, 'patch');
  manager.updateVersionFiles(version);
  assert.equal(verifyVersions(dir).version, version);
  for (const invalid of ['1.2', '1.2.3.4', '1.2.3-beta', '01.2.3', '0.0.0', '65536.0.0', '-1.2.3']) assert.throws(() => validateVersion(invalid));
  assert.throws(() => manager.bumpVersion('1.2.65535', 'patch'));
  const file = path.join(dir, 'package-lock.json'); const lock = JSON.parse(fs.readFileSync(file));
  lock.packages[''].version = '0.1.0'; fs.writeFileSync(file, JSON.stringify(lock));
  assert.throws(() => verifyVersions(dir), /mismatch/);
  assert.throws(() => manager.updateVersionFiles('1.9.0'), /mismatch/);
});

test('deploy executes real checks and stops on failing unit tests', async t => {
  const { dir } = fixture(t);
  fs.mkdirSync(path.join(dir, 'scripts')); fs.mkdirSync(path.join(dir, 'test/unit'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'scripts/lint.js'), 'process.exit(0);');
  fs.writeFileSync(path.join(dir, 'scripts/check-docs.js'), "require('fs').writeFileSync('docs-was-run', 'yes');");
  fs.writeFileSync(path.join(dir, 'test/unit/failing.test.mjs'), "import test from 'node:test'; test('synthetic failure', () => { throw Error('expected negative fixture'); });");
  const deployer = Object.assign(new Deployer(), { sourceDir: dir });
  await assert.rejects(deployer.runTests(), /unit check failed/);
  assert.equal(fs.existsSync(path.join(dir, 'docs-was-run')), false);
  fs.writeFileSync(path.join(dir, 'test/unit/failing.test.mjs'), "import test from 'node:test'; test('synthetic success', () => {});");
  await deployer.runTests();
  assert.equal(fs.existsSync(path.join(dir, 'docs-was-run')), true);
});
