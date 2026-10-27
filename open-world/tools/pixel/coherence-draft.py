"""Recover each generated prop's grid separately; the generated sheet itself is never a runtime texture."""
from pathlib import Path
import sys,json
sys.path.insert(0,'G:/webgame/aw-third-party/pixel-tools/proper-pixel-art/repo')
from proper_pixel_art import pixelate
from PIL import Image
root=Path(__file__).resolve().parents[2]/'.runtime/pixel-coherence/props'
image=Image.open(root/'draft.png').convert('RGBA')
rects={'portal':(100,0,570,390),'pier':(590,5,1040,390),'boat':(1070,0,1536,400),'forge':(95,390,575,725),'stall':(595,390,1035,735),'wardrobe':(1060,390,1536,730),'cargo':(95,730,575,1024),'fire':(650,720,990,1024),'lamp':(1140,700,1400,1024)}
report={}
for name,rect in rects.items():
    src=image.crop(rect)
    src.putalpha(src.getchannel('A').point(lambda a:255 if a>=240 else 0))
    result=pixelate(src)
    result.image.save(root/(name+'.png'))
    report[name]={'size':result.image.size,'grid':result.pixel_width}
print(json.dumps(report))
