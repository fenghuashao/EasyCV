// Investigation only. No extension bytes are edited. Synthetic clipboard text only.
// Runs headed official Google Chrome in fresh local profiles; uses CDP for probes.
// Actual action Popup via chrome.action.openPopup(), never popup.html in a tab.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH);
const root=process.cwd();
const output=path.dirname(new URL(import.meta.url).pathname);
const tmp=path.join(root,'.tmp/popup-paste-triage-20261101');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const fixture=fs.readFileSync(root+'/test/fixtures/permission-fix.html','utf8');
const mechanisms=fs.readFileSync(output+'/mechanisms.html','utf8');
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url.includes('mechanisms')?mechanisms:fixture)});
await new Promise(r=>server.listen(18941,'127.0.0.1',r));
const origin='http://easycv.localhost:18941';
const builds=[['1.1.1',root+'/.tmp/permission-recheck-20261101/baseline-source/dist'],['1.1.2',root+'/releases/permission-recheck-20261101/EasyCV-v1.1.2-20261031']];
const results=[];
try {
for(const [version,extensionPath] of builds){
 const out={version,extensionPath,browser:null,cases:[],nativeToolbarMouse:'NOT_RUN: cua getApp timeout / native pipe closed',errors:[]};results.push(out);
 let ctx,bc;
 const save=()=>fs.writeFileSync(output+'/chrome-'+version+'-reenable.json',JSON.stringify(out,null,2)+'\n');
 try{
  const profile=fs.mkdtempSync(tmp+'/chrome-'+version+'-');out.profile=profile;
  ctx=await chromium.launchPersistentContext(profile,{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:false,chromiumSandbox:true,ignoreDefaultArgs:['--disable-extensions'],args:['--no-first-run','--no-default-browser-check'],viewport:null});
  ctx.setDefaultTimeout(5000);out.browser=ctx.browser().version();
  bc=await ctx.browser().newBrowserCDPSession();
  const {id}=await bc.send('Extensions.loadUnpacked',{path:extensionPath});out.extensionId=id;
  const sw=ctx.serviceWorkers().find(w=>w.url().includes(id))||await ctx.waitForEvent('serviceworker');
  await delay(600);
  out.manifest=await sw.evaluate(()=>chrome.runtime.getManifest());
  out.permissions=await sw.evaluate(()=>chrome.permissions.getAll());
  // Passive trace wrapper retains original call / payload / return; no production writes.
  await sw.evaluate(()=>{globalThis.__trace=[];const orig=MessageUtils.sendToContent;MessageUtils.sendToContent=async function(...args){const row={at:Date.now(),tabId:args[0],type:args[1],data:args[2]};__trace.push(row);try{const result=await orig.apply(this,args);row.response=result;return result}catch(e){row.error=e.message;throw e}}});
  const page=await ctx.newPage();await page.addInitScript(()=>{window.__triageTiming=[];const log=label=>__triageTiming.push({label,t:performance.now(),readyState:document.readyState});log('init');document.addEventListener('DOMContentLoaded',()=>log('DOMContentLoaded'));new MutationObserver(ms=>{for(const m of ms){for(const n of m.addedNodes){if(n.nodeName==='SCRIPT'&&n.src?.includes('/content/injector.js'))log('injector-script-added')}if(m.type==='attributes'&&m.attributeName==='data-easycv-injected')log('injector-main-marker')}}).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['data-easycv-injected']})});const pc=await ctx.newCDPSession(page);let contexts=[];
  pc.on('Runtime.executionContextCreated',e=>contexts.push(e.context));pc.on('Runtime.executionContextsCleared',()=>contexts=[]);pc.on('Runtime.executionContextDestroyed',e=>contexts=contexts.filter(c=>c.id!==e.executionContextId));await pc.send('Runtime.enable');
  const isolated=async expression=>{
   const c=contexts.filter(c=>c.origin===`chrome-extension://${id}`).at(-1);
   if(!c)return {unavailable:'no content context'};
   const r=await pc.send('Runtime.evaluate',{expression,contextId:c.id,returnByValue:true,awaitPromise:true});
   return r.exceptionDetails?{exception:r.exceptionDetails.text}:r.result.value;
  };
  const store=()=>sw.evaluate(()=>chrome.storage.sync.get(['plugin_enabled','force_mode','user_settings','excluded_list','auto_enable_list']));
  const snap=async()=>({storage:await store(),content:await isolated(`(()=>{const m=window.copyPasteManager;return m?{isEnabled:m.isEnabled,copyEnabled:m.copyEnabled,pasteEnabled:m.pasteEnabled,forceMode:m.forceMode,lastKnownState:m.lastKnownState}:null})()`),main:await page.evaluate(()=>({timing:window.__triageTiming,readyState:document.readyState,injected:!!window.EasyCVInjected,wrapper:Event.prototype.preventDefault.toString(),targets:[...document.querySelectorAll('textarea,input,[contenteditable]')].map(el=>({id:el.id,onpaste:el.getAttribute('onpaste'),handler:String(el.onpaste),value:el.value??el.textContent})),time:performance.now()}))});
  const configure=async({copy=true,paste=true,plugin=true,force=false}={})=>{await sw.evaluate(async s=>{await chrome.storage.sync.set({plugin_enabled:s.plugin,force_mode:s.force,excluded_list:[],auto_enable_list:[],user_settings:{...StorageUtils.DEFAULT_SETTINGS,copyEnabled:s.copy,pasteEnabled:s.paste}})}, {copy,paste,plugin,force});await delay(500)};
  const load=async route=>{await page.goto(origin+route);await delay(900)};
  const paste=async target=>{
   await page.bringToFront();await page.locator('#'+target).evaluate(el=>{if('value'in el)el.value='';else el.textContent=''});
   const marker='EASYCV_TRIAGE_'+target;
   await page.evaluate(t=>navigator.clipboard.writeText(t),marker);await page.locator('#'+target).focus();
   await page.keyboard.press('Meta+v');await delay(250);
   return await page.evaluate(({target,marker})=>{const el=document.getElementById(target);const value=el.value??el.textContent;return {target,marker,value,pasted:value===marker,onpaste:el.getAttribute('onpaste'),events:window.triageEvents?.filter(e=>e.id===target)}},{target,marker});
  };
  await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin});
  async function openPopup(){
   await page.bringToFront();await sw.evaluate(()=>chrome.action.openPopup());
   let target;
   for(let i=0;i<30;i++){target=(await bc.send('Target.getTargets')).targetInfos.find(t=>t.url===`chrome-extension://${id}/popup/popup.html`);if(target)break;await delay(100)}
   if(!target)throw Error('actual action Popup target absent');
   const {sessionId}=await bc.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
   let seq=0;const pending=new Map();
   const listener=ev=>{if(ev.sessionId!==sessionId)return;const m=JSON.parse(ev.message);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}};
   bc.on('Target.receivedMessageFromTarget',listener);
   const send=(method,params={})=>new Promise((resolve,reject)=>{const msgId=++seq;pending.set(msgId,{resolve,reject});bc.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:msgId,method,params})}).catch(reject)});
   const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
   for(let i=0;i<40;i++){if(await evaluate('!!document.getElementById("mainUnlockBtn") && !document.getElementById("mainUnlockBtn").disabled && document.getElementById("currentUrl").textContent.includes("easycv.localhost")'))break;await delay(100)}
   const context=await sw.evaluate(()=>chrome.runtime.getContexts({contextTypes:['POPUP']}));
   const state=await evaluate('({copy:document.getElementById("copyToggle").checked,paste:document.getElementById("pasteToggle").checked,force:document.getElementById("forceMode").checked,url:document.getElementById("currentUrl").textContent})');
   return {evaluate,context,state,target,async screenshot(name){const r=await send('Page.captureScreenshot');fs.writeFileSync(output+'/'+version+'-'+name+'.png',Buffer.from(r.data,'base64'))},async close(){bc.off('Target.receivedMessageFromTarget',listener);await bc.send('Target.closeTarget',{targetId:target.targetId})}};
  }
  const record=async(name,body)=>{if(name!=='browser_extension_disable_reenable')return;console.log(version+' '+name);const row={name};out.cases.push(row);try{Object.assign(row,await body())}catch(e){row.error=e.stack;out.errors.push({name,error:e.message})}save()};
  await record('negative_control_disabled',async()=>{await configure({plugin:false});await load('/mechanisms');return {state:await snap(),paste:await paste('inline')}});
  await record('first_install_defaults',async()=>{await configure();await load('/mechanisms');return {state:await snap(),paste:await paste('inline')}});
  await record('popup_enable_ordinary',async()=>{
   await configure({copy:false,paste:false});await load('/fixture');const before=await snap();
   const popup=await openPopup();const popupContext=popup.context;const popupBefore=popup.state;
   await popup.evaluate('document.getElementById("mainUnlockBtn").click()');await delay(1200);
   const popupAfter=await popup.evaluate('({copy:document.getElementById("copyToggle").checked,paste:document.getElementById("pasteToggle").checked,button:document.getElementById("mainUnlockBtn").textContent})');await popup.screenshot('popup-enabled');await popup.close();
   return {before,popupContext,popupBefore,popupAfter,after:await snap(),paste:await paste('pasteTarget'),trace:await sw.evaluate(()=>__trace.slice(-15))};
  });
  await record('popup_force_after_enable',async()=>{const popup=await openPopup();await popup.evaluate('document.getElementById("forceMode").click()');await delay(1200);const popupAfter=await popup.evaluate('({copy:document.getElementById("copyToggle").checked,paste:document.getElementById("pasteToggle").checked,force:document.getElementById("forceMode").checked})');await popup.close();return {popupAfter,state:await snap(),paste:await paste('pasteTarget')}});
  await record('refresh_force_on',async()=>{await page.reload();await delay(900);return {state:await snap(),paste:await paste('pasteTarget')}});
  await record('refresh_force_off',async()=>{await configure();await load('/fixture');return {state:await snap(),paste:await paste('pasteTarget')}});
  await record('mechanisms_popup_enable',async()=>{
   await configure({copy:false,paste:false});await load('/mechanisms');const popup=await openPopup();await popup.evaluate('document.getElementById("mainUnlockBtn").click()');await delay(1200);await popup.close();const state=await snap();const pastes=[];for(const t of ['plain','listener','keyboard','inline','input','editable'])pastes.push(await paste(t));return {state,pastes};
  });
  await record('mechanisms_after_refresh',async()=>{await page.reload();await delay(900);const state=await snap();const pastes=[];for(const t of ['plain','listener','keyboard','inline','input','editable'])pastes.push(await paste(t));return {state,pastes}});
  await record('popup_only_off_reload_on',async()=>{
   await configure();await load('/fixture');const off=await openPopup();await off.evaluate('document.getElementById("mainUnlockBtn").click()');await delay(1000);await off.close();
   await page.reload();await delay(900);const afterOffReload=await snap();const offPaste=await paste('pasteTarget');
   const on=await openPopup();const uiBefore=on.state;await on.evaluate('document.getElementById("mainUnlockBtn").click()');await delay(1000);await on.close();return {afterOffReload,offPaste,uiBefore,afterOn:await snap(),onPaste:await paste('pasteTarget')};
  });
  // Runtime-only causal experiments. These do NOT edit shipped bytes or count as fixed builds.
  await record('causal_same_payload_renamed_only',async()=>{
   await configure({copy:false,paste:false});await load('/fixture');const popup=await openPopup();await popup.evaluate('document.getElementById("mainUnlockBtn").click()');await delay(1000);await popup.close();
   const r=await sw.evaluate(async()=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});return chrome.tabs.sendMessage(tab.id,{type:'STATE_BROADCAST',data:{updates:{copyEnabled:true,pasteEnabled:true},newState:await backgroundManager.stateManager.getPluginState()}})});
   return {response:r??null,validator:await isolated(`MessageUtils.isValidMessage({type:'STATE_BROADCAST'})`),state:await snap(),paste:await paste('pasteTarget')};
  });
  await record('causal_direct_nested_payload',async()=>{
   const r=await isolated(`copyPasteManager.handleStateBroadcast({updates:{copyEnabled:true,pasteEnabled:true},newState:{pluginEnabled:true,forceMode:false,userSettings:{copyEnabled:true,pasteEnabled:true}}})`);
   return {response:r,state:await snap(),paste:await paste('pasteTarget')};
  });
  await record('causal_direct_correct_flat_state',async()=>{
   const r=await isolated(`copyPasteManager.handleStateBroadcast({isEnabled:true,copyEnabled:true,pasteEnabled:true,forceMode:false})`);await delay(600);return {response:r,state:await snap(),paste:await paste('pasteTarget')};
  });
  await record('causal_existing_storage_reload_path',async()=>{
   await configure({copy:false,paste:false});await load('/fixture');const popup=await openPopup();await popup.evaluate('document.getElementById("mainUnlockBtn").click()');await delay(1000);await popup.close();
   const r=await isolated(`(async()=>{await copyPasteManager.loadSettingsWithRetry();await copyPasteManager.applyCurrentState();return true})()`);await delay(500);return {response:r,state:await snap(),paste:await paste('pasteTarget')};
  });
  await record('causal_remove_inline_only',async()=>{
   await configure({copy:false,paste:false});await load('/fixture');const popup=await openPopup();await popup.evaluate('document.getElementById("mainUnlockBtn").click()');await delay(1000);await popup.close();
   const before=await snap();await page.evaluate(()=>{document.querySelector('#pasteTarget').onpaste=null;document.querySelector('#pasteTarget').removeAttribute('onpaste')});return {before,after:await snap(),paste:await paste('pasteTarget')};
  });
  await record('popup_disable_reenable_already_loaded',async()=>{
   await configure();await load('/fixture');const popup=await openPopup();await popup.evaluate('document.getElementById("mainUnlockBtn").click()');await delay(1000);await popup.close();const off=await snap();const offPaste=await paste('pasteTarget');
   const popup2=await openPopup();await popup2.evaluate('document.getElementById("mainUnlockBtn").click()');await delay(1000);await popup2.close();return {off,offPaste,on:await snap(),onPaste:await paste('pasteTarget')};
  });
  await record('browser_extension_disable_reenable',async()=>{
   await configure();const manager=ctx.pages().find(p=>p.url().startsWith('chrome://extensions'))||await ctx.newPage();await manager.goto('chrome://extensions/');
   out.extensionManagerApi=await manager.evaluate(()=>({management:typeof chrome.management?.setEnabled}));
   const priorStorage=await store();await manager.evaluate(id=>chrome.management.setEnabled(id,false),id);await load('/fixture');const disabled={priorStorage,content:await isolated('!!window.copyPasteManager'),injected:await page.evaluate(()=>!!window.EasyCVInjected)};const disabledPaste=await paste('pasteTarget');
   await manager.evaluate(id=>chrome.management.setEnabled(id,true),id);await delay(1000);
   // sw has been terminated; use newly started worker for actual status and ping.
   const revived=ctx.serviceWorkers().find(w=>w.url().includes(id)&&w!==sw)||await ctx.waitForEvent('serviceworker',{timeout:5000});
   const beforeReload={content:await isolated('!!window.copyPasteManager'),injected:await page.evaluate(()=>!!window.EasyCVInjected),paste:await paste('pasteTarget'),storage:await revived.evaluate(()=>chrome.storage.sync.get(['plugin_enabled','force_mode','user_settings']))};
   const ping=await revived.evaluate(async()=>{const [t]=await chrome.tabs.query({active:true,currentWindow:true});try{return await chrome.tabs.sendMessage(t.id,{type:'ping'})}catch(e){return {error:e.message}}});
   await page.reload();await delay(900);return {disabled,disabledPaste,beforeReload,ping,afterReload:{ping:await revived.evaluate(async()=>{const [t]=await chrome.tabs.query({active:true,currentWindow:true});return chrome.tabs.sendMessage(t.id,{type:'ping'})}),worlds:contexts,content:await isolated('({isEnabled:window.copyPasteManager?.isEnabled,copyEnabled:window.copyPasteManager?.copyEnabled,pasteEnabled:window.copyPasteManager?.pasteEnabled})'),paste:await paste('pasteTarget'),injected:await page.evaluate(()=>!!window.EasyCVInjected)}};
  });
 }catch(e){out.errors.push({name:'setup',error:e.stack})}finally{save();if(ctx)await ctx.close()}
}
}finally{await new Promise(r=>server.close(r))}
console.log(JSON.stringify(results.map(x=>({version:x.version,cases:x.cases.length,errors:x.errors})),null,2));
