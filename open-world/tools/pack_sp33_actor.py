"""Pack rendered original Spine frames, preserving the shared ground anchor."""
from pathlib import Path
from PIL import Image
import json, hashlib
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'assets/actors/wushi/rendered'
meta=json.loads((source/'render.json').read_text())
frames=[]
for action,info in meta['actions'].items():
 for i in range(info['count']):
  name=f'{action}_{i}';im=Image.open(source/f'{name}.png').convert('RGBA');box=im.getbbox()
  if not box or min(box[:2])<2 or box[2]>254 or box[3]>254:raise ValueError(f'Clipped/empty frame: {name}: {box}')
  frames.append((name,im))
columns=16;cell=256
sheet=Image.new('RGBA',(columns*cell,((len(frames)+columns-1)//columns)*cell))
atlas={'frames':{},'meta':{'image':'hero.png','size':{'w':sheet.width,'h':sheet.height}}}
for i,(name,im) in enumerate(frames):
 x=(i%columns)*cell;y=(i//columns)*cell;sheet.alpha_composite(im,(x,y));atlas['frames'][name]={'frame':{'x':x,'y':y,'w':cell,'h':cell},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':cell,'h':cell},'sourceSize':{'w':cell,'h':cell}}
out=ROOT/'apps/web/public/art';sheet.save(out/'hero.png');(out/'hero.json').write_text(json.dumps(atlas))
p=ROOT/'packages/asset-manifest/catalog.json';catalog=json.loads(p.read_text());catalog['actors']['hero']={'identity':'sp33-wushi','anchor':meta['anchor'],'scale':meta['scale'],'fps':meta['fps'],'actions':{k:v['count'] for k,v in meta['actions'].items()},'conversion_sources':[{'action':k,'source_action':v['source'],'fallback':False,'source':'assets/actors/wushi/hero_wushi.skel'} for k,v in meta['actions'].items()]};catalog['version']='sp33-hero-ui-v2';p.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
manifest_path=out/'manifest.json'
if manifest_path.exists():
 full=json.loads(manifest_path.read_text());full['actors']['hero']=catalog['actors']['hero'];full['version']=catalog['version'];manifest_path.write_text(json.dumps(full,ensure_ascii=False,indent=2)+'\n')
# Both UI images derive from the same rendered model; no invented identity.
p=ROOT/'assets/ui-source/v2/ui-source.json';ui=json.loads(p.read_text());portrait=Image.open(source/'portrait.png');portrait=portrait.crop(portrait.getbbox());folder=ROOT/'assets/ui-source/v2/portraits';portrait.save(folder/'hero.png');bust=portrait.crop((0,0,portrait.width,int(portrait.height*.62)));bust.save(folder/'hero-bust.png')
for asset in ui['assets']:
 if asset['id']=='portrait-hero':asset['size']=list(portrait.size)
 if asset['id']=='portrait-bust':asset['size']=list(bust.size)
p.write_text(json.dumps(ui,ensure_ascii=False,indent=2)+'\n')
record={'identity':'sp33-wushi','frames':len(frames),'animation_mapping':meta,'all_frames_contained':True,'atlas_sha256':hashlib.sha256((out/'hero.png').read_bytes()).hexdigest(),'portrait_source':'same skeleton Idle at 0.1s; transparent bounds crop','source_manifest':'assets/actors/wushi/source.json'}
(ROOT/'assets/actors/wushi/export.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');print(json.dumps(record,ensure_ascii=False))
