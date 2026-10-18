"""反馈、动作、界面和交互的语义参数表。"""
from .skills import recipe
from .model import ProductionSound
from .motifs import IDENTITIES

def make(key,element='steel',family='mark',tier='ui',stage='one',variants=2,weight='filler',source='synth'):
    p=dict(key=key,element=element,family=family,weight=weight,signature=False,motif=IDENTITIES.get(key.split('/')[-1],{'bell':'clock','rustle':'leaves','creak':'staff-tap','rattle':'blades','gust':'wings','debris':'crater'}.get(key.split('-')[-1],'')))
    return ProductionSound(key,stage,tier,variants,recipe(p,stage),f'{key}：{element}质感、{family}包络与短余振',source=source,category=key.split('/')[0],weight=weight)

def cues():
    rows=[('hurt','blood','impact-light'),('miss','nature','cast'),('cast','arcane','cast'),('shield-up','holy','cast'),('shield-hit','ice','impact-light'),('block','steel','impact-heavy'),('multi-kill','holy','impact-heavy'),('kill-light','nature','foley'),('bag-full','storm','warning')]
    out=[make('cue/'+k,e,'burst',t,variants=3) for k,e,t in rows]
    out += [make('cue/drop-'+k,e,'mark',t,variants=3) for k,e,t in [('common','earth','foley'),('magic','arcane','impact-light'),('rare','ice','impact-heavy'),('epic','holy','impact-heavy'),('legendary','holy','stinger')]]
    out += [make('cue/pickup-'+k,e,'mark','foley',variants=3) for k,e in [('equipment','steel'),('material','nature'),('gold','holy'),('key','arcane')]]
    out += [make('cue/'+k,e,'mark','ui') for k,e in [('chest-open','earth'),('chest-reward','holy'),('gold-spend','steel'),('gold-gain','holy')]]
    out += [make('cue/loot-glow','holy','shield','cast','loop')]
    return out
UI_GROUPS={
 'nature':'hover cancel panel-close equip-cloth equip-leather unequip drag-drop sort lock outfit dye',
 'steel':'click confirm equip-metal salvage-batch salvage-material forge-working forge-success forge-fail reforge inscription',
 'arcane':'tab popup notification skill-learn skill-upgrade skill-slot talent-add talent-reset paragon-add boon-select boon-confirm map-open route-select sail',
 'holy':'rating reward-count reward-end badge auto-on',
 'shadow':'error auto-off'}
WORLD='npc-bubble dialogue quest-accept quest-progress quest-complete teleport-activate teleport dungeon-enter key-use gate-open clue camp-enter return-town chest-open chest-reward gold-spend gold-gain beacon-activate discovery travel'.split()
def actions():
    out=[]
    for material,e in [('grass','nature'),('dirt','earth'),('snow','ice'),('metal','steel'),('water','poison')]: out.append(make('foley/step-'+material,e,'mark','foley',variants=5))
    for k,e in [('dash','nature'),('land','earth'),('blink','arcane'),('cloth','nature'),('leather','blood'),('plate','steel'),('hurt','blood'),('hurt-heavy','earth'),('death','shadow'),('revive','holy'),('level-up','holy')]:out.append(make('foley/'+k,e,'mark','foley',variants=3))
    out.append(make('foley/heartbeat','blood','shield','foley','loop'))
    for weapon,e in [('sword','steel'),('staff','nature'),('hammer-axe','earth'),('bow','nature'),('hidden','steel')]:
        for stage in ['cast','release','impact']:out.append(make('foley/weapon-'+weapon,e,'slash','foley',stage,3))
    for material,e in [('flesh','blood'),('metal','steel'),('stone','earth'),('spirit','arcane')]:out.append(make('foley/hit-'+material,e,'burst','foley',variants=3))
    for e,keys in UI_GROUPS.items():
        out += [make('ui/'+key,e,variants=2) for key in keys.split()]
    out += [make('world/'+k,'arcane','mark','foley') for k in WORLD]
    return out
