/** Native toolbar popup validation. Opens chrome.action.openPopup, never navigates a tab to popup HTML. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(path.dirname(process.execPath),'node_modules/@playwright/cli/node_modules/playwright'));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'docs/evidence/i18n-native-20261103/verified');
const profiles=path.join(root,'.tmp/native-i18n');fs.mkdirSync(out,{recursive:true});fs.mkdirSync(profiles,{recursive:true});
const server=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end('<title>EasyCV native popup fixture</title><p style="user-select:none">Local text</p><textarea></textarea>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port, results=[];
try {
for(const [language,lang] of [['en-US','en'],['zh-CN','zh-CN'],['ja','ja'],['zh-TW','zh-TW'],['ro','en']]){
 let context,browser;const result={language,checks:[],opening:'chrome.action.openPopup()',currentTabOverride:false};results.push(result);
 const check=async(name,fn)=>{await fn();result.checks.push(name);console.log('PASS',language,name);};
 try{
 const profile=fs.mkdtempSync(path.join(profiles,'native-'));
 context=await chromium.launchPersistentContext(profile,{executablePath:path.join(process.env.LOCALAPPDATA,'ms-playwright/chromium-1228/chrome-win64/chrome.exe'),headless:false,locale:language,viewport:null,args:['--remote-debugging-port=0','--lang='+language,'--load-extension='+root,'--disable-extensions-except='+root]});
 const fixture=await context.newPage();await fixture.goto(origin);await fixture.waitForFunction(()=>document.documentElement.dataset.easycvInjected==='true');
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];
 const open=async()=>{
 await fixture.bringToFront();await worker.evaluate(()=>chrome.action.openPopup());
 browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
 const p=browser.contexts()[0].pages().find(p=>p.url().includes('/popup/popup.html'));
 assert.ok(p,'native popup target');p.setDefaultTimeout(10000);
 await p.waitForFunction(()=>document.getElementById('statusText').textContent!==chrome.i18n.getMessage('status_detecting'));
 await p.waitForFunction(()=>!document.getElementById('loadingOverlay').classList.contains('show'));
 await p.locator('.popup-container').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});
 assert.equal(await p.evaluate(()=>chrome.extension.getViews({type:'popup'}).includes(window)),true);
 assert.equal(await p.evaluate(()=>document.documentElement.lang),lang);
 return p;
 };
 let popup=await open();
 const status=async(key)=>popup.waitForFunction(k=>document.getElementById('statusText').textContent===chrome.i18n.getMessage(k),key);
 await check('native popup view, real active tab, locale and initial state',async()=>{await status('status_active');assert.equal(await popup.locator('#currentUrl').innerText(),'127.0.0.1');});
 await popup.screenshot({path:path.join(out,'native-'+language+'.png')});
 await check('native dimensions, help expansion and scroll reachability',async()=>{
 const dimensions=await popup.evaluate(()=>({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth}));result.dimensions=dimensions;
 assert.equal(dimensions.width,380);assert.ok(dimensions.height<=600);assert.ok(dimensions.scroll<=380);
 await popup.locator('#helpBtn').click();assert.equal(await popup.locator('#helpPanel').isVisible(),true);
 await popup.locator('#helpPanel').scrollIntoViewIfNeeded();await popup.screenshot({path:path.join(out,'native-help-'+language+'.png')});
 await popup.locator('#helpBtn').click();
 });
 await check('switch updates fixture and localized state',async()=>{
 await popup.locator('.advanced-summary').click();await popup.locator('label[for="pasteToggle"]').click();await status('status_partial');
 await popup.locator('#testCopyBtn').click();await popup.waitForFunction(()=>document.querySelector('.notification-message').textContent===chrome.i18n.getMessage('copy_check_enabled'));
 });
 await check('closing native view and reopening preserves state',async()=>{
 await popup.evaluate(()=>window.close());
 await popup.waitForEvent('close',{timeout:10000}).catch(()=>{assert.equal(popup.isClosed(),true);});
 popup=await open();await status('status_partial');
 await popup.locator('#mainUnlockBtn').click();await status('status_active');
 });
 await check('native settings action opens options',async()=>{
 await popup.locator('#settingsBtn').click();
 await context.waitForEvent('page',{timeout:3000}).catch(()=>{});
 assert.ok(context.pages().some(p=>p.url().includes('/options/options.html')));
 });
 await check('unsupported browser page is explained in native popup',async()=>{
 await fixture.goto('chrome://settings/');popup=await open();await status('status_unsupported');
 assert.equal(await popup.locator('#testCopyBtn').isDisabled(),true);
 });
 result.pass=true;result.browserVersion=browser.version();
 }catch(error){result.pass=false;result.error=error.stack;console.error('FAIL',language,error.message);}
 finally{await context?.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results},null,2)+'\n');}
}
}finally{await new Promise(r=>server.close(r));}
process.exitCode=results.some(r=>!r.pass)?1:0;
