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
 $opts=@((Cdp 'Target.getTargets' @{}).targetInfos|Where-Object {$_.url -eq "chrome-extension://$ExtensionId/options/options.html"})
 if($opts.Count -ne 1){throw 'Expected one known Options page'}
 $os=(Cdp 'Target.attachToTarget' @{targetId=$opts[0].targetId;flatten=$true}).sessionId
 $url=$PageURL|ConvertTo-Json -Compress
 $active=Evaluate "(async()=>{const ts=await chrome.tabs.query({url:$url});if(ts.length!==1)throw Error('Expected one test page');await chrome.tabs.update(ts[0].id,{active:true});await chrome.windows.update(ts[0].windowId,{focused:true});return {id:ts[0].id,url:ts[0].url,windowId:ts[0].windowId};})()" $os
 $main=@((Cdp 'Target.getTargets' @{}).targetInfos|Where-Object {$_.url -eq $PageURL})
 $ms=(Cdp 'Target.attachToTarget' @{targetId=$main[0].targetId;flatten=$true}).sessionId
 $null=Cdp 'Page.bringToFront' @{} $ms
 @{page=$active;documentHasFocus=(Evaluate 'document.hasFocus()' $ms);scope='Task browser only; actual input control required separately'}|ConvertTo-Json -Depth 5 -Compress
} finally {$ws.Dispose()}
