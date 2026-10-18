"""短提示音乐，完整旋律参数表；BGM不合成。"""
from dsp import *
from .model import ProductionSound
NOTES={'quest-complete':[659,784,988],'death':[440,349,294],'victory':[587,740,880,1175],'boss-defeated':[392,587,784,988,1175],'boss-intro':[294,311,440],'discovery':[784,988,1319],'legendary-drop':[698,880,1047,1397],'rare-spawn':[622,831,1245],'dungeon-fail':[523,415,349],'clue':[880,1175,1568],'reputation-up':[659,831,988,1319]}
def phrase(notes):
    def render(seed,v):
        layers=[]
        for i,f in enumerate(notes):
            layers.append((pluck(f,1.25,seed+i,.7),i*.09,-i))
            layers.append((fm(f,2.76,np.linspace(.9,.05,57600),1.2)*env_ad(1.2,.004,4),i*.09+.05,-12))
        return trim(room(mix(*layers),.6,.2,seed))
    return render
SOUNDS=[ProductionSound('stinger/'+key,'one','stinger',1,phrase(notes),'提示旋律：竖琴琶音与FM钟尾',category='stinger') for key,notes in NOTES.items()]
