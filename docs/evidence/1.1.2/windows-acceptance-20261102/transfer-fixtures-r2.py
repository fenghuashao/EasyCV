"""Copy only fixed EasyCV test artifacts into the new guest test directory.

No VM shares, firewall rules or browser policies are changed. Chunked transport
uses Parallels Tools. This is a byte copy, not rebuilding/repacking the release.
"""
from pathlib import Path
import base64
import datetime
import hashlib
import json
import subprocess

root = Path(__file__).resolve().parents[4]
output = Path(__file__).with_name('fixture-transfer-r2.json')
if output.exists():
    raise SystemExit('Refusing to overwrite prior transfer evidence')
vm = '799dc443-ad93-4544-98a6-52260c5e6cea'
dest = "$d=Join-Path $env:LOCALAPPDATA 'EasyCV-Acceptance-20261102-r2';"
files = {
    'candidate.zip': root / 'releases/permission-recheck-20261101/EasyCV-v1.1.2-20261031.zip',
    'permission-fix.html': root / 'test/fixtures/permission-fix.html',
    'mechanisms.html': root / 'docs/evidence/1.1.2/popup-paste-triage-20261101/mechanisms.html',
    'fixture-server.ps1': root / 'docs/evidence/1.1.2/windows-acceptance-20261101/fixture-server.ps1',
}

def run(script):
    encoded = base64.b64encode(script.encode('utf-16le')).decode()
    p = subprocess.run(['prlctl', 'exec', vm, '--current-user', 'powershell.exe',
                        '-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
                       capture_output=True, timeout=15)
    if p.returncode:
        raise RuntimeError(p.stderr.decode(errors='replace'))
    return p.stdout.decode('utf-8', errors='replace').strip()

run(dest + "$ErrorActionPreference='Stop';if(Test-Path -LiteralPath $d){throw 'Test directory already exists'};New-Item -ItemType Directory -Path $d | Out-Null")
records = []
try:
    for name, source in files.items():
        data = source.read_bytes()
        expected = hashlib.sha256(data).hexdigest()
        if name == 'candidate.zip':
            assert expected == '6a2f2478e847ff06d6b7a35dbe01b543d2cd00ab52df7f96d2763d758e77782a'
        # Under Windows' process command-line length limit after UTF16/Base64 encoding.
        chunks = [data[i:i + 1024] for i in range(0, len(data), 1024)]
        for i, chunk in enumerate(chunks):
            fragment = base64.b64encode(chunk).decode()
            run(dest + "$ErrorActionPreference='Stop';" +
                f"$p=Join-Path $d '{name}';" +
                ("[IO.File]::WriteAllBytes($p,[byte[]]@());" if i == 0 else '') +
                f"$b=[Convert]::FromBase64String('{fragment}');" +
                "$s=[IO.File]::Open($p,[IO.FileMode]::Append,[IO.FileAccess]::Write);try{$s.Write($b,0,$b.Length)}finally{$s.Dispose()}")
        actual = run(dest + f"(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $d '{name}')).Hash").lower()
        record = {'name': name, 'source': str(source.relative_to(root)),
                  'bytes': len(data), 'chunks': len(chunks),
                  'hostSHA256': expected, 'guestSHA256': actual, 'match': actual == expected}
        records.append(record)
        assert record['match'], name
        print(f'{name}: guest SHA256 verified', flush=True)
    result = {'status': 'PASS', 'vm': vm, 'guestDirectory': '%LOCALAPPDATA%/EasyCV-Acceptance-20261102',
              'files': records, 'transport': 'Parallels exec, same local machine, byte chunks',
              'sharedFoldersOrSecurityConfigurationChanged': False}
except Exception as exc:
    result = {'status': 'ERROR', 'files': records, 'error': str(exc)}
finally:
    result['observedAt'] = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
if result['status'] != 'PASS':
    raise SystemExit(result['error'])
