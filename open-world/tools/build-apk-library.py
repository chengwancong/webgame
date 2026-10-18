"""Build a local, searchable extraction catalog. Does not alter the game client."""
import argparse
import html
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def build(root):
    read = lambda name: json.loads((root / name).read_text(encoding='utf-8'))
    items = []
    reports = {}
    for group, kind in [('combat-vfx', 'combat'), ('ui-vfx', 'ui')]:
        source = read(group + '/source.json')
        mats, textures = read(group + '/materials.json'), read(group + '/textures.json')
        reports[group] = {'effects': len(source['effects']), 'textures': len(textures), 'materials': len(mats)}
        for effect in source['effects']:
            prefab = read(group + '/' + effect['file'])
            pics = []
            for layer in prefab['layers']:
                for mid in layer['materials']:
                    tid = mats[mid]['textures'].get('_MainTex')
                    if tid and tid not in [p['id'] for p in pics]:
                        texture = textures[tid]
                        pics.append({'id': tid, 'name': texture['name'], 'file': group + '/' + texture['file'], 'w': texture['width'], 'h': texture['height']})
            items.append({'group': kind, 'name': effect['name'], 'label': '原始特效组件', 'file': group + '/' + effect['file'], 'description': f"{effect['layers']} 个粒子层 · {sum(bool(x.get('mesh')) for x in prefab['layers'])} 个网格层", 'pics': pics, 'source': effect['sourceBundle']})
        for tid, texture in textures.items():
            items.append({'group': 'textures', 'name': texture['name'], 'label': '战斗贴图' if kind == 'combat' else '界面贴图', 'file': group + '/' + texture['file'], 'description': f"{texture['width']} × {texture['height']} · 解码后的原始像素", 'pics': [{'file': group + '/' + texture['file'], 'name': texture['name']}], 'source': texture['sourceCab']})
    spine = read('spine/files.json')
    for item in spine:
        if item['kind'] == 'split-animation':
            path = item['originalPath']
            label = '男角色' if '/Male_1/' in path else '女角色' if '/Female_1/' in path else 'NPC'
            items.append({'group': 'actions', 'name': item['name'], 'label': label + ' · Spine 动作数据', 'file': item['file'], 'description': f"{item['bytes']:,} 字节 · 原始分段动画", 'pics': [], 'source': item['sourceBundle']})
        else:
            items.append({'group': 'skeletons', 'name': item['name'], 'label': {'skeleton': 'Spine 骨骼', 'atlas': 'Spine 图集描述', 'skin-list': '皮肤清单'}[item['kind']], 'file': item['file'], 'description': item.get('spineVersion', '') + ' · ' + item['originalPath'], 'pics': [], 'source': item['sourceBundle']})
    for clip in read('motion/clips.json'):
        label = '界面时间轴' if clip['category'] == 'ui' else 'Unity 动画片段'
        if clip.get('spineSchedulingOnly'):
            label += ' · Spine 调度入口'
        items.append({'group': 'ui' if clip['category'] == 'ui' else 'timelines', 'name': clip['name'], 'label': label, 'file': clip['file'], 'description': f"{clip['category']} · {clip['duration']:.3f} 秒 · {clip['sampleRate']:g} Hz", 'pics': [], 'source': clip['sourceBundle']})
    data = json.dumps(items, ensure_ascii=False).replace('</', '<\\/')
    page = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ZJCS 原始动效素材库</title>
