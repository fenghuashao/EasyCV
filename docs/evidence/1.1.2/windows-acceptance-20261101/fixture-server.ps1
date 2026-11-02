# Test-only loopback HTTP server. No urlacl, firewall, hosts, VM or policy changes.
# Serve only the two copied public test fixtures from the explicitly passed test folder.
param([Parameter(Mandatory=$true)][string]$TestDirectory, [int]$Port = 18951)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($TestDirectory)
$allowed = @{
  '/' = 'mechanisms.html'
  '/mechanisms.html' = 'mechanisms.html'
  '/permission-fix.html' = 'permission-fix.html'
}
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
$listener.Start()
try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 5000
      $stream = $client.GetStream()
      $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
      $request = $reader.ReadLine()
      $headerBytes = 0
      while (($line = $reader.ReadLine()) -and $headerBytes -lt 8192) {
        $headerBytes += $line.Length
      }
      $parts = $request.Split(' ')
      $path = if ($parts.Length -ge 2) { $parts[1].Split('?')[0] } else { '' }
      if ($parts[0] -eq 'GET' -and $allowed.ContainsKey($path)) {
        $body = [IO.File]::ReadAllBytes([IO.Path]::Combine($root, $allowed[$path]))
        $status = '200 OK'
      } else {
        $body = [Text.Encoding]::UTF8.GetBytes('Not found')
        $status = '404 Not Found'
      }
      $header = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 $status`r`nContent-Type: text/html; charset=utf-8`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n")
      $stream.Write($header, 0, $header.Length)
      $stream.Write($body, 0, $body.Length)
      $stream.Flush()
    } catch {
      # A disconnected test tab is not a server-wide failure.
    } finally {
      $client.Dispose()
    }
  }
} finally {
  $listener.Stop()
}
