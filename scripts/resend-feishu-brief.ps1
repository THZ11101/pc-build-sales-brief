[CmdletBinding()]
param(
  [Parameter()]
  [string]$Date = (Get-Date).ToString('yyyy-MM-dd'),

  [Parameter()]
  [string]$Webhook = $env:FEISHU_WEBHOOK,

  [Parameter()]
  [string]$BaseUrl = 'https://thz11101.github.io/pc-build-sales-brief',

  [Parameter()]
  [switch]$IncludeLinks
)

$ErrorActionPreference = 'Stop'

if (-not $Webhook) {
  throw 'Missing FEISHU_WEBHOOK. Set the environment variable or pass -Webhook.'
}

$root = Split-Path -Parent $PSScriptRoot
$dataPath = Join-Path $root "brief-data\$Date.json"
if (-not (Test-Path -LiteralPath $dataPath)) {
  throw "Missing brief data: $dataPath"
}

$data = Get-Content -LiteralPath $dataPath -Raw -Encoding UTF8 | ConvertFrom-Json

$sectionLines = @(
  foreach ($section in $data.sections) {
    $titles = @(
      foreach ($item in $section.items) {
        (($item.title -split '\|')[0]).Trim()
      }
    ) -join ' / '
    "**$($section.name)**: $titles"
  }
) -join "`n"

$elements = @(
  @{
    tag = 'markdown'
    content = "**$($data.homepage.headline)**`n$($data.homepage.summary)"
  },
  @{
    tag = 'markdown'
    content = $sectionLines
  }
)

if ($IncludeLinks) {
  $briefUrl = "$($BaseUrl.TrimEnd('/'))/briefs/$Date.html"
  $imageUrl = "$($BaseUrl.TrimEnd('/'))/share-images/$Date.png"
  $elements += @{
    tag = 'markdown'
    content = "[Read brief]($briefUrl)`n[Open share image]($imageUrl)"
  }
} else {
  $elements += @{
    tag = 'markdown'
    content = 'Note: GitHub Pages is not published yet, so this resend only includes the local summary card.'
  }
}

$payload = @{
  msg_type = 'interactive'
  card = @{
    config = @{
      wide_screen_mode = $true
    }
    header = @{
      template = 'green'
      title = @{
        tag = 'plain_text'
        content = "$($data.chineseTitle) | $Date"
      }
    }
    elements = $elements
  }
} | ConvertTo-Json -Depth 8 -Compress

try {
  $response = Invoke-RestMethod -Uri $Webhook -Method Post -ContentType 'application/json; charset=utf-8' -Body $payload
} catch {
  throw "Webhook request failed: $($_.Exception.Message)"
}

if ($response.code -ne 0) {
  throw "Feishu API error: $($response | ConvertTo-Json -Depth 8 -Compress)"
}

Write-Output "Sent Feishu brief for $Date"
Write-Output ($response | ConvertTo-Json -Depth 8 -Compress)
