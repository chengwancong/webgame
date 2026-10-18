"""录音版配方：用本地素材包（palette.py）里的真实录音分层加工，替换程序合成的 fn。

每个 (key, 阶段) 由「元素 × 家族 × 阶段 × 响度档」得到若干层；层 = 素材类别 + 增益/起点/变调/滤波/时长。
片段在注册时按顺序轮转分配（与渲染顺序、--only 无关），不同 key 尽量不撞同一录音；
变体取同一录音文件的相邻片段（同一次录制的多条），没有则只变调。
加工后统一做规格贴合：高通到小喇叭/低频预算内、2–5kHz 降刺、时长上限、限幅把冲击感拉到同档目标。
素材包缺失时保留原合成配方，不影响构建。
"""
from __future__ import annotations
import hashlib, math, re
from dataclasses import dataclass, replace, fields
import numpy as np
from dsp import SR, db, fft_filter, hp_resp, lp_resp, fade, loop_crossfade
from benchmarks import TIERS
from . import palette as P
from .model import ProductionSound
from .skills import CATALOG
from .stingers import NOTES

PROFILE = {p['key']: p for p in CATALOG['profiles']}
BODY = {b['id']: b for b in CATALOG['bodies']}
VOICE_GROUP = {'dusk-humanoid': 'shadow', 'beast': 'blood', 'pirate': 'steel', 'plant': 'nature', 'fire-spirit': 'fire',
               'machine': 'steel', 'frost-guard': 'ice', 'rift': 'arcane', 'dragon-oath': 'earth'}
PITCH = (1.0, .955, 1.045, .975, 1.025)


@dataclass(frozen=True)
class L:
    cls: str
    g: float = 0.0       # 增益 dB
    at: float = 0.0      # 起点秒
    pitch: float = 1.0
    hp: float = 0.0
    lp: float = 0.0
    dur: float = 0.0     # 最长秒（0 = 原长）
    rev: bool = False    # 反向（吸入/蓄力）
    pick: int = 0        # 同类第几个（同一 key 用两条同类素材时错开）
    notes: tuple = ()    # 音高序列（Hz）：把单个有音高的录音按音符排成琶音


# 元素 → 各阶段主层类别
ELEM = {
    'steel':  dict(cast='sheath', release='swing', impact='blade_hit', body='metal_hit'),
    'fire':   dict(cast='fire', release='fire', impact='explosion', body='fire'),
    'ice':    dict(cast='ice', release='ice', impact='glass', body='ice'),
    'nature': dict(cast='nature', release='whoosh', impact='wood_break', body='nature'),
    'shadow': dict(cast='shadow', release='shadow', impact='punch', body='shadow'),
    'earth':  dict(cast='earth', release='whoosh', impact='stone_hit', body='earth'),
    'arcane': dict(cast='arcane', release='arcane', impact='arcane', body='electric'),
    'blood':  dict(cast='blood', release='swing', impact='blood', body='punch'),
    'holy':   dict(cast='holy', release='holy', impact='holy', body='metal_hit'),
    'poison': dict(cast='poison', release='poison', impact='poison', body='water'),
    'storm':  dict(cast='electric', release='electric', impact='electric', body='air'),
}
FAMILY_IMPACT = {'slash': 'blade_hit', 'burst': 'explosion', 'shield': 'metal_hit', 'chain': 'chain', 'summon': 'creature_idle',
                 'heal': 'holy', 'dash': 'punch', 'spin': 'swing', 'projectile': 'punch', 'beam': 'electric', 'zone': 'earth', 'mark': 'punch'}


def meta(s) -> tuple[str, str, str]:
    p = PROFILE.get(s.key)
    if p:
        return p['element'], p['family'], p.get('weight', '')
    m = re.search(r'：(\w+)质感、(\w+)包络', s.note or '')
    if m:
        return m[1], m[2], getattr(s, 'weight', '')
    return 'steel', 'mark', getattr(s, 'weight', '')


def skill_layers(s, el, fam, weight) -> list[L]:
    E = ELEM.get(el, ELEM['steel'])
    heavy = s.tier == 'impact-heavy' or weight == 'cooldown' or s.key.startswith('boss/')
    st = s.stage
    if st == 'cast':
        out = [L(E['cast'], 0, dur=.55), L('whoosh', -10, rev=True, dur=.3, hp=300)]
        if s.key.startswith('boss/'):
            out.append(L('riser', -6, dur=.7))
        return out
    if st == 'release':
        lead = 'swing' if fam in ('slash', 'spin', 'dash') else E['release']
        return [L(lead, 0, dur=.45), L('whoosh', -6, dur=.4, pick=1), L(E['body'], -10, at=.02, dur=.35)]
    if st == 'flight':
        return [L('whoosh', 0, dur=.5, pick=2), L(E['body'], -8, dur=.45)]
    if st == 'impact':
        out = [L(E['impact'], 0, dur=.8), L(FAMILY_IMPACT.get(fam, 'punch'), -4, dur=.45)]
        if heavy:
            out.append(L('boom', -3, dur=1.0))
        if s.tier == 'impact-light':
            out = [replace(x, dur=min(x.dur, .5)) for x in out[:2]]
        return out
    if st == 'loop':
        return [L(E['body'], 0, dur=.6), L(E['cast'], -9, dur=.5, pick=1)]
    if st == 'tick':
        return [L(E['body'], 0, dur=.35), L('punch', -12, dur=.2)]
    if st == 'end':
        return [L(E['cast'], 0, dur=.45, pick=2), L('whoosh', -12, dur=.3)]
    if st == 'warning':
        return [L('riser', 0, dur=.75), L(E['body'], -5, at=.05, dur=.6)]
    if st == 'one':  # 机制/词缀/点缀
        return [L(E['impact'], 0, dur=.6), L(E['cast'], -6, dur=.5, pick=1)]
    return [L(E['body'], 0, dur=.6)]


