[CmdletBinding()]
param(
  [switch]$NoRestart
)

$ErrorActionPreference = 'Stop'

$cfgDir = Join-Path $env:APPDATA 'io.github.clash-verge-rev.clash-verge-rev'
$cfg = Join-Path $cfgDir 'dns_config.yaml'

if (-not (Test-Path -LiteralPath $cfg)) {
  throw "Clash Verge DNS config not found: $cfg"
}

$domains = @(
  '+.github.com',
  '+.githubusercontent.com',
  '+.githubassets.com',
  '+.feishu.cn',
  '+.larkoffice.com'
)

$backup = "$cfg.bak-$(Get-Date -Format yyyyMMddHHmmss)"
Copy-Item -LiteralPath $cfg -Destination $backup -Force

$text = Get-Content -LiteralPath $cfg -Raw -Encoding UTF8
foreach ($domain in $domains) {
  if ($text -match [regex]::Escape($domain)) {
    continue
  }

  $pattern = '(?ms)(  fake-ip-filter:\r?\n(?:  - .*\r?\n)*)(  default-nameserver:)'
  if ($text -notmatch $pattern) {
    throw "Could not locate fake-ip-filter block in $cfg"
  }

  $replacement = '$1' + "  - $domain`r`n" + '$2'
  $text = [regex]::Replace($text, $pattern, $replacement, 1)
}

Set-Content -LiteralPath $cfg -Value $text -Encoding UTF8
Write-Output "Updated Clash fake-ip-filter in: $cfg"
Write-Output "Backup created at: $backup"

if (-not $NoRestart) {
  try {
    Restart-Service -Name clash_verge_service -Force
    Write-Output 'Restarted clash_verge_service'
  } catch {
    Write-Warning "Could not restart clash_verge_service automatically: $($_.Exception.Message)"
    Write-Warning 'Please restart Clash Verge manually, or rerun this script in an elevated PowerShell.'
  }
}

try {
  ipconfig /flushdns | Out-Null
  Write-Output 'Flushed local DNS cache'
} catch {
  Write-Warning "Could not flush DNS cache: $($_.Exception.Message)"
}

Write-Output ''
Write-Output 'Next checks:'
Write-Output '  Resolve-DnsName github.com'
Write-Output '  Resolve-DnsName open.feishu.cn'
Write-Output 'The returned IPs should no longer be in 198.18.0.0/16.'
