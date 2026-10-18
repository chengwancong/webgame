// Offline artwork QA only; no game service, player data, or runtime mappings are changed.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {argumentsFor,loadManifest,inspectPng,hash,escapeHtml as esc,labels} from './common.mjs';

const args=argumentsFor(['manifest','out','help']);
if(args.help||!args.manifest||!args.out){
  console.log('node tools/equipment-art/review.mjs --manifest ART_PACKAGE/manifest.json --out REVIEW_DIRECTORY');
  if(!args.help)process.exitCode=1;
}else{
  const data=await loadManifest(args.manifest),out=resolve(args.out),checks=[],images=new Map(),seen=new Map();
  await mkdir(out,{recursive:true});
  for(const item of data.items){
    if(!item.file||!item.original?.sha256||!item.production?.sha256)throw Error(`Expected an imported art package record: ${item.id}`);
    const bytes=await readFile(resolve(data.base,item.file)),info=await inspectPng(bytes,item.id,{production:true});
    if(info.sha256!==item.production.sha256)throw Error(`Changed production PNG: ${item.id}`);
    const original=await readFile(resolve(data.base,item.source));
    if(hash(original)!==item.original.sha256)throw Error(`Changed retained original: ${item.id}`);
    if(seen.has(info.pixelSha256))throw Error(`Shared artwork: ${item.id} and ${seen.get(info.pixelSha256)}`);
    seen.set(info.pixelSha256,item.id);
    images.set(item.id,`data:image/png;base64,${bytes.toString('base64')}`);
    checks.push({id:item.id,setId:item.setId,...info});
  }
  const slotLabels=labels(data.manifest,'slots',{weapon:'武器',armor:'衣服',helmet:'头盔',boots:'鞋子',necklace:'项链',ring:'戒指'}),directionLabels=labels(data.manifest,'directions',{sword:'剑',hammer:'锤',axe:'斧',staff:'法杖',hidden:'暗器',wand:'魔杖'}),seriesLabels=labels(data.manifest,'series',{standard:'常规',omega:'方阵',primal:'原初'});
  const styles=`@font-face{font-family:WorldSans;src:url('${pathToFileURL(resolve('apps/web/public/art/NotoSansSC.ttf')).href}')}*{box-sizing:border-box}body{margin:0;padding:24px;background:#0b1f3b;color:#f7e6c8;font:14px WorldSans,"Microsoft YaHei",sans-serif}h1{font-size:24px;margin:0 0 8px;font-weight:700}p{color:#a9c3d2;margin:0 0 20px}h2{font-size:16px;margin:20px 0 8px}.row{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.tile{min-width:0;border:1px solid #436782;border-radius:8px;background:#123450;text-align:center;padding:8px;display:flex;flex-direction:column;align-items:center;gap:4px}.large{width:80px;height:80px;object-fit:contain;flex-shrink:0}.small{display:flex;gap:12px;align-items:center;justify-content:center;height:52px;width:100%}.small img{flex-shrink:0;object-fit:contain}.tile b{font-size:14px;font-weight:500}.id{font-size:10px;line-height:1.3;overflow-wrap:anywhere;color:#91a3b2}a{color:#49d2ff}nav{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px}.row-header{display:flex;gap:12px;align-items:center}.tier{font-size:12px;color:#ffb65c}@media(max-width:700px){body{padding:12px}.row{grid-template-columns:repeat(3,minmax(0,1fr))}}`;
  const currentStyles=`body{background:#fcfaf5;color:#293940}p,.id{color:#65747c}.tile{background:#fff;border-color:#e2dac8}a{color:#8c621e}.tier{color:#9a6e24}.matrix>div{background:#fff}.matrix .group{color:#8c621e}.matrix .part{color:#65747c}.matrix .break{border-color:#e2dac8}.mono img{filter:grayscale(1)}`;
  function gallery(title,sets,nav=''){
    return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${styles}</style><body><h1>${esc(title)}</h1><p>${sets.length} 套 · ${sets.length*6} 张。上方 80px，下方 32px / 48px；透明底呈现于游戏午夜蓝底色。此页仅验收美术资产。</p>${nav}${sets.map(([id,set])=>{const first=set.items[0];return `<section id="${esc(id)}"><h2>${esc(directionLabels[first.direction]??first.direction)} · ${esc(seriesLabels[first.series]??first.series)} <span class="tier">${first.tier}</span></h2><div class="row">${data.slots.map(slot=>{const item=set.items.find(i=>i.slot===slot),src=images.get(item.id);return `<div class="tile" data-id="${esc(item.id)}"><img class="large" src="${src}" alt="${esc(item.name)}" width="80" height="80"><b>${esc(slotLabels[slot]??slot)}</b><div class="small" aria-label="32及48像素对照"><img src="${src}" alt="" width="32" height="32"><img src="${src}" alt="" width="48" height="48"></div><span class="id">${esc(item.id)}</span></div>`;}).join('')}</div></section>`;}).join('')}</body></html>`;
  }
  const groups=new Map();for(const entry of data.sets){const first=entry[1].items[0],key=`${first.direction}-${first.series}`,list=groups.get(key)??[];list.push(entry);groups.set(key,list);}
  const pages=[{file:'all-equipment',title:'全部装备 · 手绘符记',sets:[...data.sets]}];
  for(const [key,sets]of groups)pages.push({file:key,title:`${directionLabels[sets[0][1].items[0].direction]??sets[0][1].items[0].direction} · ${seriesLabels[sets[0][1].items[0].series]??sets[0][1].items[0].series}`,sets});
  const nav=`<nav aria-label="装备方向">${pages.slice(1).map(page=>`<a href="${page.file}.html">${esc(page.title)}</a>`).join('')}</nav>`;
  let browser;
  try{
    browser=await chromium.launch({channel:'chrome',headless:true});
    const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    for(const item of pages){
      const filters=`<div style="display:flex;gap:12px;flex-wrap:wrap;margin:12px 0"><label>武器方向 <select id="family"><option value="">全部</option>${Object.entries(directionLabels).map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('')}</select></label><label>系列 <select id="series"><option value="">全部</option>${Object.entries(seriesLabels).map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('')}</select></label><label>阶段 <select id="tier"><option value="">全部</option><option>T1</option><option>T2</option><option>T3</option></select></label><button id="gray" type="button">切换灰度</button><span id="count"></span></div><script>const sections=[...document.querySelectorAll('section[id]')];function apply(){let count=0;for(const section of sections){const [gear,series,family,tier]=section.id.split('-');const visible=(!document.getElementById('family').value||document.getElementById('family').value===family)&&(!document.getElementById('series').value||document.getElementById('series').value===series)&&(!document.getElementById('tier').value||document.getElementById('tier').value===tier);section.hidden=!visible;if(visible)count++;}document.getElementById('count').textContent=count+' 套 / '+count*6+' 张';}for(const id of ['family','series','tier'])document.getElementById(id).addEventListener('change',apply);document.getElementById('gray').addEventListener('click',()=>document.body.classList.toggle('mono'));apply();</script>`;
      const html=gallery(item.title,item.sets,item.file==='all-equipment'?nav:'').replace('</style>',currentStyles+'</style>').replace('游戏午夜蓝底色','当前奶白浅金底色').replace('</body>',filters+'</body>');
      const interactiveHtml=html.replace('<div style="display:flex;gap:12px;flex-wrap:wrap;margin:12px 0">','<div id="filters" style="display:flex;gap:12px;flex-wrap:wrap;margin:12px 0">').replace('<script>const sections=','<script>document.body.insertBefore(document.getElementById("filters"),document.querySelector("nav")??document.querySelector("section"));const sections=');
      await writeFile(join(out,item.file+'.html'),interactiveHtml.replace('value===tier)','value===tier.toUpperCase())'));
      await page.goto(pathToFileURL(join(out,item.file+'.html')).href);
      await page.evaluate(()=>Promise.all([document.fonts.ready,...[...document.images].map(image=>image.decode())]));
      const geometry=await page.locator('.tile').evaluateAll(tiles=>tiles.map(tile=>({id:tile.dataset.id,sizes:[...tile.querySelectorAll('img')].map(image=>{const bounds=image.getBoundingClientRect();return{natural:[image.naturalWidth,image.naturalHeight],display:[bounds.width,bounds.height]};})})));
      for(const tile of geometry)for(let i=0;i<tile.sizes.length;i++){const size=tile.sizes[i],expected=[80,32,48][i];if(size.natural.some(n=>n!==256)||size.display.some(n=>n!==expected))throw Error(`Unexpected browser image dimensions: ${tile.id}`);}
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(`Horizontal overflow: ${item.file}`);
      const contentHeight=await page.evaluate(()=>Math.ceil(document.body.getBoundingClientRect().height));await page.setViewportSize({width:1280,height:Math.max(240,Math.min(900,contentHeight))});
      await page.screenshot({path:join(out,item.file+'.png'),fullPage:true});
    }
    // Compact matrix for reviewing the entire 54-set collection at actual 48px size.
    const directions=[...new Set(data.items.map(i=>i.direction))],series=[...new Set(data.items.map(i=>i.series))],tiers=[...new Set(data.items.map(i=>i.tier))];
    const columns=series.length*data.slots.length;
    const overview=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>装备图标总览</title><style>${styles}.matrix{display:grid;grid-template-columns:88px repeat(${columns},minmax(0,1fr));gap:3px}.matrix>div{display:flex;align-items:center;justify-content:center;min-width:0;background:#123450;height:62px}.matrix .group{grid-column:span ${data.slots.length};height:32px;color:#ffb65c;font-weight:700}.matrix .part{height:30px;color:#a9c3d2;font-size:11px}.matrix .rowname{justify-content:flex-start;font-size:12px;background:transparent}.matrix img{width:48px;height:48px;object-fit:contain}.matrix .break{border-top:2px solid #436782}</style><body><h1>装备图标 · 手绘符记</h1><p>${data.sets.size} 套 / ${data.items.length} 张 · 6 个武器方向 · 常规 / 方阵 / 原初 · T1 / T2 / T3 · 每张以 48px 展示</p><div class="matrix"><div class="part"></div>${series.map(s=>`<div class="group">${esc(seriesLabels[s]??s)}</div>`).join('')}<div class="part"></div>${series.map(()=>data.slots.map(s=>`<div class="part">${esc(slotLabels[s]??s)}</div>`).join('')).join('')}${directions.map(direction=>tiers.map((tier,t)=>`<div class="rowname ${t===0?'break':''}">${esc(directionLabels[direction]??direction)} · ${esc(tier)}</div>${series.map(series=>data.slots.map(slot=>{const item=data.items.find(i=>i.direction===direction&&i.series===series&&i.tier===tier&&i.slot===slot);return `<div class="${t===0?'break':''}">${item?`<img src="${images.get(item.id)}" alt="${esc(item.name)}">`:''}</div>`;}).join('')).join('')}`).join('')).join('')}</div></body></html>`;
    await writeFile(join(out,'overview.html'),overview.replace('</style>',currentStyles+'</style>'));await page.goto(pathToFileURL(join(out,'overview.html')).href);await page.evaluate(()=>Promise.all([document.fonts.ready,...[...document.images].map(i=>i.decode())]));await page.screenshot({path:join(out,'overview.png'),fullPage:true});
    await page.evaluate(()=>document.body.classList.add('mono'));await page.screenshot({path:join(out,'overview-grayscale.png'),fullPage:true});
    if(errors.length)throw Error(errors.join('\n'));
  }finally{await browser?.close();}
  const result={ok:true,scope:'art-package-only; not gameplay or runtime integration acceptance',createdAt:new Date().toISOString(),manifest:data.manifestPath,icons:data.items.length,sets:data.sets.size,uniquePixels:seen.size,dimensions:[256,256],displaySizes:[32,48,80],warnings:data.manifest.warnings??[],pages:pages.map(page=>page.file+'.png'),checks};
  await writeFile(join(out,'result.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({ok:true,icons:result.icons,sets:result.sets,review:out,warnings:result.warnings.length},null,2));
}
