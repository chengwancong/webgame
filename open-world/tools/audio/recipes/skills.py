"""从实际配置生成每技能成品；显式形态、元素、冷却、招牌决定结构。"""
import json,hashlib
from pathlib import Path
from dsp import *
from .model import ProductionSound
from .elements import ELEMENTS
from .forms import FORMS
from .motifs import MOTIFS
CATALOG=json.loads(Path(__file__).with_name('catalog.json').read_text(encoding='utf-8-sig'))

def recipe(p,stage):
    ident=int(hashlib.sha1(p['key'].encode()).hexdigest()[:8],16)
    pitch=2**(((ident%301)/100-1.5)/12)
    base={'steel':470,'fire':780,'ice':620,'storm':720,'nature':420,'arcane':700,'shadow':280,'earth':380,'holy':820,'blood':360,'poison':560}[p['element']]
    def render(seed,v):
        d=({'filler':.12,'core':.23,'cooldown':.36,'ultimate':.55}[p['weight']] if stage=='impact' else .23)
        d*= (1,.88,1.12)[v%3]
        if stage=='impact': d*=1+min(p.get('cooldown',0),20)*.008
        f=base*pitch*(1,.96,1.04)[v%3]
        texture=ELEMENTS[p['element']](seed,v,d,f)
        body=highpass(osc(sweep(f,f*.65,d),d,'tri'),240)*env_ad(d,.002,3 if p['weight']=='cooldown' else 4)
        trans=bandpass(noise(.008,seed+4),2700,1)*env_ad(.008,.001,4)
        motif=MOTIFS.get(p.get('motif',''))
        if motif:
            body_hz,material_hz,q=motif
            vp=(1,.982,1.018)[v%3]
            resonance=modal([(body_hz*pitch*vp,1,d),(material_hz*pitch*vp,.55,d*.65),(material_hz*1.41*pitch*vp,.2,d*.35)],d,seed+9,.003)
            texture=bandpass(texture,material_hz,q)
            x=mix((texture,0,-5),(resonance,0,0),(body,0,-15),(trans,0,-20))
        else: x=mix((texture,0,0),(body,0,-9),(trans,0,-12))
        if p.get('signature'): x=mix((x,0,0),(modal([(f*2.76,1,.19),(f*4.13,.5,.11)],.24,seed+5),.03,-9))
        x=FORMS[p['family']](x,seed+6)
        if stage in ('cast','warning'): x=fade(x[::-1],.012,.008)
        if stage in ('end','tick','flight'): x=fade(x[:int(.28*SR)],.003,.02)
        if p['key'].startswith(('monster/','boss/')): x=soft_clip(x,1.4)
        return trim(x)
    return render

def sounds(prefixes):
    out=[]
    for p in CATALOG['profiles']:
        if p['key'].split('/')[0] not in prefixes: continue
        for st in p['stages']:
            tier='warning' if st=='warning' else ('stinger' if p['weight']=='ultimate' else 'impact-light' if p['weight']=='filler' or p['key'].startswith('monster/') else 'impact-heavy') if st=='impact' else 'cast'
            out.append(ProductionSound(p['key'],st,tier,3,recipe(p,st),f"{p['element']}·{p['family']} {st}：瞬态、身体、元素质感与形态尾部",weight=p['weight'],category=p['key'].split('/')[0]))
    return out
