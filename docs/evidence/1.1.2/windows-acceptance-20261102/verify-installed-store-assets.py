"""Explain byte differences in six browser-normalized public 1.1.1 assets.

Read only the original CRX and the task's installed extension resource paths.
Never read or copy browser storage, and never write an extension resource.
"""
from pathlib import Path
import base64
import hashlib
import io
import json
import subprocess
import zipfile
import PIL
from PIL import Image

here = Path(__file__).resolve().parent
repo = here.parents[3]
evidence = json.loads((here / 'final-guest-candidate-and-store-runtime-integrity.json').read_text())
actual = json.loads(evidence['stdout'])
names = [row['file'] for row in actual['storeRuntime']['files'] if not row['equal']]
script = r'''
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ErrorActionPreference='Stop'
$root=Join-Path $env:LOCALAPPDATA 'EasyCV-Acceptance-20261102-r3\chrome-store-profile\Default\Extensions\bnbmgiidicjdbnmkmdnjeelhijnlhnjb\1.1.1_0'
$names=ConvertFrom-Json 'NAMES_JSON'
$files=@($names|ForEach-Object {@{file=$_;base64=[Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $root $_)))}})
@{scope='Six public extension assets in explicitly isolated Profile; read-only; no browser storage';files=$files}|ConvertTo-Json -Depth 4 -Compress
'''.replace('NAMES_JSON', json.dumps(names))
run = subprocess.run(['python3', str(here / 'windows-command.py'), '--vm',
                      '799dc443-ad93-4544-98a6-52260c5e6cea', '--name',
                      'store111-install-normalized-assets-readonly', '--timeout', '25'],
                     input=script, text=True, capture_output=True)
if run.returncode:
    raise SystemExit(run.stdout)
normalized = json.loads(json.loads((here / 'store111-install-normalized-assets-readonly.json').read_text())['stdout'])
original = zipfile.ZipFile(repo / 'docs/evidence/1.1.2/release-closeout-20261101/store-current.crx')
results = []
for file in normalized['files']:
    name = file['file']
    got = base64.b64decode(file['base64'])
    wanted = original.read(name)
    if name.endswith('.json'):
        row = {'file': name, 'comparison': 'Parsed JSON object equality',
               'equal': json.loads(got) == json.loads(wanted)}
    else:
        source_image = Image.open(io.BytesIO(wanted)).convert('RGBA')
        installed_image = Image.open(io.BytesIO(got)).convert('RGBA')
        row = {'file': name, 'comparison': 'Decoded RGBA pixel equality',
               'sourceDimensions': source_image.size, 'installedDimensions': installed_image.size,
               'sourcePixelSHA256': hashlib.sha256(source_image.tobytes()).hexdigest(),
               'installedPixelSHA256': hashlib.sha256(installed_image.tobytes()).hexdigest(),
               'equal': source_image.size == installed_image.size and source_image.tobytes() == installed_image.tobytes()}
    results.append(row)
output = here / 'store111-install-asset-equivalence.json'
if output.exists():
    raise SystemExit('Refusing to overwrite evidence')
output.write_text(json.dumps({
    'source': 'https://chromium.googlesource.com/chromium/src/+/refs/tags/141.0.7390.34/extensions/browser/sandboxed_unpacker.cc',
    'cause': 'Inferred browser image/message sanitization; exact content comparisons below; no filesystem write tracing claim',
    'pillowVersion': PIL.__version__, 'byteIdenticalOtherRuntimeFiles': 30,
    'normalizedAssets': results, 'allEquivalent': all(row['equal'] for row in results),
    'candidateOriginal38FilesByteIdentical': actual['candidate']['allEqual'],
    'lockedZipSHA256InGuest': actual['candidateZip']['sha256'],
    'browserStorageReadOrCopiedByThisCheck': False
}, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'allEquivalent': all(row['equal'] for row in results), 'assets': results}, ensure_ascii=False, indent=2))
