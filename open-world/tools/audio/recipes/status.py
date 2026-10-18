"""状态、连携及机制提示。"""
from .skills import sounds
from .feedback import make
SOUNDS=sounds({'status','combo','system'})
MECHANISMS={'burn':'fire','freeze':'ice','speed':'nature','quake':'earth','arrows':'steel','echo':'arcane','block':'steel','opener':'holy'}
SOUNDS += [make('mechanism/'+key,e,'burst','impact-light',variants=3) for key,e in MECHANISMS.items()]
SOUNDS += [make('accent/'+e,e,'mark','cast',variants=3) for e in ['fire','ice','storm','shadow','nature','steel']]
