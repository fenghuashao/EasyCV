# Actual action Popup, opened using the browser API, operated with trusted CDP
# mouse input. No synthetic DOM click, extension patch, unsafe launch flag or ID change.
param([int]$Port, [string]$ExtensionId, [string]$PageURL, [string]$Selector, [string]$Desired='toggle', [string]$Phase='main')
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$version=Invoke-RestMethod "http://127.0.0.1:$Port/json/version"
$ws=[Net.WebSockets.ClientWebSocket]::new()
$null=$ws.ConnectAsync([uri]$version.webSocketDebuggerUrl,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
$script:seq=0
function Cdp([string]$Method, [hashtable]$Params, [string]$Session='') {
  $script:seq++
  $id=$script:seq
  [Console]::Error.WriteLine("CDP_REQUEST $id $Method")
  $request=@{id=$id;method=$Method;params=$Params}
  if($Session){$request.sessionId=$Session}
  $bytes=[Text.Encoding]::UTF8.GetBytes(($request|ConvertTo-Json -Depth 20 -Compress))
  $cts=[Threading.CancellationTokenSource]::new(10000)
  try {
    $null=$ws.SendAsync([ArraySegment[byte]]::new($bytes),[Net.WebSockets.WebSocketMessageType]::Text,$true,$cts.Token).GetAwaiter().GetResult()
    while($true){
      $stream=[IO.MemoryStream]::new()
      do {
        $buffer=New-Object byte[] 65536
        $frame=$ws.ReceiveAsync([ArraySegment[byte]]::new($buffer),$cts.Token).GetAwaiter().GetResult()
        $stream.Write($buffer,0,$frame.Count)
      } while(-not $frame.EndOfMessage)
      $message=[Text.Encoding]::UTF8.GetString($stream.ToArray())|ConvertFrom-Json
      $stream.Dispose()
      if($message.id -eq $id){
        if($message.error){throw ($message.error|ConvertTo-Json -Compress)}
        return $message.result
      }
    }
  } finally {$cts.Dispose()}
}
function Evaluate([string]$Code,[string]$Session){
  $r=Cdp 'Runtime.evaluate' @{expression=$Code;awaitPromise=$true;returnByValue=$true} $Session
  if($r.exceptionDetails){throw ($r.exceptionDetails|ConvertTo-Json -Depth 5 -Compress)}
  return $r.result.value
}
function MouseClick([string]$CSS,[string]$Session){
  $q=$CSS|ConvertTo-Json -Compress
  $r=Evaluate "(()=>{const e=document.querySelector($q);if(!e)throw Error('Missing control');const t=e.closest('label')||e;t.scrollIntoView({block:'center'});const b=t.getBoundingClientRect();if(!b.width||!b.height)throw Error('Control not visible');return {x:b.x+b.width/2,y:b.y+b.height/2,checked:e.checked,text:e.innerText,url:location.href}})()" $Session
  $null=Cdp 'Input.dispatchMouseEvent' @{type='mouseMoved';x=$r.x;y=$r.y} $Session
  $null=Cdp 'Input.dispatchMouseEvent' @{type='mousePressed';x=$r.x;y=$r.y;button='left';clickCount=1} $Session
  $null=Cdp 'Input.dispatchMouseEvent' @{type='mouseReleased';x=$r.x;y=$r.y;button='left';clickCount=1} $Session
  return $r
}

$script:checks=[Collections.Generic.List[object]]::new()
function Verify([bool]$Condition,[string]$Name,$Details=$null){
 $record=@{name=$Name;pass=$Condition;details=$Details};$script:checks.Add($record)
 Write-Output ('CHECK '+($record|ConvertTo-Json -Depth 14 -Compress))
 if(-not $Condition){throw "Failed: $Name"}
}
function PageSession([string]$Url,[bool]$Reload=$false){
 $t=@((Cdp 'Target.getTargets' @{}).targetInfos|Where-Object {$_.url -eq $Url})
 if($t.Count){$id=$t[0].targetId}else{$id=(Cdp 'Target.createTarget' @{url=$Url}).targetId}
 $s=(Cdp 'Target.attachToTarget' @{targetId=$id;flatten=$true}).sessionId
 if($Reload){$null=Cdp 'Page.navigate' @{url=$Url} $s}
 $null=Cdp 'Page.bringToFront' @{} $s
 for($i=0;$i -lt 50;$i++){
  $q=$Url|ConvertTo-Json -Compress
  try{if(Evaluate "document.readyState==='complete' && location.href===$q" $s){break}}catch{}
  Start-Sleep -Milliseconds 100
 }
 Start-Sleep -Milliseconds 450
 if(-not(Evaluate "location.href===$q" $s)){throw "Test navigation did not reach $Url"}
 return $s
}
function Key([string]$Key,[int]$VK,[int]$Modifiers,[string]$Session){
 $null=Cdp 'Input.dispatchKeyEvent' @{type='keyDown';key=$Key;windowsVirtualKeyCode=$VK;nativeVirtualKeyCode=$VK;modifiers=$Modifiers} $Session
 $null=Cdp 'Input.dispatchKeyEvent' @{type='keyUp';key=$Key;windowsVirtualKeyCode=$VK;nativeVirtualKeyCode=$VK;modifiers=$Modifiers} $Session
}
function Fill([string]$CSS,[string]$Text,[string]$Session){
 $null=MouseClick $CSS $Session
 Key 'a' 65 2 $Session
 Key 'Backspace' 8 0 $Session
 if($Text){$null=Cdp 'Input.insertText' @{text=$Text} $Session}
}
function Checked([string]$CSS,[bool]$Value,[string]$Session){
 $q=$CSS|ConvertTo-Json -Compress
 if((Evaluate "document.querySelector($q).checked" $Session) -ne $Value){$null=MouseClick $CSS $Session}
 Start-Sleep -Milliseconds 350
}
function ReadSettings([string]$Session){
 return Evaluate "(async()=>({id:chrome.runtime.id,version:chrome.runtime.getManifest().version,forceUI:document.querySelector('#forceMode').checked,delayUI:document.querySelector('#detectionDelay').value,storage:await chrome.storage.sync.get(['plugin_enabled','force_mode','user_settings','auto_enable_list','excluded_list'])}))()" $Session
}
function Popup([string]$CSS,[bool]$Want){
 $null=PageSession $baseUrl
 $url=$baseUrl|ConvertTo-Json -Compress
 $contexts=Evaluate "(async()=>{const ts=await chrome.tabs.query({url:$url});if(ts.length!==1)throw Error('expected task tab');await chrome.tabs.update(ts[0].id,{active:true});await chrome.windows.update(ts[0].windowId,{focused:true});await chrome.action.openPopup();return await chrome.runtime.getContexts({contextTypes:['POPUP']})})()" $script:options
 $t=@((Cdp 'Target.getTargets' @{}).targetInfos|Where-Object {$_.url -eq "chrome-extension://$ExtensionId/popup/popup.html"})
 if($t.Count -ne 1){throw 'Expected one actual Popup'}
 $s=(Cdp 'Target.attachToTarget' @{targetId=$t[0].targetId;flatten=$true}).sessionId
 Start-Sleep -Milliseconds 300
 if($CSS -eq '#mainUnlockBtn'){
  $state=Evaluate "({copy:document.querySelector('#copyToggle').checked,paste:document.querySelector('#pasteToggle').checked})" $s
  if($state.copy -ne $Want -or $state.paste -ne $Want){$null=MouseClick $CSS $s}
 }else{
  if(-not(Evaluate "document.querySelector('#advancedSection').open" $s)){$null=MouseClick '#advancedSection > summary' $s}
  Checked $CSS $Want $s
 }
 Start-Sleep -Milliseconds 500
 $state=Evaluate "({copy:document.querySelector('#copyToggle').checked,paste:document.querySelector('#pasteToggle').checked,force:document.querySelector('#forceMode').checked})" $s
 Verify ($contexts.contextType -eq 'POPUP' -and $contexts.tabId -eq -1) "native Popup $CSS=$Want" $state
 $null=Evaluate 'setTimeout(()=>window.close(),0);true' $s
 for($i=0;$i -lt 20;$i++){
  $open=@((Cdp 'Target.getTargets' @{}).targetInfos|Where-Object {$_.url -eq "chrome-extension://$ExtensionId/popup/popup.html"})
  if(-not $open.Count){break}
  Start-Sleep -Milliseconds 100
 }
 $null=PageSession $baseUrl
}
function Probe([string]$Url,[bool]$Enabled,[string]$Token,[string]$Name){
 $s=PageSession $Url
 $focus=Evaluate 'document.hasFocus()' $s
 if(-not $focus){throw 'Keyboard probe has no page focus'}
 Fill '#plain' $Token $s
 Key 'a' 65 2 $s
 Key 'c' 67 2 $s
 foreach($field in @('plain','inline','input','listener','keyboard')){
  Fill "#$field" '' $s
  Key 'v' 86 2 $s
  Start-Sleep -Milliseconds 80
 }
 $values=Evaluate "({values:Object.fromEntries(['plain','inline','input','listener','keyboard'].map(k=>[k,document.getElementById(k).value])),events:window.testEvents,select:getComputedStyle(document.getElementById('restricted')).userSelect})" $s
 $pass=$values.values.plain -eq $Token
 foreach($field in @('inline','input','listener','keyboard')){
  $expected=if($Enabled){$Token}else{''}
  $pass=$pass -and ($values.values.$field -eq $expected)
  if($Enabled){$pass=$pass -and @($values.events|Where-Object {$_.id -eq $field -and $_.trusted -and -not $_.prevented}).Count -gt 0}
 }
 Verify $pass $Name $values
}
$baseUrl='http://127.0.0.1:18963/mechanisms.html?statefix=a'
$secondUrl='http://localhost:18963/mechanisms.html?statefix=b'
$optionsUrl="chrome-extension://$ExtensionId/options/options.html"
$status='FAIL'
try {
 $browser=Cdp 'Browser.getVersion' @{}
 $script:options=PageSession $optionsUrl $true
 if($Phase -eq 'main'){
  Checked '#forceMode' $false $script:options
  Checked '#forceMode' $true $script:options
  $script:options=PageSession $optionsUrl $true
  $v=ReadSettings $script:options
  Verify ($v.forceUI -and $v.storage.force_mode) 'force-mode refresh reads saved value' $v
  $null=MouseClick '#showNotifications' $script:options
  Start-Sleep -Milliseconds 350
  $v=ReadSettings $script:options
  Verify ($v.storage.force_mode) 'unrelated Options save preserves force mode' $v
  $null=PageSession $baseUrl $true
  Popup '#forceMode' $false
  Popup '#mainUnlockBtn' $false
  $null=PageSession $baseUrl $true
  $null=PageSession $secondUrl $true
  Probe $baseUrl $false 'EASYCV_WIN_NEGATIVE' 'off baseline: four restrictions effective'
  Popup '#mainUnlockBtn' $true
  Probe $baseUrl $true 'EASYCV_WIN_ON_A' 'Popup enables tab A without refresh'
  Probe $secondUrl $true 'EASYCV_WIN_ON_B' 'Popup enables existing tab B without refresh'
  Popup '#mainUnlockBtn' $false
  Probe $baseUrl $false 'EASYCV_WIN_OFF_A' 'Popup restores restrictions without refresh'
  Popup '#mainUnlockBtn' $true
  Probe $baseUrl $true 'EASYCV_WIN_ON_AGAIN' 'Popup re-enable without refresh'
  Popup '#forceMode' $true
  $script:options=PageSession $optionsUrl $true
  $v=ReadSettings $script:options
  Verify ($v.forceUI -and $v.storage.force_mode) 'Popup force mode visible in Options' $v
 }elseif($Phase -eq 'auto'){
  $null=MouseClick '[data-tab="whitelist"]' $script:options
  Fill '#whitelistInput' 'statefix.localhost' $script:options
  $null=MouseClick '#addWhitelistBtn' $script:options
  Start-Sleep -Milliseconds 400
  $v=ReadSettings $script:options
  Verify (@($v.storage.auto_enable_list|Where-Object {$_.domain -eq 'statefix.localhost'}).Count -eq 1) 'auto list saved through UI' $v
  Popup '#mainUnlockBtn' $false
  $null=PageSession $baseUrl $true
  Probe $baseUrl $false 'EASYCV_WIN_AUTO_NEG' 'unlisted page remains restricted before auto visit'
  Probe 'http://statefix.localhost:18963/mechanisms.html?first' $true 'EASYCV_WIN_AUTO_FIRST' 'auto first visit unlocks without refresh'
  $script:options=PageSession $optionsUrl $true
  $null=MouseClick '[data-tab="excluded"]' $script:options
  Fill '#excludedInput' 'statefix.localhost' $script:options
  $null=MouseClick '#addExcludedBtn' $script:options
  Start-Sleep -Milliseconds 400
  Probe 'http://statefix.localhost:18963/mechanisms.html?excluded' $false 'EASYCV_WIN_EXCLUDED' 'exclusion wins over automatic enable and force mode'
  $script:options=PageSession $optionsUrl $true
  Checked '#forceMode' $true $script:options
  Fill '#detectionDelay' '1900' $script:options
  Key 'Tab' 9 0 $script:options
  Start-Sleep -Milliseconds 400
  $v=ReadSettings $script:options
  Verify ($v.storage.force_mode -and $v.storage.user_settings.detectionDelay -eq 1900) 'nondefault settings prepared for normal restart' $v
 }elseif($Phase -eq 'prepare'){
  Fill '#detectionDelay' '1900' $script:options
  Key 'Tab' 9 0 $script:options
  Start-Sleep -Milliseconds 450
  $v=ReadSettings $script:options
  Verify ($v.storage.force_mode -and $v.storage.user_settings.detectionDelay -eq 1900) 'nondefault settings prepared through visible numeric input' $v
 }elseif($Phase -eq 'copy'){
  $s=PageSession $baseUrl
  $r=Evaluate "(()=>{const e=document.getElementById('restricted');e.scrollIntoView({block:'center'});const r=document.createRange();r.selectNodeContents(e);const b=r.getBoundingClientRect();return {x:b.x,y:b.y+b.height/2,right:b.right}})()" $s
  $null=Cdp 'Input.dispatchMouseEvent' @{type='mouseMoved';x=($r.x+1);y=$r.y} $s
  $null=Cdp 'Input.dispatchMouseEvent' @{type='mousePressed';x=($r.x+1);y=$r.y;button='left';buttons=1;clickCount=1} $s
  for($i=1;$i -le 10;$i++){$null=Cdp 'Input.dispatchMouseEvent' @{type='mouseMoved';x=($r.x+($r.right-$r.x+2)*$i/10);y=$r.y;button='left';buttons=1} $s;Start-Sleep -Milliseconds 20}
  $null=Cdp 'Input.dispatchMouseEvent' @{type='mouseReleased';x=($r.right+1);y=$r.y;button='left';clickCount=1} $s
  $selection=Evaluate 'getSelection().toString()' $s
  Key 'c' 67 2 $s
  Fill '#plain' '' $s
  Key 'v' 86 2 $s
  $value=Evaluate "document.getElementById('plain').value" $s
  Verify ($selection -eq 'EASYCV_STATE_COPY_TEXT' -and $value -eq $selection) 'trusted mouse selection and real copy/paste' @{selection=$selection;pasted=$value;geometry=$r;focus=(Evaluate 'document.hasFocus()' $s);style=(Evaluate "getComputedStyle(document.querySelector('#restricted')).userSelect" $s)}
 }elseif($Phase -eq 'restart'){
  $v=ReadSettings $script:options
  Verify ($v.forceUI -and $v.storage.force_mode -and $v.storage.user_settings.detectionDelay -eq 1900) 'normal restart preserves settings and force UI' $v
  Verify (@($v.storage.auto_enable_list|Where-Object {$_.domain -eq 'statefix.localhost'}).Count -eq 1 -and $v.storage.excluded_list -contains 'statefix.localhost') 'normal restart preserves both site lists' $v
  Probe $baseUrl $true 'EASYCV_WIN_RESTART' 'real paste after normal browser restart'
  Probe 'http://statefix.localhost:18963/mechanisms.html?restart' $false 'EASYCV_WIN_RESTART_EXCLUDED' 'excluded page remains restricted after restart'
 }
 $status='PASS'
} catch {
 Write-Output ('FAILURE '+$_.Exception.Message)
} finally {
 Write-Output ('SUMMARY '+(@{status=$status;phase=$Phase;browser=$browser;checks=$script:checks}|ConvertTo-Json -Depth 18 -Compress))
 $ws.Dispose()
}
if($status -ne 'PASS'){exit 1}
