"""Corrected Edge Popup scene with trusted paste and plain-field controls.

Earlier zero-event probes were invalid due to foreground/focus, not failures.
This scene uses only the isolated Edge session and the unchanged candidate.
"""
from pathlib import Path
import base64
import json
import re
import subprocess

here = Path(__file__).resolve().parent
seed = 'EASYCV_EDGE_POPUP_RECHECK_20261102'
enc = lambda text: base64.b64encode(text.encode()).decode()

def result_objects(name):
    d = json.loads((here / (name + '.json')).read_text())
    values = []
    for match in re.finditer(r'(?m)^\{', d['stdout']):
        try:
            values.append(json.JSONDecoder().raw_decode(d['stdout'][match.start():])[0])
        except ValueError:
            pass
    return values

def browser(name, commands):
    r = subprocess.run(['python3', str(here / 'browser-command.py'), '--browser', 'edge',
                        '--name', name], input=json.dumps(commands), text=True, capture_output=True)
    print(name + ': ' + str(r.returncode), flush=True)
    if r.returncode:
        raise SystemExit(r.stdout)

def popup(name, selector, desired):
    script = '& {\n' + (here / 'popup-click.ps1').read_text() + (
        "\n} -Port 19332 -ExtensionId 'dgckfbbdhlgcjhaihmpdnnhnfpfeaono' "
        "-PageURL 'http://127.0.0.1:18951/mechanisms.html' "
        f"-Selector '{selector}' -Desired '{desired}'\n")
    r = subprocess.run(['python3', str(here / 'windows-command.py'), '--vm',
                        '799dc443-ad93-4544-98a6-52260c5e6cea', '--name', name,
                        '--timeout', '30'], input=script, text=True, capture_output=True)
    print(name + ': ' + str(r.returncode), flush=True)
    if r.returncode:
        raise SystemExit(r.stdout)
    actual = result_objects(name)[-1]
    assert actual['contexts']['contextType'] == 'POPUP'
    assert actual['pageHasFocusAfterDismiss'] is True

def probe(name, refresh, positive):
    c = [['tab', 't1']]
    if refresh:
        c += [['reload'], ['wait', '#plain']]
    if positive:
        c += [['fill', '#plain', seed], ['press', 'Control+a'], ['press', 'Control+c']]
    c += [['fill', '#plain', ''], ['press', 'Control+v'], ['click', '#inline'],
          ['press', 'Control+v'], ['click', '#input'], ['press', 'Control+v'],
          ['eval', '-b', enc('({focus:document.hasFocus(),values:Object.fromEntries(["inline","input","plain"].map(id=>[id,document.getElementById(id).value])),events:triageEvents})')]]
    browser(name, c)
    actual = next(o for o in result_objects(name) if 'values' in o)
    if actual['values']['plain'] != seed or not any(e['id'] == 'plain' and e['isTrusted'] for e in actual['events']):
        raise SystemExit('Invalid clipboard/focus control; do not interpret restricted target results')

probe('edge-popup-r4-seed-positive', refresh=True, positive=True)
popup('edge-popup-r4-main-off', '#mainUnlockBtn', 'off')
probe('edge-popup-r4-off-refreshed', refresh=True, positive=False)
popup('edge-popup-r4-main-on', '#mainUnlockBtn', 'on')
probe('edge-popup-r4-on-stale', refresh=False, positive=False)
probe('edge-popup-r4-refresh-workaround', refresh=True, positive=True)
popup('edge-popup-r4-force-off', '#forceMode', 'off')
browser('edge-native-menu-open', [['tab', 't1'], ['mouse', 'move', '800', '600'],
                                ['mouse', 'down', 'right'], ['mouse', 'up', 'right']])
