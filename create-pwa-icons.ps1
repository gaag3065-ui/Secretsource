Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourcePath = Join-Path $root "icons\ga-east-operations-master.png"
$iconDirectory = Join-Path $root "icons"
$sizes = @(192, 512)

foreach ($size in $sizes) {
    $source = [System.Drawing.Image]::FromFile($sourcePath)
    $canvas = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)

    try {
        $graphics.Clear(
            [System.Drawing.Color]::FromArgb(250, 249, 247)
        )

        $graphics.InterpolationMode =
            [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

        $graphics.SmoothingMode =
            [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

        $padding = [int]($size * 0.08)
        $available = $size - ($padding * 2)

        $scale = [Math]::Min(
            $available / $source.Width,
            $available / $source.Height
        )

        $width = [int]($source.Width * $scale)
        $height = [int]($source.Height * $scale)
        $x = [int](($size - $width) / 2)
        $y = [int](($size - $height) / 2)

        $graphics.DrawImage($source, $x, $y, $width, $height)

        $outputPath =
            Join-Path $iconDirectory "icon-$size.png"

        $canvas.Save(
            $outputPath,
            [System.Drawing.Imaging.ImageFormat]::Png
        )
    }
    finally {
        $graphics.Dispose()
        $canvas.Dispose()
        $source.Dispose()
    }
}

Write-Host "PWA icons created successfully."