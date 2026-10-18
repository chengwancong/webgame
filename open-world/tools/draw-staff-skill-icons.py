"""Procedural icons for the 杖术 (staff martial) skills, 2026-10-07.

Follows the approved 手绘符记 rules (transparent background, large silhouette, few flat
colours, soft dark outline) in the same way as tools/draw-hidden-skill-icons.py. These are
NOT image-generated art: provenance.json marks them as placeholders so hand-drawn signs can
replace them later without code changes.
Run: py -3 -X utf8 tools/draw-staff-skill-icons.py [--preview out.png]
"""
import json
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'assets/ui-source/v2/skill-handdrawn'
S = 1024
INK = (59, 51, 64, 255)
WOOD, WOOD_L = (176, 118, 70, 255), (226, 176, 112, 255)
GOLD, GOLD_L = (240, 190, 80, 255), (255, 236, 170, 255)
CREAM = (255, 247, 210, 255)
SWOOSH = (250, 214, 130, 255)
ROCK, ROCK_L = (150, 150, 162, 255), (204, 204, 210, 255)
STEEL = (120, 170, 214, 255)
LINE = 30


def shape(d, pts, fill):
    """Filled polygon with a smooth ink outline (PIL polygon outlines are jagged at joints)."""
    pts = list(pts)
    d.polygon(pts, fill=fill)
    d.line(pts + pts[:2], fill=INK, width=LINE, joint='curve')
    for x, y in pts:
        d.ellipse((x - LINE / 2, y - LINE / 2, x + LINE / 2, y + LINE / 2), fill=INK)


def rot(points, cx, cy, angle):
    c, s = math.cos(angle), math.sin(angle)
    return [(cx + x * c - y * s, cy + x * s + y * c) for x, y in points]


def rod(d, a, b, width, fill):
    """Rounded bar from a to b with an ink outline."""
    for w, colour in ((width + 2 * LINE, INK), (width, fill)):
        d.line([a, b], fill=colour, width=int(w))
        for x, y in (a, b):
            d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=colour)


def staff(d, cx, cy, angle, length=820, width=118):
    """Quarterstaff centred on (cx,cy), long axis along `angle` (radians)."""
    dx, dy = math.cos(angle) * length / 2, math.sin(angle) * length / 2
    a, b = (cx - dx, cy - dy), (cx + dx, cy + dy)
    rod(d, a, b, width, WOOD)
    nx, ny = math.sin(angle) * width * .22, -math.cos(angle) * width * .22
    d.line([(a[0] + nx + dx * .1, a[1] + ny + dy * .1), (b[0] + nx - dx * .1, b[1] + ny - dy * .1)], fill=WOOD_L, width=int(width * .2))
    for t, w in ((.62, 54), (-.62, 54), (0, 70)):
        px, py = cx + dx * t, cy + dy * t
        band = [(-w / 2, -width * .64), (w / 2, -width * .64), (w / 2, width * .64), (-w / 2, width * .64)]
        shape(d, rot(band, px, py, angle), GOLD)
    for x, y in (a, b):
        r = width * .78
        d.ellipse((x - r, y - r, x + r, y + r), fill=GOLD, outline=INK, width=LINE)
        d.ellipse((x - r * .55, y - r * .6, x - r * .05, y - r * .1), fill=GOLD_L)
    return a, b


def burst(d, cx, cy, r, points=8, fill=GOLD, inner=CREAM):
    pts = []
    for i in range(points * 2):
        a = i * math.pi / points - math.pi / 2
        rr = r if i % 2 == 0 else r * .52
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    shape(d, pts, fill)
    d.polygon([(cx + (x - cx) * .5, cy + (y - cy) * .5) for x, y in pts], fill=inner)


def star(d, cx, cy, r):
    burst(d, cx, cy, r, 5, GOLD, GOLD_L)


def crescent(d, cx, cy, radius, thickness, start, end, fill=SWOOSH):
    """Tapered swoosh band from angle start to end (degrees): thin tail, thick head."""
    n = 48
    outer, inner = [], []
    for i in range(n + 1):
        t = i / n
        a = math.radians(start + (end - start) * t)
        w = thickness * math.sin(math.pi * min(1, t * 1.25) / 2) if t < .8 else thickness * (1 - (t - .8) / .2 * .55)
        outer.append((cx + math.cos(a) * radius, cy + math.sin(a) * radius))
        inner.append((cx + math.cos(a) * (radius - w), cy + math.sin(a) * (radius - w)))
    shape(d, outer + inner[::-1], fill)


