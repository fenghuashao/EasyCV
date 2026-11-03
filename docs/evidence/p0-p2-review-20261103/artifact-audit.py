"""Read-only audit of the existing ZIP, current source and stale dist. No build/download."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import subprocess
import zipfile

evidence = Path(__file__).resolve().parent
root = evidence.parents[2]
sha = lambda data: hashlib.sha256(data).hexdigest()
load = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
runtime = ['manifest.json']
for folder in ['background', 'content', 'popup', 'options', 'utils', 'icons', '_locales']:
    runtime.extend(p.relative_to(root).as_posix() for p in (root / folder).rglob('*') if p.is_file())
runtime.sort()
zip_path = root / 'releases/store-submission-20261103/EasyCV-v1.1.2-20261103.zip'
with zipfile.ZipFile(zip_path) as archive:
    entries = [e.filename for e in archive.infolist() if not e.is_dir()]
    safe = all(not PurePosixPath(n).is_absolute() and '..' not in PurePosixPath(n).parts and '\\' not in n for n in entries)
    assert safe and len(entries) == len(set(entries))
    assert set(entries) == set(runtime + ['build-info.json'])
    assert archive.testzip() is None
    rows = []
    for name in runtime:
        payload = archive.read(name)
        baseline = subprocess.check_output(['git', 'show', f'02d0681:{name}'], cwd=root)
        rows.append({'file': name, 'zipSha256': sha(payload),
            'matchesCurrentSource': payload == (root / name).read_bytes(),
            'matchesCommit02d0681': payload == baseline})
    zip_manifest = json.loads(archive.read('manifest.json'))
    zip_result = {'path': str(zip_path.relative_to(root)), 'sha256': sha(zip_path.read_bytes()),
        'bytes': zip_path.stat().st_size, 'fileCount': len(entries), 'crc': 'PASS', 'safeExactAllowlist': 'PASS',
        'manifest': zip_manifest, 'matchesCurrentSource': all(r['matchesCurrentSource'] for r in rows),
        'changedCurrentRuntimeFiles': [r['file'] for r in rows if not r['matchesCurrentSource']],
        'commit02d0681MatchingFiles': sum(r['matchesCommit02d0681'] for r in rows), 'files': rows}
package, lock = load(root / 'package.json'), load(root / 'package-lock.json')
result = {'sourceHead': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'sourceVersion': load(root / 'manifest.json')['version'], 'packageVersion': package['version'],
    'lockVersion': lock['version'], 'lockRootVersion': lock['packages']['']['version'],
    'distManifest': load(root / 'dist/manifest.json'), 'runtimeFileCount': len(runtime), 'existingZip': zip_result,
    'nodeDevDependencyCount': len(lock.get('packages', {})) - 1,
    'oldAcceptanceZipExists': (root / 'releases/state-fix-20261103/EasyCV-v1.1.2-20261102.zip').exists(),
    'browserOperated': False, 'storeStateVerified': False}
(evidence / 'artifact-audit.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in result.items() if k not in ['distManifest', 'existingZip']}, ensure_ascii=False))
print(json.dumps({k: v for k, v in zip_result.items() if k not in ['files', 'manifest']}, ensure_ascii=False))
