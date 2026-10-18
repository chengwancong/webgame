"""录音素材调色板：按来源路径/文件名把本地素材包片段归入声音类别。

素材包由 tools/audio/sourcing/index.py 生成在 .qa/audio-sourcing/pack（只留本地）。
类别只看素材自身的命名与时长，不看游戏 key；key → 类别的组合在 recorded.py。
"""
from __future__ import annotations
import json, re
from functools import lru_cache
from pathlib import Path
import numpy as np
import soundfile as sf

PACK = Path(__file__).resolve().parents[3] / '.qa/audio-sourcing/pack'

# 类别：(包含正则, 排除正则, 最短秒, 最长秒)。正则匹配小写的来源相对路径。
R = lambda s: re.compile(s)
CLASSES: dict[str, tuple] = {
    # —— 武器与物理 ——
    'swing': (R(r'meleeswingspack|swing scrape|swsh_swing 3|weapon swings|future melee weapons|epic_whoosh|whoosh_fast|whoosh air|rpg-sfx_0/blade|knifeslice|drawknife|action deploy units sword slice'), R(r'impact|hit'), .08, 1.6),
    'blade_hit': (R(r'sword slash impact|sword slide cuts|metal swing hit|weapon_hit|swing impacts|axe flesh hit|slash'), None, .05, 2.0),
    'sheath': (R(r'sword sheath|drawknife|beltHandle|metallatch|metal_element_spring|shield spin|weapaxe|weapswrd_weapon 03|metal, slow whoosh'.lower()), None, .05, 2.0),
    'punch': (R(r'punch|fghtimpt|hit_injured|impact_low_thud|hit & punch|tackleheavy'), None, .04, 1.6),
    'blunt_hit': (R(r'spear and stick impact|woodimpt_impact wood|impactplank|impactwood|wood_hit|bfh1_hit|sfx100v2_hit|sfx100v2_wood|rpg-sfx_0/wood|impactgeneric|creature_wood_attack|kenney_rpg-audio/audio/chop'), None, .04, 1.6),
    'metal_hit': (R(r'cinematic_metal|metal_pipe_hit|impactmetal|impactplate|metal_hit|anvil|metal old file|shield block|impact metal|metal sweeteners|metal elements|impactbell'), None, .04, 2.5),
    'stone_hit': (R(r'stone_impact|rocks impact|rock_hit|impactmining|rock_breaking|rock dropping|rpg-sfx_0/stones|item_stone|sfx100v2_stones|invader_debris|wav junction sound effects - rocks|rocks_tumble|tumble_cliff'), None, .04, 2.5),
    'wood_break': (R(r'wood_breaking|wood crash|woodcrsh|log_debris|branch_leaf_foliage_impact|bfh1_breaking|falling'), R(r'glass|metal|rock'), .05, 2.5),
    'glass': (R(r'glass_breaking|glass_hit|impactglass|glass_0|sbvfe2_glass|glasmvmt|glass_falling'), None, .04, 2.0),
    'boom': (R(r'epic impacts|cinematic_impact|trailer_booms|dsgnboom|colossal impacts|impact dark epic|big lfe|ultra transitions|impact hit rapid|cinematic_whoosh_hit|epic impacts'), None, .1, 3.0),
    'explosion': (R(r'explosion|expl|deepexplosion|bigexplosion|farexplosion|mortar|grenade'), R(r'water'), .15, 3.0),
    'whoosh': (R(r'whoosh|woosh|whsh|swoosh|jw4-ws|wipe|transition_3|w_a_p_spell'), R(r'fire|glass|ghost|water|watery|metal'), .1, 2.0),
    'bow': (R(r'whip snap|wipe|metal_element_spring'), None, .03, 1.2),
    # —— 元素 ——
    'fire': (R(r'fire|flame|burn|sizzle|spell_fire|campfire|bonfire'), R(r'firework'), .05, 3.0),
    'ice': (R(r'ice|frost|freeze|icebrk|icefric|crystal'), R(r'office|slice|voice|device|dice|price|ice hockey'), .05, 3.0),
    'electric': (R(r'electric|zap|arc_|laser|static|spark'), R(r'lawn|guitar|motor|scooter|sewing'), .05, 3.0),
    'arcane': (R(r'magic generic|shimmer|creation|magic_transformation|w_a_p_spell|spell_0|magicpack2_electricityspells|energy flow|magic_spells_castshort_push|magic, |dreamcatcher|emotion and magic|enchant|power ?up'), R(r'evil|dark|menacing'), .08, 3.0),
    'holy': (R(r'bell|harp|angl|light spell|bright positive|enchanting|heaven|discovery_|chime|kalimba|xylophone|ting'), R(r'belt|church bells, far'), .08, 3.0),
    'shadow': (R(r'dark|evil|ghost|scary|menacing|shadow|haunted|horror|ethereal entity|whisper|spellbound|onslaught|braam|tentacle'), R(r'ambien'), .08, 3.0),
    'nature': (R(r'druid|leaf|branch|foliage|bamboo|forest_tree|wood_texture|vine|tree|bird flutes|rustle'), R(r'ambien|night deciduous'), .06, 3.0),
    'poison': (R(r'slime|acid|bubble|gurgl|swamp|corroded|mud|syringe|burp|spit'), R(r'ambien|loop'), .05, 3.0),
    'earth': (R(r'rock|stone|debris|meteor|earth|tumble|rumble|collapse|mining|drag_on_rock'), R(r'ambien'), .05, 3.0),
    'blood': (R(r'gore|blood|squelch|flesh|splat|carapace|squishy|eat_0'), None, .04, 2.5),
    'water': (R(r'water|splash|liquid|watr|drip|wave_|swirled'), R(r'ambien|loop_|flowing|waterfall|stream|ocean|cave_?design0|sea'), .05, 3.0),
    'air': (R(r'air|wind|gust|whistl|tonalwind|rush'), R(r'ambien|indoor|chimney|airport|aircraft|repair|loop'), .08, 3.0),
    'chain': (R(r'chain'), None, .05, 3.0),
    # —— 生物 ——
    'roar': (R(r'roar|growl|dinosaur|largemonster|werewolf|threaten|fire monster vocals|sea beast|snarl|howl|troll'), None, .2, 3.0),
    'creature_attack': (R(r'attack|aggressive|charged up|onslaught'), R(r'whoosh|impact|creature_wood|crab_organic|magevil|water spell|melee'), .1, 2.5),
    'creature_hurt': (R(r'hurt|pain|damage|grim pain'), None, .1, 2.5),
    'creature_death': (R(r'die_|death|monster9_death|flutter death'), None, .15, 3.0),
    'creature_idle': (R(r'idle|breath|call|grunt|mouth|talking mutant|orc speech|gurgling|exhale|tremble|screeching|zombie|hellhound|creature-sfx[^/]*/monster_|snore|bark|creature_misc'), R(r'anime|panting male|warrior breaths'), .1, 3.0),
    'creature_small': (R(r'cute_|bug_|alien_|insect|weird_|misc_\d'), R(r'sfx100|bfh1|rpg-sfx|interface|item_'), .05, 2.0),
    'human_effort': (R(r'voxmale|voxfem|warrior|adventurer|yell|hmnbrth|panting|human_0|cough|scream|surprise'), R(r'cry|laugh|whistle'), .1, 2.5),
    'step_creature': (R(r'creature footstep|creature_footstep|orc_footstep|hoof|paw |tallons|stomp|creature_wood_footstep|gallop|trot'), None, .04, 1.5),
    # —— 动作拟音 ——
    'step_stone': (R(r'footstep_concrete|footstep0|sfx100v2_footstep_0|0002_footsteps'), R(r'snow'), .03, .6),
    'step_wood': (R(r'footstep_wood|footstep_carpet|sfx100v2_footstep_wood|wooden floor'), None, .03, .6),
    'step_grass': (R(r'footstep_grass|grass 3 single step'), None, .03, 1.0),
    'step_snow': (R(r'footstep_snow|snow_footsteps|snow 7 single step|crusty_snow'), None, .03, .8),
    'step_water': (R(r'footstep_wet|puddle|footsteps_water'), None, .03, .8),
    'step_dirt': (R(r'mud 1|footstep_mud|footstep_damp|footstep_medium|footstep_carpet|footstep_grass_00[34]'), None, .03, .8),
    'cloth': (R(r'cloth|zipper|backpack|t-shirt|washing basket|clothflp'), None, .05, 1.5),
    'leather': (R(r'leather|belt|buckle|handlesmall'), None, .05, 1.5),
    'plate': (R(r'metallatch|metalclick|metalpot|jiggling belt|dragging metal|metal_clutter|cartridge|armr'), None, .04, 1.5),
    'coins': (R(r'coin'), None, .04, 2.0),
    'item': (R(r'items?_|book|lock|door|sbvfe|drop_00|chest|box|lid|dice|cards|pawns|wooden_pieces|paper'), R(r'clock|doorclose|dooropen'), .04, 1.5),
    'door': (R(r'door|creak|gate|lock_0|lock_open'), None, .08, 3.0),
    # —— 界面 ——
    'ui_click': (R(r'kenney_ui-audio/audio/(click|switch|mouse)|interface-sounds/audio/(click|select|tick|toggle|switch)|switch_button|clicks & switches|kawaii ui|uiclick|button_press|interface percussion snap|wall_light|plastic knob|clicks_ddm|bleeps'), None, .01, .6),
    'ui_hover': (R(r'rollover|interface-sounds/audio/(tick|scroll|pluck|glitch)|readout|fui ease|hologram ping|transitions_low_ddm'), None, .01, .4),
    'ui_open': (R(r'interface-sounds/audio/(open|maximize|drop)|clothflp|bookopen|bookflip|navigation swipe|woosh sweep slide|interface arp reveal|rising flutter'), None, .03, 1.0),
    'ui_close': (R(r'interface-sounds/audio/(close|minimize|back)|bookclose|ss wipe|bookplace'), None, .03, 1.0),
    'ui_error': (R(r'error|deny|denied|failure_0|access_denied'), None, .05, 1.2),
    'ui_confirm': (R(r'confirmation|accept|happy|success|kalimba|xylophone|arp twinkle|plucks happy|game entry|bright positive|notif oct up|boing'), None, .05, 1.5),
    'ui_ping': (R(r'bong|ping|glass_00|notif|chime|bells_4|interface pop|toonpop|pop high'), None, .03, 1.5),
    # —— 预警、提示 ——
    'riser': (R(r'riser|swell|rising|power ?up|transition braam|braam|intense trailer|transition_3'), None, .3, 3.0),
    'stinger_good': (R(r'discovery_|harp_glissando|bright positive|enchanting_bells|level up|power up bright|short_powerup|xylophone ringtone|cofetti'), None, .3, 3.0),
    'tonal': (R(r'impactbell_heavy|interface plucks happy|kalimba|pluck_00|xylophone|ting coins'), None, .1, 3.0),
    'stinger_bad': (R(r'failure_|horror stingers|hsfh|mystery_|dark creepy|uialert_alert designed transition swell'), None, .3, 3.0),
}

