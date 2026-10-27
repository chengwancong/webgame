"""Recover complete high-density draft grids, rejecting clipped sprite boundaries."""
from pathlib import Path
import sys,json,shutil
from PIL import Image
import cv2,numpy as np
sys.path.insert(0,'G:/webgame/aw-third-party/pixel-tools/proper-pixel-art/repo')
from proper_pixel_art import pixelate,PixelateConfig
root=Path(__file__).resolve().parents[2]/'.runtime/pixel-coherence/environment-v2'
root.mkdir(parents=True,exist_ok=True)
generated=Path('C:/Users/ccc/.codex/generated_images/01a17e39-63aa-7831-91dc-ed5f45be0769')
groups=[('nature','exec-d4f0715b-2c02-440a-abf0-bf389f575bed.png',[
 ('oak',(0,0,430,540)),('pine',(430,0,850,540)),('snow-pine',(850,0,1254,540)),
 ('rock',(0,540,430,880)),('ore',(430,540,850,880)),('lava-rock',(850,540,1254,880)),
 ('bush',(0,880,430,1254)),('herbs',(430,880,850,1254)),('column',(850,880,1254,1254))]),
 ('buildings','exec-bc22a960-fc67-4a48-97ec-17df969fc7f7.png',[
 ('house',(100,0,770,512)),('forge',(780,0,1536,512)),('warehouse',(0,512,820,1024)),('postal',(820,512,1536,1024))]),
 ('facilities','exec-06ae4b94-03fc-4e0d-87d5-ddf1603cd580.png',[
 ('arch',(0,0,715,560)),('altar',(715,0,1437,560)),('fence',(0,560,715,1095)),('tent',(715,560,1437,1095))])]
groups[0]=('nature-v2','exec-b2a74a90-5d4b-4a15-adb4-d58466544594.png',['oak','pine','snow-pine','rock','ore','lava-rock','bush','herbs','column'])
groups.extend([
 ('dungeon-v2','exec-bc1bec2a-ece6-4edd-91bb-952a452681ce.png',['crystal','minecart','stalagmite','sarcophagus','runestone','candelabra','ruin-wall','moss-stone','gem-stone']),
 ('industry-v2','exec-562e09e9-6e8e-4b8d-8b24-69a5213fc75b.png',[
 ('crane',(40,0,560,369)),('smelter',(565,0,970,365)),('tank',(990,0,1536,365)),
 ('pipes',(25,368,540,680)),('pylon',(625,360,910,680)),('drill',(955,375,1536,681)),
 ('workbench',(25,690,555,1024)),('waterwheel',(560,679,1000,1024)),('lift',(1050,660,1536,1024))]),
 ('relics-v2','exec-bfb6ead5-dbd5-4d50-bea0-0ca71c10e7c6.png',['binding','engine','key','letters','journal','astrolabe','mailcart','dragonbone','beacon']),
 ('landmarks-v2','exec-d7a825b5-80f3-4dbd-ac96-8a14c1d3cad4.png',['lighthouse','windmill','bell-tower','watchtower','observatory','oath-hall']),
 ('monuments-v2','exec-a38f8bce-c341-42b9-82f9-669d433ac28c.png',['drum','oath-monument','obelisk','telescope','signal-mast','root-shrine','letter-monument','crystal-array','turret'])])
groups=[('industry-v3','exec-abbaa6e1-c92e-46ab-9c03-61735dd0477e.png',['crane','smelter','tank','pipes','pylon','drill','workbench','waterwheel','lift']) if label=='industry-v2' else (label,file,items) for label,file,items in groups]
groups.extend([
 ('quest-props-v2','exec-eb4474b3-9315-4ba2-adef-6e1540e82acf.png',['contract','noticeboard','chest-closed','chest-open','winged-node','orb-core','ice-journal','testimony','ice-anchor']),
 ('full-cave','exec-f1168cfd-f491-4003-b4da-b2c686f29efa.png',[('cave-backdrop',None)]),
 ('full-crypt','exec-0385cf77-19d0-41ae-baa6-a24ec627ccef.png',[('crypt-backdrop',None)]),
 ('full-maze','exec-90d0f900-ceac-411e-ba1f-234100d2e09a.png',[('maze-backdrop',None)]),
 ('full-sky','exec-e4eea047-6359-4433-b1bb-9d3b4f4d4dff.png',[('sky',None)]),
 ('full-cliff','exec-f4a4e23e-f9c7-4e25-aaa9-6640b1d11381.png',[('cliff-sand',(0,0,836,470)),('cliff-granite',(836,0,1672,470)),('cliff-ice',(0,470,836,941)),('cliff-basalt',(836,470,1672,941))])])
