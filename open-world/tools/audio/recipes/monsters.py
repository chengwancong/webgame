"""躯体材质、真实叫声占位、敌方技能及预警。"""
from .skills import sounds,CATALOG
from .feedback import make
GROUPS={'dusk-humanoid':'shadow','beast':'blood','pirate':'steel','plant':'nature','fire-spirit':'fire','machine':'steel','frost-guard':'ice','rift':'arcane','dragon-oath':'earth'}
SOUNDS=sounds({'monster','boss'})
for group,e in GROUPS.items():
    for stage,n in [('move',3),('alert',2),('attack',2),('hurt',3),('death',2),('idle',2)]:
        SOUNDS.append(make('voice/'+group,e,'mark','impact-light',stage,n,source='synth-placeholder' if group in ['dusk-humanoid','beast','pirate','frost-guard','dragon-oath'] and stage in ['alert','death','idle'] else 'synth'))
for body in CATALOG['bodies']:
    if body['boss']:
        for stage in ['warning','intro','phase','enrage','death','hurt']:
            SOUNDS.append(make('voice/'+body['id'],GROUPS[body['group']],'burst','warning' if stage=='warning' else 'impact-heavy',stage,2,source='synth-placeholder' if stage in ['intro','death'] else 'synth'))
for affix,e in [('swift','nature'),('shield','holy'),('frost-nova','ice'),('fire-trail','fire'),('summon','shadow'),('teleport','arcane')]:
    for stage in ['warning','impact']: SOUNDS.append(make('affix/'+affix,e,'burst','cast' if stage=='warning' else 'impact-light',stage,2))

for body in CATALOG['bodies']:
    if '-rare-' in body['id'] or '-elite-' in body['id']:
        for stage in ['alert','death']:
            SOUNDS.append(make('voice/'+body['id'],GROUPS[body['group']],'mark','impact-light',stage,2,source='synth-placeholder' if body['group'] in ['dusk-humanoid','beast','pirate','frost-guard','dragon-oath'] else 'synth'))

from dataclasses import replace
from .warnings import warning_for
SOUNDS=[replace(s,fn=warning_for(s.key),note='首领专属预警：持续双音呼叫与窄带空气，区别于材质命中') if s.stage=='warning' and s.key.startswith('voice/') else s for s in SOUNDS]