VOICE_STAGE = {'move': 'step_creature', 'alert': 'creature_attack', 'attack': 'creature_attack', 'hurt': 'creature_hurt',
               'death': 'creature_death', 'idle': 'creature_idle'}
VOICE_STYLE = {  # 组 → (主体类别替换, 变调, 质感类别)
    'dusk-humanoid': ({'move': 'step_dirt', '*': 'human_effort'}, .92, 'shadow'),
    'beast':         ({'alert': 'roar', '*': None}, .95, 'blood'),
    'pirate':        ({'move': 'step_wood', '*': 'human_effort'}, 1.0, 'leather'),
    'plant':         ({'move': 'nature', '*': 'creature_small'}, 1.15, 'nature'),
    'fire-spirit':   ({'move': 'fire', '*': None}, 1.2, 'fire'),
    'machine':       ({'move': 'plate', 'idle': 'plate', 'hurt': 'metal_hit', 'death': 'metal_hit', '*': 'metal_hit'}, 1.0, 'electric'),
    'frost-guard':   ({'move': 'step_snow', '*': 'human_effort'}, .9, 'ice'),
    'rift':          ({'move': 'arcane', '*': 'creature_small'}, 1.1, 'shadow'),
    'dragon-oath':   ({'alert': 'roar', 'attack': 'roar', '*': None}, .8, 'earth'),
}


def voice_layers(s) -> list[L]:
    name = s.key.split('/', 1)[1]
    body = BODY.get(name)
    group = body['group'] if body else name
    mapping, pitch, tex = VOICE_STYLE.get(group, ({'*': None}, 1.0, 'shadow'))
    st = s.stage
    boss = bool(body and body.get('boss'))
    if boss:
        pitch *= .82
        main = {'warning': 'roar', 'intro': 'roar', 'phase': 'roar', 'enrage': 'roar', 'death': 'creature_death', 'hurt': 'creature_hurt'}[st]
        if group in ('dusk-humanoid', 'pirate', 'frost-guard') and st in ('hurt', 'death'):
            main = 'human_effort'
        out = [L(main, 0, pitch=pitch, dur=1.0 if st != 'hurt' else .55), L(tex, -8, dur=.6)]
        if st == 'warning':
            out = [L('riser', -2, dur=.8), L(main, -2, at=.12, pitch=pitch, dur=.7), L(tex, -9, dur=.6)]
        elif st in ('intro', 'phase', 'death'):
            out.append(L('boom', -4, dur=1.0))
        elif st == 'enrage':
            out.append(L('creature_attack', -4, pitch=pitch, dur=.8))
        return out
    main = mapping.get(st, mapping.get('*')) or VOICE_STAGE[st]
    if main == 'human_effort' and st == 'move':
        main = 'step_dirt'
    dur = {'move': .35, 'idle': .7, 'alert': .7, 'attack': .55, 'hurt': .45, 'death': .9}[st]
    out = [L(main, 0, pitch=pitch, dur=dur)]
    if st != 'move':
        out.append(L(tex, -10, dur=min(dur, .5)))
    return out


