"""从已生成WAV摘出短试听；不重渲染、不改变分级电平。"""
from pathlib import Path
import json,numpy as np
from build import read_wav
from dsp import SR,write_wav,silence
root=Path(__file__).resolve().parents[2];bank=json.loads((root/'apps/web/src/audio/sample-manifest.json').read_text(encoding='utf-8'))
keys=[*(('cue/'+k,'one') for k in ['hit','crit','hurt','kill','multi-kill','bag-full','block','shield-up','shield-hit','shield-break','drop-rare','drop-legendary']),*(('player/'+k,'impact') for k in ['cut','whirl','fireball','frost_bolt','chain','meteor','guardian_angel','seismic_staff','death_lotus']),('status/freeze','end'),*(('mechanism/'+k,'one') for k in ['burn','freeze','speed','quake','arrows','echo','block','opener']),*(('voice/'+k,'warning') for k in ['ss-boss-port-vanguard','ss-boss-fog-quartermaster','ss-boss-core-extractor','ss-boss-ice-patrol','ss-boss-rift-marshal','ss-boss-vilo']),*(('amb/'+k,'loop') for k in ['port','wind','mist','forge','frost','rift','dragon']),*(('stinger/'+k,'one') for k in ['level-up','quest-complete','victory','boss-defeated'])]
parts=[];labels=[];at=0
for key,stage in keys:
    e=bank.get(key,{}).get(stage)
    if not e:continue
    x,sr=read_wav(root/'apps/web/public'/e['files'][0].lstrip('/'))
    if x.ndim==2:x=x.mean(axis=0)
    if stage=='loop':x=x[:sr*4]
    if sr!=SR:x=np.interp(np.arange(int(len(x)*SR/sr))*sr/SR,np.arange(len(x)),x)
    labels.append(f'{at:.2f}s {key} [{stage}] v1 / {e["tier"]} / {e["source"]}')
    parts.extend([x,silence(.6)]);at+=len(x)/SR+.6
out=root/'.qa/audio-production';write_wav(out/'quick-reel.wav',np.concatenate(parts));(out/'quick-reel.txt').write_text('\n'.join(labels)+'\n',encoding='utf-8');print(f'快速试听 {len(keys)}段，{at:.1f}秒')
