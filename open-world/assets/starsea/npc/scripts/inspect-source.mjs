import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {TextureAtlas} from '@esotericsoftware/spine-webgl';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'../../../..'),base=join(root,'assets/mini-hero/navy/runtime'),out=join(root,'apps/web/public/art/starsea/npc/preview/inspection');await mkdir(out,{recursive:true});
const json=JSON.parse(await readFile(join(base,'Character.json'),'utf8')),atlas=new TextureAtlas(await readFile(join(base,'Character.atlas'),'utf8'));
let html='<!doctype html><html><meta charset="utf-8"><style>body{background:#f2efe7;font:10px sans-serif}section{display:grid;grid-template-columns:repeat(13,90px);gap:3px}article{background:#fff;text-align:center}img{width:65px;height:65px;object-fit:contain}p{margin:0}</style><section>';
for(const skin of json.skins.filter(s=>/^BODY\/|^HAIR\/hair[AB]_[abc]|^HEAD\//.test(s.name))){const slot=skin.name.startsWith('HAIR')?'hair':skin.name.startsWith('BODY')?'top':'head',attachment=skin.attachments?.[slot]?.[slot];if(!attachment)continue;const region=atlas.findRegion(attachment.name);if(!region)continue;
 const name=skin.name.replaceAll('/','-')+'.png',rotated=region.degrees===90||region.degrees===270;
 const bytes=await sharp(join(base,region.page.name)).extract({left:region.x,top:region.y,width:rotated?region.height:region.width,height:rotated?region.width:region.height}).rotate(region.degrees===90?270:region.degrees===270?90:region.degrees===180?180:0).png().toBuffer();await writeFile(join(out,name),bytes);html+=`<article><img src="./${name}"><p>${skin.name.replace(/^.*\//,'')}</p></article>`;
}
await writeFile(join(out,'index.html'),html+'</section></html>');console.log(out);
