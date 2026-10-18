#!/usr/bin/env python3
"""Stage UI icons and panel pieces from the legacy art directories into the
open-world web client, with provenance.

- Only reads the old project's PNGs; never writes back.
- Trims fully transparent borders so small icons are not padded into blur when
  displayed at their native size.
- Writes apps/web/public/art/ui/* and packages/asset-manifest/ui.json.
- Missing icons are NOT invented: they are recorded in the manifest under
  "missing" with the semantic slot they must eventually fill.
"""
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT.parent.parent / 'game'
SKILLS = OLD / 'assets/imported/pockie_media/skills'
ITEMS = OLD / 'assets/imported/pockie_items'
SYS = OLD / 'assets/icons/ui'
WINDOWS = OLD / 'assets/imported/pockie_media/windows'
UIBITS = OLD / 'assets/imported/pockie_media/ui'
OUT = ROOT / 'apps/web/public/art/ui'
MANIFEST = ROOT / 'packages/asset-manifest/ui.json'

# Skill id -> source file. Chosen by what the skill DOES, not the filename:
# whirl is a self-centred area (whirlwind), ward absorbs damage (shield icon),
# rush is a dash (shadow step), mend heals (healing cross), cleave is a slow
# heavy ground slam (seismic), chain spreads to several targets (blade fan).
SKILL_MAP = {
    'cut': 'power_strike', 'whirl': 'whirlwind', 'bolt': 'ranger_volley',
    'frost': 'mage_prismatic_bolt', 'ward': 'abyss_guard', 'ember': 'battle_focus',
    'chain': 'assassin_blade_fan', 'nova': 'mage_rune_orbit', 'mend': 'cleric_smite',
    'rush': 'assassin_shadow_step', 'cleave': 'seismic_slam',
    # 'lance' has no painted spear/bolt in the set: recorded as missing below.
}
# Gear base -> source file. Six bases from packages/rules; bow has no bow icon
# in the set, so it is recorded as missing rather than shown as a sword.
GEAR_MAP = {
    'blade': 'sword_iron', 'coat': 'chest_leather', 'charm': 'amulet_void',
    'core': 'amulet_ember', 'shield': 'warrior_guard_amulet',
}
# System entries and small glyphs, all from one flat outline family.
SYSTEM_MAP = {
    'bag': 'icon_bag', 'build': 'icon_skill', 'goal': 'icon_character',
    'settings': 'icon_settings', 'close': 'icon_close', 'gold': 'icon_gold',
    'xp': 'icon_xp', 'death': 'icon_skull', 'target': 'icon_battle_focus',
}
PANEL_PIECES = {
    'panel-frame': (WINDOWS, 'frame'),           # nine-slice window with metal edge
    'item-slot': (WINDOWS, 'slot'),
    'portrait-frame': (WINDOWS, 'people'),
    'close-default': (WINDOWS, 'close'), 'close-hover': (WINDOWS, 'close_hover'),
    'close-pressed': (WINDOWS, 'close_pressed'),
    'btn-primary': (UIBITS, 'primary_default'), 'btn-primary-hover': (UIBITS, 'primary_hover'),
    'btn-primary-pressed': (UIBITS, 'primary_pressed'),
    'btn-secondary': (UIBITS, 'secondary_default'), 'btn-secondary-hover': (UIBITS, 'secondary_hover'),
    'btn-secondary-pressed': (UIBITS, 'secondary_pressed'),
}

def trim(im: Image.Image) -> Image.Image:
    box = im.getbbox()
    return im.crop(box) if box else im

def emit(source: Path, dest: Path, *, trim_edges: bool, source_label: str | None = None) -> dict:
    im = Image.open(source).convert('RGBA')
    original = im.size
    if trim_edges:
        im = trim(im)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest)
    data = dest.read_bytes()
    origin = source_label or str(source.relative_to(OLD))
    return {
        'file': str(dest.relative_to(ROOT / 'apps/web/public')),
        'source': origin,
        'sha256': hashlib.sha256(data).hexdigest(),
        'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest()[:16],
        'original_size': list(original), 'staged_size': list(im.size),
        'trimmed': trim_edges and list(original) != list(im.size),
    }

def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    records: dict = {'skills': {}, 'gear': {}, 'system': {}, 'panel': {}, 'portrait': {},
                     'missing': [], 'display': {'skill': 44, 'gear': 40, 'system': 20, 'slot': 52}}
    for skill_id, name in SKILL_MAP.items():
        records['skills'][skill_id] = emit(SKILLS / f'{name}.png', OUT / f'skill-{skill_id}.png', trim_edges=True)
    for base, name in GEAR_MAP.items():
        records['gear'][base] = emit(ITEMS / f'{name}.png', OUT / f'gear-{base}.png', trim_edges=True)
    for semantic, name in SYSTEM_MAP.items():
        records['system'][semantic] = emit(SYS / f'{name}.png', OUT / f'sys-{semantic}.png', trim_edges=True)
    for semantic, (folder, name) in PANEL_PIECES.items():
        records['panel'][semantic] = emit(folder / f'{name}.png', OUT / f'{semantic}.png', trim_edges=False)
    # Stable hero preview: first idle frame of the existing atlas, never a
    # random attack frame.
    atlas = json.loads((ROOT / 'apps/web/public/art/hero.json').read_text())
    rect = atlas['frames']['idle_0']['frame']
    hero = Image.open(ROOT / 'apps/web/public/art/hero.png').convert('RGBA')
    portrait = trim(hero.crop((rect['x'], rect['y'], rect['x'] + rect['w'], rect['y'] + rect['h'])))
    portrait.thumbnail((72, 72))
    dest = OUT / 'hero-portrait.png'
    dest.parent.mkdir(parents=True, exist_ok=True)
    portrait.save(dest)
    records['portrait'] = emit(dest, dest, trim_edges=False,
                               source_label='apps/web/public/art/hero.png#idle_0')
    # Missing icons stay visible as tasks instead of being faked.
    records['missing'] = [
        {'slot': 'skill:lance', 'reason': '图集内无长矛/重型投射图标，不得用剑形图标冒充星矛',
         'accept': '重导出或补制一枚与 painted 家族同笔触的星矛图标'},
        {'slot': 'gear:bow', 'reason': 'pockie_items 无弓类图标，不得用剑冒充穿云弓',
         'accept': '重导出或补制一枚与装备家族同笔触的弓图标'},
    ]
    MANIFEST.write_text(json.dumps(records, ensure_ascii=False, indent=1))
    total = len(records['skills']) + len(records['gear']) + len(records['system']) + len(records['panel']) + 1
    print(f'staged {total} assets, missing {len(records["missing"])}: {MANIFEST}')

if __name__ == '__main__':
    main()
