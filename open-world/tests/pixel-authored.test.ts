import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {pixelFrameIndex,pixelFrameSource,pixelSocket,pixelObjectOrigin,type PixelAction,type PixelAsset} from '../apps/web/src/pixel-assets.ts';
import {pixelHeroKey} from '../apps/web/src/pixel-actor.ts';
import type {ResolvedAppearance} from '../packages/contracts/appearance.ts';
// @ts-expect-error The production checker is a directly executable Node ESM CLI.
import {checkAsset,checkManifest} from '../tools/pixel/check-pixel-art.mjs';
const clip:PixelAction={row:0,count:6,duration:1,impactTime:.35,impactFrame:2,frameTimes:[0,.175,.35,.5125,.675,.8375],sockets:[]};
describe('authored frame playback',()=>{
 it('releases precisely at the source impact and holds the last frame',()=>{
  expect(pixelFrameIndex(clip,.349,false)).toBe(1);expect(pixelFrameIndex(clip,.35,false)).toBe(2);
  expect(pixelFrameIndex(clip,12,false)).toBe(5);expect(pixelFrameIndex(clip,1,true)).toBe(0);
 });
 it('maps simulation windup/recovery without changing authored total duration',()=>{
  expect(pixelFrameIndex(clip,0,false,{elapsed:.8,windup:.8,recovery:.2})).toBe(2);
  expect(pixelFrameIndex(clip,0,false,{elapsed:1,windup:.8,recovery:.2})).toBe(5);
  expect(clip.duration).toBe(1);expect(clip.impactTime).toBe(.35);
 });
 it('reads packed actor frames across sheet rows while retaining legacy row playback',()=>{
  expect(pixelFrameSource({frame:[160,160]},{...clip,positions:[[320,0],[0,160]]},1)).toEqual([0,160]);
  expect(pixelFrameSource({frame:[128,128]},{...clip,row:2},1)).toEqual([128,256]);
 });
 it('mirrors sockets around the same integer foot anchor as the sprite',()=>{
  expect(pixelSocket([45,30],[32,60],[256,384],2,false)).toEqual([282,324]);
  expect(pixelSocket([45,30],[32,60],[256,384],2,true)).toEqual([230,324]);
 });
 it('selects all seven gameplay weapons independently of the legacy family name',()=>{
  for(const type of ['sword','hammer','axe','bow','staff','hidden','wand'] as const){const appearance={family:'magic',kit:{weapon:{type,series:'standard',tier:1},armor:null}} as ResolvedAppearance;expect(pixelHeroKey(appearance,'native')).toBe(`hero:${type}:native`);}
  expect(pixelHeroKey({family:'gun'} as ResolvedAppearance,'wardrobe')).toBe('hero:gun:wardrobe');
 });
 it('keeps port markers at their original 268px lift rather than dropping them to the ground',()=>{
  const asset={frame:[16,16],anchor:[8,16],baseOrigin:[.5,1]} as PixelAsset;
  const origin=pixelObjectOrigin(asset,[.5,1+268/32],[32,32]);expect(origin).toEqual([.5,1+268/32]);expect(32-origin[1]*32).toBe(-268);
 });
});
describe('pixel production quality gate',()=>{
 const palette={ramps:{ink:['#243343','#e7e0c6']},shadow:'#243343'};
 async function candidate(edit?:(data:Buffer)=>void){
  const publicRoot=fs.mkdtempSync(path.join(os.tmpdir(),'aw-pixel-test-'));fs.mkdirSync(path.join(publicRoot,'art-pixel'));
  const data=Buffer.alloc(8*8*4);for(let y=2;y<6;y++)for(let x=2;x<6;x++){const i=(y*8+x)*4;data[i]=36;data[i+1]=51;data[i+2]=67;data[i+3]=255;}edit?.(data);
  const file=path.join(publicRoot,'art-pixel/test.png');await sharp(data,{raw:{width:8,height:8,channels:4}}).png().toFile(file);
  const asset={file:'/art-pixel/test.png',original:['/art/test.png'],kind:'image',frame:[8,8],anchor:[4,7],scale:2,provenance:{method:'authored-pixels',reviewed:true,recipe:'test'},sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
  return {asset,publicRoot};
 }
 async function codes(edit?:(data:Buffer)=>void,change?:(asset:any)=>void){const fixture=await candidate(edit);try{change?.(fixture.asset);return (await checkAsset(fixture.asset,{publicRoot:fixture.publicRoot,palette})).map((i:any)=>i.code);}finally{fs.rmSync(fixture.publicRoot,{recursive:true,force:true});}}
 it('accepts connected opaque palette art',async()=>{expect(await codes()).toEqual([]);});
 it('rejects colors outside the master palette',async()=>{expect(await codes(d=>{d[(3*8+3)*4]=255;})).toContain('palette');});
 it('rejects semitransparency',async()=>{expect(await codes(d=>{d[(3*8+3)*4+3]=120;})).toContain('alpha');});
 it('rejects non-integral frame packing',async()=>{expect(await codes(undefined,a=>{a.frame=[7,8];})).toContain('grid');});
 it('rejects detached single pixels per frame',async()=>{expect(await codes(d=>{d[0]=36;d[1]=51;d[2]=67;d[3]=255;})).toContain('isolated');});
 it('requires a valid anchor and reviewed provenance',async()=>{expect(await codes(undefined,a=>{delete a.anchor;})).toContain('anchor');expect(await codes(undefined,a=>{a.provenance.reviewed=false;})).toContain('provenance');});
 it('requires pinned license provenance for adapted pixel assets',async()=>{expect(await codes(undefined,a=>{a.provenance.method='adapted-pixels';})).toContain('license');expect(await codes(undefined,a=>{a.provenance.method='adapted-pixels';a.provenance.upstream={license:'CC0-1.0',url:'https://opengameart.org/node/39455',author:'Henrique Lazarini (7Soul1)',package:'496 RPG Icons',archiveSha256:'b'.repeat(64),modifications:['palette remap'],file:'W_Sword001.png',sourceSha256:'a'.repeat(64)};})).toEqual([]);});
 it('rejects empty coverage rather than reporting an empty manifest complete',async()=>{
  expect((await checkManifest({schemaVersion:1,stage:[1280,720],canvas:[640,360],assets:{}})).ok).toBe(false);
 });
 it('rejects forged actor timing and missing per-frame sockets',async()=>{
  expect(await codes(undefined,a=>{a.kind='actor';a.actions={attack:{...clip,row:0,count:1,frameTimes:[0],impactFrame:0,sockets:[]}};})).toContain('impact');
 });
 it('validates packed frame occupancy and bounds rather than assuming a single row',async()=>{
  const make=(a:any,positions:number[][])=>{a.kind='actor';a.frame=[4,4];a.anchor=[2,4];a.actions={idle:{row:0,count:2,duration:1,impactTime:0,impactFrame:0,frameTimes:[0,.5],positions,sockets:[0,1].map(()=>Object.fromEntries(['feet','chest','hand','weapon','muzzle'].map(k=>[k,[2,2]])))}};};
  expect(await codes(undefined,a=>make(a,[[0,0],[4,4]]))).toEqual([]);
  expect(await codes(undefined,a=>make(a,[[0,0],[8,4]]))).toContain('grid');
  expect(await codes(undefined,a=>make(a,[[0,0],[3,4]]))).toContain('grid');
 });
});
