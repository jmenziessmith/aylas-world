param(
    [string]$SourceDir = (Join-Path $PSScriptRoot "..\assets\cafe"),
    [string]$OutputDir = (Join-Path $PSScriptRoot "..\public\assets\cafe")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;

public static class CafeSpriteCleaner
{
    // Generated sheets contain a disconnected opaque guide rectangle plus noise.
    // The intended sprite is the largest 8-connected opaque component.
    public static void KeepLargestOpaqueComponent(Bitmap bitmap)
    {
        int width = bitmap.Width, height = bitmap.Height, count = width * height;
        var labels = new int[count];
        var queue = new int[count];
        int label = 0, largestLabel = 0, largestSize = 0;

        for (int y = 0; y < height; y++)
        for (int x = 0; x < width; x++)
        {
            int start = y * width + x;
            if (labels[start] != 0 || bitmap.GetPixel(x, y).A <= 20) continue;
            label++;
            int head = 0, tail = 0;
            queue[tail++] = start;
            labels[start] = label;
            while (head < tail)
            {
                int current = queue[head++], cx = current % width, cy = current / width;
                for (int dy = -1; dy <= 1; dy++)
                for (int dx = -1; dx <= 1; dx++)
                {
                    if (dx == 0 && dy == 0) continue;
                    int nx = cx + dx, ny = cy + dy;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                    int next = ny * width + nx;
                    if (labels[next] == 0 && bitmap.GetPixel(nx, ny).A > 20)
                    {
                        labels[next] = label;
                        queue[tail++] = next;
                    }
                }
            }
            if (tail > largestSize) { largestSize = tail; largestLabel = label; }
        }

        for (int y = 0; y < height; y++)
        for (int x = 0; x < width; x++)
        {
            int index = y * width + x;
            if (labels[index] != largestLabel) bitmap.SetPixel(x, y, Color.Transparent);
        }
    }
}
"@

$script:cropRectsBySource = @{}

function Test-GuidePixel {
    param([System.Drawing.Color]$Pixel)
    return $Pixel.A -gt 20 -and $Pixel.G -gt 130 -and $Pixel.G -gt ($Pixel.R * 1.1) -and $Pixel.G -gt ($Pixel.B * 1.08)
}

function Assert-NearbyGuideLines {
    param(
        [System.Drawing.Bitmap]$Image,
        [string]$Source,
        [string]$Name,
        [int]$X,
        [int]$Y,
        [int]$Width,
        [int]$Height
    )

    # Mapped coordinates begin just inside generated guides. Search a small band
    # around each crop edge for a substantial horizontal and vertical green run.
    $horizontalFound = $false
    $rowStart = [Math]::Max(0, $Y - 20)
    $rowEnd = [Math]::Min($Image.Height - 1, $Y + $Height + 20)
    $candidateRows = @()
    for ($row = $rowStart; $row -le [Math]::Min($rowStart + 26, $rowEnd); $row += 3) { $candidateRows += $row }
    for ($row = [Math]::Max($rowStart, $rowEnd - 26); $row -le $rowEnd; $row += 3) { $candidateRows += $row }
    foreach ($row in $candidateRows) {
        $green = 0
        $left = [Math]::Max(0, $X - 16)
        $right = [Math]::Min($Image.Width - 1, $X + $Width + 16)
        for ($px = $left; $px -le $right; $px += 6) {
            if (Test-GuidePixel ($Image.GetPixel($px, $row))) { $green++ }
        }
        if ($green -ge [Math]::Max(4, [int]($Width * 0.02))) { $horizontalFound = $true; break }
    }

    $verticalFound = $false
    $columnStart = [Math]::Max(0, $X - 20)
    $columnEnd = [Math]::Min($Image.Width - 1, $X + $Width + 20)
    $candidateColumns = @()
    for ($column = $columnStart; $column -le [Math]::Min($columnStart + 26, $columnEnd); $column += 3) { $candidateColumns += $column }
    for ($column = [Math]::Max($columnStart, $columnEnd - 26); $column -le $columnEnd; $column += 3) { $candidateColumns += $column }
    foreach ($column in $candidateColumns) {
        $green = 0
        $top = [Math]::Max(0, $Y - 16)
        $bottom = [Math]::Min($Image.Height - 1, $Y + $Height + 16)
        for ($py = $top; $py -le $bottom; $py += 6) {
            if (Test-GuidePixel ($Image.GetPixel($column, $py))) { $green++ }
        }
        if ($green -ge [Math]::Max(4, [int]($Height * 0.02))) { $verticalFound = $true; break }
    }

    if (-not $horizontalFound -or -not $verticalFound) {
        throw "Mapped crop $Name in $Source is not enclosed by detectable green guide lines (horizontal=$horizontalFound vertical=$verticalFound)."
    }
}

function Save-Crop {
    param(
        [string]$Source,
        [string]$RelativeOutput,
        [int]$X,
        [int]$Y,
        [int]$Width,
        [int]$Height,
        [switch]$KeepSeparateComponents,
        [switch]$ClearBottomGuide,
        [switch]$ClearTopGuide
    )

    $mappedRect = [pscustomobject]@{ Name = $RelativeOutput; X = $X; Y = $Y; Right = $X + $Width; Bottom = $Y + $Height }
    $existingRects = @($script:cropRectsBySource[$Source])
    foreach ($other in $existingRects) {
        $overlaps = $mappedRect.X -lt $other.Right -and $mappedRect.Right -gt $other.X -and $mappedRect.Y -lt $other.Bottom -and $mappedRect.Bottom -gt $other.Y
        if ($overlaps) {
            throw "Mapped crops $RelativeOutput and $($other.Name) overlap in $Source."
        }
    }
    $script:cropRectsBySource[$Source] = $existingRects + $mappedRect

    $mappedX = $X
    $mappedY = $Y
    $mappedWidth = $Width
    $mappedHeight = $Height

    # Generated guide strokes wander several pixels inward. The coordinates below
    # already begin inside the nominal 1 px line; this safety inset excludes the
    # anti-aliased remainder while retaining the sheet's intended clear padding.
    $guideInset = 7
    $X += $guideInset
    $Y += $guideInset
    $Width -= $guideInset * 2
    $Height -= $guideInset * 2

    $sourcePath = Join-Path $SourceDir $Source
    $outputPath = Join-Path $OutputDir $RelativeOutput
    $outputParent = Split-Path -Parent $outputPath
    New-Item -ItemType Directory -Force -Path $outputParent | Out-Null

    $inputImage = [System.Drawing.Bitmap]::FromFile($sourcePath)
    try {
        Assert-NearbyGuideLines $inputImage $Source $RelativeOutput $mappedX $mappedY $mappedWidth $mappedHeight
        if ($X -lt 0 -or $Y -lt 0 -or ($X + $Width) -gt $inputImage.Width -or ($Y + $Height) -gt $inputImage.Height) {
            throw "Crop $RelativeOutput is outside $Source ($($inputImage.Width)x$($inputImage.Height))."
        }

        $outputImage = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($outputImage)
            try {
                $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
                $graphics.DrawImage(
                    $inputImage,
                    [System.Drawing.Rectangle]::new(0, 0, $Width, $Height),
                    [System.Drawing.Rectangle]::new($X, $Y, $Width, $Height),
                    [System.Drawing.GraphicsUnit]::Pixel
                )
            }
            finally {
                $graphics.Dispose()
            }

            # The crop coordinates are inside each 1 px guide. Remove only residual
            # neon-green guide pixels; transparent padding and the painted asset remain.
            for ($py = 0; $py -lt $Height; $py++) {
                for ($px = 0; $px -lt $Width; $px++) {
                    $pixel = $outputImage.GetPixel($px, $py)
                    $nearEdge = $px -lt 12 -or $py -lt 12 -or $px -ge ($Width - 12) -or $py -ge ($Height - 12)
                    $strongGuide = $pixel.G -gt 225 -and $pixel.R -lt 180 -and $pixel.B -lt 180 -and $pixel.G -gt ($pixel.R * 1.3) -and $pixel.G -gt ($pixel.B * 1.25)
                    $edgeGuide = $nearEdge -and $pixel.G -gt 190 -and $pixel.G -gt ($pixel.R * 1.22) -and $pixel.G -gt ($pixel.B * 1.18)
                    if ($pixel.A -gt 20 -and ($strongGuide -or $edgeGuide)) {
                        $outputImage.SetPixel($px, $py, [System.Drawing.Color]::Transparent)
                    }
                }
            }

            if (-not $KeepSeparateComponents) {
                [CafeSpriteCleaner]::KeepLargestOpaqueComponent($outputImage)
            }

            # On the lower customer row the guide touches the painted chair/body,
            # so component isolation cannot split it. Remove only long vivid-green
            # runs near the lower edge while retaining the original canvas size.
            if ($ClearBottomGuide) {
                for ($py = [Math]::Max(0, $Height - 26); $py -lt $Height; $py++) {
                    $guidePixels = @()
                    for ($px = 0; $px -lt $Width; $px++) {
                        $pixel = $outputImage.GetPixel($px, $py)
                        if ($pixel.A -gt 20 -and $pixel.G -gt 145 -and $pixel.G -gt ($pixel.R * 1.1) -and $pixel.G -gt ($pixel.B * 1.08)) {
                            $guidePixels += $px
                        }
                    }
                    if ($guidePixels.Count -ge [Math]::Max(20, [int]($Width * 0.12))) {
                        foreach ($px in $guidePixels) { $outputImage.SetPixel($px, $py, [System.Drawing.Color]::Transparent) }
                    }
                }
            }

            # The tray's generated top guide is connected to its green rim by a
            # few antialiased pixels. It occupies rows 3-5; row 6 provides a
            # clean separation before the painted rim resumes at row 9.
            if ($ClearTopGuide) {
                for ($py = 0; $py -le [Math]::Min(5, $Height - 1); $py++) {
                    for ($px = 0; $px -lt $Width; $px++) {
                        $pixel = $outputImage.GetPixel($px, $py)
                        if ($pixel.A -gt 20 -and $pixel.G -gt 120 -and $pixel.G -gt ($pixel.R * 1.1) -and $pixel.G -gt ($pixel.B * 1.06)) {
                            $outputImage.SetPixel($px, $py, [System.Drawing.Color]::Transparent)
                        }
                    }
                }
            }

            $outputImage.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
            Write-Host "$RelativeOutput ($Width x $Height)"
        }
        finally {
            $outputImage.Dispose()
        }
    }
    finally {
        $inputImage.Dispose()
    }
}

