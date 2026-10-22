# Processes RUN-generated relic sprites into game-ready PNGs: crop to content, fit to a square, downscale, snap to the Mash32 palette.
# usage: powershell -NoProfile -File tools/process_sprites.ps1 [-Size 32] [-CardSize 24]
param([int]$Size = 32, [int]$CardSize = 24)
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'docs\handoff\shots\gen'
$out = Join-Path $root 'game\public\sprites\relics'
New-Item -ItemType Directory -Force $out | Out-Null
# Mash32 (game/src/art/palette.ts)
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
function Process($file, $dest, $S) {
  $img = New-Object System.Drawing.Bitmap $file
  $minX = $img.Width; $minY = $img.Height; $maxX = 0; $maxY = 0
  for ($y = 0; $y -lt $img.Height; $y++) { for ($x = 0; $x -lt $img.Width; $x++) { if ($img.GetPixel($x, $y).A -gt 16) { if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }; if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y } } } }
  $w = $maxX - $minX + 1; $h = $maxY - $minY + 1
  $scale = ($S - 2) / [double][math]::Max($w, $h)
  $tw = [math]::Max(1, [int][math]::Round($w * $scale)); $th = [math]::Max(1, [int][math]::Round($h * $scale))
  $big = New-Object System.Drawing.Bitmap $S, $S, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($big)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $dx = [int](($S - $tw) / 2); $dy = [int](($S - $th) / 2)
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle $dx, $dy, $tw, $th), $minX, $minY, $w, $h, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose(); $img.Dispose()
  $res = New-Object System.Drawing.Bitmap $S, $S, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $S; $y++) { for ($x = 0; $x -lt $S; $x++) {
    $c = $big.GetPixel($x, $y)
    if ($c.A -lt 128) { $res.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0)) }
    else { $i = Nearest $c.R $c.G $c.B; $p = $palRgb[$i]; $res.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $p[0], $p[1], $p[2])) }
  } }
  $res.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $big.Dispose(); $res.Dispose()
}
$map = @{
  'w_skyforge_maul' = 'maul_test.png'; 'w_comet_fists' = 'fists.png'; 'w_bulwark_disc' = 'disc_v2_2.png';
  'w_steersong_arrow' = 'arrow.png'; 'w_silkline_shooters' = 'shooters.png'; 'w_kinetic_palms' = 'palms.png';
  'w_brahmastra_arrow' = 'w_brahmastra_arrow.png'; 'w_omnitrix_dial' = 'w_omnitrix_dial.png';
  'w_hailstorm_cauldron' = 'w_hailstorm_cauldron.png'; 'w_rolling_millstone' = 'w_rolling_millstone.png'; 'w_pinata_mirv' = 'w_pinata_mirv.png';
  'w_earthworm_drill' = 'w_earthworm_drill.png'; 'w_black_hole_marble' = 'w_black_hole_marble.png'; 'w_chain_rod' = 'w_chain_rod.png'
}
# monsters: id -> @(source file, size in px); the output has no _card variant
$monsters = @{ 'frost_wolf' = @('frost_wolf.png', 32); 'ice_golem' = @('ice_golem.png', 40); 'frost_giant' = @('frost_giant.png', 56);
  'lava_imp' = @('lava_imp.png', 24); 'forge_ogre' = @('forge_ogre.png', 40); 'forge_tyrant' = @('forge_tyrant.png', 56);
  'cloud_harpy' = @('cloud_harpy.png', 32); 'storm_mage' = @('storm_mage.png', 32); 'storm_sovereign' = @('storm_sovereign.png', 56) }
foreach ($id in $map.Keys) {
  $f = Join-Path $src $map[$id]
  if (-not (Test-Path $f)) { Write-Output "missing $f"; continue }
  Process $f (Join-Path $out "$id.png") $Size
  Process $f (Join-Path $out "${id}_card.png") $CardSize
  Write-Output "ok $id"
}
$outM = Join-Path $root 'game\public\sprites\monsters'
New-Item -ItemType Directory -Force $outM | Out-Null
foreach ($id in $monsters.Keys) {
  $f = Join-Path $src $monsters[$id][0]
  if (-not (Test-Path $f)) { Write-Output "missing $f"; continue }
  Process $f (Join-Path $outM "$id.png") $monsters[$id][1]
  Write-Output "ok monster $id"
}
