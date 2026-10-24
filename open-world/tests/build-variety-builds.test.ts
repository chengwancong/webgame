import {it,expect} from 'vitest';
import {assembleBuildVariety,buildVarietyProfiles} from '../tools/build-variety-builds.ts';
import {gearSchema} from '../packages/contracts/index.ts';
import {equipmentItems} from '../packages/content/equipment-catalog.ts';
import {regionById} from '../packages/content/index.ts';
import {World} from '../packages/simulation/index.ts';
import {freezeItemRules} from '../packages/rules/item-issuance.ts';
import {makeGearByBase} from '../packages/rules/index.ts';
import {skillWeaponAllowed} from '../packages/rules/skill-weapon-access.ts';
import {randomUUID} from 'node:crypto';

for(const profile of buildVarietyProfiles)it(profile.id+' actually assembles its catalogue four-plus-two and executes the resolved primary skill',()=>{
 const before=freezeItemRules(),built=assembleBuildVariety(profile);
 expect(profile).not.toHaveProperty('preferredAugment');expect(built).not.toHaveProperty('augments');
 expect(built.acquisition.publicRulesUnmodified).toBe(true);expect(freezeItemRules()).toEqual(before);
 expect(built.state.gear).toHaveLength(6);expect(built.sets.find(s=>s.setId===profile.four)).toMatchObject({count:4,activeBonuses:[2,4]});expect(built.sets.find(s=>s.setId===profile.two)).toMatchObject({count:2,activeBonuses:[2]});
 for(const g of built.state.gear){expect(()=>gearSchema.parse(g)).not.toThrow();expect(g.base==='bow'||equipmentItems.some(i=>i.runtimeBase===g.base&&i.obtainable)).toBe(true);expect(new Set(g.affixes.map(a=>a.stat)).size).toBe(g.affixes.length);expect(g.affixes.some(a=>a.stat===g.mainStat?.stat)).toBe(false);}
 expect(built.state.gear.filter(g=>g.aspectId===profile.aspect)).toHaveLength(1);expect(built.build.skills.map(s=>s.id)).toEqual(profile.skills);
 const region={...structuredClone(regionById('meadow')),obstacles:[],safe:{x:10,y:10}};
 const skill=built.build.skills[0],target={id:'assembly-target',name:'装配靶',kind:'ranged' as const,boss:false,elite:false,hp:100000000,attack:0,armor:10,x:12,y:10,art:'raider'};
 const w=new World(region,built.build.stats,built.build.skills,[target],[],41);w.setMode('manual');w.hero.position={x:10,y:10};w.anchor={x:10,y:10};w.enemies[0].cooldown=100000;w.applyStatus(target.id,{kind:'root',duration:100000,strength:0,scope:'hit',cleanse:true});
 expect(w.cast(skill.id,w.enemies[0],{x:12,y:10}),w.lastCastFailure).toBe(true);
 const events=[...w.events];for(let i=0;i<160;i++){w.step();events.push(...w.events);}
 expect(events.some(e=>e.type==='cast_started'&&e.skill===skill.id)).toBe(true);
 expect(events.some(e=>e.type==='hit_resolved'&&e.id===target.id&&e.amount!>0)).toBe(true);
});
it('rejects impossible four-plus-two main-hand ownership instead of forging a set ID',()=>{
 const p=structuredClone(buildVarietyProfiles.find(p=>p.id==='quake')!);p.weapon='sword';expect(()=>assembleBuildVariety(p)).toThrow('Main-hand template');
});
it('keeps aspect-only hammer whirlwind permission conditional on a real worn core',()=>{
 const built=assembleBuildVariety(buildVarietyProfiles.find(p=>p.id==='quake')!);expect(skillWeaponAllowed(built.state,'whirl')).toBe(true);
 delete built.state.gear.find(g=>g.aspectId===built.profile.aspect)!.aspectId;expect(skillWeaponAllowed(built.state,'whirl')).toBe(false);
 const bare=makeGearByBase('standard-hammer-t1-weapon',randomUUID());expect(skillWeaponAllowed({gear:[bare],equipment:{weapon:bare.id}},'whirl')).toBe(false);
});
