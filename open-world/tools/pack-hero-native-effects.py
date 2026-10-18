"""Pack original Spine effect planes without resampling their source coordinates."""
from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]
source=root/'assets/actors/wushi/effect-attachments'
frames=[]
for i in range(29):
 for layer in ('front','back'):
  im=Image.open(source/f'skill_{i}_{layer}.png').convert('RGBA');box=im.getbbox()
  if box:frames.append((f'skill_{i}_{layer}',im,box))
frames.sort(key=lambda row:row[2][3]-row[2][1],reverse=True)
positions=[];x=y=row_height=0;width=2048
for name,im,box in frames:
 w,h=box[2]-box[0],box[3]-box[1]
 if x+w+4>width:x=0;y+=row_height;row_height=0
 positions.append((name,im,box,x+2,y+2));x+=w+4;row_height=max(row_height,h+4)
height=y+row_height;sheet=Image.new('RGBA',(width,height));atlas={'frames':{},'meta':{'image':'hero-native-fx.png','size':{'w':width,'h':height}}}
for name,im,box,x,y in positions:
 crop=im.crop(box);sheet.alpha_composite(crop,(x,y));w,h=crop.size
 atlas['frames'][name]={'frame':{'x':x,'y':y,'w':w,'h':h},'rotated':False,'trimmed':True,'spriteSourceSize':{'x':box[0],'y':box[1],'w':w,'h':h},'sourceSize':{'w':512,'h':512}}
out=root/'apps/web/public/art';sheet.save(out/'hero-native-fx.png');(out/'hero-native-fx.json').write_text(json.dumps(atlas),encoding='utf-8')
print(json.dumps({'frames':len(frames),'atlas':[width,height],'source':'original Skill effect slots; front/back planes; shared camera and 1:1 pixel scale'}))
