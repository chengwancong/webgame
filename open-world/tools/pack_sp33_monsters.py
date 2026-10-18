"""Pack native Spine monster frames; trim transparent margins without moving the foot origin."""
from pathlib import Path
from PIL import Image
import json,hashlib
ROOT=Path(__file__).resolve().parents[1]
config=json.loads((ROOT/'assets/actors/monsters.json').read_text())
out=ROOT/'apps/web/public/art'
catalog_path=ROOT/'packages/asset-manifest/catalog.json'
catalog=json.loads(catalog_path.read_text())
for key,actor in config['actors'].items():
 source=ROOT/actor['source'];render=source/'rendered';meta=json.loads((render/'render.json').read_text())
 cell=512 if 'boss' in key else 256;frames=[];hashes={};transparent_death_frames=[]
 for action,info in meta['actions'].items():
  hashes[action]=set()
  for i in range(info['count']):
   name=f'{action}_{i}';original=Image.open(render/f'{name}.png').convert('RGBA');raw=original.getbbox()
   if not raw:
    if action!='death' or i<info['count']-2:raise ValueError(f'{key}: unexpected empty {name}')
    transparent_death_frames.append(name)
   elif min(raw[:2])<2 or raw[2]>original.width-2 or raw[3]>original.height-2:raise ValueError(f'{key}: clipped {name} {raw}')
   im=original.resize((cell,cell),Image.Resampling.LANCZOS);box=im.getbbox() or (0,0,1,1)
   hashes[action].add(hashlib.sha256(im.tobytes()).hexdigest());frames.append((name,im,box))
 # Shelf packing keeps GPU memory proportional to the actor rather than transparent export canvas.
 frames.sort(key=lambda frame:frame[2][3]-frame[2][1],reverse=True)
 placements=[];x=y=row=0;width=4096 if cell==512 else 2048
 for name,im,box in frames:
  w,h=box[2]-box[0],box[3]-box[1]
  if x+w+4>width:x=0;y+=row;row=0
  placements.append((name,im,box,x+2,y+2));x+=w+4;row=max(row,h+4)
 height=y+row;assert height<=4096,(key,height)
 sheet=Image.new('RGBA',(width,height));atlas={'frames':{},'meta':{'image':key+'.png','size':{'w':width,'h':height}}}
 for name,im,box,x,y in placements:
  crop=im.crop(box);sheet.alpha_composite(crop,(x,y));w,h=crop.size
  atlas['frames'][name]={'frame':{'x':x,'y':y,'w':w,'h':h},'rotated':False,'trimmed':True,'spriteSourceSize':{'x':box[0],'y':box[1],'w':w,'h':h},'sourceSize':{'w':cell,'h':cell}}
 sheet.save(out/(key+'.png'));(out/(key+'.json')).write_text(json.dumps(atlas))
 idle=Image.open(render/'idle_1.png').convert('RGBA').resize((cell,cell),Image.Resampling.LANCZOS).getbbox();scale=actor['height']/(idle[3]-idle[1]);anchor=[meta['anchor'][0],idle[3]/cell]
 profile={'identity':'sp33-'+actor['identity'],'displayName':actor['name'],'anchor':anchor,'scale':scale,'displayHeight':actor['height'],'nativeFacing':actor['nativeFacing'],'fps':meta['fps'],'actions':{k:v['count'] for k,v in meta['actions'].items()},'conversion_sources':[{'action':k,'source_action':v['source'],'fallback':False,'source':actor['source']+'/'+actor['base']+'.skel'} for k,v in meta['actions'].items()]}
 catalog['actors'][key]=profile
 record={'actor':key,'identity':profile['identity'],'frames':len(frames),'unique_frames':{k:len(v) for k,v in hashes.items()},'all_frames_contained':True,'transparent_death_frames':transparent_death_frames,'animation_mapping':meta,'profile':profile,'atlas_sha256':hashlib.sha256((out/(key+'.png')).read_bytes()).hexdigest(),'atlas_size':[width,height],'source_manifest':actor['source']+'/source.json','foot_anchor':'Idle frame visible bottom; common origin retained across all actions and trimmed atlas frames'}
 (source/'export.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');print(key,len(frames),[width,height])
catalog['version']='sp33-actors-v3';catalog_path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
mp=out/'manifest.json';manifest=json.loads(mp.read_text());manifest['actors']=catalog['actors'];manifest['version']=catalog['version'];manifest['sources']=[{'manifest':v['source']+'/source.json'} for v in config['actors'].values()]+[{'manifest':'assets/actors/wushi/source.json'}];mp.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
