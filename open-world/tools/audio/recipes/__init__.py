"""汇总注册：同 key/阶段的标杆优先，永不改标杆配方。"""
from benchmarks import SOUNDS as BENCHMARKS
SOUNDS=list(BENCHMARKS)

from .feedback import cues
SOUNDS += cues()

from .skills import sounds
known={(s.key,s.stage) for s in SOUNDS}
SOUNDS += [s for s in sounds({'player'}) if (s.key,s.stage) not in known]

from .status import SOUNDS as STATUS
from .monsters import SOUNDS as MONSTERS
from .feedback import actions
known={(s.key,s.stage) for s in SOUNDS}
SOUNDS += [s for s in STATUS+MONSTERS+actions() if (s.key,s.stage) not in known]

from .ambience import SOUNDS as AMBIENCE
from .stingers import SOUNDS as STINGERS
known={(s.key,s.stage) for s in SOUNDS}
SOUNDS += [s for s in AMBIENCE+STINGERS if (s.key,s.stage) not in known]

# 体积超80MB：非高频降至2变体，脚步/受击/拾取保留高频下限。
from dataclasses import replace
SOUNDS=[replace(s,variants=min(s.variants,3 if any(t in s.key for t in ['step-','pickup-','hurt','cue/hit','cue/kill']) else 2)) if hasattr(s,'category') else s for s in SOUNDS]

# 标杆已接入的触发点在本期补齐；只改变注册元数据，不改benchmarks.py。
SOUNDS=[replace(s,wired=True) if s.key.startswith(('ui/','foley/','amb/','stinger/','voice/','cue/')) else s for s in SOUNDS]
# wired只表示已经存在真实触发钩子；资源已生成但无入口的项目保留为False。
WIRED_UI=set('hover click cancel tab panel-open panel-close error equip-metal unequip lock salvage-batch forge-success forge-fail confirm reforge skill-learn skill-upgrade skill-slot talent-add talent-reset outfit badge forge-working inscription salvage-material equip-cloth equip-leather popup notification reward-count reward-end'.split())
WIRED_WORLD=set('quest-accept quest-progress dialogue teleport-activate camp-enter travel teleport return-town clue beacon-activate npc-bubble gate-open dungeon-enter quest-complete chest-open chest-reward gold-gain gold-spend discovery'.split())
WIRED_FOLEY=set('step-stone step-wood step-grass step-dirt step-snow step-metal step-water hurt hurt-heavy hit-flesh hit-metal hit-stone hit-spirit blink dash death revive level-up heartbeat'.split())
WIRED_STINGERS=set('level-up quest-complete death victory boss-defeated boss-intro discovery legendary-drop rare-spawn dungeon-fail clue reputation-up'.split())
WIRED_CUES=set('hit crit hurt kill danger shield-up shield-hit shield-break miss cast loot block multi-kill kill-light bag-full drop-common drop-magic drop-rare drop-legendary pickup-equipment pickup-material pickup-gold pickup-key chest-open chest-reward'.split())
def has_hook(s):
    prefix,name=s.key.split('/',1)
    if prefix=='mechanism' and name=='speed':return False
    if prefix=='ui': return name in WIRED_UI
    if prefix=='world':return name in WIRED_WORLD
    if prefix=='foley':return name in WIRED_FOLEY or name.startswith('weapon-') and s.stage in ['cast','release','impact']
    if prefix=='stinger':return name in WIRED_STINGERS
    if prefix=='cue':return name in WIRED_CUES
    if prefix=='affix':return s.stage=='warning' or name=='shield' or s.stage=='impact' and name in ('frost-nova','fire-trail','summon','teleport')
    if prefix=='voice':return True
    return True
SOUNDS=[replace(s,wired=has_hook(s)) for s in SOUNDS]

# 录音版：本地素材包存在时，用真实录音分层加工替换合成配方（素材包缺失时保持合成）。
from .recorded import apply as _recorded
SOUNDS=_recorded(SOUNDS)
