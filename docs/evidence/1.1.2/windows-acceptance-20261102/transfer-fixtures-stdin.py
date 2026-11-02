"""Copy fixed artifacts through Parallels stdin; avoid command-line size limits."""
from pathlib import Path
import base64
import datetime
import hashlib
import json
import subprocess

root = Path(__file__).resolve().parents[4]
out = Path(__file__).with_name('fixture-transfer-stdin.json')
if out.exists():
    raise SystemExit('Refusing to overwrite transfer evidence')
vm = '799dc443-ad93-4544-98a6-52260c5e6cea'
prefix = "$ErrorActionPreference='Stop';[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);$d=Join-Path $env:LOCALAPPDATA 'EasyCV-Acceptance-20261102-r3';"

def run(script, data=None):
    cmd = ['prlctl', 'exec', vm, '--current-user', 'powershell.exe', '-NoLogo',
           '-NoProfile', '-NonInteractive', '-EncodedCommand',
           base64.b64encode((prefix + script).encode('utf-16le')).decode()]
    p = subprocess.run(cmd, input=data, capture_output=True, timeout=25)
    if p.returncode:
        raise RuntimeError(p.stderr.decode(errors='replace'))
    return p.stdout.decode().strip()

files = {
    'candidate.zip': root / 'releases/permission-recheck-20261101/EasyCV-v1.1.2-20261031.zip',
    'permission-fix.html': root / 'test/fixtures/permission-fix.html',
    'mechanisms.html': root / 'docs/evidence/1.1.2/popup-paste-triage-20261101/mechanisms.html',
    'fixture-server.ps1': root / 'docs/evidence/1.1.2/windows-acceptance-20261101/fixture-server.ps1',
}
records = []
try:
    run("if(Test-Path $d){throw 'Directory exists'};New-Item -ItemType Directory -Path $d|Out-Null")
    for name, source in files.items():
        data = source.read_bytes()
        expected = hashlib.sha256(data).hexdigest()
        if name == 'candidate.zip':
            assert expected == '6a2f2478e847ff06d6b7a35dbe01b543d2cd00ab52df7f96d2763d758e77782a'
        actual = run(f"$p=Join-Path $d '{name}';$b=[Convert]::FromBase64String([Console]::ReadLine());[IO.File]::WriteAllBytes($p,$b);(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash",
                     base64.b64encode(data) + b'\n').lower()
        records.append({'file': name, 'source': str(source.relative_to(root)), 'bytes': len(data),
                        'hostSHA256': expected, 'guestSHA256': actual, 'match': expected == actual})
        assert expected == actual, name
        print(name + ': host/guest SHA256 match', flush=True)
    result = {'status': 'PASS', 'records': records,
              'guestDirectory': '%LOCALAPPDATA%/EasyCV-Acceptance-20261102-r3',
              'transport': 'Parallels stdin; no shared folders or network listener',
              'candidateRebuiltOrRepacked': False}
except Exception as exc:
    result = {'status': 'ERROR', 'records': records, 'errorType': type(exc).__name__,
              'error': 'Transport timeout' if isinstance(exc, subprocess.TimeoutExpired) else str(exc)}
finally:
    result['observedAt'] = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
if result['status'] != 'PASS':
    raise SystemExit(result['error'])
