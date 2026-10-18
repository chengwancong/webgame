# 2026-10-07 用户要求主角表情更刚毅：把 HEAD/headA2 的上挑弧眉+微笑改为压低斜眉+平嘴。
# 只改头部区域内不透明像素；其余图集像素逐字节保留。原图见 git 历史 / release.json provenanceSource。
# 用法（在 open-world 下）：python assets/mini-hero/navy/headA2-resolute-v1.py
# --- 图集抽取（含 rotate/PMA 还原）---
from PIL import Image
R='assets/mini-hero/navy/runtime/'
def regions():
    lines=open(R+'Character.atlas',encoding='utf8').read().splitlines();page=None;out={};cur=None
    for l in lines:
        if l.endswith('.png'):page=l;cur=None;continue
        if not l.strip():continue
        if ':' in l and cur:
            k,v=l.split(':',1);out[cur][k.strip()]=v.strip()
        elif ':' not in l:
            cur=l.strip();out[cur]={'page':page}
    return out
def extract(reg):
    im=Image.open(R+reg['page']).convert('RGBA');x,y,w,h=map(int,reg['bounds'].split(','));rot=int(reg.get('rotate','0') or 0)
    if rot in(90,270):c=im.crop((x,y,x+h,y+w))
    else:c=im.crop((x,y,x+w,y+h))
    if rot==90:c=c.rotate(-90,expand=True)   # spine4 atlas: region stored rotated 90 CCW; undo
    elif rot==270:c=c.rotate(90,expand=True)
    elif rot==180:c=c.rotate(180)
    # un-premultiply
    px=c.load()
    for j in range(c.height):
        for i in range(c.width):
            r,g,b,a=px[i,j]
            if a:px[i,j]=(min(255,r*255//a),min(255,g*255//a),min(255,b*255//a),a)
    return c

# --- 表情改动 ---
# MiniFantasy navy 主角头 HEAD/headA2：上挑弧眉+微笑 → 压低斜眉+平嘴（可选压眼睑）。只改脸内不透明像素。
from PIL import ImageDraw
SS=8
def skin_at(im,x,y,ya,yb):
    a=im.getpixel((x,ya));b=im.getpixel((x,yb));t=(y-ya)/(yb-ya)
    return tuple(round(a[i]*(1-t)+b[i]*t) for i in range(3))
def erase(im,box,ya,yb):
    x0,y0,x1,y1=box
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):
            p=im.getpixel((x,y))
            if p[3]==255:im.putpixel((x,y),skin_at(im,x,y,ya,yb)+(255,))
def stroke(im,lines,color,width):
    m=Image.new('L',(im.width*SS,im.height*SS),0);d=ImageDraw.Draw(m)
    for pts in lines:
        P=[(x*SS+SS/2,y*SS+SS/2) for x,y in pts];d.line(P,fill=255,width=round(width*SS),joint='curve')
        r=width*SS/2
        for x,y in (P[0],P[-1]):d.ellipse((x-r,y-r,x+r,y+r),fill=255)
    m=m.resize(im.size,Image.LANCZOS)
    for y in range(im.height):
        for x in range(im.width):
            t=m.getpixel((x,y))/255;p=im.getpixel((x,y))
            if t>0.02 and p[3]==255:im.putpixel((x,y),tuple(round(p[i]*(1-t)+color[i]*t) for i in range(3))+(255,))
def lid(im,eye,outer_row,inner_row,outer_x,inner_x,ya):
    # 眼睛上缘按斜线切掉，线以上换成皮肤，线下保留眼珠
    x0,x1=min(outer_x,inner_x),max(outer_x,inner_x)
    for x in range(x0-1,x1+2):
        t=(x-outer_x)/(inner_x-outer_x);cut=outer_row+(inner_row-outer_row)*min(1,max(0,t))
        for y in range(eye[1],eye[3]+1):
            p=im.getpixel((x,y))
            if p[3]==255 and y<cut:im.putpixel((x,y),im.getpixel((x,ya))[:3]+(255,))
BROW=(0x3d,0x22,0x18);MOUTH=(0x4a,0x24,0x1a)
def build(src,level):
    im=src.copy()
    erase(im,(4,35,48,42),34,43)              # 原弧眉
    erase(im,(19,67,35,72),66,73)             # 原微笑
    if level>=2:
        lid(im,(10,44,18,49),45,48,10,18,43);lid(im,(35,44,43,49),48,45,35,43,43)
    stroke(im,[[(7,40),(13,41),(19,43.5)]],BROW,2.6)   # 左眉：外高内低（内侧靠鼻梁）
    stroke(im,[[(34,43.5),(40,41),(46,40)]],BROW,2.6)  # 右眉
    stroke(im,[[(23,70),(31,70)]],MOUTH,1.6)            # 平嘴
    return im

# --- 写回图集 ---
R='assets/mini-hero/navy/runtime/';reg=regions()['HEAD/headA2/head']
x,y,w,h=map(int,reg['bounds'].split(','));assert reg.get('rotate')=='90' and reg['page']=='Character.png'
orig=extract(reg);edit=build(orig,1)
page=Image.open(R+'Character.png');assert page.mode=='RGBA';px=page.load()
up2pack=lambda u,v:(x+v,y+(w-1-u))   # 抽取时 rotate(-90) 的逆映射：packed(i,j) -> upright(w-1-j,i)
n=0
for v in range(orig.height):
    for u in range(orig.width):
        a,b=orig.getpixel((u,v)),edit.getpixel((u,v))
        if a!=b:
            assert a[3]==255;px[up2pack(u,v)]=b;n+=1
page.save(R+'Character.png',optimize=True)
chk=extract(reg);assert list(chk.getdata())==list(edit.getdata()),'round-trip mismatch'
print('changed pixels',n)
