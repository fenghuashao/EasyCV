"""Auditable agent-browser commands inside the isolated Windows test session.

JSON stdin: a list of CLI argument arrays. No personal browser discovery or
profile access. Uses only the task's explicitly launched loopback CDP ports.
"""
import argparse
import base64
import datetime
import json
from pathlib import Path
import subprocess
import sys

p = argparse.ArgumentParser()
p.add_argument('--browser', choices=['edge', 'chrome', 'chrome-store'], required=True)
p.add_argument('--name', required=True)
p.add_argument('--timeout', type=int, default=45)
args = p.parse_args()
if not args.name.replace('-', '').replace('_', '').isalnum():
    p.error('unsafe evidence name')
output = Path(__file__).with_name(args.name + '.json')
if output.exists():
    p.error('refusing to overwrite evidence')
commands = json.load(sys.stdin)
if not isinstance(commands, list) or any(not isinstance(c, list) or
        any(not isinstance(a, str) for a in c) for c in commands):
    p.error('expected a list of string argument arrays')
port = {'chrome': 19331, 'edge': 19332, 'chrome-store': 19333}[args.browser]
session = 'easycv-win-' + args.browser + '-20261103'
script = r"""
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ProgressPreference='SilentlyContinue'
$a=Join-Path $env:LOCALAPPDATA 'EasyCV-Downloads-20261102-Tools\package\bin\agent-browser-win32-x64.exe'
$commands=ConvertFrom-Json ([Console]::ReadLine())
$failed=$false
foreach($c in $commands){
  $argv=@($c | ForEach-Object {[string]$_})
  & $a --session SESSION --cdp PORT --json @argv
  $code=$LASTEXITCODE
  Write-Output ('ACTION_RESULT '+(@{arguments=$argv;exitCode=$code}|ConvertTo-Json -Compress))
  if($code -ne 0){$failed=$true;break}
}
if($failed){exit 1}
""".replace('SESSION', session).replace('PORT', str(port))
command = ['prlctl', 'exec', '799dc443-ad93-4544-98a6-52260c5e6cea',
           '--current-user', 'powershell.exe', '-NoLogo', '-NoProfile',
           '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand',
           base64.b64encode(script.encode('utf-16le')).decode()]
result = {'observedAt': datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(),
          'browser': args.browser, 'session': session, 'guestCDPPort': port,
          'commands': commands, 'timeoutSeconds': args.timeout}
try:
    process = subprocess.run(command, input=json.dumps(commands).encode() + b'\n',
                             capture_output=True, timeout=args.timeout)
    result.update(exitCode=process.returncode, stdout=process.stdout.decode('utf-8', errors='replace'),
                  stderr=process.stderr.decode('utf-8', errors='replace'), timedOut=False)
except subprocess.TimeoutExpired as exc:
    result.update(exitCode=None, stdout=(exc.stdout or b'').decode('utf-8', errors='replace'),
                  stderr=(exc.stderr or b'').decode('utf-8', errors='replace'), timedOut=True)
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'evidence': str(output), 'exitCode': result['exitCode'],
                  'timedOut': result['timedOut'], 'stdout': result['stdout'],
                  'stderrPreview': result['stderr'][:1000]}, ensure_ascii=False, indent=2))
sys.exit(0 if result['exitCode'] == 0 else 1)
