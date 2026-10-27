import {it,expect} from 'vitest';import fs from 'node:fs';import path from 'node:path';import sharp from 'sharp';
import palette from '../packages/asset-manifest/pixel-palette.json';import {dyeShibaGarment} from '../apps/web/src/pixel-shiba-style.ts';
const manifest=JSON.parse(fs.readFileSync(path.resolve('apps/web/public/art-pixel/manifest.json'),'utf8'));
it('ships Shiba frames for every boot/native/wardrobe hero route and retains both clothing and weapon layers',()=>{
 const heroes=Object.entries(manifest.assets).filter(([key,a]:[string,any])=>/^hero(?::|$)/.test(key)&&a.kind==='actor');expect(heroes).toHaveLength(20);
 for(const[key,a]of heroes as [string,any][]){expect(a.appearanceStyle,key).toBe('shiba');expect(a.file,key).toContain('/hero/shiba-fine-v1/');for(const layer of a.layers??[]){expect(manifest.assets[layer].appearanceStyle).toBe('shiba');expect(manifest.assets[layer].frame).toEqual([128,128]);}}
});
it('does not dye Shiba fur, muzzle, eyes or dark contours when equipment recolors the navy jacket',()=>{
 const colors=Object.values(palette.ramps).flat(),data=new Uint8ClampedArray(colors.flatMap(c=>[...Buffer.from(c.slice(1),'hex'),255])),before=data.slice();dyeShibaGarment(data,palette.ramps.arcane);
 colors.forEach((c,i)=>{const expected=palette.ramps.navy.slice(2).includes(c)?palette.ramps.arcane[palette.ramps.navy.indexOf(c)]:c;expect([...data.slice(i*4,i*4+4)]).toEqual([...Buffer.from(expected.slice(1),'hex'),255]);});expect(data).not.toEqual(before);
 const transparent=new Uint8ClampedArray([...Buffer.from(palette.ramps.navy[3].slice(1),'hex'),0]),original=transparent.slice();dyeShibaGarment(transparent,palette.ramps.fire);expect(transparent).toEqual(original);
});
it('keeps the complete fallen Shiba silhouette inside each death frame',async()=>{
 for(const[key,a]of Object.entries(manifest.assets) as [string,any][]){if(!/^hero:.*:native$/.test(key)||a.kind!=='actor')continue;const body=manifest.assets[a.layers[0]],{data,info}=await sharp(path.resolve('apps/web/public'+body.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true}),clip=a.actions.death;
  for(let n=0;n<clip.count;n++){let fur=0;for(let y=0;y<128;y++)for(let x=0;x<128;x++){const i=((clip.row*128+y)*info.width+n*128+x)*4;if(!data[i+3])continue;if(data[i]>data[i+2]*1.3&&data[i]>130)fur++;expect(x===0||x===127||y===0||y===127,key+'/'+n).toBe(false);}expect(fur,key+'/'+n).toBeGreaterThan(80);}
 }
});
