const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const runtimePaths = ['manifest.json', 'background', 'content', 'popup', 'options', 'utils', 'icons', '_locales'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function validateVersion(version) {
  // Project versions use three numeric components; no prerelease tags or leading zeros.
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) ||
      version.split('.').some(part => Number(part) > 65535) || version === '0.0.0') throw Error('Invalid project version');
  return version;
}
function verifyVersions(sourceDir) {
  const manifest = readJSON(path.join(sourceDir, 'manifest.json'));
  const pkg = readJSON(path.join(sourceDir, 'package.json'));
  const lock = readJSON(path.join(sourceDir, 'package-lock.json'));
  validateVersion(manifest.version);
  if ([pkg.version, lock.version, lock.packages?.['']?.version].some(value => value !== manifest.version)) throw Error('Version mismatch: manifest/package/lock');
  return manifest;
}
function collectFiles(root, entries = fs.readdirSync(root)) {
  const files = {};
  const rootPath = path.resolve(root);
  const walk = relative => {
    const absolute = path.resolve(rootPath, relative);
    // Every entry must stay inside the package root; `..` segments are rejected.
    const contained = absolute === rootPath || absolute.startsWith(rootPath + path.sep);
    if (!contained) throw Error('Package entries must stay inside the package root');
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw Error('Symlinks are not allowed in packages');
    if (stat.isDirectory()) for (const entry of fs.readdirSync(absolute)) walk(path.join(relative, entry));
    else if (stat.isFile()) files[relative.replace(/\\/g, '/')] = hash(fs.readFileSync(absolute));
    else throw Error('Unsupported package entry');
  };
  entries.forEach(walk);
  return files;
}
function sourceInventory(sourceDir) {
  const files = collectFiles(sourceDir, runtimePaths);
  for (const name of Object.keys(files)) {
    if (name !== 'manifest.json' && !/^(?:(?:background|content|popup|options|utils)\/[a-z0-9-]+\.(?:js|css|html)|icons\/[a-z0-9-]+\.png|_locales\/[A-Za-z_]+\/messages\.json)$/.test(name)) {
      throw Error('Unexpected runtime file: ' + name);
    }
  }
  return files;
}
function verifyBuild(sourceDir, distDir) {
  const manifest = verifyVersions(sourceDir);
  if (manifest.manifest_version !== 3 || JSON.stringify([...(manifest.permissions || [])].sort()) !== JSON.stringify(['contextMenus', 'storage']) ||
      JSON.stringify((manifest.web_accessible_resources || []).flatMap(item => item.resources)) !== JSON.stringify(['content/injector.js'])) throw Error('Unexpected permission/resource surface');
  const expected = sourceInventory(sourceDir);
  const actual = collectFiles(distDir);
  const info = readJSON(path.join(distDir, 'build-info.json'));
  if (info.version !== manifest.version || JSON.stringify(info.sourceHashes) !== JSON.stringify(expected)) throw Error('Stale build metadata');
  const names = Object.keys(actual).filter(name => name !== 'build-info.json');
  if (names.length !== Object.keys(expected).length || names.some(name => actual[name] !== expected[name])) throw Error('Source/build mismatch or unexpected files');
  return { version: manifest.version, files: actual };
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function verifyZip(sourceDir, distDir, zipPath) {
  const build = verifyBuild(sourceDir, distDir);
  const zip = fs.readFileSync(zipPath);
  // Small extension ZIPs do not need ZIP64 or comments. Reject unsupported structures.
  const end = zip.length - 22;
  if (end < 0 || zip.readUInt32LE(end) !== 0x06054b50 || zip.readUInt16LE(end + 20) !== 0 || zip.readUInt32LE(end + 4) !== 0) throw Error('Invalid ZIP end record');
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const centralStart = offset;
  const names = new Set();
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw Error('Invalid ZIP directory');
    const method = zip.readUInt16LE(offset + 10);
    const size = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (names.has(name) || !Object.hasOwn(build.files, name) || name.includes('..') || name.includes('\\') || name.startsWith('/')) throw Error('Unexpected/duplicate ZIP entry: ' + name);
    if (zip.readUInt16LE(offset + 8) & 1 || ![0, 8].includes(method)) throw Error('Encrypted/unsupported ZIP entry');
    names.add(name);
    const local = zip.readUInt32LE(offset + 42);
    if (zip.readUInt32LE(local) !== 0x04034b50 || zip.readUInt16LE(local + 8) !== method) throw Error('Invalid ZIP local header');
    const localNameLength = zip.readUInt16LE(local + 26);
    if (zip.subarray(local + 30, local + 30 + localNameLength).toString('utf8') !== name) throw Error('ZIP name mismatch');
    const start = local + 30 + localNameLength + zip.readUInt16LE(local + 28);
    if (start + size > centralStart) throw Error('Invalid ZIP entry bounds');
    const payload = zip.subarray(start, start + size);
    const bytes = method === 8 ? zlib.inflateRawSync(payload, { maxOutputLength: 20 * 1024 * 1024 }) : payload;
    if (bytes.length !== zip.readUInt32LE(offset + 24) || crc32(bytes) !== zip.readUInt32LE(offset + 16) || hash(bytes) !== build.files[name]) throw Error('ZIP CRC/content mismatch: ' + name);
    offset += 46 + nameLength + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32);
  }
  if (names.size !== Object.keys(build.files).length || offset !== end || offset - centralStart !== zip.readUInt32LE(end + 12)) throw Error('Missing files or invalid ZIP directory bounds');
  return { ...build, zipSHA256: hash(zip), zipBytes: zip.length, fileCount: names.size, browserAcceptance: 'NOT_RUN', storeReady: false };
}
module.exports = { runtimePaths, hash, validateVersion, verifyVersions, sourceInventory, verifyBuild, verifyZip };
