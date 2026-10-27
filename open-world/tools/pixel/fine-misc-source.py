"""Recover new scenic drafts' grids, then assign clusters to the shared <=64-color palette."""
from pathlib import Path
import json,sys,shutil
import numpy as np
from PIL import Image
sys.path.insert(0,'G:/webgame/aw-third-party/pixel-tools/proper-pixel-art/repo')
from proper_pixel_art import pixelate,PixelateConfig
root=Path(__file__).resolve().parents[2]
work=root/'.runtime/pixel-coherence/misc'
if '--v2' in sys.argv:work=work/'v2'
palette=json.loads((root/'packages/asset-manifest/pixel-palette.json').read_text())['ramps']
colors=list(dict.fromkeys(c for ramp in palette.values() for c in ramp))
if '--v2' in sys.argv:
    # The new drafts already use broad clean material planes; this fixed shade subset keeps them coherent.
    # This is not an attempt to repair noisy old scenic art through image filtering.
    selected={'ink':[0,1,2,4,5],'wood':[0,1,3,4],'navy':[0,2,3,4,5],'copper':[0,2,3,4],
              'leaf':[0,1,2,3,4],'water':[0,2,3,4,5],'fire':[0,2,3,4],'arcane':[0,2,3,4],'ui':[0,1]}
    colors=list(dict.fromkeys(palette[name][i] for name,indices in selected.items() for i in indices))
rgb=np.array([tuple(bytes.fromhex(c[1:])) for c in colors],dtype=np.int32)
paper=tuple(bytes.fromhex(palette['ui'][0][1:]))
def recover(group,name,size):
    source=work/f'{group}-{name}-draft.png'
    if not source.exists():return None
    src=Image.open(source).convert('RGB')
    cached=work/f'{group}-{name}-grid.png'
    if '--cached-grid' in sys.argv and cached.exists():
        grid=Image.open(cached).convert('RGB');recovered_width='cached-grid'
    else:
        result=pixelate(src,config=PixelateConfig.from_dict({'pixel_width':2,'transparent_background':False}))
        grid=result.image.convert('RGB');grid.save(cached);recovered_width=result.pixel_width
    pixels=np.asarray(grid.resize(size,Image.Resampling.NEAREST),dtype=np.int32)
    out=np.empty(pixels.shape,dtype=np.uint8)
    for y in range(size[1]):
        d=pixels[y,:,None,:]-rgb[None,:,:]
        distance=(d*d*np.array([2,3,1])).sum(axis=2)
        out[y]=rgb[np.argmin(distance,axis=1)].astype(np.uint8)
    if group=='chart':
        # The graph owns all actual geography, nodes and links; this is only border decoration.
        # Flatten the new draft's ivory empty center, not existing scenic silhouettes.
        neutral=(pixels.max(axis=2)-pixels.min(axis=2)<27)&(pixels.min(axis=2)>220)
        out[neutral]=paper
    image=Image.fromarray(out,'RGB').convert('RGBA');image.save(work/f'{group}-{name}-native.png')
    return {'draft':source.name,'grid':recovered_width,'recovered':grid.size,'native':size,'recipe':'proper-pixel-art mesh; nearest native footprint; master-palette shade clusters; opaque RGB scenic art'}
if __name__=='__main__':
    group=sys.argv[1] if len(sys.argv)>1 else 'chart'
    names=['wind','mist','forge','frost','rift','dragon','deep'] if group=='chart' else ['meadow','forest','rift','tundra','abyss','dragonbone','tundra-boss','abyss-boss','dragonbone-boss']
    size=(900,504) if group=='chart' else (640,360)
    report={name:value for name in names if (value:=recover(group,name,size))}
    (work/f'{group}-grid-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))