function Copy-Background {
    param([string]$Source, [string]$RelativeOutput)
    $sourcePath = Join-Path $SourceDir $Source
    $outputPath = Join-Path $OutputDir $RelativeOutput
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outputPath) | Out-Null
    $image = [System.Drawing.Image]::FromFile($sourcePath)
    try {
        if ($image.Width -ne 2172 -or $image.Height -ne 724) {
            throw "Background $Source is $($image.Width)x$($image.Height); expected 2172x724."
        }
    }
    finally { $image.Dispose() }
    Copy-Item -LiteralPath $sourcePath -Destination $outputPath -Force
}

function Save-DerivedCrop {
    param(
        [string]$RelativeSource,
        [string]$RelativeOutput,
        [int]$X,
        [int]$Y,
        [int]$Width,
        [int]$Height
    )
    $sourcePath = Join-Path $OutputDir $RelativeSource
    $outputPath = Join-Path $OutputDir $RelativeOutput
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outputPath) | Out-Null
    $inputImage = [System.Drawing.Bitmap]::FromFile($sourcePath)
    try {
        if ($X -lt 0 -or $Y -lt 0 -or ($X + $Width) -gt $inputImage.Width -or ($Y + $Height) -gt $inputImage.Height) {
            throw "Derived crop $RelativeOutput is outside $RelativeSource."
        }
        $outputImage = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($outputImage)
            try {
                $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
                $graphics.DrawImage($inputImage, [System.Drawing.Rectangle]::new(0, 0, $Width, $Height), [System.Drawing.Rectangle]::new($X, $Y, $Width, $Height), [System.Drawing.GraphicsUnit]::Pixel)
            }
            finally { $graphics.Dispose() }
            $outputImage.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
            Write-Host "$RelativeOutput ($Width x $Height, derived)"
        }
        finally { $outputImage.Dispose() }
    }
    finally { $inputImage.Dispose() }
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Copy-Background "ChatGPT Image Sep 20, 2026, 11_20_50 AM (1).png" "backgrounds/counter.png"
Copy-Background "ChatGPT Image Sep 20, 2026, 11_20_50 AM (2).png" "backgrounds/carry.png"
Copy-Background "ChatGPT Image Sep 20, 2026, 11_21_56 AM (2).png" "backgrounds/serve.png"

