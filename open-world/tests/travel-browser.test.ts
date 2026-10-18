import {it,expect} from 'vitest';
import {regions,type Region} from '../packages/content/index.ts';
import type {Snapshot} from '../packages/contracts/index.ts';
import {initialTravelState,travelModel,destinationReady,destinationRequirement,destinationCatalog} from '../apps/web/src/travel-browser.ts';
const snapshot=(kills=0,bossEligible=false)=>({progress:{regions:['town','meadow'],bosses:[],kills},bossAccess:{'meadow-boss':{eligible:bossEligible}}} as unknown as Snapshot);
it('switches the selection and details to a locked region without granting entry',()=>{
 const model=travelModel({...initialTravelState(),regionId:'forest',destinationId:'forest'},snapshot());
 expect(model.selected?.region.id).toBe('forest');expect(destinationReady(model.selected!,snapshot())).toBe(false);
 expect(destinationRequirement(model.selected!,snapshot())).toBe('击败荒原守门人后解锁');
});
it('shows only the selected region’s real boss in the dungeon tab',()=>{
 const model=travelModel({...initialTravelState(),mode:'dungeon'},snapshot());
 expect(model.visible.map(d=>d.region.id)).toEqual(['meadow-boss']);expect(destinationReady(model.selected!,snapshot())).toBe(false);
 expect(destinationReady(model.selected!,snapshot(6))).toBe(false);expect(destinationReady(model.selected!,snapshot(6,true))).toBe(true);
});
it('filters unavailable activities and handles a genuinely empty result',()=>{
 const model=travelModel({...initialTravelState(),mode:'dungeon',filter:'available'},snapshot());
 expect(model.visible).toEqual([]);expect(model.selected).toBeUndefined();expect(model.pages).toBe(1);
});
it('searches a boss across regions, then selects its correct parent and details',()=>{
 const model=travelModel({...initialTravelState(),mode:'dungeon',query:'炎主'},snapshot());
 expect(model.visible.map(d=>d.region.id)).toEqual(['rift-boss']);expect(model.area.id).toBe('rift');
 expect(destinationRequirement(model.selected!,snapshot())).toBe('击败雾林祭司后解锁');
});
it('paginates a large content catalog and clamps stale pages after filtering',()=>{
 const template=regions.find(r=>r.id==='meadow')!;
 const content=Array.from({length:20},(_,i)=>({...template,id:'sample-'+i,name:'测试地区'+i}) as Region);
 const state={...initialTravelState(),query:'测试地区',page:3};
 const model=travelModel(state,snapshot(),content);expect(model.pages).toBe(4);expect(model.shown).toHaveLength(2);
 const filtered=travelModel({...state,query:'不存在'},snapshot(),content);expect(filtered.page).toBe(0);expect(filtered.shown).toHaveLength(0);
});
it('catalog construction and browsing leave the server snapshot untouched',()=>{
 const player=snapshot(),before=JSON.stringify(player);expect(destinationCatalog()).toHaveLength(12);
 travelModel({...initialTravelState(),mode:'dungeon',query:'试炼'},player);expect(JSON.stringify(player)).toBe(before);
});
