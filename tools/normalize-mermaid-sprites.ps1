Add-Type -AssemblyName System.Drawing

$spriteRoot = Join-Path $PSScriptRoot '..\public\assets\mermaid\sprites'
$rewardSheet = Join-Path $PSScriptRoot '..\public\assets\mermaid\rewards.png'
$effectSheet = Join-Path $spriteRoot 'magic-effects.png'
$outlineSheet = Join-Path $spriteRoot 'shape-outlines.png'
$uiSheet = Join-Path $PSScriptRoot '..\public\assets\mermaid\ui.png'

function Export-SourceRegion([string]$name, [int]$x, [int]$y, [int]$width, [int]$height) {
  $source = [System.Drawing.Bitmap]::FromFile((Resolve-Path $rewardSheet))
  $region = $source.Clone([System.Drawing.Rectangle]::new($x, $y, $width, $height), $source.PixelFormat)
  $region.Save((Join-Path $spriteRoot "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $region.Dispose(); $source.Dispose()
}

function Export-EffectRegion([string]$name, [int]$x, [int]$y, [int]$width, [int]$height) {
  $source = [System.Drawing.Bitmap]::FromFile((Resolve-Path $effectSheet))
  $region = $source.Clone([System.Drawing.Rectangle]::new($x, $y, $width, $height), $source.PixelFormat)
  $region.Save((Join-Path $spriteRoot "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $region.Dispose(); $source.Dispose()
}

function Export-OutlineRegion([string]$name, [int]$x, [int]$y, [int]$width, [int]$height) {
  $source = [System.Drawing.Bitmap]::FromFile((Resolve-Path $outlineSheet))
  $region = $source.Clone([System.Drawing.Rectangle]::new($x, $y, $width, $height), $source.PixelFormat)
  $region.Save((Join-Path $spriteRoot "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $region.Dispose(); $source.Dispose()
}

function Export-UiRegion([string]$name, [int]$x, [int]$y, [int]$width, [int]$height) {
  $source = [System.Drawing.Bitmap]::FromFile((Resolve-Path $uiSheet))
  $region = $source.Clone([System.Drawing.Rectangle]::new($x, $y, $width, $height), $source.PixelFormat)
  $region.Save((Join-Path $spriteRoot "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $region.Dispose(); $source.Dispose()
}

function Find-OpaqueSeed([System.Drawing.Bitmap]$bitmap, [int]$startX, [int]$startY) {
  for ($radius = 0; $radius -lt [Math]::Max($bitmap.Width, $bitmap.Height); $radius += 1) {
    for ($x = [Math]::Max(0, $startX - $radius); $x -le [Math]::Min($bitmap.Width - 1, $startX + $radius); $x += 1) {
      foreach ($y in @([Math]::Max(0, $startY - $radius), [Math]::Min($bitmap.Height - 1, $startY + $radius))) {
        if ($bitmap.GetPixel($x, $y).A -gt 8) { return [System.Drawing.Point]::new($x, $y) }
      }
    }
    for ($y = [Math]::Max(0, $startY - $radius); $y -le [Math]::Min($bitmap.Height - 1, $startY + $radius); $y += 1) {
      foreach ($x in @([Math]::Max(0, $startX - $radius), [Math]::Min($bitmap.Width - 1, $startX + $radius))) {
        if ($bitmap.GetPixel($x, $y).A -gt 8) { return [System.Drawing.Point]::new($x, $y) }
      }
    }
  }
  throw 'No opaque pixels found.'
}

function Normalize-MainSprite([string]$name, [int]$canvasWidth, [int]$canvasHeight, [int]$maxWidth, [int]$maxHeight, [bool]$alignTop = $false) {
  $path = Join-Path $spriteRoot "$name.png"
  $source = [System.Drawing.Bitmap]::FromFile((Resolve-Path $path))
  $seed = Find-OpaqueSeed $source ([int]($source.Width / 2)) ([int]($source.Height / 2))
  $seen = New-Object 'bool[,]' $source.Width, $source.Height
  $queue = [System.Collections.Generic.Queue[System.Drawing.Point]]::new()
  $queue.Enqueue($seed); $seen[$seed.X, $seed.Y] = $true
  $points = [System.Collections.Generic.List[System.Drawing.Point]]::new()
  $minX = $source.Width; $minY = $source.Height; $maxX = 0; $maxY = 0
  while ($queue.Count -gt 0) {
    $point = $queue.Dequeue(); $colour = $source.GetPixel($point.X, $point.Y)
    if ($colour.A -le 8) { continue }
    $points.Add($point); $minX = [Math]::Min($minX, $point.X); $maxX = [Math]::Max($maxX, $point.X); $minY = [Math]::Min($minY, $point.Y); $maxY = [Math]::Max($maxY, $point.Y)
    foreach ($offset in @(@(1,0),@(-1,0),@(0,1),@(0,-1))) {
      $x = $point.X + $offset[0]; $y = $point.Y + $offset[1]
      if ($x -ge 0 -and $x -lt $source.Width -and $y -ge 0 -and $y -lt $source.Height -and -not $seen[$x,$y]) {
        $seen[$x,$y] = $true
        if ($source.GetPixel($x,$y).A -gt 8) { $queue.Enqueue([System.Drawing.Point]::new($x,$y)) }
      }
    }
  }
  $isolated = [System.Drawing.Bitmap]::new($maxX - $minX + 1, $maxY - $minY + 1, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  foreach ($point in $points) { $isolated.SetPixel($point.X - $minX, $point.Y - $minY, $source.GetPixel($point.X, $point.Y)) }
  $source.Dispose()
  $scale = [Math]::Min($maxWidth / $isolated.Width, $maxHeight / $isolated.Height)
  $drawWidth = [int]($isolated.Width * $scale); $drawHeight = [int]($isolated.Height * $scale)
  $target = [System.Drawing.Bitmap]::new($canvasWidth, $canvasHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($target)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $drawX = [int](($canvasWidth - $drawWidth) / 2); $drawY = if ($alignTop) { 16 } else { [int](($canvasHeight - $drawHeight) / 2) }
  $graphics.DrawImage($isolated, $drawX, $drawY, $drawWidth, $drawHeight)
  $graphics.Dispose(); $isolated.Dispose()
  $temporary = "$path.normalized.png"; $target.Save($temporary, [System.Drawing.Imaging.ImageFormat]::Png); $target.Dispose()
  Move-Item -LiteralPath $temporary -Destination $path -Force
}

Export-UiRegion 'home-button' 20 20 205 205
Export-UiRegion 'audio-button' 205 20 205 205
Export-UiRegion 'title-banner' 395 10 820 220
Export-UiRegion 'chalkboard' 10 200 395 570
foreach ($name in @('home-button', 'audio-button')) { Normalize-MainSprite $name 256 256 210 210 }
Normalize-MainSprite 'title-banner' 1024 256 950 220
Normalize-MainSprite 'chalkboard' 512 768 460 700
Export-UiRegion 'option-panel' 1080 180 368 220
Normalize-MainSprite 'option-panel' 512 320 470 270
foreach ($name in @('pink-shell','yellow-shell','teal-shell','purple-spiral','pink-spiral','orange-spiral','pearl','star','sand-dollar','teal-spiral','conch','gem')) { Normalize-MainSprite $name 512 512 420 420 }
Normalize-MainSprite 'shell-basket' 512 320 460 260
Export-OutlineRegion 'outline-scallop' 0 0 440 560
Export-OutlineRegion 'outline-spiral' 300 0 500 560
Export-OutlineRegion 'outline-pearl' 650 0 500 560
Export-OutlineRegion 'outline-star' 950 0 498 560
Export-OutlineRegion 'outline-sand-dollar' 0 440 520 646
Export-OutlineRegion 'outline-conch' 390 440 610 646
Export-OutlineRegion 'outline-gem' 880 440 568 646
foreach ($name in @('outline-scallop','outline-spiral','outline-pearl','outline-star','outline-sand-dollar','outline-conch','outline-gem')) { Normalize-MainSprite $name 512 512 430 430 }
Export-SourceRegion 'charm-pearl' 500 575 260 305
Export-SourceRegion 'charm-shell' 665 575 295 305
Export-SourceRegion 'charm-star' 900 580 280 300
Export-SourceRegion 'charm-rainbow' 1095 570 353 315
foreach ($name in @('charm-pearl','charm-shell','charm-star','charm-rainbow')) { Normalize-MainSprite $name 360 360 270 320 $true }
Export-EffectRegion 'effect-bubbles' 5 0 285 300
Export-EffectRegion 'effect-gold-sparkle' 555 0 235 410
Export-EffectRegion 'effect-blue-sparkle' 745 0 240 410
Export-EffectRegion 'effect-pink-sparkle' 930 0 240 410
Export-EffectRegion 'effect-star-burst' 555 380 380 350
foreach ($name in @('effect-bubbles','effect-gold-sparkle','effect-blue-sparkle','effect-pink-sparkle','effect-star-burst')) { Normalize-MainSprite $name 512 512 410 410 }