$ayla = "ChatGPT Image Sep 20, 2026, 11_20_51 AM (4).png"
Save-Crop $ayla "characters/ayla-welcome.png" 48 17 360 434
Save-Crop $ayla "characters/ayla-point.png" 455 17 356 434
Save-Crop $ayla "characters/ayla-empty-tray.png" 861 17 358 434
Save-Crop $ayla "characters/ayla-carry.png" 1267 17 357 434
Save-Crop $ayla "characters/ayla-spill.png" 48 489 370 414
Save-Crop $ayla "characters/ayla-cheer.png" 861 489 357 414
Save-Crop $ayla "characters/ayla-thumbs-up.png" 1267 489 357 414

$items = "ChatGPT Image Sep 20, 2026, 11_20_52 AM (6).png"
Save-Crop $items "items/cupcake-heart.png" 170 28 292 278
Save-Crop $items "items/cupcake-chocolate.png" 510 28 300 278
Save-Crop $items "items/cupcake-strawberry.png" 858 28 302 278
Save-Crop $items "items/drink-orange.png" 1216 28 288 278
Save-Crop $items "items/drink-strawberry.png" 170 334 292 278
Save-Crop $items "items/drink-green.png" 510 334 300 278
Save-Crop $items "items/cookie-chocolate-chip.png" 858 334 302 278
Save-Crop $items "items/cookie-heart.png" 1216 334 288 278
Save-Crop $items "items/ice-cream-vanilla.png" 170 642 292 266
Save-Crop $items "items/ice-cream-chocolate.png" 510 642 300 266
Save-Crop $items "items/ice-cream-mint.png" 858 642 302 266
Save-Crop $items "items/spoon-blue.png" 1216 642 288 266

