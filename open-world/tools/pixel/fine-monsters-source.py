"""Isolate complete source silhouettes, recover their real grid, retain enough detail for native output."""
from pathlib import Path
import sys,json,hashlib
import numpy as np
from scipy.ndimage import label,find_objects
from PIL import Image
sys.path.insert(0,'G:/webgame/aw-third-party/pixel-tools/proper-pixel-art/repo')
from proper_pixel_art import pixelate,PixelateConfig
root=Path(__file__).resolve().parents[2]/'.runtime/pixel-coherence/monsters'
groups={
 'enemies-a':(4,2,3,['dusk-blade','dusk-gunner','dusk-weaver','wind-hound','dock-scavenger','ember-worker','ore-loader','frozen-watch']),
 'enemies-b':(4,2,3,['moss-warden','pollen-caller','rift-lurker','rift-caller','bone-sentinel','oath-acolyte','raider','artillery']),
 'bosses-a':(2,2,2,['port-vanguard','fog-quartermaster','core-extractor','ice-patrol']),
 'bosses-b':(2,2,2,['rift-marshal','vilo','cyclops','hunter']),
 'bosses-c':(2,2,2,['dragon','frost-queen','abyss-lord','mimic']),
}
groupSelection=set(sys.argv[1:]);report=json.loads((root/'source-index.json').read_text(encoding='utf8')) if groupSelection and (root/'source-index.json').exists() else {}
for group,(cols,rows,grid,names) in groups.items():
 if groupSelection and group not in groupSelection:continue
 source=root/'drafts'/(group+'.png');im=Image.open(source).convert('RGBA');a=np.array(im);lab,count=label(a[:,:,3]>=240,structure=np.ones((3,3)));objects=find_objects(lab);selected={}
 for number,box in enumerate(objects):
  area=int(np.sum(lab[box]==number+1))
  if area<5000:continue
  cy=(box[0].start+box[0].stop)/2;cx=(box[1].start+box[1].stop)/2;index=min(rows-1,int(cy/im.height*rows))*cols+min(cols-1,int(cx/im.width*cols))
  if index in selected:raise RuntimeError('Two major components in cell; source needs review: '+group+str(index))
  selected[index]=(number+1,box,area)
 if len(selected)!=len(names):raise RuntimeError('Merged/cropped silhouettes: '+group+str(selected.keys()))
 for index,name in enumerate(names):
  number,box,area=selected[index];pad=12;x0=max(0,box[1].start-pad);y0=max(0,box[0].start-pad);x1=min(im.width,box[1].stop+pad);y1=min(im.height,box[0].stop+pad)
  raw=a[y0:y1,x0:x1].copy();raw[:,:,3]=np.where(lab[y0:y1,x0:x1]==number,255,0);cut=Image.fromarray(raw);folder=root/'sources'/name;folder.mkdir(parents=True,exist_ok=True);cut.save(folder/'draft.png')
  result=pixelate(cut,config=PixelateConfig.from_dict({'pixel_width':grid,'transparent_background':True}));result.image.save(folder/'grid.png')
  report[name]={'group':group,'cell':index,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'isolatedSourceSize':cut.size,'recoveredSize':result.image.size,'gridWidth':result.pixel_width,'upscale':result.upscale_factor,'foregroundArea':area}
  print(name,result.image.size,flush=True)
(root/'source-index.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
