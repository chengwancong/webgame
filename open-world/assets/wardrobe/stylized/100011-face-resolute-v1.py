# 在游戏实际使用的柔化脸 stylized/100011-face.png 上改五官：压眉、下压上眼睑、收高光、平嘴。
from PIL import Image
SRC='assets/wardrobe/stylized/100011-face.png'
def mix(p,c,t):return tuple(round(p[i]*(1-t)+c[i]*t) for i in range(3))+(p[3],)
def paint(im,pts,c,t=1.0):
    for x,y in pts:
        p=im.getpixel((x,y))
        if p[3]:im.putpixel((x,y),mix(p,c,t))
LASH=(0x2e,0x08,0x09);BROW=(0x4a,0x26,0x26);IRIS=(0x7d,0x1d,0x15);MOUTH=(0xb8,0x7c,0x68)
def build(level):
    im=Image.open(SRC).convert('RGBA')
    # 眉：外高内低，压在眼上方
    paint(im,[(29,56),(30,56),(31,56)],BROW,.75);paint(im,[(32,57),(33,57),(34,57),(35,57)],BROW,.9);paint(im,[(32,56),(35,58)],BROW,.4)
    paint(im,[(48,56),(49,56),(50,56)],BROW,.75);paint(im,[(44,57),(45,57),(46,57),(47,57)],BROW,.9);paint(im,[(47,56),(44,58)],BROW,.4)
    # 嘴：去掉微笑弧，改成短平线
    paint(im,[(37,70),(38,70),(39,70),(40,70)],MOUTH,.8);paint(im,[(36,70),(41,70)],MOUTH,.35);paint(im,[(37,71),(38,71),(39,71),(40,71)],(0xfb,0xe4,0xc3),.7)
    if level>=2:
        # 上眼睑下压，内眼角更低，形成目光下压
        paint(im,[(x,60) for x in range(30,35)],LASH,.85);paint(im,[(34,61),(35,60)],LASH,.7)
        paint(im,[(x,60) for x in range(45,51)],LASH,.85);paint(im,[(45,61),(44,60)],LASH,.7)
    if level>=3:
        # 收掉大块白高光
        paint(im,[(30,61),(30,62),(30,63)],IRIS,.7);paint(im,[(51,62),(51,63),(51,64)],IRIS,.6);paint(im,[(46,61)],IRIS,.6)
    return im
if __name__=='__main__':
    out='.design/hero-face-20261007/'
    base=Image.open(SRC).convert('RGBA');vs=[base]+[build(l) for l in (1,2,3)]
    for l,v in zip((1,2,3),vs[1:]):v.save(out+f'resolute-v{l}.png')
    Z=5;s=Image.new('RGBA',(len(vs)*(96*Z+20),96*Z+120),(250,246,236,255))
    for i,v in enumerate(vs):
        s.alpha_composite(v.resize((96*Z,96*Z),Image.NEAREST),(i*(96*Z+20),0))
        s.alpha_composite(v,(i*(96*Z+20)+60,96*Z+10))
        s.alpha_composite(v.resize((48,48),Image.LANCZOS),(i*(96*Z+20)+200,96*Z+40))
    s.save(out+'resolute-sheet.png')
