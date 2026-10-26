#!/usr/bin/env bash
# Cuts the clips from tools/record_gameplay.mjs into a trailer: captions, soundtrack and an end card. Needs ffmpeg.
# usage: tools/make_trailer.sh <clipsDir> <musicWav> <thumbnail.png> <outDir>
set -euo pipefail
CLIPS="$1"; MUSIC="$2"; THUMB="$3"; OUT="$4"
FONT="C\\:/Windows/Fonts/arialbd.ttf"
mkdir -p "$OUT/cut"

cut() { # name source seconds caption
  local name="$1" src="$2" len="$3" cap="$4"
  local vf="scale=1280:720:flags=neighbor,fps=30,format=yuv420p"
  if [ -n "$cap" ]; then
    vf="$vf,drawtext=fontfile='$FONT':text='$cap':fontcolor=white:fontsize=44:box=1:boxcolor=black@0.55:boxborderw=14:x=(w-text_w)/2:y=h-110"
  fi
  ffmpeg -y -loglevel error -i "$CLIPS/$src.mp4" -t "$len" -vf "$vf" -an -c:v libx264 -crf 18 -r 30 "$OUT/cut/$name.mp4"
}

cut 01 01_title 2.8 "MONSTER MASH - Slingshot Siege"
cut 02 02_level_2 5 "Fling real weapons"
cut 04 04_level_31 7.5 "Topple physics-built forts"
cut 05 05_boss_35 7.5 "Boss citadels"
cut 06 06_builder 6.5 "Build your own level"
cut 07 07_challenges 2.8 "Global Challenges"
cut 08 08_challenge_detail 2.8 "Every challenge has a leaderboard"
cut 09 09_challenge_play 10 "Clear it with the weapons they allow"

# end card: the game's cover with the call to action
ffmpeg -y -loglevel error -loop 1 -t 3.5 -i "$THUMB" -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,boxblur=14:2,format=yuv420p,drawbox=x=0:y=0:w=iw:h=ih:color=black@0.45:t=fill,drawtext=fontfile='$FONT':text='MONSTER MASH':fontcolor=0xffd75e:fontsize=96:x=(w-text_w)/2:y=190,drawtext=fontfile='$FONT':text='Slingshot Siege':fontcolor=white:fontsize=54:x=(w-text_w)/2:y=300,drawtext=fontfile='$FONT':text='Play free on RUN':fontcolor=white:fontsize=60:box=1:boxcolor=0x2e9d4f@0.9:boxborderw=18:x=(w-text_w)/2:y=450,drawtext=fontfile='$FONT':text='w.run/yuyungfu/monster-mash-slingshot-siege':fontcolor=white:fontsize=30:x=(w-text_w)/2:y=580" -r 30 -c:v libx264 -crf 18 "$OUT/cut/10.mp4"

: > "$OUT/list.txt"
for n in 01 02 04 05 06 07 08 09 10; do echo "file 'cut/$n.mp4'" >> "$OUT/list.txt"; done
ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/list.txt" -c copy "$OUT/silent.mp4"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/silent.mp4")
FADE=$(awk "BEGIN{print $DUR-2}")

# landscape (X, Reddit, YouTube): the soundtrack looped and faded out
ffmpeg -y -loglevel error -i "$OUT/silent.mp4" -stream_loop -1 -i "$MUSIC" -t "$DUR" -filter_complex "[1:a]volume=0.9,afade=t=in:d=0.5,afade=t=out:st=$FADE:d=2[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -shortest "$OUT/trailer_landscape.mp4"

# vertical (TikTok, Reels, Shorts): the footage centred on a dark panel with a headline above and the call to action below
ffmpeg -y -loglevel error -i "$OUT/silent.mp4" -stream_loop -1 -i "$MUSIC" -t "$DUR" -filter_complex "color=c=0x1a1c2c:s=1080x1920:r=30[bg];[0:v]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2:shortest=1,format=yuv420p,drawtext=fontfile='$FONT':text='MONSTER MASH':fontcolor=0xffd75e:fontsize=120:x=(w-text_w)/2:y=330,drawtext=fontfile='$FONT':text='Slingshot Siege':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=470,drawtext=fontfile='$FONT':text='35 levels  -  boss citadels':fontcolor=white:fontsize=46:x=(w-text_w)/2:y=1330,drawtext=fontfile='$FONT':text='Build and share your own levels':fontcolor=white:fontsize=46:x=(w-text_w)/2:y=1400,drawtext=fontfile='$FONT':text='Global Challenge leaderboards':fontcolor=white:fontsize=46:x=(w-text_w)/2:y=1470,drawtext=fontfile='$FONT':text='Play free on RUN':fontcolor=white:fontsize=64:box=1:boxcolor=0x2e9d4f@0.95:boxborderw=22:x=(w-text_w)/2:y=1600[v];[1:a]volume=0.9,afade=t=in:d=0.5,afade=t=out:st=$FADE:d=2[aud]" -map "[v]" -map "[aud]" -c:v libx264 -crf 19 -c:a aac -b:a 160k -shortest "$OUT/trailer_vertical.mp4"
echo "duration $DUR"
