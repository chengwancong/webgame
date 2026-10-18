"""Procedural placeholder icons for the 暗器 (hidden weapon) skills.

Follows the approved 手绘符记 rules (transparent background, large silhouette, few flat
colours, soft dark outline) but is NOT hand-drawn art. provenance.json marks these records
as placeholders so they can be replaced by real hand-drawn icons without code changes.
Run: py -3 -X utf8 tools/draw-hidden-skill-icons.py
"""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'assets/ui-source/v2/skill-handdrawn'
S = 1024  # supersampled canvas, downsampled to 256
INK = (59, 51, 64, 255)
STEEL, STEEL_L = (192, 220, 227, 255), (255, 247, 210, 255)
HANDLE = (101, 73, 56, 255)
POISON, SHADOW, BLOOD, FIRE, FIRE_L = (157, 201, 104, 255), (154, 115, 188, 255), (210, 114, 103, 255), (241, 155, 66, 255), (255, 233, 162, 255)
LINE = 30


def rot(points, cx, cy, angle):
    c, s = math.cos(angle), math.sin(angle)
    return [(cx + x * c - y * s, cy + x * s + y * c) for x, y in points]


def knife(d, cx, cy, angle, length=620, width=120, blade=STEEL):
    """Blade along -y from (cx,cy); handle along +y."""
    half = width / 2
    tip = [(0, -length * .62), (half, -length * .12), (half * .7, 0), (-half * .7, 0), (-half, -length * .12)]
    guard = [(-half * 1.25, 0), (half * 1.25, 0), (half * 1.25, 34), (-half * 1.25, 34)]
    grip = [(-half * .42, 34), (half * .42, 34), (half * .42, length * .3), (-half * .42, length * .3)]
    d.polygon(rot(grip, cx, cy, angle), fill=HANDLE, outline=INK, width=LINE)
    d.polygon(rot(guard, cx, cy, angle), fill=STEEL_L, outline=INK, width=LINE)
    d.polygon(rot(tip, cx, cy, angle), fill=blade, outline=INK, width=LINE)
    shine = [(0, -length * .55), (half * .35, -length * .14), (0, -length * .05)]
    d.polygon(rot(shine, cx, cy, angle), fill=STEEL_L)
    px, py = rot([(0, length * .3 + 34)], cx, cy, angle)[0]
    d.ellipse((px - 46, py - 46, px + 46, py + 46), fill=STEEL_L, outline=INK, width=LINE)


def drop(d, cx, cy, r, color):
    d.polygon([(cx, cy - r * 1.7), (cx + r * .95, cy - r * .2), (cx - r * .95, cy - r * .2)], fill=color)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color, outline=INK, width=LINE)
    d.line([(cx - r * .95, cy - r * .2), (cx, cy - r * 1.7), (cx + r * .95, cy - r * .2)], fill=INK, width=LINE, joint='curve')


def burst(d, cx, cy, r, points=8):
    pts = []
    for i in range(points * 2):
        a = i * math.pi / points - math.pi / 2
        rr = r if i % 2 == 0 else r * .52
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    d.polygon(pts, fill=FIRE, outline=INK, width=LINE)
    inner = [(cx + (x - cx) * .55, cy + (y - cy) * .55) for x, y in pts]
    d.polygon(inner, fill=FIRE_L)


def icon(draw_fn):
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(img))
    return img.resize((256, 256), Image.LANCZOS)


def throwing_knife(d):
    knife(d, 560, 540, math.radians(40), 760, 150)
    for k in range(3):
        d.line([(170 + k * 40, 760 - k * 90), (330 + k * 40, 620 - k * 90)], fill=INK, width=LINE)


def fan_of_knives(d):
    for deg in (-42, -14, 14, 42):
        knife(d, 512, 700, math.radians(deg), 600, 110)


def venom_needle(d):
    d.polygon(rot([(0, -440), (26, 0), (26, 300), (-26, 300), (-26, 0)], 470, 560, math.radians(35)), fill=STEEL, outline=INK, width=LINE)
    drop(d, 690, 700, 120, POISON)
    drop(d, 310, 330, 64, POISON)


def shadow_step(d):
    d.pieslice((160, 160, 860, 860), 110, 300, fill=SHADOW, outline=INK, width=LINE)
    d.pieslice((260, 240, 860, 840), 110, 300, fill=(0, 0, 0, 0))
    d.arc((260, 240, 860, 840), 110, 300, fill=INK, width=LINE)
    knife(d, 620, 560, math.radians(30), 560, 110)


def blade_flurry(d):
    knife(d, 512, 560, math.radians(-38), 640, 120)
    knife(d, 512, 560, math.radians(38), 640, 120)
    for a in (200, 250, 300):
        r = math.radians(a)
        d.line([(512 + math.cos(r) * 330, 520 + math.sin(r) * 330), (512 + math.cos(r) * 430, 520 + math.sin(r) * 430)], fill=INK, width=LINE)


def explosive_kunai(d):
    burst(d, 690, 330, 230)
    knife(d, 430, 620, math.radians(45), 640, 130, STEEL)


def assassinate(d):
    d.ellipse((190, 190, 834, 834), outline=BLOOD, width=56)
    d.ellipse((190, 190, 834, 834), outline=INK, width=16)
    drop(d, 512, 700, 110, BLOOD)
    knife(d, 512, 470, math.radians(180), 600, 140)


def death_lotus(d):
    for k in range(6):
        knife(d, 512, 512, math.radians(k * 60), 520, 120, BLOOD if k % 2 else STEEL)
    d.ellipse((430, 430, 594, 594), fill=BLOOD, outline=INK, width=LINE)


ICONS = {'throwing_knife': throwing_knife, 'fan_of_knives': fan_of_knives, 'venom_needle': venom_needle, 'shadow_step': shadow_step,
         'blade_flurry': blade_flurry, 'explosive_kunai': explosive_kunai, 'assassinate': assassinate, 'death_lotus': death_lotus}


def main():
    import hashlib
    (FOLDER / 'originals').mkdir(parents=True, exist_ok=True)
    provenance_path = FOLDER / 'provenance.json'
    provenance = json.loads(provenance_path.read_text(encoding='utf-8'))
    records = [r for r in provenance['records'] if r['id'] not in ICONS]
    manifest_path = ROOT / 'assets/ui-source/v2/ui-source.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['assets'] = [a for a in manifest['assets'] if a['id'] not in {'skill-' + k for k in ICONS}]
    for skill_id, fn in ICONS.items():
        img = icon(fn)
        name = f'skill-{skill_id}.png'
        img.save(FOLDER / 'originals' / name)
        img.save(FOLDER / name)
        digest = hashlib.sha256((FOLDER / name).read_bytes()).hexdigest()
        records.append({'id': skill_id, 'file': 'skill-handdrawn/' + name, 'size': [256, 256], 'sha256': digest, 'originalSha256': digest,
                        'placeholder': True, 'generation': 'procedural placeholder (tools/draw-hidden-skill-icons.py); replace with hand-drawn sign'})
        manifest['assets'].append({'id': 'skill-' + skill_id, 'kind': 'skill', 'file': 'skill-handdrawn/' + name, 'size': [256, 256]})
    provenance['records'] = records
    provenance_path.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'icons': len(ICONS), 'placeholder': True}))


if __name__ == '__main__':
    main()
