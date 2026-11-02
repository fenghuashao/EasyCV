"""Run actual Popup mouse actions and real page keyboard probes in task Chrome.

Only the fixed candidate Profile/CDP 19331 is used. No storage writes, extension
reload, ID edits, generated install events or synthetic paste events are used.
"""
from pathlib import Path
import base64
import json
import re
import subprocess

here = Path(__file__).resolve().parent
candidate_id = 'dgckfbbdhlgcjhaihmpdnnhnfpfeaono'
base_url = 'http://127.0.0.1:18951/mechanisms.html'
seed = 'EASYCV_CHROME_POPUP_HISTORY_20261102'
enc = lambda code: base64.b64encode(code.encode()).decode()
read = "({url:location.href,focus:document.hasFocus(),active:document.activeElement.id,values:Object.fromEntries(['inline','input','listener','keyboard','plain'].map(id=>[id,document.getElementById(id).value])),events:window.triageEvents})"

def objects(name):
    outer = json.loads((here / (name + '.json')).read_text())
    values = []
    for match in re.finditer(r'(?m)^\{', outer['stdout']):
        try:
            values.append(json.JSONDecoder().raw_decode(outer['stdout'][match.start():])[0])
        except ValueError:
            pass
    return values

def browser(name, commands):
    r = subprocess.run(['python3', str(here / 'browser-command.py'), '--browser', 'chrome',
                        '--name', name, '--timeout', '45'], input=json.dumps(commands),
                       text=True, capture_output=True)
    print(name + ': transport exit ' + str(r.returncode), flush=True)
    if r.returncode:
        print(r.stdout, flush=True)
        raise SystemExit('Browser harness step failed; inspect raw evidence')

def popup(name, selector, desired):
    script = '& {\n' + (here / 'popup-click.ps1').read_text() + (
        f"\n}} -Port 19331 -ExtensionId '{candidate_id}' -PageURL '{base_url}' "
        f"-Selector '{selector}' -Desired '{desired}'\n")
    r = subprocess.run(['python3', str(here / 'windows-command.py'), '--vm',
                        '799dc443-ad93-4544-98a6-52260c5e6cea', '--name', name,
                        '--timeout', '35'], input=script, text=True, capture_output=True)
    print(name + ': transport exit ' + str(r.returncode), flush=True)
    if r.returncode:
        print(r.stdout, flush=True)
        raise SystemExit('Popup harness step failed; inspect raw evidence')
    actual = objects(name)[-1]
    assert actual['contexts']['contextType'] == 'POPUP' and actual['contexts']['tabId'] == -1
    if not actual['pageHasFocusAfterDismiss']:
        raise SystemExit('Page lost focus after Popup; do not interpret keyboard probes as product failures')

def probe(name, tab=None, refresh=False, copy_seed=False):
    commands = [['tab', tab]] if tab else []
    if refresh:
        commands += [['reload'], ['wait', '#plain']]
    if copy_seed:
        commands += [['fill', '#plain', seed], ['press', 'Control+a'], ['press', 'Control+c']]
    else:
        commands += [['fill', '#plain', ''], ['click', '#plain'], ['press', 'Control+v']]
    commands += [['click', '#inline'], ['press', 'Control+v'], ['click', '#input'],
                 ['press', 'Control+v'], ['eval', '-b', enc(read)]]
    browser(name, commands)

popup('chrome-popup-force-off', '#forceMode', 'off')
probe('chrome-popup-seed-positive', 't3', refresh=True, copy_seed=True)
popup('chrome-popup-main-off', '#mainUnlockBtn', 'off')
probe('chrome-popup-off-refreshed-a', 't3', refresh=True)
browser('chrome-second-tab-off', [['tab', 'new', 'http://localhost:18951/mechanisms.html'],
                                 ['wait', '#plain'], ['tab', 'list', '--json']])
tabs = next(o['data']['tabs'] for o in objects('chrome-second-tab-off') if o.get('success'))
second_tab = next(t['tabId'] for t in tabs if t['url'] == 'http://localhost:18951/mechanisms.html')
probe('chrome-popup-off-refreshed-b', second_tab)
popup('chrome-popup-main-on', '#mainUnlockBtn', 'on')
probe('chrome-popup-on-stale-a', 't3')
probe('chrome-popup-on-stale-b', second_tab)
popup('chrome-popup-force-on', '#forceMode', 'on')
probe('chrome-popup-force-stale-a', 't3')
probe('chrome-popup-refresh-workaround-a', 't3', refresh=True, copy_seed=True)
probe('chrome-popup-refresh-workaround-b', second_tab, refresh=True, copy_seed=True)

popup('chrome-auto-prerequisite-off', '#mainUnlockBtn', 'off')
probe('chrome-auto-unlisted-control', 't3', refresh=True)
browser('chrome-auto-enabled-real-page', [['tab', 'new', 'http://chrome.localhost:18951/mechanisms.html'],
    ['wait', '#plain'], ['click', '#plain'], ['press', 'Control+v'], ['click', '#inline'],
    ['press', 'Control+v'], ['click', '#input'], ['press', 'Control+v'], ['eval', '-b', enc(read)]])
browser('chrome-exclusion-priority-real-page', [['tab', 'new', 'http://blocked.localhost:18951/mechanisms.html'],
    ['wait', '#plain'], ['click', '#plain'], ['press', 'Control+v'], ['click', '#inline'],
    ['press', 'Control+v'], ['click', '#input'], ['press', 'Control+v'], ['click', '#listener'],
    ['press', 'Control+v'], ['eval', '-b', enc(read)]])