# 环境长素材：类别 → 来源路径正则（第一个命中者）
LONGS = {
    'ocean': r'ocean', 'wind': r'ivo vicic - wind|wind_blowing|extreme winds|tonal wind|wind strong', 'forest': r'forest ambiences|forest|owls',
    'harbor': r'yacht|marina|rigging|cable rope', 'ethereal': r'heaven|afterlife|ethereal|dream', 'steel': r'symphony of steel|steelwork|welding',
    'stream': r'winter forest stream|stream', 'waterfall': r'waterfall', 'tonalwind': r'tonal wind|tonalwind', 'flowing': r'flowing water',
    'steam': r'steam engine|steamengine', 'metaltone': r'haunted metal vol.3|tense metallic tone', 'watermill': r'watermill|axle and wheel',
    'campfire': r'campfire|bonfire', 'bell': r'church bells', 'strange': r'strange game ambient', 'cave': r'cave ?design|cavedesign',
    'electric': r'electric_arc_deep_bass_seamless_loop|electricityloop|magic_ambience_electricity', 'magic': r'magic_ambience',
}


@lru_cache(maxsize=1)
def index() -> list[dict]:
    p = PACK / 'index.json'
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else []


def available() -> bool:
    return bool(index())


@lru_cache(maxsize=None)
def members(cls: str) -> tuple[dict, ...]:
    inc, exc, lo, hi = CLASSES[cls]
    out = []
    for e in index():
        # 长片段由各层 dur 截短，只有界面/脚步需要原本就短
        if e['kind'] != 'shot' or not (lo <= e['dur'] <= (hi if cls.startswith(('ui_', 'step_')) else 8)):
            continue
        s = e['origin'].lower()
        if inc.search(s) and not (exc and exc.search(s)):
            out.append(e)
    return tuple(sorted(out, key=lambda e: e['id']))


@lru_cache(maxsize=None)
def longs(name: str) -> tuple[dict, ...]:
    rx = re.compile(LONGS[name])
    return tuple(e for e in index() if e['kind'] == 'long' and rx.search(e['origin'].lower()))


@lru_cache(maxsize=4096)
def load(entry_id: str) -> np.ndarray:
    x, sr = sf.read(str(PACK / f'{entry_id}.wav'), dtype='float64')
    return x if x.ndim == 1 else x.mean(axis=1)
