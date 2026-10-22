# Contact sheet of concept images: a grid of thumbnails with file names.
# usage: powershell -NoProfile -File tools/concept_sheet.ps1 <folder> <out.png> [columns]
param([string]$Dir, [string]$Out, [int]$Cols = 4)
Add-Type -AssemblyName System.Drawing
$files = Get-ChildItem $Dir -Filter *.png | Sort-Object Name
$tw = 384; $th = 216; $lh = 18
$rows = [math]::Ceiling($files.Count / $Cols)
$sheet = New-Object System.Drawing.Bitmap ($Cols * $tw), ($rows * ($th + $lh))
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.Clear([System.Drawing.Color]::FromArgb(26, 28, 44))
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
$font = New-Object System.Drawing.Font 'Consolas', 10
$brush = [System.Drawing.Brushes]::White
for ($i = 0; $i -lt $files.Count; $i++) {
  $x = ($i % $Cols) * $tw; $y = [math]::Floor($i / $Cols) * ($th + $lh)
  $img = [System.Drawing.Image]::FromFile($files[$i].FullName)
  $g.DrawImage($img, $x, $y + $lh, $tw - 2, $th - 2)
  $g.DrawString($files[$i].BaseName, $font, $brush, $x + 4, $y + 2)
  $img.Dispose()
}
$sheet.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "ok $Out ($($files.Count) images)"
