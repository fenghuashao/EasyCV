# Actual action Popup, opened using the browser API, operated with trusted CDP
# mouse input. No synthetic DOM click, extension patch, unsafe launch flag or ID change.
param([int]$Port, [string]$ExtensionId, [string]$PageURL, [string]$Selector, [string]$Desired='toggle')
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
  $r=Evaluate "(()=>{const e=document.querySelector($q);if(!e)throw Error('Missing control');const t=e.closest('label')||e;const b=t.getBoundingClientRect();if(!b.width||!b.height)throw Error('Control not visible');return {x:b.x+b.width/2,y:b.y+b.height/2,checked:e.checked,text:e.innerText,url:location.href}})()" $Session
  $null=Cdp 'Input.dispatchMouseEvent' @{type='mouseMoved';x=$r.x;y=$r.y} $Session
  $null=Cdp 'Input.dispatchMouseEvent' @{type='mousePressed';x=$r.x;y=$r.y;button='left';clickCount=1} $Session
  $null=Cdp 'Input.dispatchMouseEvent' @{type='mouseReleased';x=$r.x;y=$r.y;button='left';clickCount=1} $Session
  return $r
}
try {
  $targets=(Cdp 'Target.getTargets' @{}).targetInfos
  $options=@($targets|Where-Object {$_.url -eq "chrome-extension://$ExtensionId/options/options.html"})
  if(-not $options.Count){throw 'No existing task Options context'}
  $os=(Cdp 'Target.attachToTarget' @{targetId=$options[0].targetId;flatten=$true}).sessionId
  $url=$PageURL|ConvertTo-Json -Compress
  $contexts=Evaluate "(async()=>{const ts=await chrome.tabs.query({url:$url});if(ts.length!==1)throw Error('Expected one known task page');await chrome.tabs.update(ts[0].id,{active:true});await chrome.windows.update(ts[0].windowId,{focused:true});await chrome.action.openPopup();return await chrome.runtime.getContexts({contextTypes:['POPUP']});})()" $os
  $popup=$null
  for($i=0;$i -lt 20;$i++){
    $popup=@((Cdp 'Target.getTargets' @{}).targetInfos|Where-Object {$_.url -eq "chrome-extension://$ExtensionId/popup/popup.html"})
    if($popup.Count){break}
    Start-Sleep -Milliseconds 50
  }
  if($popup.Count -ne 1){throw 'Expected exactly one actual Popup target'}
  $ps=(Cdp 'Target.attachToTarget' @{targetId=$popup[0].targetId;flatten=$true}).sessionId
  $read="({url:location.href,mainText:document.getElementById('mainUnlockText').innerText,copy:document.getElementById('copyToggle').checked,paste:document.getElementById('pasteToggle').checked,force:document.getElementById('forceMode').checked})"
  $before=Evaluate $read $ps
  if($Selector -ne '#mainUnlockBtn'){
    $expanded=Evaluate "document.getElementById('advancedSection').open" $ps
    if(-not $expanded){$null=MouseClick '#advancedSection > summary' $ps}
  }
  $needsClick=$true
  if($Desired -ne 'toggle'){
    $want=$Desired -eq 'on'
    if($Selector -eq '#mainUnlockBtn'){$needsClick=($before.copy -ne $want) -or ($before.paste -ne $want)}
    elseif($Selector -eq '#forceMode'){$needsClick=$before.force -ne $want}
  }
  $clicked=if($needsClick){MouseClick $Selector $ps}else{@{skipped='UI already in requested state'}}
  Start-Sleep -Milliseconds 600
  $after=Evaluate $read $ps
  Write-Output ('POPUP_UI_RESULT '+(@{contexts=$contexts;selector=$Selector;desired=$Desired;before=$before;after=$after;clicked=$clicked}|ConvertTo-Json -Depth 8 -Compress))
  $storage=Evaluate "new Promise(r=>chrome.storage.sync.get(['plugin_enabled','force_mode','user_settings','auto_enable_list','excluded_list'],r))" $ps
  # Dismiss the actual Popup before sending any keyboard tests to the page.
  # A Popup can retain native focus even when a CDP tab is selected.
  $null=Evaluate 'setTimeout(()=>window.close(),0);true' $ps
  Start-Sleep -Milliseconds 150
  $main=@((Cdp 'Target.getTargets' @{}).targetInfos|Where-Object {$_.url -eq $PageURL})
  $ms=(Cdp 'Target.attachToTarget' @{targetId=$main[0].targetId;flatten=$true}).sessionId
  $null=Cdp 'Page.bringToFront' @{} $ms
  $focused=Evaluate 'document.hasFocus()' $ms
  @{contexts=$contexts;popupTargetType=$popup[0].type;selector=$Selector;input='Input.dispatchMouseEvent moved/pressed/released';clicked=$clicked;before=$before;after=$after;storage=$storage;pageHasFocusAfterDismiss=$focused;pageFunctionTest='Required separately; UI/storage alone do not prove unlocking'}|ConvertTo-Json -Depth 12 -Compress
} finally {$ws.Dispose()}
