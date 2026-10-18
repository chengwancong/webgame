"""环境床、点缀、固定声源；24kHz应对全库体积预算。"""
from dsp import *
from .model import ProductionSound
from .feedback import make
SR_AMB=24000
REGIONS={'port':(580,'nature'),'wind':(620,'nature'),'mist':(900,'nature'),'forge':(480,'fire'),'frost':(1100,'ice'),'rift':(350,'shadow'),'dragon':(720,'earth')}
def bed(freq,indoor=False):
    def render(seed,v):
        d=26;sr=SR_AMB;t=t_axis(d,sr);channels=[]
        for c in range(2):
            wind=bandpass(noise(d,seed+c,'pink',sr),freq,.8,sr)*(.65+.25*np.sin(2*np.pi*.13*t+c))
            texture=bandpass(noise(d,seed+10+c,'white',sr),freq*2.7,3,sr)*.08
            x=soft_clip(wind+texture,1.3)
            channels.append(x)
        x=loop_crossfade(np.stack(channels),2,sr)
        # 2ms接缝平滑，避免量化后的跳变。
        n=48;delta=x[...,0]-x[...,-1];x[...,-n:]+=delta[:,None]*np.linspace(0,1,n)
        return x
    return render
SOUNDS=[]
for region,(freq,element) in REGIONS.items():
    SOUNDS.append(ProductionSound('amb/'+region,'loop','ambience',1,bed(freq),'区域底噪：风床、材料共鸣和缓慢阵风；24秒立体声',sr=SR_AMB,category='amb'))
    for motif in ['bell','rustle','creak','rattle','gust','debris']:
        SOUNDS.append(make('ambient-detail/'+region+'-'+motif,element,'mark','foley',variants=2))
    if region!='port': SOUNDS.append(ProductionSound('amb/dungeon-'+region,'loop','ambience',1,bed(freq*.75,True),'地城底噪：封闭空间低共鸣与材料空气',sr=SR_AMB,category='amb'))
for region,freq in [('boss-arena',420),('travel',750)]:SOUNDS.append(ProductionSound('amb/'+region,'loop','ambience',1,bed(freq),'空间底噪：风床与缓慢起伏',sr=SR_AMB,category='amb'))
for key,freq in [('waterfall',1300),('stream',1700),('campfire',800),('forge',460),('steam',2200),('windmill',640),('ship',520),('bell',1200),('teleport',980),('rift',340),('chest',1500),('rigging',700)]:SOUNDS.append(ProductionSound('source/'+key,'loop','ambience',1,bed(freq),'定点环境：距离衰减的连续材质底噪',sr=SR_AMB,category='source'))
