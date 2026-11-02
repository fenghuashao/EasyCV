"""Check the observed browser evidence, not the product implementation."""
import json,pathlib
out=pathlib.Path(__file__).parent
verified=[]
for v in ['1.1.1','1.1.2']:
 d=json.loads((out/f'chrome-{v}.json').read_text()); cases={c['name']:c for c in d['cases']}; checks=[]
 def check(name,condition):
  assert condition, f'{v}: {name}'
  checks.append(name)
 check('all 16 scenarios recorded without top-level harness errors',len(cases)==16 and not d['errors'])
 check('disabled inline paste blocked',cases['negative_control_disabled']['paste']['pasted'] is False)
 check('default enabled inline paste works',cases['first_install_defaults']['paste']['pasted'] is True)
 c=cases['popup_enable_ordinary']
 check('actual POPUP context',c['popupContext'][0]['contextType']=='POPUP')
 check('Popup observes target domain',c['popupBefore']['url']=='easycv.localhost')
 check('Popup UI enabled',c['popupAfter']['copy'] and c['popupAfter']['paste'])
 check('storage enabled but content stale',c['after']['storage']['user_settings']['pasteEnabled'] and c['after']['content']['pasteEnabled'] is False)
 check('inline remains and trusted paste fails',c['after']['main']['targets'][0]['onpaste']=='return false' and c['paste']['pasted'] is False)
 check('background state_updated rejected by content',any(t['type']=='state_updated' and t.get('response',{}).get('error')=='Unknown message type' for t in c['trace']))
 c=cases['popup_force_after_enable']
 check('force updates without repairing paste flag',c['state']['content']['forceMode'] and c['state']['content']['pasteEnabled'] is False and c['paste']['pasted'] is False)
 for n in ['refresh_force_on','refresh_force_off']:check(n,cases[n]['paste']['pasted'])
 expected={'plain':True,'listener':True,'keyboard':True,'inline':False,'input':False,'editable':True}
 check('mechanism-specific results', {p['target']:p['pasted'] for p in cases['mechanisms_popup_enable']['pastes']}==expected)
 check('actual trusted paste events observed',all(p['events'][-1]['isTrusted'] for p in cases['mechanisms_popup_enable']['pastes']))
 check('all mechanisms pass after refresh',all(p['pasted'] for p in cases['mechanisms_after_refresh']['pastes']))
 c=cases['popup_only_off_reload_on']
 check('natural Popup off/reload/on reproduces',c['afterOn']['storage']['user_settings']['pasteEnabled'] and c['afterOn']['content']['pasteEnabled'] is False and c['onPaste']['pasted'] is False)
 check('renaming alone fails validator',cases['causal_same_payload_renamed_only']['validator'] is False and cases['causal_same_payload_renamed_only']['paste']['pasted'] is False)
 check('nested payload invalid',cases['causal_direct_nested_payload']['response']['error']=='Invalid state data')
 check('flat state application restores paste',cases['causal_direct_correct_flat_state']['response']['success'] and cases['causal_direct_correct_flat_state']['paste']['pasted'])
 check('existing reload/apply path restores paste',cases['causal_existing_storage_reload_path']['paste']['pasted'])
 c=cases['causal_remove_inline_only']
 check('removing only inline handler restores paste with stale content',c['after']['content']['pasteEnabled'] is False and c['paste']['pasted'])
 c=cases['popup_disable_reenable_already_loaded']
 check('UI disable does not promptly disable loaded content',c['off']['storage']['user_settings']['pasteEnabled'] is False and c['off']['content']['pasteEnabled'] and c['offPaste']['pasted'])
 # Main run's post-reenable CDP context selector was stale. Use the targeted rerun.
 r=json.loads((out/f'chrome-{v}-reenable.json').read_text());check('targeted reenable rerun completed',not r['errors'])
 c=r['cases'][0]
 check('browser-disabled document blocks paste',c['disabled']['injected'] is False and c['disabledPaste']['pasted'] is False)
 check('reenable before reload has no content receiver',c['beforeReload']['injected'] is False and c['beforeReload']['paste']['pasted'] is False and 'Receiving end does not exist' in c['ping']['error'])
 check('reenable after reload has live content and trusted paste',c['afterReload']['ping']['success'] and c['afterReload']['content']['pasteEnabled'] and c['afterReload']['injected'] and c['afterReload']['paste']['pasted'])
 verified.append({'version':v,'checks':checks,'checkCount':len(checks),'mechanismResults':expected})
result={'evidenceChecksPassed':True,'verified':verified,'scenarioParity':'MATCH','POPUP_PASTE_ROOT_CAUSE':'STATE_SYNC_CONTRACT_AND_USER_SETTINGS_CONSUMPTION','BASELINE_DEFECT_CONFIRMED':'YES_REPOSITORY_1.1.1','NEW_PERMISSION_REGRESSION':'NOT_DETECTED_IN_TESTED_SCOPE','REAL_CHROME_REPRODUCTION':'YES_CHROME_156_ACTION_POPUP_CDP','USER_IMPACT_SEVERITY':'P2_MODERATE_PROPOSED','HOTFIX_RELEASE_READY':'CONDITIONAL_POPUP_NONBLOCKER_OTHER_RELEASE_GATES_OPEN'}
(out/'verdicts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('evidence checks passed:',sum(x['checkCount'] for x in verified))
