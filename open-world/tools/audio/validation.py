"""制作新增约束；返回真实残差，不修改阈值。"""
from collections import defaultdict
from pathlib import Path
import json
WEIGHTS={p['key']:p['weight'] for p in json.loads((Path(__file__).parent/'recipes/catalog.json').read_text(encoding='utf-8-sig'))['profiles']}

def production_checks(rows,public):
    errors=[]; groups=defaultdict(list); weights=defaultdict(list)
    for s,v,m,_ in rows:
        category=getattr(s,'category','') or s.key.split('/')[0]
        if category and s.stage!='loop': groups[(category,s.tier,s.stage)].append((s.key,m['punch']))
        weight=getattr(s,'weight','') or WEIGHTS.get(s.key,'')
        if s.key.startswith('player/') and s.stage=='impact' and weight: weights[weight].append(m['punch'])
        if s.tier!='ambience' and m.get('bytes',0)>1000000: errors.append(f'{s.key}/{s.stage}: 单文件超过1MB')
    for (category,tier,stage),values in groups.items():
        lo=min(values,key=lambda x:x[1]);hi=max(values,key=lambda x:x[1])
        if hi[1]-lo[1]>3: errors.append(f'同类冲击差 {category}/{tier}/{stage}: {hi[0]} 与 {lo[0]} {hi[1]-lo[1]:.1f}dB > 3')
    for hi,lo in [('ultimate','cooldown'),('cooldown','core'),('core','filler')]:
        if hi in weights and lo in weights:
            gap=sum(weights[hi])/len(weights[hi])-sum(weights[lo])/len(weights[lo])
            if gap<2: errors.append(f'技能层级 {hi}/{lo}: {gap:.1f}dB < 2')
    return errors
