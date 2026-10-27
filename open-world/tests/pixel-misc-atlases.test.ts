import {it,expect} from 'vitest';
import fs from 'node:fs';

const manifest=JSON.parse(fs.readFileSync(new URL('../apps/web/public/art-pixel/manifest.json',import.meta.url),'utf8'));
const atlas=(name:string)=>manifest.assets['supplement:hub-ui/'+name+'.png'];

it('fits both the 40px route node and the 16px details control without cropping a legacy 64px icon',()=>{
 const a=atlas('chart-nodes');expect(a.scale).toBe(1);
 for(const name of ['node-story','node-nest','node-hunt','node-tide','node-treasure','node-gate','mark-collect','mark-hidden']){
  expect([a.frames[name].w,a.frames[name].h]).toEqual([40,40]);
  expect([a.frames[name+':small'].w,a.frames[name+':small'].h]).toEqual([16,16]);
  expect(a.sourceFrames[name].w).toBe(96);
 }
});

it('fits the 24px region tabs while retaining every original unlocked and locked source rectangle',()=>{
 const a=atlas('sea-emblems');expect(a.scale).toBe(1);
 for(const region of ['wind','mist','forge','frost','rift','dragon','deep'])for(const locked of ['', '-locked']){
  const name='emblem-'+region+locked;
  expect([a.frames[name].w,a.frames[name].h]).toEqual([24,24]);
  expect(a.sourceFrames[name].w).toBe(128);
 }
});

it('preserves the construction card source lookup and supplies exact list/detail sizes independently of badges',()=>{
 const a=atlas('port-build');expect(a.scale).toBe(1);
 for(const type of ['forge','dock','post']){
  const name='build-card-'+type;
  expect([a.frames[name].w,a.frames[name].h]).toEqual([200,134]);
  expect([a.frames[name+':small'].w,a.frames[name+':small'].h]).toEqual([120,80]);
  expect([a.sourceFrames[name].w,a.sourceFrames[name].h]).toEqual([480,320]);
 }
 for(const name of ['build-tier-1','build-tier-2','build-tier-3','build-tier-4','collect-life-crystal','collect-star-core'])expect([a.frames[name].w,a.frames[name].h]).toEqual([24,24]);
});
