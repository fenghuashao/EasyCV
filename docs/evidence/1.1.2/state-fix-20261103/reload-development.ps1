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
 $es=(Cdp 'Target.getTargets' @{}).targetInfos
 $target=@($es|Where-Object {$_.url -eq 'chrome://extensions/'})[0]
 if(-not $target){throw 'Expected task extension manager'}
 $s=(Cdp 'Target.attachToTarget' @{targetId=$target.targetId;flatten=$true}).sessionId
 $identity=Evaluate "(async()=>{const es=await chrome.developerPrivate.getExtensionsInfo({includeDisabled:true});return es.filter(e=>e.id==='dgckfbbdhlgcjhaihmpdnnhnfpfeaono').map(e=>({id:e.id,version:e.version,state:e.state,location:e.location,path:e.path}))})()" $s
 if($identity.location -ne 'UNPACKED'){throw 'Refuse reload of non-development extension'}
 $null=Evaluate "chrome.developerPrivate.reload('dgckfbbdhlgcjhaihmpdnnhnfpfeaono')" $s
 $r=Cdp 'Target.createTarget' @{url='chrome-extension://dgckfbbdhlgcjhaihmpdnnhnfpfeaono/options/options.html'}
 Start-Sleep -Milliseconds 600
 $o=(Cdp 'Target.attachToTarget' @{targetId=$r.targetId;flatten=$true}).sessionId
 $v=Evaluate "(async()=>({id:chrome.runtime.id,version:chrome.runtime.getManifest().version,permissions:chrome.runtime.getManifest().permissions,forceUI:document.querySelector('#forceMode').checked,settings:await StorageUtils.getPluginSettings(),forceSource:(await fetch(chrome.runtime.getURL('utils/storage-utils.js')).then(r=>r.text())).includes('...userSettings,\n      enabled') }))()" $o
 @{identity=$identity;result=$v;reloadKind='development reload only, NOT store upgrade'}|ConvertTo-Json -Depth 12 -Compress
} finally {$ws.Dispose()}
