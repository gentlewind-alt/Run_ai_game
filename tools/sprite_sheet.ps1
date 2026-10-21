# Builds a labelled contact sheet from the generated relic sprites (nearest-neighbour, on the game's dark background).
# usage: powershell -File tools/sprite_sheet.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'docs\handoff\shots\gen'
$items = @(
  @('maul_test.png', 'Skyforge Maul'), @('fists.png', 'Comet Fists'), @('disc.png', 'Bulwark Disc'),
  @('arrow.png', 'Steersong Arrow'), @('shooters.png', 'Silkline Shooters'), @('palms.png', 'Kinetic Palms')
)
$cell = 240; $pad = 12; $cols = 3; $rows = 2; $lab = 22
$W = $cols * ($cell + $pad) + $pad; $H = $rows * ($cell + $lab + $pad) + $pad
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#14172b'))
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$font = New-Object System.Drawing.Font 'Consolas', 11
$brush = [System.Drawing.Brushes]::White
$i = 0
foreach ($it in $items) {
  $cx = $pad + ($i % $cols) * ($cell + $pad); $cy = $pad + [math]::Floor($i / $cols) * ($cell + $lab + $pad)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#1f2340'))), $cx, $cy, $cell, $cell)
  $f = Join-Path $dir $it[0]
  if (Test-Path $f) {
    $img = [System.Drawing.Image]::FromFile($f)
    $s = [math]::Min($cell / $img.Width, $cell / $img.Height)
    if ($s -gt 1) { $s = [math]::Floor($s) }
    $w = [int]($img.Width * $s); $h = [int]($img.Height * $s)
    $g.DrawImage($img, $cx + [int](($cell - $w) / 2), $cy + [int](($cell - $h) / 2), $w, $h)
    $dim = "$($img.Width)x$($img.Height)"
    $img.Dispose()
  } else { $dim = 'pending' }
  $g.DrawString("$($it[1])  ($dim)", $font, $brush, $cx, $cy + $cell + 2)
  $i++
}
$out = Join-Path $dir 'contact_sheet.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output $out
