"""预警采用持续双音呼叫，命中采用短材质冲击；参数显式按首领登记。"""
from dsp import *
from .motifs import IDENTITIES,MOTIFS

def warning_for(key):
    motif=MOTIFS.get(IDENTITIES.get(key.split('/')[-1],''),(650,2300,3))
    body,material,q=motif
    def render(seed,v):
        d=(.42,.48)[v%2];f=material*.7*(1,.985)[v%2]
        first=osc(f,d)*env_ad(d,.025,1.8)
        second=osc(f*1.41,d)*env_ad(d,.04,2.5)
        air=bandpass(noise(d,seed),f,8)*env_ad(d,.025,2)
        return trim(mix((first,0,0),(second,.07,-4),(air,0,-9)))
    return render
