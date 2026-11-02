"""Normal installed original CWS 1.1.1: real behavior and pre-upgrade UI seed.

This is baseline preparation, not an upgrade. It never modifies extension ID,
extension files, browser storage directly, installation events or update events.
"""
from pathlib import Path
import base64
import json
import re
import subprocess

here = Path(__file__).resolve().parent
ext = 'bnbmgiidicjdbnmkmdnjeelhijnlhnjb'
seed = 'EASYCV_STORE111_BASELINE_20261102'
enc = lambda text: base64.b64encode(text.encode()).decode()
read = '({url:location.href,focus:document.hasFocus(),values:Object.fromEntries(["inline","input","listener","keyboard","plain"].map(id=>[id,document.getElementById(id).value])),events:triageEvents})'
settings = '(async()=>({id:chrome.runtime.id,version:chrome.runtime.getManifest().version,ui:{forceMode:document.getElementById("forceMode").checked,copy:document.getElementById("enableCopy").checked,paste:document.getElementById("enablePaste").checked,notifications:document.getElementById("showNotifications").checked,delay:document.getElementById("detectionDelay").value,retries:document.getElementById("maxRetries").value,autoList:document.getElementById("whitelistContainer").textContent,excludedList:document.getElementById("excludedContainer").textContent},storage:await chrome.storage.sync.get(["plugin_enabled","force_mode","user_settings","auto_enable_list","excluded_list"])}))()'

def objects(name):
    data = json.loads((here / (name + '.json')).read_text())
    values = []
    for match in re.finditer(r'(?m)^\{', data['stdout']):
        try:
            values.append(json.JSONDecoder().raw_decode(data['stdout'][match.start():])[0])
        except ValueError:
            pass
    return values

def browser(name, commands):
    run = subprocess.run(['python3', str(here / 'browser-command.py'), '--browser', 'chrome-store',
                          '--name', name, '--timeout', '40'], input=json.dumps(commands),
                         text=True, capture_output=True)
    print(name + ': ' + str(run.returncode), flush=True)
    if run.returncode:
        raise SystemExit(run.stdout)

def popup(name, selector, desired):
    script = '& {\n' + (here / 'popup-click.ps1').read_text() + (
        f"\n}} -Port 19333 -ExtensionId '{ext}' "
        "-PageURL 'http://127.0.0.1:18951/mechanisms.html' "
        f"-Selector '{selector}' -Desired '{desired}'\n")
    run = subprocess.run(['python3', str(here / 'windows-command.py'), '--vm',
                          '799dc443-ad93-4544-98a6-52260c5e6cea', '--name', name,
                          '--timeout', '30'], input=script, text=True, capture_output=True)
    print(name + ': ' + str(run.returncode), flush=True)
    if run.returncode:
        raise SystemExit(run.stdout)
    value = objects(name)[-1]
    assert value['contexts']['contextType'] == 'POPUP' and value['pageHasFocusAfterDismiss']

def probe(name, tab='t4', refresh=False, copy_seed=False, all_targets=False):
    c = [['tab', tab]]
    if refresh:
        c += [['reload'], ['wait', '#plain']]
    if copy_seed:
        c += [['fill', '#plain', seed], ['press', 'Control+a'], ['press', 'Control+c']]
    c += [['fill', '#plain', ''], ['press', 'Control+v']]
    for target in (['inline', 'input', 'listener', 'keyboard'] if all_targets else ['inline', 'input']):
        c += [['click', '#' + target], ['press', 'Control+v']]
    c += [['eval', '-b', enc(read)]]
    browser(name, c)
    value = next(o for o in objects(name) if 'values' in o)
    if value['values']['plain'] != seed or not any(e['id'] == 'plain' and e['isTrusted'] for e in value['events']):
        raise SystemExit('Invalid positive clipboard/focus control; do not infer restricted-field result')

browser('store111-force-ui-before-refresh', [['tab', 't3'], ['check', '#forceMode'], ['eval', '-b', enc(settings)]])
browser('store111-force-ui-after-refresh', [['reload'], ['wait', '#detectionDelay'], ['eval', '-b', enc(settings)],
    ['click', '[data-tab="whitelist"]'], ['fill', '#whitelistInput', 'store-auto.localhost'], ['click', '#addWhitelistBtn'],
    ['fill', '#whitelistInput', 'blocked.localhost'], ['click', '#addWhitelistBtn'],
    ['click', '[data-tab="excluded"]'], ['fill', '#excludedInput', 'blocked.localhost'], ['click', '#addExcludedBtn'],
    ['tab', 'new', 'http://127.0.0.1:18951/mechanisms.html'], ['wait', '#plain']])
popup('store111-popup-force-off', '#forceMode', 'off')
probe('store111-default-real-paste', refresh=True, copy_seed=True, all_targets=True)
popup('store111-popup-main-off', '#mainUnlockBtn', 'off')
probe('store111-popup-off-refreshed', refresh=True)
popup('store111-popup-main-on', '#mainUnlockBtn', 'on')
probe('store111-popup-on-stale')
popup('store111-popup-force-on', '#forceMode', 'on')
probe('store111-popup-force-stale')
probe('store111-popup-refresh-workaround', refresh=True, copy_seed=True)
popup('store111-auto-prerequisite-off', '#mainUnlockBtn', 'off')
browser('store111-auto-first-visit', [['tab', 'new', 'http://store-auto.localhost:18951/mechanisms.html'],
    ['wait', '#plain'], ['click', '#plain'], ['press', 'Control+v'], ['click', '#inline'], ['press', 'Control+v'],
    ['click', '#input'], ['press', 'Control+v'], ['eval', '-b', enc(read)]])
probe('store111-auto-refresh-workaround', tab='t5', refresh=True, copy_seed=True)

# Save meaningful nondefaults through actual Options UI, force last. Keep this
# original installation/Profile for a future genuine same-ID store update.
browser('store111-pre-upgrade-nondefault-seed', [['tab', 't3'], ['reload'], ['wait', '#detectionDelay'],
    ['uncheck', '#showNotifications'], ['uncheck', '#enableCopy'], ['check', '#enablePaste'],
    ['fill', '#detectionDelay', '2100'], ['press', 'Tab'], ['fill', '#maxRetries', '7'], ['press', 'Tab'],
    ['check', '#forceMode'], ['eval', '-b', enc(settings)], ['reload'], ['wait', '#detectionDelay'],
    ['eval', '-b', enc(settings)]])
probe('store111-seeded-real-paste', refresh=True, copy_seed=True, all_targets=True)
