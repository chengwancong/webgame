"""Recover real grids from the finer source drafts before native-frame authoring."""
from pathlib import Path
import sys,json
from PIL import Image
sys.path.insert(0,'G:/webgame/aw-third-party/pixel-tools/proper-pixel-art/repo')
from proper_pixel_art import pixelate,PixelateConfig
root=Path(__file__).resolve().parents[2]/'.runtime/pixel-coherence/fine'
root.mkdir(parents=True,exist_ok=True)
def recover(name,src):
    src=src.convert('RGBA');src.putalpha(src.getchannel('A').point(lambda a:255 if a>=220 else 0));config=PixelateConfig.from_dict({'pixel_width':8,'transparent_background':True}) if name=='shiba' else PixelateConfig.from_dict({'transparent_background':True});result=pixelate(src,config=config);result.image.save(root/(name+'-grid.png'));return {'size':result.image.size,'grid':result.pixel_width}
report={'shiba':recover('shiba',Image.open(root/'shiba-draft.png'))}
image=Image.open(root/'npc-draft.png');w,h=image.size
for i in range(8):
    x0=round(i%4*w/4);x1=round((i%4+1)*w/4);y0=round(i//4*h/2);y1=round((i//4+1)*h/2)
    report['npc'+str(i)]=recover('npc'+str(i),image.crop((x0,y0,x1,y1)))
print(json.dumps(report))