UI = {
    'hover': [L('ui_hover', 0, dur=.12)], 'click': [L('ui_click', 0, dur=.12)], 'tab': [L('ui_click', 0, dur=.15, pick=1), L('cloth', -12, dur=.12)],
    'sort': [L('item', 0, dur=.25)], 'route-select': [L('ui_click', 0, dur=.15, pick=2), L('ui_ping', -8, dur=.25)], 'lock': [L('item', 0, dur=.3, pick=1)],
    'cancel': [L('ui_close', 0, dur=.25)], 'panel-close': [L('ui_close', 0, dur=.3, pick=1)], 'panel-open': [L('ui_open', 0, dur=.3)],
    'map-open': [L('ui_open', 0, dur=.32, pick=1)], 'popup': [L('ui_ping', 0, dur=.6), L('ui_open', -8, dur=.3, pick=2)],
    'notification': [L('ui_ping', 0, dur=.7, pick=1)], 'error': [L('ui_error', 0, dur=.33)], 'forge-fail': [L('ui_error', 0, dur=.3, pick=1), L('metal_hit', -6, dur=.3)],
    'auto-off': [L('ui_close', 0, dur=.25, pick=2), L('ui_error', -10, dur=.25, pick=2)], 'auto-on': [L('ui_confirm', 0, dur=.3, pick=3)],
    'confirm': [L('ui_confirm', 0, dur=.3)], 'equip-metal': [L('plate', 0, dur=.32)], 'equip-cloth': [L('cloth', 0, dur=.3)],
    'equip-leather': [L('leather', 0, dur=.3)], 'unequip': [L('leather', 0, dur=.3, pick=1)], 'outfit': [L('cloth', 0, dur=.3, pick=1)],
    'dye': [L('water', 0, dur=.3), L('cloth', -8, dur=.25, pick=2)], 'drag-drop': [L('item', 0, dur=.25, pick=2)],
    'salvage-batch': [L('metal_hit', 0, dur=.9), L('stone_hit', -6, dur=.6)], 'salvage-material': [L('stone_hit', 0, dur=.32), L('item', -6, dur=.2)],
    'forge-working': [L('metal_hit', 0, dur=.33, pick=1)], 'forge-success': [L('metal_hit', 0, dur=.3, pick=2), L('ui_confirm', -4, dur=.3, pick=1)],
    'reforge': [L('metal_hit', 0, dur=.3, pick=3), L('arcane', -6, dur=.3)], 'inscription': [L('item', 0, dur=.3, pick=3), L('arcane', -8, dur=.3, pick=1)],
    'skill-learn': [L('ui_confirm', 0, dur=.33, pick=2), L('holy', -6, dur=.3)], 'skill-upgrade': [L('holy', 0, dur=.33, pick=1), L('ui_confirm', -6, dur=.3, pick=4)],
    'skill-slot': [L('ui_click', 0, dur=.2, pick=3), L('arcane', -10, dur=.25, pick=2)], 'talent-add': [L('ui_confirm', 0, dur=.3, pick=5)],
    'talent-reset': [L('ui_close', 0, dur=.3, pick=3), L('whoosh', -8, dur=.3, rev=True)], 'paragon-add': [L('holy', 0, dur=.33, pick=2)],
    'boon-select': [L('ui_ping', 0, dur=.3, pick=2)], 'boon-confirm': [L('ui_confirm', 0, dur=.33, pick=6), L('holy', -8, dur=.3, pick=3)],
    'sail': [L('water', 0, dur=.33, pick=1), L('whoosh', -8, dur=.3)], 'rating': [L('ui_confirm', 0, dur=.9, pick=7), L('holy', -6, dur=.8, pick=4)],
    'reward-count': [L('coins', 0, dur=.5)], 'reward-end': [L('coins', 0, dur=.8, pick=1), L('holy', -6, dur=.8, pick=5)],
    'badge': [L('holy', 0, dur=.9, pick=6), L('ui_confirm', -6, dur=.5, pick=8)],
}

CUE = {
    'hit': [L('punch', 0, dur=.22), L('blade_hit', -5, dur=.18)], 'crit': [L('punch', 0, dur=.3, pick=1), L('blade_hit', -2, dur=.35, pick=1), L('metal_hit', -6, dur=.5)],
    'kill': [L('punch', 0, dur=.3, pick=2), L('blood', -4, dur=.35)], 'kill-light': [L('punch', 0, dur=.25, pick=3)],
    'danger': [L('riser', 0, dur=.6), L('metal_hit', -4, dur=.4, pick=1)], 'hurt': [L('punch', 0, dur=.25, pick=4), L('human_effort', -6, dur=.35)],
    'miss': [L('whoosh', 0, dur=.3)], 'cast': [L('arcane', 0, dur=.4)], 'shield-up': [L('holy', 0, dur=.6), L('metal_hit', -6, dur=.4, pick=2)],
    'shield-hit': [L('metal_hit', 0, dur=.35, pick=3)], 'shield-break': [L('glass', 0, dur=.8), L('metal_hit', -4, dur=.6, pick=4)],
    'block': [L('metal_hit', 0, dur=.5, pick=5), L('punch', -6, dur=.25, pick=5)], 'multi-kill': [L('boom', 0, dur=1.0), L('holy', -4, dur=.9, pick=1)],
    'bag-full': [L('ui_error', 0, dur=.5, pick=3), L('item', -6, dur=.4)], 'loot': [L('coins', 0, dur=.5, pick=2), L('ui_ping', -6, dur=.4, pick=3)],
    'loot-legendary': [L('stinger_good', 0, dur=2.2), L('boom', -6, dur=1.2, pick=1)], 'loot-glow': [L('holy', 0, dur=.6, pick=2)],
    'drop-common': [L('item', 0, dur=.4, pick=1)], 'drop-magic': [L('item', 0, dur=.4, pick=2), L('arcane', -4, dur=.5, pick=1)],
    'drop-rare': [L('glass', 0, dur=.6, pick=1), L('ice', -4, dur=.6)], 'drop-epic': [L('boom', 0, dur=.9, pick=2), L('holy', -3, dur=.9, pick=3)],
    'drop-legendary': [L('stinger_good', 0, dur=2.2, pick=1), L('boom', -6, dur=1.0, pick=3)],
    'pickup-equipment': [L('plate', 0, dur=.3)], 'pickup-material': [L('leather', 0, dur=.3)], 'pickup-gold': [L('coins', 0, dur=.35, pick=3)],
    'pickup-key': [L('item', 0, dur=.3, pick=3), L('metal_hit', -10, dur=.2, pick=6)],
    'chest-open': [L('door', 0, dur=.33), L('item', -6, dur=.25, pick=4)], 'chest-reward': [L('coins', 0, dur=.33, pick=4), L('holy', -6, dur=.33, pick=4)],
    'gold-spend': [L('coins', 0, dur=.33, pick=5)], 'gold-gain': [L('coins', 0, dur=.33, pick=6), L('ui_ping', -8, dur=.3, pick=4)],
}

