"""Verify a 1.1.2 state-fix ZIP against source/dist and the immutable permission candidate.

Usage: python3 test/verify-state-fix-package.py NEW_ZIP BASELINE_ZIP OUTPUT_JSON
This does not build, modify packages, or contact the store.
"""
import hashlib
import json
from pathlib import Path
import re
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
new_zip, baseline_zip, output = map(Path, sys.argv[1:])
sha = lambda data: hashlib.sha256(data).hexdigest()
assert sha(baseline_zip.read_bytes()) == '6a2f2478e847ff06d6b7a35dbe01b543d2cd00ab52df7f96d2763d758e77782a'
expected = {'manifest.json': (root / 'manifest.json').read_bytes(),
            'build-info.json': (root / 'dist/build-info.json').read_bytes()}
for directory in ['background', 'content', 'popup', 'options', 'utils', 'icons', '_locales']:
    for file in (root / directory).rglob('*'):
        if file.is_file():
            expected[file.relative_to(root).as_posix()] = file.read_bytes()

allowed_changes = {'background/auto-enable-manager.js', 'content/content.js',
                   'content/injector.js', 'options/options.js', 'utils/storage-utils.js', 'build-info.json'}
rows, changes = [], []
with zipfile.ZipFile(new_zip) as archive, zipfile.ZipFile(baseline_zip) as baseline:
    names = [entry.filename for entry in archive.infolist() if not entry.is_dir()]
    assert len(names) == len(set(names)) and set(names) == set(expected), 'Unexpected ZIP payload'
    assert archive.testzip() is None, 'ZIP CRC failure'
    for name in sorted(names):
        data = archive.read(name)
        assert data == expected[name] == (root / 'dist' / name).read_bytes(), name
        if data != baseline.read(name):
            changes.append(name)
        if name.endswith('.js'):
            text = data.decode()
            assert not re.search(r'\b(?:chrome|browser)\s*\.\s*scripting|\b(?:executeScript|insertCSS|registerContentScripts)\s*\(', text), name
        rows.append({'file': name, 'bytes': len(data), 'sha256': sha(data)})
    assert set(changes) == allowed_changes, f'Unexpected runtime changes: {changes}'
    manifest = json.loads(archive.read('manifest.json'))
    assert manifest == json.loads(baseline.read('manifest.json'))
    assert manifest['version'] == '1.1.2' and manifest['permissions'] == ['storage', 'contextMenus']
    assert not manifest.get('optional_permissions')
    assert json.loads(expected['build-info.json'])['version'] == manifest['version']
    package = json.loads((root / 'package.json').read_text())
    lock = json.loads((root / 'package-lock.json').read_text())
    assert package['version'] == lock['version'] == lock['packages']['']['version'] == manifest['version']
notes = (new_zip.parent / 'EasyCV-v1.1.2-README.md').read_text()
assert '**权限要求**: storage, contextMenus' in notes
assert '**网站访问范围**: <all_urls>' in notes
result = {'status': 'PASS', 'zip': str(new_zip), 'sha256': sha(new_zip.read_bytes()),
          'bytes': new_zip.stat().st_size, 'fileCount': len(rows), 'changedFromLockedCandidate': changes,
          'checks': ['ZIP CRC', 'exact payload allowlist', 'unique entries', 'source/dist/ZIP equality',
                     'explicit runtime change allowlist', 'manifest unchanged', 'version consistency',
                     'no scripting dependency', 'permission notes', 'old ZIP unchanged'],
          'manifest': manifest, 'files': rows}
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'PASS {len(rows)} files; SHA256 {result["sha256"]}')
