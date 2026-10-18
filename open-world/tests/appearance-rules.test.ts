import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {appearanceContent,appearanceConfigSchema,validateAppearanceAssets} from '../packages/content/appearance.ts';
import {appearanceSlots} from '../packages/contracts/appearance.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import {ensureProgression} from '../packages/rules/deep-progression.ts';
import {ensureAppearance,resolveAppearance,previewAppearance,applyAppearance,appearanceView} from '../packages/rules/appearance.ts';
function player():CharacterState{
 const gear=[0,1,2,3,4,5].map(i=>makeGear(i,randomUUID()));
 const s:CharacterState={id:randomUUID(),name:'旅人',revision:4,build:2,level:1,xp:0,gold:77,material:11,gear,equipment:{weapon:gear[0].id,armor:gear[2].id},skills:['cut'],skillRanks:{cut:1},progress:{kills:0,regions:['town','meadow'],bosses:[],safe:'town',tasks:[]}};
 ensureProgression(s);ensureAppearance(s);return s;
}
it('automatic rear hair stays paired with the chosen head while an explicit back remains independent',()=>{
 const s=player(),preview=previewAppearance(s,{head:'100011'});
 expect(preview.resolvedAppearance.parts.back.setId).toBe('100011');
 expect(preview.resolvedAppearance.parts.body.setId).toBe(appearanceContent.equipment.coat.setId);
 expect(previewAppearance(s,{head:'100011',back:'100041'}).resolvedAppearance.parts.back.setId).toBe('100041');
});
it('validates curated shipping, slots, identifiers and defaults before serving players',()=>{
 expect(appearanceContent.bundles).toHaveLength(16);expect(appearanceContent.bundles.filter(b=>b.unlock.type==='starter')).toHaveLength(4);
 for(const mutate of [(c:any)=>c.bundles.push(c.bundles[0]),(c:any)=>c.bundles[0].id='../../art',(c:any)=>c.bundles[0].slots=['boots'],(c:any)=>c.equipment.bow.family=undefined,(c:any)=>c.defaultWeaponSets.bow='100011']){const invalid=structuredClone(appearanceContent);mutate(invalid);expect(()=>appearanceConfigSchema.parse(invalid)).toThrow();}
 expect(()=>validateAppearanceAssets([])).toThrow('Missing appearance asset');
});
it('mixes all seven parts with one compatible weapon and preserves every combat input',()=>{
 const s=player(),before=structuredClone(s),build=resolveBuild(s),selection={head:'100031',body:'100041',hands:'100061',legs:'100031',feet:'100041',back:'100061',weapon:'100011'};
 const preview=previewAppearance(s,selection);expect(s).toEqual(before);expect(preview.selection).toEqual(selection);
 for(const slot of appearanceSlots)expect(preview.resolvedAppearance.parts[slot].setId).toBe(selection[slot]);
 applyAppearance(s,selection);expect(resolveBuild(s)).toEqual(build);expect(s.build).toBe(before.build);expect(s.revision).toBe(before.revision);expect([s.gold,s.material,s.xp]).toEqual([before.gold,before.material,before.xp]);
});
it('rejects incompatible weapon cosmetics and resolves automatic fallback after switching real weapons',()=>{
 const s=player();expect(()=>previewAppearance(s,{weapon:'100031'})).toThrow('主手类型');
 applyAppearance(s,{weapon:'100011',head:'100061'});s.equipment.weapon=s.gear.find(g=>g.base==='bow')!.id;
 expect(resolveAppearance(s)).toMatchObject({family:'bow',parts:{head:{setId:'100061'},weapon:{setId:'400104'}}});
 expect(appearanceView(s).resolvedAppearance.family).toBe('bow');expect(()=>previewAppearance(s,{weapon:'100011'})).toThrow('主手类型');
 s.equipment.weapon=s.gear.find(g=>g.base==='blade')!.id;expect(resolveAppearance(s).parts.weapon.setId).toBe('100011');
 delete s.equipment.weapon;expect(resolveAppearance(s)).toMatchObject({family:'fist',parts:{weapon:{setId:'100061'}}});
});
it('owns only starters and confirmed equipment or regions, persisting collection after salvage',()=>{
 const s=player(),view=appearanceView(s);expect(view.catalog.filter(b=>b.owned).length).toBeLessThan(view.catalog.length);
 const collection=appearanceContent.bundles.find(b=>b.unlock.type==='gear'&&b.unlock.base==='charm')!;
 expect(s.appearance!.unlocked).toContain(collection.id);s.gear=s.gear.filter(g=>g.base!=='charm');expect(appearanceView(s).catalog.find(b=>b.id===collection.id)!.owned).toBe(true);
 const region=appearanceContent.bundles.find(b=>b.unlock.type==='region')!;expect(()=>previewAppearance(s,{head:region.id})).toThrow('尚未收集');
 if(region.unlock.type!=='region')throw Error('Test configuration');s.progress.regions.push(region.unlock.region);ensureAppearance(s);expect(()=>previewAppearance(s,{head:region.id})).not.toThrow();
});

