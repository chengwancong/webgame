"""像素画风 HUD 边框：用 pixel-art-studio（MIT, github.com/Gamezxz/pixel-art-studio）逐像素画 12×12 九宫格，
再转成 SVG 矩形写进 apps/web/src/ui/pixel-frames.ts（文本，可提交；不产出二进制图片）。
运行：PIXELSTUDIO=<pixel-art-studio/scripts 目录> python tools/pixel/hud-frames.py [预览输出目录]"""
import os, sys, json
from pathlib import Path
sys.path.insert(0, os.environ['PIXELSTUDIO'])
from pixelstudio import Sprite

N = 12  # 九宫格切 4：角 4×4，边 4 宽
palette = json.loads((Path(__file__).resolve().parents[2]/'packages/asset-manifest/pixel-palette.json').read_text(encoding='utf8'))['ramps']
ui, earth, ink, copper, fire = (palette[k] for k in ('ui','earth','ink','copper','fire'))
FRAMES = {  # 64色主色板内的奶白浅金；不用粉色白底与深棕铜边。
 'panel':     (earth[3], ui[0], ui[0], earth[4]),
 'inset':     (earth[3], earth[4], ink[5], ui[0]),
 'primary':   (ui[3], ui[2], ui[1], copper[3]),
 'secondary': (earth[3], ui[0], ink[5], earth[4]),
 'danger':    (fire[0], fire[3], fire[2], fire[1]),
}
def draw(outline, light, fill, dark):
 s = Sprite(N, N)
 s.rect(1, 1, N - 2, N - 2, fill)
 s.line(2, 1, N - 3, 1, light); s.line(1, 2, 1, N - 3, light)          # 顶左亮边
 s.line(2, N - 2, N - 3, N - 2, dark); s.line(N - 2, 2, N - 2, N - 3, dark)  # 底右暗边
 s.line(2, 0, N - 3, 0, outline); s.line(2, N - 1, N - 3, N - 1, outline)
 s.line(0, 2, 0, N - 3, outline); s.line(N - 1, 2, N - 1, N - 3, outline)
 for x, y in ((1, 1), (N - 2, 1), (1, N - 2), (N - 2, N - 2)): s.px(x, y, outline)  # 切角
 return s
def svg(s):
 rects = []
 for y in range(N):
  for x in range(N):
   c = s.get(x, y, composite=True)
   if c and c[3] > 0: rects.append(f"<rect x='{x}' y='{y}' width='1' height='1' fill='#{c[0]:02x}{c[1]:02x}{c[2]:02x}'/>")
 return f"<svg xmlns='http://www.w3.org/2000/svg' width='{N}' height='{N}' viewBox='0 0 {N} {N}' shape-rendering='crispEdges'>" + ''.join(rects) + '</svg>'
preview = Path(sys.argv[1]) if len(sys.argv) > 1 else None
out = {}
for name, colors in FRAMES.items():
 s = draw(*colors); out[name] = svg(s)
 if preview: s.preview(str(preview / f'{name}.png'), scale=16, grid=True); s.stats()
root = Path(__file__).resolve().parents[2]
lines = ['// 生成文件：tools/pixel/hud-frames.py（pixel-art-studio 逐像素绘制）。像素画风下 HUD 九宫格边框，切片 4。',
         'export const pixelFrameSlice=4,pixelFrameSize=12;',
         'export const pixelFrames={']
lines += [f" {k}:`{v}`," for k, v in out.items()]
lines += ['} as const;', "export type PixelFrame=keyof typeof pixelFrames;",
          "export const pixelFrameUrl=(name:PixelFrame)=>`url(\"data:image/svg+xml,${encodeURIComponent(pixelFrames[name])}\")`;", '']
(root / 'apps/web/src/ui/pixel-frames.ts').write_text('\n'.join(lines), encoding='utf-8', newline='\n')
print('wrote', len(out), 'frames')