FOLEY = {
    'step-stone': [L('step_stone', 0, dur=.25)], 'step-wood': [L('step_wood', 0, dur=.25)], 'step-grass': [L('step_grass', 0, dur=.3)],
    'step-dirt': [L('step_dirt', 0, dur=.3)], 'step-snow': [L('step_snow', 0, dur=.35)], 'step-metal': [L('plate', 0, dur=.25), L('step_stone', -4, dur=.2, pick=1)],
    'step-water': [L('step_water', 0, dur=.4)], 'dash': [L('whoosh', 0, dur=.4), L('cloth', -6, dur=.3)], 'land': [L('step_creature', 0, dur=.4), L('step_dirt', -4, dur=.3, pick=1)],
    'blink': [L('arcane', 0, dur=.45), L('whoosh', -6, dur=.3, rev=True, pick=1)], 'cloth': [L('cloth', 0, dur=.4, pick=1)], 'leather': [L('leather', 0, dur=.4, pick=1)],
    'plate': [L('plate', 0, dur=.4, pick=1)], 'hurt': [L('human_effort', 0, dur=.45, pick=1), L('punch', -6, dur=.2, pick=6)],
    'hurt-heavy': [L('human_effort', 0, dur=.6, pick=2), L('punch', -3, dur=.3, pick=7)], 'death': [L('human_effort', 0, dur=1.2, pick=3), L('wood_break', -6, at=.25, dur=.8)],
    'revive': [L('holy', 0, dur=1.2, rev=True), L('holy', -3, at=.4, dur=1.0, pick=1)], 'level-up': [L('stinger_good', 0, dur=1.5, pick=2)],
    'heartbeat': [L('punch', 0, dur=.18, lp=900, pick=8), L('punch', -4, at=.22, dur=.18, lp=900, pick=8)],
}
WEAPON = {  # 武器 → (起手, 挥出, 命中)
    'sword': ('sheath', 'swing', 'blade_hit'), 'staff': ('leather', 'whoosh', 'blunt_hit'), 'hammer-axe': ('plate', 'whoosh', 'metal_hit'),
    'bow': ('leather', 'bow', 'blunt_hit'), 'hidden': ('sheath', 'swing', 'blade_hit'),
}
HITMAT = {'flesh': ('punch', 'blood'), 'metal': ('metal_hit', 'punch'), 'stone': ('stone_hit', 'punch'), 'spirit': ('shadow', 'arcane')}

