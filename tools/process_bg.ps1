# Processes concept-art backdrop plates to game-ready 640x360 PNGs snapped to the Mash32 palette.
# Usage: powershell -NoProfile -File tools/process_bg.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $root 'docs\concepts\backdrops'
$out  = Join-Path $root 'game\public\sprites\bg'
New-Item -ItemType Directory -Force $out | Out-Null

# Mash32 palette (game/src/art/palette.ts)
$pal = @(0x1a1c2c,0x5d275d,0xb13e53,0xef7d57,0xffcd75,0xa7f070,0x38b764,0x257179,0x29366f,0x3b5dc9,0x41a6f6,0x73eff7,0xf4f4f4,0x94b0c2,0x566c86,0x333c57,0x8b5a2b,0x5a3a1e,0xc28b4f,0x3e2a19,0x7a8a99,0xa9b4be,0x4a5663,0x1f6f3f,0x2e5d34,0xf2a65a,0x9d2a3c,0x7a3b8c,0x5ee0a0,0xffe9a8,0x6b4f6f,0x111322)
$palRgb = $pal | ForEach-Object { , @((($_ -shr 16) -band 255), (($_ -shr 8) -band 255), ($_ -band 255)) }

function Nearest($r, $g, $b) {
  $best = 0; $bd = [double]::MaxValue
  for ($i = 0; $i -lt $palRgb.Count; $i++) {
    $p = $palRgb[$i]; $dr = $r - $p[0]; $dg = $g - $p[1]; $db = $b - $p[2]
    $d = 2 * $dr * $dr + 4 * $dg * $dg + 3 * $db * $db
    if ($d -lt $bd) { $bd = $d; $best = $i }
  }
  return $best
}

function ProcessBg($file, $dest) {
  $img = New-Object System.Drawing.Bitmap $file

  # Downscale to exactly 640x360 using NearestNeighbor
  $scaled = New-Object System.Drawing.Bitmap 640, 360, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gfx = [System.Drawing.Graphics]::FromImage($scaled)
  $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $gfx.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $gfx.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::None
  $gfx.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, 640, 360))
  $gfx.Dispose()
  $img.Dispose()

  # Snap every pixel to Mash32; force alpha = 255 (opaque)
  $res = New-Object System.Drawing.Bitmap 640, 360, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt 360; $y++) {
    for ($x = 0; $x -lt 640; $x++) {
      $c = $scaled.GetPixel($x, $y)
      $i = Nearest $c.R $c.G $c.B
      $p = $palRgb[$i]
      $res.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $p[0], $p[1], $p[2]))
    }
  }
  $scaled.Dispose()

  $res.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $res.Dispose()
}

$styles = @('hills', 'wood', 'keep', 'frost', 'ember', 'sky')
foreach ($style in $styles) {
  $f = Join-Path $src "$style.png"
  if (-not (Test-Path $f)) { Write-Output "missing $f"; continue }
  $d = Join-Path $out "$style.png"
  Write-Output "processing $style ..."
  ProcessBg $f $d
  Write-Output "ok $style -> $d"
}
Write-Output "Done."