$carry = "ChatGPT Image Sep 20, 2026, 11_21_58 AM (3).png"
Save-Crop $carry "trays/carry-tray.png" 35 88 475 347 -ClearTopGuide
Save-Crop $carry "hands/left.png" 535 88 177 347
Save-Crop $carry "hands/right.png" 742 88 157 347
Save-Crop $carry "trays/carry-held.png" 925 88 495 347 -KeepSeparateComponents -ClearTopGuide
Save-Crop $carry "ui/hold-phone-flat.png" 25 506 337 259
Save-Crop $carry "ui/status-empty.png" 397 582 163 160
Save-Crop $carry "ui/status-complete.png" 578 582 163 160
Save-Crop $carry "ui/step-progress-empty.png" 773 582 643 160
Save-Crop $carry "ui/speech-bubble.png" 27 812 313 239

$counterProps = "ChatGPT Image Sep 20, 2026, 11_21_59 AM (4).png"
Save-Crop $counterProps "counter/counter-tray.png" 54 86 512 247
Save-Crop $counterProps "counter/storage-box-heart.png" 608 86 382 247
Save-Crop $counterProps "counter/storage-box-flower.png" 1022 86 377 247
Save-Crop $counterProps "counter/cake-dome.png" 48 371 286 348
Save-Crop $counterProps "counter/utensil-pot.png" 356 371 264 348
Save-Crop $counterProps "counter/chalkboard-standing.png" 646 371 318 348
Save-Crop $counterProps "counter/chalkboard-hanging.png" 994 371 405 348
Save-Crop $counterProps "counter/order-paper.png" 49 762 296 274
Save-Crop $counterProps "ui/speech-bubble-pink.png" 382 767 513 263
Save-DerivedCrop "counter/chalkboard-hanging.png" "counter/chalkboard-panel.png" 7 82 377 245

$service = "ChatGPT Image Sep 20, 2026, 11_21_59 AM (5).png"
Save-Crop $service "table/wooden-table.png" 100 17 640 457
Save-Crop $service "targets/cupcake.png" 54 502 260 249
Save-Crop $service "targets/drink.png" 332 502 244 249
Save-Crop $service "targets/cookie.png" 594 502 254 249
Save-Crop $service "targets/spoon.png" 868 502 264 249
Save-Crop $service "targets/ice-cream.png" 1154 502 242 249
Save-Crop $service "table/serving-plate.png" 201 782 371 264
Save-Crop $service "table/napkin.png" 595 782 325 264
Save-Crop $service "table/flower-vase.png" 951 782 294 264

$customers = "ChatGPT Image Sep 20, 2026, 11_21_59 AM (6).png"
Save-Crop $customers "customers/bunny-waiting.png" 45 70 411 468
Save-Crop $customers "customers/bunny-happy.png" 496 70 410 468
Save-Crop $customers "customers/elephant-waiting.png" 946 70 456 468
Save-Crop $customers "customers/elephant-happy.png" 46 575 438 451 -ClearBottomGuide
Save-Crop $customers "customers/purple-monster-waiting.png" 500 575 414 451 -ClearBottomGuide
Save-Crop $customers "customers/purple-monster-happy.png" 944 575 458 451 -ClearBottomGuide

$ui = "ChatGPT Image Sep 20, 2026, 11_20_53 AM (8).png"
Save-Crop $ui "ui/footprint.png" 31 493 280 330
Save-Crop $ui "ui/success-star.png" 351 493 311 330
Save-Crop $ui "ui/celebration-heart.png" 680 493 307 330

Write-Host "Cafe assets written to $OutputDir"
