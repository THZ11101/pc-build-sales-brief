Add-Type -AssemblyName System.Drawing
$data = Get-Content -Raw -Encoding UTF8 -Path 'brief-data/2026-06-05.json' | ConvertFrom-Json
$w = 1480; $h = 3100
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$bg = [System.Drawing.ColorTranslator]::FromHtml('#F3F1EC')
$paper = [System.Drawing.ColorTranslator]::FromHtml('#FCFBF8')
$ink = [System.Drawing.ColorTranslator]::FromHtml('#121212')
$body = [System.Drawing.ColorTranslator]::FromHtml('#2E3330')
$muted = [System.Drawing.ColorTranslator]::FromHtml('#66706D')
$primary = [System.Drawing.ColorTranslator]::FromHtml('#6F9F99')
$light = [System.Drawing.ColorTranslator]::FromHtml('#EEF6F3')
$line = [System.Drawing.Color]::FromArgb(56,17,17,17)
$g.Clear($bg)
$paperBrush = New-Object System.Drawing.SolidBrush $paper
$g.FillRectangle($paperBrush, 58, 36, 1364, 3028)
$gridPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(18,17,17,17)), 1
for ($x=98; $x -lt 1380; $x += 38) { $g.DrawLine($gridPen, $x, 92, $x, 3020) }
for ($y=92; $y -lt 3020; $y += 38) { $g.DrawLine($gridPen, 98, $y, 1380, $y) }
$titleFont = New-Object System.Drawing.Font 'Georgia', 42, ([System.Drawing.FontStyle]::Bold)
$brandFont = New-Object System.Drawing.Font 'Microsoft YaHei UI', 10, ([System.Drawing.FontStyle]::Bold)
$leadFont = New-Object System.Drawing.Font 'Microsoft YaHei UI', 25, ([System.Drawing.FontStyle]::Bold)
$sectionFont = New-Object System.Drawing.Font 'Microsoft YaHei UI', 24, ([System.Drawing.FontStyle]::Bold)
$itemTitleFont = New-Object System.Drawing.Font 'Microsoft YaHei UI', 18, ([System.Drawing.FontStyle]::Bold)
$itemBodyFont = New-Object System.Drawing.Font 'Microsoft YaHei UI', 13.2, ([System.Drawing.FontStyle]::Regular)
$sourceFont = New-Object System.Drawing.Font 'Microsoft YaHei UI', 9.2, ([System.Drawing.FontStyle]::Bold)
$microFont = New-Object System.Drawing.Font 'Arial', 9, ([System.Drawing.FontStyle]::Bold)
$insightFont = New-Object System.Drawing.Font 'Microsoft YaHei UI', 19, ([System.Drawing.FontStyle]::Bold)
$inkBrush = New-Object System.Drawing.SolidBrush $ink
$bodyBrush = New-Object System.Drawing.SolidBrush $body
$mutedBrush = New-Object System.Drawing.SolidBrush $muted
$primaryBrush = New-Object System.Drawing.SolidBrush $primary
$lightBrush = New-Object System.Drawing.SolidBrush $light
$cardBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(246,252,251,248))
$primaryPen = New-Object System.Drawing.Pen $primary, 6
$blackPen = New-Object System.Drawing.Pen $ink, 2
$thinPen = New-Object System.Drawing.Pen $line, 1
$format = New-Object System.Drawing.StringFormat
$format.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit
$format.Trimming = [System.Drawing.StringTrimming]::Word
function Draw-TextBox([System.Drawing.Graphics]$graphics, [string]$text, [System.Drawing.Font]$font, [System.Drawing.Brush]$brush, [float]$x, [float]$y, [float]$w, [float]$h) {
  $rect = New-Object System.Drawing.RectangleF $x, $y, $w, $h
  $graphics.DrawString($text, $font, $brush, $rect, $script:format)
}
function Draw-Item([System.Drawing.Graphics]$graphics, $item, [string]$mark, [int]$x, [int]$y, [int]$w, [int]$h) {
  $graphics.FillRectangle([System.Drawing.Brushes]::White, $x, $y, $w, $h)
  $graphics.DrawRectangle((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(50,17,17,17)), 1), $x, $y, $w, $h)
  $graphics.DrawString($mark, $script:itemTitleFont, $script:primaryBrush, $x+24, $y+22)
  Draw-TextBox $graphics $item.title $script:itemTitleFont $script:inkBrush ($x+64) ($y+20) ($w-92) 56
  Draw-TextBox $graphics $item.description $script:itemBodyFont $script:bodyBrush ($x+28) ($y+92) ($w-56) 104
  $graphics.DrawLine((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(34,17,17,17)), 1), $x+28, $y+$h-42, $x+$w-28, $y+$h-42)
  $source = '→ ' + $item.sourceName + '  ' + $item.sourceDateLabel
  Draw-TextBox $graphics $source $script:sourceFont $script:mutedBrush ($x+28) ($y+$h-31) ($w-56) 22
}
function Draw-Section([System.Drawing.Graphics]$graphics, $section, [int]$num, [int]$x, [int]$y) {
  $cardW = 580; $itemH = 232; $cardH = 900
  $graphics.FillRectangle($script:cardBrush, $x, $y, $cardW, $cardH)
  $graphics.DrawRectangle((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(72,17,17,17)), 1), $x, $y, $cardW, $cardH)
  $graphics.FillRectangle($script:primaryBrush, $x+18, $y+20, 54, 36)
  $graphics.DrawString(('{0:00}' -f $num), $script:brandFont, [System.Drawing.Brushes]::White, $x+32, $y+30)
  Draw-TextBox $graphics $section.name $script:sectionFont $script:inkBrush ($x+88) ($y+16) 410 42
  Draw-TextBox $graphics $section.subtitle $script:microFont $script:mutedBrush ($x+88) ($y+64) 420 16
  $marks = @('◆','◇','◈')
  for ($i=0; $i -lt $section.items.Count; $i++) {
    Draw-Item $graphics $section.items[$i] $marks[$i] ($x+18) ($y+112+$i*248) ($cardW-36) $itemH
  }
}
$g.DrawLine($primaryPen, 128, 76, 1352, 76)
$g.DrawString($data.publicTitle, $titleFont, $inkBrush, 138, 104)
$g.DrawString('琴剑产品研发部', $brandFont, $inkBrush, 1274, 112)
$g.DrawString('06/05 · 星期五', $brandFont, $mutedBrush, 1274, 132)
$g.DrawLine($blackPen, 128, 170, 1352, 170)
$g.DrawLine($thinPen, 128, 208, 1352, 208)
$g.FillRectangle($lightBrush, 128, 226, 1224, 146)
$g.DrawLine($thinPen, 202, 226, 202, 372)
$g.DrawString('LEAD', $microFont, $primaryBrush, 158, 276)
Draw-TextBox $g $data.opening $leadFont $inkBrush 234 286 980 70
Draw-Section $g $data.sections[0] 1 138 430
Draw-Section $g $data.sections[1] 2 764 430
Draw-Section $g $data.sections[2] 3 138 1470
Draw-Section $g $data.sections[3] 4 764 1470
$g.DrawLine($thinPen, 128, 2420, 1352, 2420)
$g.DrawString('今日洞察', $sectionFont, $primaryBrush, 196, 2490)
Draw-TextBox $g $data.insight $insightFont $inkBrush 344 2468 900 170
Draw-TextBox $g $data.methodNote $sourceFont $mutedBrush 344 2900 920 42
$out = 'share-images/2026-06-05-sales-full.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$format.Dispose(); $g.Dispose(); $bmp.Dispose()
Get-Item $out | Select-Object FullName,Length,LastWriteTime
