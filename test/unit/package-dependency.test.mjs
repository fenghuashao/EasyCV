import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('locked build dependencies exclude the affected minimatch range in GHSA-g3hv-75wg-m249', () => {
  const lock = JSON.parse(fs.readFileSync(new URL('../../package-lock.json', import.meta.url), 'utf8'));
  for (const [name, entry] of Object.entries(lock.packages)) {
    if (!name.endsWith('/minimatch')) continue;
    const [major, minor, patch] = entry.version.split('.').map(Number);
    assert.ok(major > 11 || (major === 11 && (minor > 0 || patch >= 1)),
      `${name}@${entry.version} remains in the audited affected range (<11.0.1)`);
  }
});