WORLD = {
    'npc-bubble': [L('ui_ping', 0, dur=.3, pick=5)], 'dialogue': [L('item', 0, dur=.3, pick=5)], 'quest-accept': [L('ui_confirm', 0, dur=.6, pick=9), L('item', -6, dur=.3, pick=6)],
    'quest-progress': [L('ui_ping', 0, dur=.5, pick=6)], 'quest-complete': [L('stinger_good', 0, dur=1.2, pick=3)], 'teleport-activate': [L('arcane', 0, dur=1.0, pick=3), L('riser', -6, dur=.8, pick=1)],
    'teleport': [L('whoosh', 0, dur=.6, rev=True, pick=3), L('arcane', -4, dur=.7, pick=4)], 'dungeon-enter': [L('door', 0, dur=1.0, pick=1), L('shadow', -6, dur=1.0)],
    'key-use': [L('door', 0, dur=.6, pick=2)], 'gate-open': [L('door', 0, dur=1.2, pick=3), L('chain', -6, dur=1.0)], 'clue': [L('holy', 0, dur=.8, pick=7)],
    'camp-enter': [L('fire', 0, dur=.9), L('leather', -6, dur=.4, pick=2)], 'return-town': [L('arcane', 0, dur=.9, pick=5), L('whoosh', -6, dur=.5, pick=4)],
    'chest-open': [L('door', 0, dur=.8, pick=4), L('item', -6, dur=.3, pick=7)], 'chest-reward': [L('coins', 0, dur=.8, pick=7), L('holy', -6, dur=.8, pick=8)],
    'gold-spend': [L('coins', 0, dur=.5, pick=8)], 'gold-gain': [L('coins', 0, dur=.6, pick=9)], 'beacon-activate': [L('fire', 0, dur=1.0, pick=1), L('holy', -6, dur=1.0, pick=9)],
    'discovery': [L('stinger_good', 0, dur=1.4, pick=4)], 'travel': [L('whoosh', 0, dur=.8, pick=5), L('water', -8, dur=.6, pick=2)],
}
DETAIL_MOTIF = {'bell': 'holy', 'rustle': 'nature', 'creak': 'door', 'rattle': 'chain', 'gust': 'air', 'debris': 'stone_hit'}
DETAIL_REGION = {'port': 'water', 'wind': 'air', 'mist': 'water', 'forge': 'metal_hit', 'frost': 'ice', 'rift': 'shadow', 'dragon': 'fire'}
STING_TAIL = {  # 琶音之外的点缀层
    'level-up': [L('stinger_good', -6, at=.1, dur=2.0)], 'quest-complete': [L('coins', -10, dur=.6, pick=10)],
    'discovery': [L('stinger_good', -5, dur=2.2, pick=1)], 'legendary-drop': [L('boom', -6, dur=1.4, pick=4), L('stinger_good', -8, dur=2.0, pick=2)],
    'reputation-up': [L('holy', -8, dur=1.6, pick=12)], 'victory': [L('boom', -6, dur=1.5, pick=5), L('stinger_good', -6, dur=2.2, pick=3)],
    'boss-defeated': [L('boom', 0, dur=1.6, pick=6), L('stinger_good', -6, at=.3, dur=2.3, pick=4)], 'clue': [L('holy', -8, dur=1.5, pick=13)],
    'death': [L('stinger_bad', -3, dur=2.6), L('boom', -6, dur=1.6, pick=7)], 'dungeon-fail': [L('stinger_bad', -3, dur=2.4, pick=1)],
    'boss-intro': [L('riser', 0, dur=1.6, pick=2), L('boom', 0, at=1.1, dur=1.6, pick=8)], 'rare-spawn': [L('riser', -4, dur=1.2, pick=3)],
}
STINGER = {k: [L('tonal', 0, at=1.1 if k == 'boss-intro' else 0, dur=1.6, notes=tuple(n), pick={'death': 1, 'dungeon-fail': 1, 'boss-intro': 1, 'rare-spawn': 1}.get(k, 0))] + STING_TAIL.get(k, [])
           for k, n in NOTES.items()}
STINGER['level-up'] = [L('tonal', 0, dur=1.6, notes=(523, 659, 784, 1047), pick=2)] + STING_TAIL['level-up']

AMB = {  # 环境/定点循环 → (主长素材, 副长素材)
    'boss-arena': ('strange', 'metaltone'), 'dragon': ('wind', 'campfire'), 'dungeon-dragon': ('cave', 'campfire'), 'dungeon-forge': ('steam', 'metaltone'),
    'dungeon-frost': ('cave', 'tonalwind'), 'dungeon-mist': ('cave', 'ethereal'), 'dungeon-rift': ('strange', 'ethereal'), 'dungeon-wind': ('tonalwind', 'cave'),
    'forge': ('steel', 'steam'), 'frost': ('stream', 'wind'), 'mist': ('ocean', 'ethereal'), 'port': ('harbor', 'ocean'), 'rift': ('ethereal', 'strange'),
    'travel': ('ocean', 'wind'), 'wind': ('wind', 'forest'),
    'bell': ('bell', None), 'campfire': ('campfire', None), 'chest': ('magic', 'ethereal'), 'rift-src': ('strange', None), 'rigging': ('harbor', None),
    'ship': ('harbor', 'ocean'), 'steam': ('steam', None), 'stream': ('stream', None), 'teleport': ('magic', 'electric'), 'waterfall': ('waterfall', None),
    'windmill': ('watermill', None), 'forge-src': ('steel', 'campfire'),
}


def design(s) -> list[L] | None:
    prefix, name = s.key.split('/', 1)
    if prefix == 'voice':
        return voice_layers(s)
    if prefix == 'ui':
        return UI.get(name)
    if prefix == 'cue':
        return CUE.get(name)
    if prefix == 'world':
        return WORLD.get(name)
    if prefix == 'stinger':
        return STINGER.get(name)
    if prefix == 'foley':
        if name in FOLEY:
            return FOLEY[name]
        if name.startswith('weapon-'):
            a, b, c = WEAPON[name[7:]]
            return {'cast': [L(a, 0, dur=.35)], 'release': [L(b, 0, dur=.45)], 'impact': [L(c, 0, dur=.45), L('punch', -8, dur=.2)]}[s.stage]
        if name.startswith('hit-'):
            a, b = HITMAT[name[4:]]
            return [L(a, 0, dur=.4), L(b, -6, dur=.25)]
        return None
    if prefix == 'ambient-detail':
        region, motif = name.split('-', 1)
        return [L(DETAIL_MOTIF[motif], 0, dur=.6), L(DETAIL_REGION[region], -9, dur=.45)]
    el, fam, weight = meta(s)
    return skill_layers(s, el, fam, weight)


