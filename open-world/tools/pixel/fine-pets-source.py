"""Recover the new high-density creature and physical-ground FX grids; no old PX7 bitmap is sampled."""
from pathlib import Path
import sys,json
from PIL import Image
sys.path.insert(0,'G:/webgame/aw-third-party/pixel-tools/proper-pixel-art/repo')
from proper_pixel_art import pixelate,PixelateConfig
root=Path(__file__).resolve().parents[2]/'.runtime/pixel-coherence/pets-fx'
root.mkdir(parents=True,exist_ok=True)
drafts=[('A','C:/Users/ccc/.codex/generated_images/01a17e39-63aa-7831-91dc-ed5f45be0769/exec-60e56a8a-88d7-4cb9-93ca-ac8d268fb7c8.png'),('B','C:/Users/ccc/.codex/generated_images/01a17e39-63aa-7831-91dc-ed5f45be0769/exec-be29fb7e-46bb-401c-87f5-113701fe322a.png'),('C','C:/Users/ccc/.codex/generated_images/01a17e39-63aa-7831-91dc-ed5f45be0769/exec-df549939-27ec-40a7-a17c-757ba96afe7e.png')]
families=[['xiaoyuniguai','bingren','jinlong','xiaozhizhu','yuniguai','jiutoushe'],['xiaoemo','emo','dalong','bailong','ejiao','gulong_1'],['xiaolong','lvlongwang','shenyuanjiutoulong','xiaoyuanling','diyusantouquan','heilong_1']]
rects=[[(0,0,560,525),(560,0,970,525),(970,0,1536,525),(0,525,545,1024),(545,525,1030,1024),(1030,525,1536,1024)],[(0,0,440,520),(440,0,955,520),(955,0,1536,520),(0,520,440,1024),(440,520,960,1024),(960,520,1536,1024)],[(0,0,430,540),(430,0,1015,540),(1015,0,1536,540),(0,540,400,1024),(400,540,1015,1024),(1015,540,1536,1024)]]
report={}
for i,(label,file) in enumerate(drafts):
    image=Image.open(file).convert('RGBA');image.save(root/('pets-draft-'+label+'.png'))
    for name,rect in zip(families[i],rects[i]):
        src=image.crop(rect);src.putalpha(src.getchannel('A').point(lambda a:255 if a>=240 else 0))
        result=pixelate(src,config=PixelateConfig.from_dict({'pixel_width':3,'transparent_background':True}))
        result.image.save(root/(name+'-grid.png'));report[name]={'size':result.image.size,'pixelWidth':result.pixel_width}
image=Image.open('C:/Users/ccc/.codex/generated_images/01a17e39-63aa-7831-91dc-ed5f45be0769/exec-26aadef0-9281-4697-b7e0-104086eac7fd.png').convert('RGBA');image.save(root/'ground-draft.png')
for n,name in enumerate(['crater','crack','dust','rock','ring','scorch']):
    src=image.crop((n%3*512,n//3*512,(n%3+1)*512,(n//3+1)*512));src.putalpha(src.getchannel('A').point(lambda a:255 if a>=240 else 0));result=pixelate(src,config=PixelateConfig.from_dict({'pixel_width':2,'transparent_background':True}));result.image.save(root/('ground-'+name+'-grid.png'));report[name]={'size':result.image.size,'pixelWidth':result.pixel_width}
# The first hydra drafts showed only three heads. Use the corrected, countable 3+3+3 heads instead.
image=Image.open('C:/Users/ccc/.codex/generated_images/01a17e39-63aa-7831-91dc-ed5f45be0769/exec-ea5e6e54-eae9-42a8-a14a-7fa7c7a8cb54.png').convert('RGBA');image.save(root/'hydras-nine-head-draft.png');w,h=image.size
for n,name in enumerate(['jiutoushe','shenyuanjiutoulong']):
    src=image.crop((n*w//2,0,(n+1)*w//2,h));src.putalpha(src.getchannel('A').point(lambda a:255 if a>=240 else 0));result=pixelate(src,config=PixelateConfig.from_dict({'pixel_width':3,'transparent_background':True}));result.image.save(root/(name+'-grid.png'));report[name]={'size':result.image.size,'pixelWidth':result.pixel_width,'headCount':9}
(root/'source-grids.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps({'petFamilies':18,'groundEffects':6,'grids':report}))