groups.append(('build-decor-v2','exec-a975ff88-31dc-4e3d-8fd3-04c2b5e0afc2.png',['toolrack','bell-gear-sign','rowboat','survey-table','mailbox','pigeon-cart','ore-crate','recipe-stall','flagboat']))
groups.append(('empty-chest-v2','exec-5ce12885-4479-439b-9f95-e9316f25eb25.png',['chest-open']))
groups.append(('gates-cargo-v2','exec-8161ec39-53bf-4836-9dc7-a3fe37e0f22f.png',[
 ('gate-wind',(0,0,512,340)),('gate-dragon',(512,0,1024,340)),('gate-forge',(1024,0,1536,340)),
 ('gate-frost',(0,340,512,675)),('gate-mist',(512,340,1044,675)),('gate-rift',(1044,340,1536,675)),
 ('civilian-bag',(0,675,512,1024)),('cargo-closed',(512,675,1024,1024)),('cargo-open',(1024,675,1536,1024))]))
report=json.loads((root/'sources.json').read_text()) if (root/'sources.json').exists() else {}
only=set(sys.argv[1:])
for label,file,items in groups:
    shutil.copy2(generated/file,root/(label+'-draft.png'));image=Image.open(generated/file).convert('RGBA')
    isolated={}
    if isinstance(items[0],str):
        mask=(np.array(image)[:,:,3]>=240).astype('uint8');_,labels,stats,centers=cv2.connectedComponentsWithStats(mask,8)
        mains=sorted(sorted(range(1,len(stats)),key=lambda i:-stats[i,4])[:len(items)],key=lambda i:stats[i,1])
        ordered=[]
        for n in range(0,len(items),3): ordered.extend(sorted(mains[n:n+3],key=lambda i:stats[i,0]))
        assignments={i:[i] for i in ordered}
        for i in range(1,len(stats)):
            if i in assignments or stats[i,4]<25: continue
            nearest=min(ordered,key=lambda j:np.linalg.norm((centers[i]-centers[j])/np.maximum(stats[j,2:4],1)))
            assignments[nearest].append(i)
        prepared=[]
        for name,i in zip(items,ordered):
            alpha=np.isin(labels,assignments[i]).astype('uint8')*255;copy=image.copy();copy.putalpha(Image.fromarray(alpha));bbox=copy.getbbox();x,y,x1,y1=bbox
            rect=(max(0,x-4),max(0,y-4),min(image.width,x1+4),min(image.height,y1+4));isolated[name]=copy
            prepared.append((name,rect))
        items=prepared
    for name,rect in items:
        if rect is None: rect=(0,0,image.width,image.height)
        if only and name not in only: continue
        if report.get(name,{}).get('sourceFile')==file and report[name].get('crop')==list(rect) and (root/(name+'-grid.png')).exists(): continue
        src=isolated.get(name,image).crop(rect);src.putalpha(src.getchannel('A').point(lambda a:255 if a>=240 else 0))
        # A deliberately wide manual crop may contain a tiny edge fragment from its neighboring cell.
        # Remove only detached edge fragments; a clipped main silhouette still fails below.
        neighbor_fragments=0
        if label=='gates-cargo-v2':
            arr=np.array(src);n,labels,stats,_=cv2.connectedComponentsWithStats((arr[:,:,3]>0).astype('uint8'),8);largest=max(stats[1:,4],default=0)
            for i in range(1,n):
                x,y,ww,hh,area=stats[i]
                if (x==0 or y==0 or x+ww==src.width or y+hh==src.height) and area<largest*.10:
                    arr[labels==i,3]=0;neighbor_fragments+=int(area)
            src=Image.fromarray(arr)
        bbox=src.getbbox()
        touches=bool(bbox and (bbox[0]==0 or bbox[1]==0 or bbox[2]==src.width or bbox[3]==src.height))
        full=label.startswith('full-')
        if touches and not full: raise ValueError(name+' draft touches crop boundary: '+str(bbox))
        result=pixelate(src,config=PixelateConfig.from_dict({'pixel_width':1,'transparent_background':not full}))
        result.image.save(root/(name+'-grid.png'))
        report[name]={'draft':label+'-draft.png','sourceFile':file,'crop':rect,'sourceSize':src.size,'sourceBounds':bbox,'gridSize':result.image.size,'pixelWidth':result.pixel_width,'upscaleFactor':result.upscale_factor,'completeContour':full or not touches,'fullBleed':full,'neighborFragmentsRemoved':neighbor_fragments}
        (root/'sources.json').write_text(json.dumps(report,indent=2),encoding='utf8')
(root/'sources.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({'sources':len(report),'completeContours':all(r['completeContour'] for r in report.values())}))