def puff(d, cx, cy, r):
    for ox, oy, k in ((-r * .85, r * .2, .72), (r * .85, r * .2, .72), (0, 0, 1)):
        d.ellipse((cx + ox - r * k, cy + oy - r * k, cx + ox + r * k, cy + oy + r * k), fill=CREAM, outline=INK, width=LINE)
    d.rectangle((cx - r * 1.5, cy + r * .2, cx + r * 1.5, cy + r * .93), fill=CREAM)
    d.line([(cx - r * 1.45, cy + r * .93), (cx + r * 1.45, cy + r * .93)], fill=INK, width=LINE)


def staff_strike(d):
    for k in range(3):
        d.line([(120 + k * 70, 760 + k * 40), (260 + k * 70, 640 + k * 40)], fill=INK, width=LINE + 6)
    staff(d, 440, 590, math.radians(-42), 760)
    burst(d, 740, 300, 240)


def staff_sweep(d):
    crescent(d, 512, 470, 420, 190, 20, 175)
    staff(d, 512, 420, math.radians(-14), 800)
    for x, y, r in ((300, 170, 85), (520, 110, 105), (740, 170, 85)):
        star(d, x, y, r)


def pole_vault(d):
    for k in range(6):
        t = k / 5
        x, y = 170 + 640 * t, 700 - 560 * math.sin(math.pi * t * .9)
        r = 26 + 10 * k
        d.ellipse((x - r, y - r, x + r, y + r), fill=CREAM, outline=INK, width=LINE)
    staff(d, 540, 520, math.radians(-68), 720)
    puff(d, 420, 830, 120)


def staff_flurry(d):
    staff(d, 400, 620, math.radians(-38), 720)
    for x, y, r in ((560, 330, 110), (770, 230, 140), (820, 530, 170)):
        burst(d, x, y, r, 7)


def seismic_staff(d):
    shape(d, [(90, 880), (210, 720), (400, 740), (512, 660), (640, 740), (820, 710), (934, 880), (790, 960), (240, 960)], ROCK)
    d.polygon([(250, 790), (420, 790), (380, 870), (270, 870)], fill=ROCK_L)
    d.polygon([(630, 790), (790, 780), (820, 860), (660, 870)], fill=ROCK_L)
    for path in ([(512, 740), (430, 840), (470, 950)], [(512, 740), (610, 830), (580, 950)]):
        d.line(path, fill=INK, width=LINE, joint='curve')
    for sign in (-1, 1):
        cx = 512 + sign * 250
        half = [(0, -190), (sign * 170, -150), (sign * 150, 60), (0, 210), (sign * 40, 40), (-sign * 20, -60)]
        shape(d, [(cx + x, 360 + y) for x, y in half], STEEL)
        d.polygon([(cx + sign * 40, 230), (cx + sign * 130, 250), (cx + sign * 120, 330), (cx + sign * 50, 300)], fill=(190, 222, 245, 255))
    staff(d, 512, 430, math.radians(-90), 640)


def staff_cyclone(d):
    crescent(d, 512, 512, 440, 170, 160, 320)
    crescent(d, 512, 512, 440, 170, 340, 500)
    staff(d, 512, 512, math.radians(28), 660)


ICONS = {'staff_strike': staff_strike, 'staff_sweep': staff_sweep, 'pole_vault': pole_vault,
         'staff_flurry': staff_flurry, 'seismic_staff': seismic_staff, 'staff_cyclone': staff_cyclone}


def icon(draw_fn):
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(img))
    return img.resize((256, 256), Image.LANCZOS)


def preview(out):
    sheet = Image.new('RGBA', (256 * 6, 256 + 96), (60, 60, 70, 255))
    for k, fn in enumerate(ICONS.values()):
        img = icon(fn)
        sheet.alpha_composite(img, (256 * k, 0))
        sheet.alpha_composite(img.resize((48, 48), Image.LANCZOS), (256 * k + 40, 280))
        sheet.alpha_composite(img.resize((32, 32), Image.LANCZOS), (256 * k + 120, 288))
    sheet.save(out)


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
                        'placeholder': True, 'generation': 'procedural placeholder (tools/draw-staff-skill-icons.py); replace with hand-drawn sign'})
        manifest['assets'].append({'id': 'skill-' + skill_id, 'kind': 'skill', 'file': 'skill-handdrawn/' + name, 'size': [256, 256]})
    provenance['records'] = records
    provenance_path.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'icons': len(ICONS), 'placeholder': True}))


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--preview':
        preview(sys.argv[2])
    else:
        main()
