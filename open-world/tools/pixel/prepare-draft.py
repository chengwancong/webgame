"""Reference preparation only. Its output is never eligible for the runtime manifest."""
import argparse
import json
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TOOL = Path('G:/webgame/aw-third-party/pixel-tools/proper-pixel-art/repo')
sys.path.insert(0, str(TOOL))
from proper_pixel_art import PixelateConfig, pixelate

parser = argparse.ArgumentParser()
parser.add_argument('input')
parser.add_argument('output')
parser.add_argument('--pixel-width', type=float, default=4)
args = parser.parse_args()
result = pixelate(Image.open(args.input), config=PixelateConfig.from_dict({
    'transparent_background': True, 'pixel_width': args.pixel_width,
    'initial_upscale_factor': 1,
}))
source = result.image.convert('RGBA')
master = json.loads((ROOT / 'packages/asset-manifest/pixel-palette.json').read_text(encoding='utf8'))
colors = [tuple(bytes.fromhex(c[1:])) for ramp in master['ramps'].values() for c in ramp]
palette = Image.new('P', (1, 1))
palette.putpalette([v for c in colors + [colors[0]] * (256-len(colors)) for v in c])
rgb = source.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGBA')
rgb.putalpha(source.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
target = Path(args.output)
target.parent.mkdir(parents=True, exist_ok=True)
rgb.save(target)
print(json.dumps({'referenceOnly': True, 'nativeSize': rgb.size, 'colors': len(colors)}))