<style>
:root{color-scheme:dark;--bg:#101c28;--panel:#182a3b;--edge:#385168;--text:#e9f0f4;--muted:#b1c1cf;--accent:#ffd080;--space:16px}*{box-sizing:border-box}body{margin:0;font:15px/1.6 "Microsoft YaHei",sans-serif;background:var(--bg);color:var(--text)}header,main{max-width:1440px;margin:auto;padding:24px 32px}header{border-bottom:1px solid var(--edge)}.eyebrow{color:var(--accent);letter-spacing:2px;font-size:12px}h1{font-size:30px;line-height:1.3;margin:8px 0}p{margin:8px 0;color:var(--muted)}a{color:var(--accent)}nav{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}button,input{font:inherit;color:var(--text);background:var(--panel);border:1px solid var(--edge);border-radius:6px;padding:8px 16px}button{cursor:pointer}button[aria-pressed=true]{border-color:var(--accent);color:var(--accent)}button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}button:disabled{opacity:.45;cursor:default}.controls{display:flex;align-items:center;gap:16px;flex-wrap:wrap}input{flex:1;min-width:220px}#count{color:var(--muted)}#results{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:24px}.item{border:1px solid var(--edge);background:var(--panel);border-radius:6px;min-width:0;overflow:hidden}.preview{height:180px;display:flex;align-items:center;justify-content:center;background-color:#0b111a;background-image:linear-gradient(45deg,#152131 25%,transparent 25%),linear-gradient(-45deg,#152131 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#152131 75%),linear-gradient(-45deg,transparent 75%,#152131 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}.preview img{object-fit:contain;max-width:100%;max-height:100%}.content{padding:16px}.label{font-size:12px;color:var(--accent)}h2{font:600 16px/1.45 "Microsoft YaHei",sans-serif;margin:4px 0;overflow-wrap:anywhere}.meta{font-size:12px;color:var(--muted);margin:8px 0}details{font-size:12px;margin-top:8px}summary{cursor:pointer}.source{word-break:break-all;color:var(--muted)}.thumbs{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.thumbs img{width:64px;height:64px;object-fit:contain;background:#0b111a}.pager{display:flex;align-items:center;justify-content:center;gap:16px;padding:24px}.empty{padding:40px;grid-column:1/-1;text-align:center;border:1px dashed var(--edge)}footer{padding:16px 32px;text-align:center;color:var(--muted);font-size:12px}@media(max-width:900px){#results{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){header,main{padding:16px}#results{grid-template-columns:1fr}h1{font-size:24px}}
</style>
<header><div class="eyebrow">SOURCE ARCHIVE / 原始资源</div><h1>ZJCS 原始动效素材库</h1><p>技能特效、角色动作与界面动效。此处图片是原始贴图预览；完整播放与接入状态请查看动态播放器。</p><p><a href="http://127.0.0.1:8625/">动态预览与可用性</a> · <a href="README.md">提取说明</a> · <a href="extraction-report.json">统计与来源</a> · <a href="native/unresolved-dependencies.json">原包缺失依赖</a> · <a href="spine/atlases.json">图集页可用性</a></p></header>
<main><nav aria-label="素材分类"><button data-group="combat" aria-pressed="true">战斗特效</button><button data-group="actions" aria-pressed="false">角色动作</button><button data-group="ui" aria-pressed="false">界面动效</button><button data-group="skeletons" aria-pressed="false">骨骼与图集</button><button data-group="timelines" aria-pressed="false">其他时间轴</button><button data-group="textures" aria-pressed="false">原始贴图库</button></nav><div class="controls"><input type="search" id="search" aria-label="搜索资源" placeholder="搜索原始名称、角色或文件路径"><span id="count" role="status"></span></div><section id="results" aria-label="资源列表"></section><div class="pager"><button id="prev">上一页</button><span id="page" aria-live="polite"></span><button id="next">下一页</button></div></main><footer>Unity 2022.3.57f1 · Spine 4.2.28 · 未安装或执行 APK · 动态验收与接入状态见可用性清单</footer>
<script id="catalog-data" type="application/json">__DATA__</script><script>
const entries=JSON.parse(document.getElementById('catalog-data').textContent);let group='combat',page=0;const size=36,$=s=>document.querySelector(s);const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){const q=$('#search').value.trim().toLowerCase(),all=entries.filter(x=>x.group===group&&(!q||(x.name+' '+x.label+' '+x.description+' '+x.file).toLowerCase().includes(q))),pages=Math.max(1,Math.ceil(all.length/size));page=Math.min(page,pages-1);$('#count').textContent=all.length+' 项';$('#page').textContent=(page+1)+' / '+pages;$('#prev').disabled=page===0;$('#next').disabled=page===pages-1;$('#results').innerHTML=all.slice(page*size,(page+1)*size).map(x=>`<article class="item">${x.pics.length?`<div class="preview"><img loading="lazy" src="${esc(x.pics[0].file)}" alt="${esc(x.pics[0].name)} 原始贴图"></div>`:''}<div class="content"><div class="label">${esc(x.label)}</div><h2>${esc(x.name)}</h2><p class="meta">${esc(x.description)}</p><a href="${esc(x.file)}" target="_blank" rel="noopener">打开原始数据</a><details><summary>贴图与来源</summary><div class="thumbs">${x.pics.map(p=>`<a href="${esc(p.file)}" target="_blank" rel="noopener" title="${esc(p.name)}"><img loading="lazy" src="${esc(p.file)}" alt="${esc(p.name)}"></a>`).join('')}</div><div class="source">${esc(x.source)}</div></details></div></article>`).join('')||'<div class="empty">未找到匹配资源。可尝试英文原名、男角色、女角色或 NPC。</div>';}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{group=b.dataset.group;page=0;document.querySelectorAll('nav button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render()});$('#search').oninput=()=>{page=0;render()};$('#prev').onclick=()=>{page--;render()};$('#next').onclick=()=>{page++;render()};render();
</script></html>'''.replace('__DATA__', data)
    (root / 'index.html').write_text(page, encoding='utf-8')

    # A contact sheet shows actual decoded pixels only, without reconstructing effects.
    samples = []
    for group in ['combat', 'ui']:
        candidates = [x for x in items if x['group'] == group and x['pics']]
        step = max(1, len(candidates) // 12)
        samples.extend(candidates[::step][:12])
    width, height, cell_w, cell_h = 1280, 1080, 320, 180
    sheet = Image.new('RGB', (width, height), '#152131')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 11)
    for i, entry in enumerate(samples):
        x, y = i % 4 * cell_w, i // 4 * cell_h
        image = Image.open(root / entry['pics'][0]['file']).convert('RGBA')
        image.thumbnail((cell_w - 24, cell_h - 38))
        sheet.paste(image, (x + (cell_w-image.width)//2, y+8+(cell_h-38-image.height)//2), image)
        draw.text((x+8, y+cell_h-24), entry['name'][:43], fill='#dde8ef', font=font)
        draw.rectangle((x,y,x+cell_w-1,y+cell_h-1),outline='#385168')
    (root/'previews').mkdir(exist_ok=True)
    sheet.save(root/'previews/original-textures.jpg', quality=92)
    (root/'catalog-summary.json').write_text(json.dumps({'entries':len(items),'vfx':reports},indent=2),encoding='utf-8')
    print(json.dumps({'catalogEntries': len(items), 'vfx': reports}, indent=2))


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path('../../source-assets/zjcs-apk'))
    args=parser.parse_args()
    build(args.root.resolve())