# ---------------- 片段分配 ----------------

def _origins(cls: str) -> list[list[dict]]:
    groups: dict[str, list] = {}
    for e in P.members(cls):
        groups.setdefault(e['origin'], []).append(e)
    return [sorted(v, key=lambda e: e['segment']) for _, v in sorted(groups.items(), key=lambda kv: kv[1][0]['id'])]


class Allocator:
    def __init__(self):
        self.count: dict[str, int] = {}
        self.cache: dict[str, list] = {}

    def take(self, cls: str, pick: int) -> tuple[list, int] | None:
        if cls not in self.cache:
            self.cache[cls] = _origins(cls)
        og = self.cache[cls]
        if not og:
            return None
        n = self.count.get(cls, 0)
        self.count[cls] = n + 1
        k = (n * 7 + pick * 3) % len(og) if len(og) > 7 else (n + pick) % len(og)
        return og[k], n // len(og)


def resample(x: np.ndarray, ratio: float) -> np.ndarray:
    """ratio > 1 升调（变短）。"""
    if abs(ratio - 1) < 1e-6:
        return x
    n = max(8, int(len(x) / ratio))
    return np.interp(np.arange(n) * ratio, np.arange(len(x)), x)


def f0_of(x: np.ndarray) -> float:
    m = 1 << 15
    spec = np.abs(np.fft.rfft(x[:m] * np.hanning(min(m, len(x))), m))
    f = np.fft.rfftfreq(m, 1 / SR)
    band = (f > 150) & (f < 2500)
    return float(f[band][np.argmax(spec[band])])