// 脸固定：穿戴只换衣服/鞋/武器；后发跟脸，背饰跟衣服。
import {makeGearByBase} from '../packages/rules/index.ts';
const backOf=(id:string)=>appearanceContent.bundles.find(b=>b.id===id)!.back;
function wearable(slot:string,pick:(setId:string)=>boolean){
 for(const [base,m] of Object.entries(appearanceContent.equipment)){if(!pick(m.setId))continue;try{const g=makeGearByBase(base,randomUUID());if(g.slot===slot)return g;}catch{}}
 throw Error('No '+slot+' gear for test');
}
function wear(s:CharacterState,...items:ReturnType<typeof wearable>[]){for(const g of items){s.gear.push(g);(s.equipment as Record<string,string>)[g.slot]=g.id;}return resolveAppearance(s).parts;}
it('helmets never replace the face; the face only changes through the appearance choice',()=>{
 const s=player(),helmet=wearable('helmet',id=>id!==appearanceContent.defaultSet);
 expect(wear(s,helmet).head.setId).toBe(appearanceContent.defaultSet);
 const choice=appearanceContent.bundles.find(b=>b.unlock.type==='starter'&&b.id!==appearanceContent.defaultSet)!;applyAppearance(s,{head:choice.id});
 expect(resolveAppearance(s).parts.head.setId).toBe(choice.id);
});
it('rear hair follows the face and back gear follows the clothes',()=>{
 const hairArmor=wearable('armor',id=>backOf(id)==='hair'),s=player(),parts=wear(s,hairArmor);
 const clothes=appearanceContent.equipment[hairArmor.base].setId;
 expect(parts.body.setId).toBe(clothes);expect(parts.hands.setId).toBe(clothes);expect(parts.legs.setId).toBe(clothes);
 expect(parts.back.setId).not.toBe(clothes);expect(backOf(parts.back.setId)).not.toBe('hair');
 const t=player();let gearArmor;try{gearArmor=wearable('armor',id=>backOf(id)==='gear');}catch{}
 // 目前没有衣服对应带背饰的套装；一旦有，背饰必须跟着衣服显示。
 if(gearArmor)expect(wear(t,gearArmor).back.setId).toBe(appearanceContent.equipment[gearArmor.base].setId);
 const hairFace=appearanceContent.bundles.find(b=>b.back==='hair'&&b.unlock.type==='starter')!;applyAppearance(t,{head:hairFace.id});
 expect(resolveAppearance(t).parts.back.setId).toBe(hairFace.id);
});
it('boots change only the feet',()=>{
 const s=player(),before=resolveAppearance(s).parts,boots=wearable('boots',id=>id!==before.feet.setId),after=wear(s,boots);
 expect(after.feet.setId).toBe(appearanceContent.equipment[boots.base].setId);
 for(const slot of appearanceSlots)if(slot!=='feet')expect(after[slot]).toEqual(before[slot]);
});
it('the default set has an empty back so it is a safe fallback',()=>{expect(backOf(appearanceContent.defaultSet)).toBe('none');});
