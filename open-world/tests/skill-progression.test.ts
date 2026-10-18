import {it,expect} from 'vitest';
import type {CharacterState} from '../packages/contracts/index.ts';
import {skillCatalog,starterSkills,skillCategories} from '../packages/content/index.ts';
import {applyXp,migrateSkillActivation,resolveBuild,resolveSkillAccess,xpThreshold,makeGear} from '../packages/rules/index.ts';
const character=():CharacterState=>({id:'test',name:'测试',revision:0,build:1,level:1,xp:0,gold:90,material:8,gear:[makeGear(0,'sword')],equipment:{weapon:'sword'},skills:[...starterSkills],skillRanks:Object.fromEntries(starterSkills.map(id=>[id,1])),skillBooks:{},progress:{kills:0,regions:[],bosses:[],safe:'town',tasks:[]}});
it('only starters are activated; each other skill has exactly one activation route',()=>{
 const s=character(),access=resolveSkillAccess(s);expect(access.filter(sk=>sk.activated).map(sk=>sk.id)).toEqual(expect.arrayContaining(starterSkills));
 expect(new Set(skillCatalog.map(sk=>sk.category))).toEqual(new Set(Object.keys(skillCategories)));
 expect(access.find(sk=>sk.id==='whirl')).toMatchObject({activated:true,rank:1,action:'upgrade'});
 expect(access.find(sk=>sk.id==='ember')).toMatchObject({activated:false,activation:{type:'book',book:'ember',required:1,current:0},blocked:'book'});
});
it('confirmed XP enables free level activation without activating or equipping',()=>{
 const s=character();delete s.skillRanks.whirl;applyXp(s,xpThreshold(1));const quote=resolveSkillAccess(s).find(sk=>sk.id==='whirl')!;
 expect(s.level).toBe(2);expect(quote).toMatchObject({eligible:true,activated:false,rank:0,action:'activate',cost:{gold:0,material:0},affordable:true,current:null});expect(s.skills).toEqual(starterSkills);
});
it('skill-book activation depends on the correct book, not character level',()=>{
 const s=character();s.level=100;s.skillBooks={chain:1};expect(resolveSkillAccess(s).find(sk=>sk.id==='ember')!.eligible).toBe(false);
 s.level=1;s.skillBooks.ember=1;expect(resolveSkillAccess(s).find(sk=>sk.id==='ember')).toMatchObject({eligible:true,activated:false,action:'activate',affordable:true});
});
it('active skills expose upgrade quotes and previews owned by the server',()=>{
 const s=character(),quote=resolveSkillAccess(s).find(sk=>sk.id==='cut')!;expect(quote).toMatchObject({activated:true,rank:1,action:'upgrade',cost:{gold:60,material:0},affordable:true});expect(quote.next!.damage).toBeGreaterThan(quote.current!.damage);
 expect(quote.current!.damage).toBe(resolveBuild(s).resolvedSkills.find(sk=>sk.id==='cut')!.damage);
});
it('insufficient upgrade resources do not prevent an active skill being equipped',()=>{
 const s=character();s.gold=0;s.material=0;expect(resolveSkillAccess(s).find(sk=>sk.id==='cut')).toMatchObject({activated:true,affordable:false,blocked:'resource'});expect(resolveBuild(s).resolvedSkills.map(sk=>sk.id)).toEqual(starterSkills);
});
it('skill training needs gold only and leaves enhancement stones for equipment',()=>{
 const s=character();s.gold=60;s.material=0;
 expect(resolveSkillAccess(s).find(sk=>sk.id==='cut')).toMatchObject({cost:{gold:60,material:0},affordable:true});
});
it('max rank has neither a price nor a next rank and remains usable',()=>{
 const s=character();s.skillRanks.cut=5;expect(resolveSkillAccess(s).find(sk=>sk.id==='cut')).toMatchObject({activated:true,max:true,action:null,cost:null,next:null,affordable:false,blocked:'max'});expect(resolveBuild(s).resolvedSkills.some(sk=>sk.id==='cut')).toBe(true);
});
it('inactive skills cannot leak into the resolved battle loadout',()=>{
 const s=character();delete s.skillRanks.whirl;s.skills=['cut','whirl','ember'];expect(resolveBuild(s).resolvedSkills.map(sk=>sk.id)).toEqual(['cut']);
});
it('legacy migration preserves equipped skills, paid ranks and previous book-source progress',()=>{
 const s=character();s.skills=['cut','whirl','ward'];s.skillRanks={mend:3};s.progress.bosses=['meadow-boss'];migrateSkillActivation(s);
 expect(s.skillRanks).toMatchObject({cut:1,bolt:1,ward:1,whirl:1,mend:3});expect(s.skillBooks).toEqual({ember:1});expect(s.skills).toEqual(['cut','whirl','ward']);expect(s.gold).toBe(90);expect(s.revision).toBe(1);expect(s.build).toBe(2);
});
