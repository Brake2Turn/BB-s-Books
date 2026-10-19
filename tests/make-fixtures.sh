#!/usr/bin/env bash
# Generates the test images the browser tests use (kept out of git: the camera feed is ~40 MB).
# Needs python3 with Pillow, and ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .fixtures/covers
python3 - <<'PY'
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random
random.seed(4)
# An ISBN barcode (9780141439518) for the fake camera.
L=["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"]
G=["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"]
R=["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"]
P=["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"]
code="9780141439518"
bits="101"+"".join((L if p=="L" else G)[int(d)] for p,d in zip(P[int(code[0])],code[1:7]))+"01010"+"".join(R[int(d)] for d in code[7:])+"101"
img=Image.new("RGB",(1280,720),(235,225,210)); d=ImageDraw.Draw(img); m=5; x0=(1280-len(bits)*m)//2
d.rectangle([x0-40,220,x0+len(bits)*m+40,500],fill="white")
for i,b in enumerate(bits):
    if b=="1": d.rectangle([x0+i*m,240,x0+i*m+m-1,460],fill="black")
img.save(".fixtures/barcode.jpg",quality=95)
# Phone-photo-like covers for the cover-reading test.
F="/usr/share/fonts/truetype/dejavu/"
def font(n,s):
    try: return ImageFont.truetype(F+n,s)
    except OSError: return ImageFont.load_default()
def cover(name,bg,fg,lines,tilt=0,blur=0,light=False,texture=False):
    W,H=600,900; im=Image.new("RGB",(W,H),bg); d=ImageDraw.Draw(im)
    if texture:
        for _ in range(2500):
            x,y=random.randrange(W),random.randrange(H); d.point((x,y),fill=tuple(max(0,min(255,v+random.randint(-25,25))) for v in bg))
    for text,fn,size,y,col in lines: d.text((W/2,y),text,font=font(fn,size),fill=col or fg,anchor="mm")
    if light:
        g=Image.new("L",(W,H)); gd=ImageDraw.Draw(g)
        for x in range(W): gd.line([(x,0),(x,H)],fill=int(70*x/W))
        im=Image.composite(Image.new("RGB",(W,H),(255,255,255)),im,g)
    if blur: im=im.filter(ImageFilter.GaussianBlur(blur))
    c=Image.new("RGB",(760,1060),(120,105,95)); c.paste(im,(80,80))
    if tilt: c=c.rotate(tilt,resample=Image.BICUBIC,fillcolor=(120,105,95))
    c.save(f".fixtures/covers/{name}.jpg",quality=85)
cover("secret-history",(22,34,60),(236,224,196),[("THE SUNDAY TIMES BESTSELLER","DejaVuSans.ttf",20,70,None),("THE","DejaVuSerif.ttf",54,300,None),("SECRET","DejaVuSerif-Bold.ttf",88,390,None),("HISTORY","DejaVuSerif-Bold.ttf",88,490,None),("DONNA TARTT","DejaVuSans.ttf",40,800,(214,170,90))],tilt=3,blur=1.2,texture=True)
cover("circe",(14,14,16),(240,200,120),[("THE NUMBER ONE BESTSELLER","DejaVuSans.ttf",20,80,(200,200,200)),("CIRCE","DejaVuSerif.ttf",130,420,None),("MADELINE MILLER","DejaVuSans.ttf",36,780,None),("Author of The Song of Achilles","DejaVuSerif.ttf",22,830,(200,200,200))],tilt=-4,blur=1.5)
cover("normal-people",(232,226,214),(30,30,30),[("NOW A MAJOR BBC SERIES","DejaVuSans.ttf",22,90,(120,40,40)),("Normal","DejaVuSerif.ttf",100,380,None),("People","DejaVuSerif.ttf",100,490,None),("Sally Rooney","DejaVuSans.ttf",40,780,None)],tilt=2,light=True,blur=1)
cover("piranesi",(70,100,96),(250,246,236),[("SUSANNA","DejaVuSans-Bold.ttf",46,150,None),("CLARKE","DejaVuSans-Bold.ttf",46,205,None),("Piranesi","DejaVuSerif.ttf",110,520,None),("WINNER OF THE WOMEN'S PRIZE FOR FICTION","DejaVuSans.ttf",18,840,None)],tilt=-2,blur=1.3,texture=True)
cover("klara",(196,60,40),(255,240,220),[("KAZUO","DejaVuSans-Bold.ttf",60,160,None),("ISHIGURO","DejaVuSans-Bold.ttf",60,230,None),("Klara","DejaVuSerif.ttf",96,470,None),("and the Sun","DejaVuSerif.ttf",64,560,None),("Winner of the Nobel Prize in Literature","DejaVuSans.ttf",18,850,None)],tilt=5,blur=1.8,light=True)
PY
ffmpeg -loglevel error -y -loop 1 -i .fixtures/barcode.jpg -t 3 -r 10 -pix_fmt yuv420p .fixtures/barcode.y4m
echo "Fixtures ready in tests/.fixtures"
