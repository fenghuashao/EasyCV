"""Verify the actual release ZIP, source/dist bytes and preserved baseline.

Usage: python3 test/verify-permission-package.py ZIP BASELINE_DIST OUTPUT_JSON
Uses Python standard library only; no store/network operations.
"""
import hashlib
import json
from pathlib import Path
import re
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
zip_path, baseline, output = map(Path, sys.argv[1:])
runtime_dirs = ['background', 'content', 'popup', 'options', 'utils', 'icons', '_locales']
source_files = [root / 'manifest.json']
for directory in runtime_dirs:
    source_files += sorted(p for p in (root / directory).rglob('*') if p.is_file())
expected = {str(p.relative_to(root)): p.read_bytes() for p in source_files}
expected['build-info.json'] = (root / 'dist/build-info.json').read_bytes()
sha = lambda data: hashlib.sha256(data).hexdigest()
manifest = json.loads(expected['manifest.json'])
old_manifest = json.loads((baseline / 'manifest.json').read_bytes())
assert old_manifest['version'] == '1.1.1'
assert old_manifest['permissions'] == ['activeTab', 'storage', 'scripting', 'contextMenus']
assert manifest['version'] == '1.1.2'
assert manifest['permissions'] == ['storage', 'contextMenus']
assert manifest['host_permissions'] == ['<all_urls>']
old_manifest.update(version=manifest['version'], permissions=manifest['permissions'])
assert old_manifest == manifest, 'Unexpected manifest change beyond version/permissions'
package = json.loads((root / 'package.json').read_bytes())
lock = json.loads((root / 'package-lock.json').read_bytes())
assert package['version'] == lock['version'] == lock['packages']['']['version'] == '1.1.2'
assert json.loads(expected['build-info.json'])['version'] == '1.1.2'
inventory = []
with zipfile.ZipFile(zip_path) as archive:
    assert archive.testzip() is None, 'ZIP CRC failure'
    names = [entry.filename for entry in archive.infolist() if not entry.is_dir()]
    assert len(names) == len(set(names)), 'Duplicate ZIP entries'
    assert set(names) == set(expected), 'Unexpected or missing ZIP payload'
    for name in sorted(names):
        data = archive.read(name)
        assert data == expected[name], f'ZIP differs from source: {name}'
        assert data == (root / 'dist' / name).read_bytes(), f'ZIP differs from dist: {name}'
        if name not in ['manifest.json', 'build-info.json']:
            assert data == (baseline / name).read_bytes(), f'Runtime changed from baseline: {name}'
        inventory.append({'file': name, 'bytes': len(data), 'sha256': sha(data)})
    assert json.loads(archive.read('manifest.json')) == manifest

# Inventory all shipped and helper JS; retain exact file/line evidence for review.
api_calls = []
for directory in ['background', 'content', 'popup', 'options', 'utils', 'scripts']:
    for p in sorted((root / directory).rglob('*.js')):
        source = p.read_text()
        assert not re.search(r'(?:chrome|browser)\s*(?:\.\s*scripting|\[\s*[\"\']scripting)', source), str(p)
        assert not re.search(r'\b(?:executeScript|insertCSS|registerContentScripts|captureVisibleTab|captureTab)\s*\(', source), str(p)
        for i, line in enumerate(source.splitlines(), 1):
            for match in re.finditer(r'\b(?:chrome|browser)\.[A-Za-z]+(?:\.[A-Za-z]+)*', line):
                api_calls.append({'file': str(p.relative_to(root)), 'line': i, 'api': match.group()})
notes = (zip_path.parent / 'EasyCV-v1.1.2-README.md').read_text()
assert '**权限要求**: storage, contextMenus' in notes
assert '**网站访问范围**: <all_urls>' in notes
assert 'activeTab' not in notes and 'scripting' not in notes
result = {
    'status': 'PASS', 'zip': str(zip_path), 'zipBytes': zip_path.stat().st_size,
    'zipSHA256': sha(zip_path.read_bytes()), 'manifest': manifest,
    'checks': ['ZIP CRC', 'unique entries', 'exact payload allowlist', 'source/dist/ZIP byte equality',
               'runtime assets unchanged from 1.1.1', 'manifest only version/permissions changed',
               'manifest/package/lock/build-info versions agree', 'generated permission notes',
               'no scripting or capture API dependency in runtime/helper JS'],
    'storePackageMatch': 'NOT_VERIFIED', 'files': inventory, 'apiReferences': api_calls
}
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f"PASS: {len(inventory)} files; ZIP SHA256 {result['zipSHA256']}")
