"""Decode reviewed Duelyst CC0 atlases without resizing their native pixel art."""
from pathlib import Path
import re,json,plistlib,hashlib
from PIL import Image
root=Path(__file__).resolve().parents[2]
upstream=root/'.runtime/pixel-coherence/research/duelyst/app/resources/fx'
output=root/'.runtime/pixel-coherence/pets-fx/fx-source'
output.mkdir(parents=True,exist_ok=True)
def nums(s):return [int(float(v)) for v in re.findall(r'-?\d+(?:\.\d+)?',s)]
def order(name):
    phase=0 if 'appear' in name and 'disappear' not in name else 2 if 'disappear' in name else 1
    return (phase,int(re.findall(r'\d+',name)[-1]))
result={}
for plist in sorted(upstream.glob('*.plist')):
    name=plist.stem;meta=plistlib.loads(plist.read_bytes());sheet=Image.open(plist.with_suffix('.png')).convert('RGBA');directory=output/name;directory.mkdir(exist_ok=True);frames=[]
    for n,(key,entry) in enumerate(sorted(meta['frames'].items(),key=lambda p:order(p[0]))):
        x,y,w,h=nums(entry['frame']);sw,sh=nums(entry['sourceSize']);sx,sy,cw,ch=nums(entry['sourceColorRect']);cut=sheet.crop((x,y,x+w,y+h))
        if entry.get('rotated'):cut=cut.transpose(Image.Transpose.ROTATE_90)
        frame=Image.new('RGBA',(sw,sh));frame.alpha_composite(cut,(sx,sy));frame.save(directory/(str(n)+'.png'))
        pixels=list(frame.getdata());power=sum(a*(r+g+b) for r,g,b,a in pixels if a>=96);frames.append({'name':key,'file':str(n)+'.png','size':[sw,sh],'power':power})
    result[name]={'frames':frames,'peak':max(range(len(frames)),key=lambda n:frames[n]['power']),'sourceSha256':hashlib.sha256(plist.read_bytes()+plist.with_suffix('.png').read_bytes()).hexdigest(),'file':'app/resources/fx/'+name+'.plist + '+name+'.png'}
(output/'index.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print(json.dumps({'sources':len(result),'frames':sum(len(v['frames']) for v in result.values())}))
