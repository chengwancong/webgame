"""Recover the newly painted semantic atlases. Never enlarges old runtime pixel images."""
from pathlib import Path
import sys,json,hashlib
import numpy as np
from PIL import Image
from scipy.ndimage import label,find_objects
sys.path.insert(0,'G:/webgame/aw-third-party/pixel-tools/proper-pixel-art/repo')
from proper_pixel_art import pixelate,PixelateConfig
work=Path(__file__).resolve().parents[2]/'.runtime/pixel-coherence/world-states'
groups={'bridges':['plank','bone','rope-fixed','rope-broken'],'seals':['seal-closed','seal-open','arch-device','crystal-generator'],'supplies':['wagon','outpost','power-hall','supply-tent'],'ships':['wreck','anchor-machine','zeppelin','frozen-hull']}
report={}
for group,names in groups.items():
 source=work/'drafts'/(group+'.png');im=Image.open(source).convert('RGBA');a=np.array(im);labels,count=label(a[:,:,3]>=240,structure=np.ones((3,3)));parts={i:[] for i in range(4)}
 for number,box in enumerate(find_objects(labels)):
  mask=labels[box]==number+1;area=int(mask.sum())
  if area<300:continue
  yy,xx=np.where(mask);cx=float(xx.mean()+box[1].start);cy=float(yy.mean()+box[0].start);cell=min(1,int(cy/im.height*2))*2+min(1,int(cx/im.width*2));parts[cell].append((number+1,area))
 for i,name in enumerate(names):
  if not parts[i]:raise RuntimeError('Missing object component '+name)
  threshold=max(1000,max(area for _,area in parts[i])*.04);keep=[number for number,area in parts[i] if area>=threshold];cut=a.copy();cut[:,:,3]=np.where(np.isin(labels,keep),255,0)
  yy,xx=np.where(cut[:,:,3]>0)
  if len(xx)<2500:raise RuntimeError('Missing semantic source '+name)
  # State pairs may intentionally contain two disconnected bridge halves; do not discard either half.
  box=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)];pad=6;box=[max(0,box[0]-pad),max(0,box[1]-pad),min(cut.shape[1],box[2]+pad),min(cut.shape[0],box[3]+pad)]
  raw=Image.fromarray(cut).crop(box);folder=work/'sources'/name;folder.mkdir(parents=True,exist_ok=True);raw.save(folder/'draft.png')
  result=pixelate(raw,config=PixelateConfig.from_dict({'pixel_width':1,'transparent_background':True}));result.image.save(folder/'grid.png')
  report[name]={'group':group,'cell':i,'draftSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'draftSize':raw.size,'nativeGridSize':result.image.size,'gridWidth':result.pixel_width,'upscale':result.upscale_factor,'method':'new authored draft -> proper-pixel-art; no old low-resolution runtime raster'}
  print(name,result.image.size,flush=True)
(work/'source-index.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
