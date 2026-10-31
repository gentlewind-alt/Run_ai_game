# Turns a `rundot generate animate-sprite` sheet into a game strip: square frames side by side at the enemy's native sprite size,
# colours snapped to the Mash32 palette, every frame placed with one shared scale and the same footing as the still sprite
# (so an animated enemy is exactly as big as its still sprite and its feet stay put).
#   powershell -NoProfile -File tools/anim_strip.ps1 -Sheet sheet.png -Still still.png -Out game/public/sprites/monsters/anim/goblin_grunt_idle.png [-Frames 6]
# -Still is the enemy's current sprite at native size (16, 24, 32, 40 or 56 px, transparent background); its size sets the frame size.
param(
  [Parameter(Mandatory = $true)][string]$Sheet,
  [Parameter(Mandatory = $true)][string]$Still,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$Frames = 6
)
Add-Type -AssemblyName System.Drawing
$pal = @(0x1a1c2c,0x5d275d,0xb13e53,0xef7d57,0xffcd75,0xa7f070,0x38b764,0x257179,0x29366f,0x3b5dc9,0x41a6f6,0x73eff7,0xf4f4f4,0x94b0c2,0x566c86,0x333c57,0x8b5a2b,0x5a3a1e,0xc28b4f,0x3e2a19,0x7a8a99,0xa9b4be,0x4a5663,0x1f6f3f,0x2e5d34,0xf2a65a,0x9d2a3c,0x7a3b8c,0x5ee0a0,0xffe9a8,0x6b4f6f,0x111322)
$palRgb = $pal | ForEach-Object { , @((($_ -shr 16) -band 255), (($_ -shr 8) -band 255), ($_ -band 255)) }
function Nearest($r, $g, $b) { $best = 0; $bd = [double]::MaxValue; for ($i = 0; $i -lt $palRgb.Count; $i++) { $p = $palRgb[$i]; $d = 2*($r-$p[0])*($r-$p[0]) + 4*($g-$p[1])*($g-$p[1]) + 3*($b-$p[2])*($b-$p[2]); if ($d -lt $bd) { $bd = $d; $best = $i } }; return $best }

$src = New-Object System.Drawing.Bitmap $Sheet
$stillBmp = New-Object System.Drawing.Bitmap $Still
$S = $stillBmp.Width
$F = [int]($src.Width / $Frames)

# the still sprite's footprint: where the creature stands inside its square
$sx0 = $S; $sy0 = $S; $sx1 = 0; $sy1 = 0
for ($y = 0; $y -lt $S; $y++) { for ($x = 0; $x -lt $S; $x++) { if ($stillBmp.GetPixel($x, $y).A -gt 16) { if ($x -lt $sx0) { $sx0 = $x }; if ($x -gt $sx1) { $sx1 = $x }; if ($y -lt $sy0) { $sy0 = $y }; if ($y -gt $sy1) { $sy1 = $y } } } }
$stillH = $sy1 - $sy0 + 1; $stillCx = ($sx0 + $sx1 + 1) / 2.0; $stillBottom = $sy1 + 1

# one crop box over every frame, so the creature keeps one scale through the whole loop
$minX = $F; $minY = $src.Height; $maxX = 0; $maxY = 0
for ($k = 0; $k -lt $Frames; $k++) { for ($y = 0; $y -lt $src.Height; $y++) { for ($x = 0; $x -lt $F; $x++) { if ($src.GetPixel($k*$F + $x, $y).A -gt 16) { if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }; if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y } } } } }
$w = $maxX - $minX + 1; $h = $maxY - $minY + 1
$scale = [math]::Min($stillH / [double]$h, $S / [double]$w)
$tw = [int][math]::Round($w * $scale); $th = [int][math]::Round($h * $scale)
$dx = [int][math]::Round($stillCx - $tw / 2.0); $dy = [int]($stillBottom - $th)
if ($dx -lt 0) { $dx = 0 }; if ($dx + $tw -gt $S) { $dx = $S - $tw }; if ($dy -lt 0) { $dy = 0 }

# Each target pixel takes the most common palette colour of the source pixels it covers (opaque if at least half of them are), so the
# result stays crisp like hand-made pixel art and stray one-pixel noise from the generator is voted away.
$cache = @{}
function Snap($c) { $key = ($c.R -shl 16) -bor ($c.G -shl 8) -bor $c.B; if (-not $cache.ContainsKey($key)) { $cache[$key] = Nearest $c.R $c.G $c.B }; return $cache[$key] }
$strip = New-Object System.Drawing.Bitmap ($S * $Frames), $S, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($k = 0; $k -lt $Frames; $k++) {
  $cnt = New-Object 'int[]' ($S * $S * 33)
  for ($y = 0; $y -lt $h; $y++) {
    $ty = $dy + [int][math]::Floor($y * $th / [double]$h); if ($ty -ge $S) { $ty = $S - 1 }
    for ($x = 0; $x -lt $w; $x++) {
      $tx = $dx + [int][math]::Floor($x * $tw / [double]$w); if ($tx -ge $S) { $tx = $S - 1 }
      $c = $src.GetPixel($k*$F + $minX + $x, $minY + $y)
      $slot = ($ty * $S + $tx) * 33
      if ($c.A -ge 128) { $cnt[$slot + (Snap $c)]++ } else { $cnt[$slot + 32]++ }
    }
  }
  for ($ty = 0; $ty -lt $S; $ty++) { for ($tx = 0; $tx -lt $S; $tx++) {
    $slot = ($ty * $S + $tx) * 33; $opaque = 0; $best = -1; $bn = 0
    for ($i = 0; $i -lt 32; $i++) { $n = $cnt[$slot + $i]; $opaque += $n; if ($n -gt $bn) { $bn = $n; $best = $i } }
    $total = $opaque + $cnt[$slot + 32]
    if ($total -gt 0 -and $opaque * 2 -ge $total -and $best -ge 0) { $p = $palRgb[$best]; $strip.SetPixel($k*$S + $tx, $ty, [System.Drawing.Color]::FromArgb(255, $p[0], $p[1], $p[2])) }
  } }
}
New-Item -ItemType Directory -Force (Split-Path -Parent $Out) | Out-Null
$strip.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
"ok $($strip.Width)x$($strip.Height) ($Frames frames of $S px) from $Sheet"
$src.Dispose(); $stillBmp.Dispose(); $strip.Dispose()
