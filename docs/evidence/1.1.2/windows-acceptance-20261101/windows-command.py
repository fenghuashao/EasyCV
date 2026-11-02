"""Run one explicit test command in an authorized Windows guest and retain its result.

Read the PowerShell script from stdin. Does not install tools, choose a VM, repair
the guest, weaken security, or infer test success. Use only with this task's test
paths/Profile; never query personal browser data. --NoProfile avoids loading the
user's PowerShell startup configuration. Output files are never overwritten.
"""
import argparse
import base64
import datetime
import json
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--vm', required=True)
parser.add_argument('--name', required=True)
parser.add_argument('--timeout', type=int, default=55)
args = parser.parse_args()
if not args.name.replace('-', '').replace('_', '').isalnum():
    parser.error('name must contain only letters, numbers, hyphens or underscores')
output = Path(__file__).resolve().parent / (args.name + '.json')
if output.exists():
    parser.error('refusing to overwrite existing evidence')
script = sys.stdin.read()
encoded = base64.b64encode(script.encode('utf-16le')).decode('ascii')
command = ['prlctl', 'exec', args.vm, '--current-user', 'powershell.exe',
           '-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded]
result = {
    'observedAt': datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(),
    'vm': args.vm,
    'script': script,
    'launch': 'prlctl exec --current-user powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand',
    'timeoutSeconds': args.timeout,
}
try:
    process = subprocess.run(command, capture_output=True, timeout=args.timeout)
    result.update(exitCode=process.returncode,
                  stdout=process.stdout.decode('utf-8', errors='replace'),
                  stderr=process.stderr.decode('utf-8', errors='replace'), timedOut=False)
except subprocess.TimeoutExpired as exc:
    result.update(exitCode=None, timedOut=True,
                  stdout=(exc.stdout or b'').decode('utf-8', errors='replace'),
                  stderr=(exc.stderr or b'').decode('utf-8', errors='replace'))
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False, indent=2))
sys.exit(0 if result.get('exitCode') == 0 else 1)
