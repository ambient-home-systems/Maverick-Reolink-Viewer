#!/bin/sh
# Synthetic camera pictures for the design preview (not real footage): a sky
# and ground, a few shapes, sensor noise, a vignette and the camera's
# on-screen time and name, as Reolink cameras burn them in. Written to
# preview/public/media/ (not committed).
set -eu
out="$(dirname "$0")/public/media"
mkdir -p "$out"
font=/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf

scene() {
  # name size sky ground horizon extra-filters
  name=$1 size=$2 sky=$3 ground=$4 horizon=$5 extra=$6
  w=${size%x*} h=${size#*x}
  ffmpeg -hide_banner -loglevel error -y -f lavfi \
    -i "gradients=s=${size}:c0=${sky}:c1=${ground}:x0=0:y0=0:x1=0:y1=${h}:nb_colors=2,format=yuv420p" \
    -frames:v 1 -vf "drawbox=x=0:y=${horizon}:w=${w}:h=$((h - horizon)):color=${ground}@0.55:t=fill${extra},noise=alls=14:allf=t,vignette=PI/4.5,drawtext=fontfile=${font}:text='10/27/2026 21\:24\:13':x=$((w / 40)):y=$((h / 30)):fontsize=$((h / 22)):fontcolor=white@0.9:borderw=2:bordercolor=black@0.6,drawtext=fontfile=${font}:text='${name}':x=w-tw-$((w / 40)):y=h-th-$((h / 30)):fontsize=$((h / 22)):fontcolor=white@0.9:borderw=2:bordercolor=black@0.6" \
    "$out/$(echo "$name" | tr ' A-Z' '-a-z').jpg"
}

# Day: a lawn and a street, a house front, a parked car.
scene "Front Yard Right" 1280x720 0x9cc3df 0x4f6b3c 430 ",drawbox=x=120:y=250:w=420:h=200:color=0xc9c2b5@1:t=fill,drawbox=x=170:y=310:w=90:h=140:color=0x6d5a46@1:t=fill,drawbox=x=780:y=470:w=330:h=110:color=0x2f3a48@1:t=fill,drawbox=x=820:y=430:w=220:h=60:color=0x3c4a5c@1:t=fill"
# Garage interior at night: infrared, grey.
scene "Garage Camera" 640x480 0x3a3a3a 0x5c5c5c 300 ",drawbox=x=60:y=120:w=230:h=180:color=0x7a7a7a@1:t=fill,drawbox=x=380:y=210:w=200:h=110:color=0x2a2a2a@1:t=fill,hue=s=0"
# Day: the street side, a fence line.
scene "Front Yard Left" 1280x720 0xa9cbe3 0x5d7444 400 ",drawbox=x=0:y=380:w=1280:h=26:color=0x8a6e4f@1:t=fill,drawbox=x=880:y=230:w=300:h=170:color=0xd6cfc2@1:t=fill,drawbox=x=930:y=290:w=70:h=110:color=0x5b4a3a@1:t=fill"
# Panorama: a long back yard (the Duo 3's wide picture).
scene "Back Yard" 1536x432 0x8fb6d6 0x46613a 230 ",drawbox=x=200:y=150:w=180:h=80:color=0x6b8f4e@1:t=fill,drawbox=x=1100:y=120:w=260:h=110:color=0xb9b1a3@1:t=fill,drawbox=x=640:y=300:w=240:h=40:color=0x7c6248@1:t=fill"
# A kennel run at night: infrared.
scene "Dogs" 640x480 0x303030 0x6a6a6a 260 ",drawbox=x=40:y=150:w=560:h=8:color=0x9a9a9a@1:t=fill,drawbox=x=420:y=300:w=120:h=60:color=0x8c8c8c@1:t=fill,hue=s=0"
# Indoors: a hallway, warm light.
scene "Hallway Camera" 640x360 0xe8dcc4 0x9b7f5e 250 ",drawbox=x=250:y=60:w=140:h=190:color=0x6e5843@1:t=fill,drawbox=x=0:y=0:w=60:h=360:color=0xcfc2a8@1:t=fill"
# Indoors: washer and dryer panels.
scene "Laundry Room" 640x360 0xdfe3e6 0xb7bcc0 280 ",drawbox=x=120:y=90:w=170:h=190:color=0xf4f5f6@1:t=fill,drawbox=x=330:y=90:w=170:h=190:color=0xf0f1f3@1:t=fill,drawbox=x=160:y=120:w=90:h=12:color=0x2b6cb0@1:t=fill,drawbox=x=370:y=120:w=90:h=12:color=0x2f855a@1:t=fill"
# The doorbell's square picture: a porch.
scene "Doorbell" 720x720 0xb9cfe0 0x8a7a66 470 ",drawbox=x=0:y=470:w=720:h=250:color=0x9a8b78@1:t=fill,drawbox=x=40:y=120:w=160:h=350:color=0x5b4636@1:t=fill,drawbox=x=520:y=520:w=140:h=100:color=0xa0773f@1:t=fill"
ls -la "$out"