def render_layer(entry: dict, lay: L, pitch: float) -> np.ndarray:
    x = P.load(entry['id'])
    if lay.notes:
        f0 = f0_of(x)
        hits = [(resample(x, f / f0 * pitch), i * .1, -1.5 * i) for i, f in enumerate(lay.notes)]
        end = max(int(at * SR) + len(h) for h, at, _ in hits)
        y = np.zeros(end)
        for h, at, g in hits:
            y[int(at * SR):int(at * SR) + len(h)] += h * db(g)
        x = y
        pitch = 1.0
    if lay.rev:
        x = x[::-1]
    x = resample(x, lay.pitch * pitch)
    if lay.dur and len(x) > lay.dur * SR:
        n = int(lay.dur * SR)
        x = x[:n] * np.concatenate([np.ones(n - n // 3), np.linspace(1, 0, n // 3) ** 2])
    if lay.hp:
        x = fft_filter(x, hp_resp(lay.hp, 2))
    if lay.lp:
        x = fft_filter(x, lp_resp(lay.lp, 2))
    x = fade(x, .002 if not lay.rev else .02, .01)
    return x / (np.max(np.abs(x)) + 1e-12)


# ---------------- 规格贴合（阈值见 build.check，不改阈值） ----------------

def _k_weight(f):
    shelf = 1 + (db(4) - 1) / (1 + (1700 / np.maximum(f, 1)) ** 2)
    return hp_resp(38, 2)(f) * shelf


def measure(x: np.ndarray) -> dict:
    mono = x.mean(axis=0) if x.ndim == 2 else x
    peak = float(np.max(np.abs(x))) + 1e-12
    m = 1 << 16
    spec = np.abs(np.fft.rfft(mono[:m], m)) ** 2
    f = np.fft.rfftfreq(m, 1 / SR)
    tot = spec.sum() + 1e-20
    act = np.abs(mono) > peak * .05
    full = math.sqrt(np.mean(mono[act] ** 2)) + 1e-12
    small = fft_filter(mono, hp_resp(200, 2))
    small_r = math.sqrt(np.mean(small[act] ** 2)) + 1e-12
    kw = fft_filter(mono, _k_weight)
    w = int(.05 * SR)
    win = np.sqrt(np.convolve(kw ** 2, np.ones(w) / w, 'valid')) if len(kw) > w else np.array([math.sqrt(np.mean(kw ** 2))])
    return dict(crest=20 * math.log10(float(win.max()) + 1e-12) - 20 * math.log10(peak),
                low200=float(spec[f < 200].sum() / tot), harsh=float(spec[(f > 2000) & (f < 5000)].sum() / tot),
                small_loss=20 * math.log10(full / small_r))


def limit(x: np.ndarray, reduce_db: float) -> np.ndarray:
    """前视峰值限幅：把峰值压低 reduce_db（0.5ms 块、释放随时长 3–60ms），再由构建归一。"""
    peak = np.max(np.abs(x)) + 1e-12
    thr = peak * db(-reduce_db)
    hop = int(.0005 * SR)
    n = len(x) // hop + 1
    pad = np.zeros(n * hop)
    pad[:len(x)] = np.abs(x)
    blk = pad.reshape(n, hop).max(axis=1)
    blk = np.maximum(blk, np.concatenate([blk[1:], [0]]))  # 前视一格
    gain = np.minimum(1, thr / (blk + 1e-12))
    rel = math.exp(-1 / (2 * min(60, max(3, len(x) / SR * 150))))
    g = np.empty(n)
    cur = 1.0
    for i in range(n):
        cur = gain[i] if gain[i] < cur else gain[i] + (cur - gain[i]) * rel
        g[i] = cur
    env = np.interp(np.arange(len(x)), np.arange(n) * hop + hop / 2, g)
    return x * env


HARSH_KEYS = {'cue/hit', 'cue/kill', 'cue/loot', 'foley/step-stone', 'foley/step-wood', 'ui/click'}
CORE = {'cue/hit', 'cue/crit', 'cue/kill', 'cue/danger', 'cue/loot', 'cue/shield-break'}
CREST = {'impact-heavy': -7.5, 'impact-light': -8.5, 'cast': -8.5, 'warning': -6, 'stinger': -9, 'ui': -9.5, 'foley': -9.5}
WEIGHT_CREST = {'filler': -10, 'core': -8, 'cooldown': -6}


def conform(s, x: np.ndarray, weight: str) -> np.ndarray:
    ui_cap = 1.0 if any(k in s.key for k in ('popup', 'notification', 'reward', 'rating', 'badge', 'salvage')) else .35
    cap = ui_cap - .02 if s.key.startswith('ui/') else 2.9
    if len(x) > cap * SR:
        n = int(cap * SR)
        x = x[:n] * np.concatenate([np.ones(n - n // 4), np.linspace(1, 0, n // 4) ** 2])
    # 尾部静音裁掉
    a = np.abs(x)
    idx = np.nonzero(a > a.max() * db(-60))[0]
    x = fade(x[:idx[-1] + int(.01 * SR)] if len(idx) else x, 0, .008)
    low_cap = s.tier not in ('ambience', 'stinger') and not s.key.startswith('boss/')
    loss_cap = 2.7 if s.key in CORE else 3.7
    need_loss = s.key in CORE or s.tier in ('impact-heavy', 'impact-light', 'cast', 'warning', 'stinger')
    for fc in (0, 90, 130, 180, 240, 320, 420, 560):
        y = fft_filter(x, hp_resp(fc, 2)) if fc else x
        m = measure(y)
        if (not low_cap or m['low200'] <= .27) and (not need_loss or m['small_loss'] <= loss_cap) and (s.key not in CORE or m['low200'] <= .45):
            break
    x = y
    harsh_rule = s.key in HARSH_KEYS or s.key.startswith(('foley/step-', 'cue/pickup-')) or s.stage == 'hurt'
    for _ in range(6):
        if not harsh_rule or m['harsh'] <= .42:
            break
        x = fft_filter(x, lambda f: 1 - .5 * np.exp(-((np.log2(np.maximum(f, 1) / 3200)) / .7) ** 2))
        m = measure(x)
    target = WEIGHT_CREST.get(weight, CREST[s.tier]) if s.key.startswith('player/') and s.stage == 'impact' else CREST.get(s.tier)
    if target is not None and m['crest'] < target - 1:
        lo, hi = 0.0, 12.0
        for _ in range(7):  # 二分：压到目标附近但不超过 12dB
            mid = (lo + hi) / 2
            c = measure(limit(x, mid))['crest']
            lo, hi = (mid, hi) if c < target - .5 else (lo, mid)
        x = limit(x, hi)
        m = measure(x)
        for fc in (90, 130, 180, 240, 320):
            if (not low_cap or m['low200'] <= .27) and (not need_loss or m['small_loss'] <= loss_cap):
                break
            x = fft_filter(x, hp_resp(fc, 2))
            m = measure(x)
    return x


# ---------------- 环境循环 ----------------

def _resample_sr(x: np.ndarray, sr: int) -> np.ndarray:
    if sr == SR:
        return x
    n = int(len(x) * sr / SR)
    spec = np.fft.rfft(x)[: n // 2 + 1]
    return np.fft.irfft(spec, n) * (n / len(x))


def _long(name: str, idx: int) -> np.ndarray | None:
    pool = P.longs(name) if name else ()
    if not pool:
        return None
    return P.load(pool[idx % len(pool)]['id'])


def ambience(s, seed: int, v: int) -> np.ndarray | None:
    name = s.key.split('/', 1)[1]
    if s.key.startswith('source/') and name in ('rift', 'forge'):
        name += '-src'
    a, b = AMB.get(name, (None, None))
    xa = _long(a, v + seed % 3)
    if xa is None:
        return None
    sr = s.sr
    need = int(26.5 * SR)

    def take(x, off):
        if len(x) < need:  # 不足时自身交叉平铺
            reps = need // len(x) + 2
            x = np.concatenate([x] * reps)
        off = int(off * SR) % max(1, len(x) - need)
        return x[off:off + need]

    chans = []
    for c in range(2):
        y = take(xa, c * 7.3 + v * 3.1)
        xb = _long(b, v) if b else None
        if xb is not None:
            yb = take(xb, c * 5.1 + 2)
            y = y / (np.sqrt(np.mean(y ** 2)) + 1e-12) + .5 * yb / (np.sqrt(np.mean(yb ** 2)) + 1e-12)
        y = fft_filter(fft_filter(y, hp_resp(70, 2)), color(s.key))
        chans.append(_resample_sr(y, sr))
    x = np.stack(chans)
    x = loop_crossfade(x, 2.5, sr)
    n = 48
    delta = x[..., 0] - x[..., -1]
    x[..., -n:] += delta[:, None] * np.linspace(0, 1, n)
    # 防峰：环境要求峰值 ≤ -10 而响度 -26，峰均比需 < 16dB
    peak = np.max(np.abs(x)); rms = np.sqrt(np.mean(x ** 2))
    if 20 * math.log10(peak / rms) > 13:
        g = np.minimum(1, rms * db(13) / (np.abs(x) + 1e-12))
        x = x * g
        delta = x[..., 0] - x[..., -1]
        x[..., -n:] += delta[:, None] * np.linspace(0, 1, n)
    return x


# ---------------- 组装 ----------------

SFX_SR = 32000  # 短音效 32kHz（16kHz 带宽足够），控制总体积；环境沿用 24kHz 立体声


def color(key: str):
    """每个 key 的固定音色指纹：一处 +5–7dB 宽峰（350–5000Hz）和相隔约 1.5 个八度的一处 -6dB 凹陷，按 key 散列；
    同元素同家族的技能因此不会变成孪生音，变体共用同一指纹。"""
    h = int(hashlib.sha1(key.encode()).hexdigest()[:12], 16)
    fc = 350 * 2 ** ((h % 1000) / 1000 * 3.8)
    cut = fc * 2 ** (1.5 if (h // 1000) % 2 else -1.5)
    gain = db(5 + (h // 2000) % 3)

    def resp(f):
        o = np.log2(np.maximum(f, 1) / fc) / .6
        c = np.log2(np.maximum(f, 1) / cut) / .5
        return (1 + (gain - 1) * np.exp(-o ** 2)) * (1 - .5 * np.exp(-c ** 2))
    return resp


def make_fn(s, plan: list[tuple[L, list]], weight: str, fallback):
    def fn(seed: int, v: int) -> np.ndarray:
        if s.tier == 'ambience':
            y = ambience(s, seed, v)
            return fallback(seed, v) if y is None else y
        pitch = PITCH[v % len(PITCH)]
        parts = []
        for i, (lay, (segs, rot)) in enumerate(plan):
            entry = segs[(rot + (v if i or len(plan) == 1 else 0)) % len(segs)]
            parts.append((render_layer(entry, lay, pitch), lay.at, lay.g))
        end = max(int(at * SR) + len(x) for x, at, _ in parts)
        out = np.zeros(end)
        for x, at, g in parts:
            i = int(at * SR)
            out[i:i + len(x)] += x * db(g)
        out = fft_filter(out, color(s.key))
        out = conform(s, out, weight)
        return _resample_sr(out, SFX_SR)
    return fn


def apply(sounds: list) -> list:
    if not P.available():
        return sounds
    alloc = Allocator()
    out = []
    names = {f.name for f in fields(ProductionSound)}
    for s in sounds:
        weight = getattr(s, 'weight', '') or PROFILE.get(s.key, {}).get('weight', '')
        if s.tier == 'ambience':
            name = s.key.split('/', 1)[1] + ('-src' if s.key.startswith('source/') and s.key.split('/')[1] in ('rift', 'forge') else '')
            a, b = AMB.get(name, (None, None))
            pool = [e for k in (a, b) if k for e in P.longs(k)]
            if not pool:
                out.append(s); continue
            srcs = sorted({e['source'] + '（' + e['licence'] + '）' for e in pool})
            note = f'录音环境循环：{a}' + (f' + {b}' if b else '') + '，左右声道错位取段，24秒首尾交叉'
            plan = []
        else:
            layers = design(s)
            if not layers:
                out.append(s); continue
            plan = []
            for lay in layers:
                got = alloc.take(lay.cls, lay.pick)
                if got:
                    plan.append((lay, got))
            if not plan:
                out.append(s); continue
            srcs = sorted({e['source'] + '（' + e['licence'] + '）' for _, (segs, _) in plan for e in segs[:max(1, s.variants)]})
            note = f'{s.key}：录音分层 ' + ' + '.join(lay.cls for lay, _ in plan)
        base = {f: getattr(s, f) for f in names if hasattr(s, f)}
        if s.tier != 'ambience':
            base['sr'] = SFX_SR
        base.update(fn=make_fn(s, plan, weight, s.fn), note=note, source='recorded', license='录音素材加工：' + '；'.join(srcs),
                    category=getattr(s, 'category', ''), weight=getattr(s, 'weight', ''))
        out.append(ProductionSound(**base))
    return out
