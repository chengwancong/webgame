import {it,expect} from 'vitest';
import {resolveMeasuredBuild} from '../tools/measured-build.ts';
import {campaignCharacter} from '../tools/campaign-model.ts';
import {armorMitigation,combatNumerics} from '../packages/rules/combat-numerics.ts';
import {gearContribution,makeGear} from '../packages/rules/index.ts';
import {gearSchema} from '../packages/contracts/index.ts';
import {generateAffixes,gearAffixConfig} from '../packages/rules/affix-generator.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {measureDungeon} from '../tools/dungeon-model.ts';
import recordedV2 from './fixtures/combat-numerics-v2.json';
it('fails an empty-rank measurement rather than publishing unarmed combat',()=>{const s=campaignCharacter('starter');s.skillRanks={};expect(()=>resolveMeasuredBuild(s)).toThrow('inactive');s.skillRanks=Object.fromEntries(s.skills.map(id=>[id,1]));expect(resolveMeasuredBuild(s).resolvedSkills.map(s=>s.id)).toEqual(s.skills);});
it('matches the official PoE 3.16 half-damage reference after explicit rating conversion',()=>{
 const reference={...combatNumerics.armor,ratingScale:1};
 expect(armorMitigation(2000,10000,reference)).toEqual({damage:1000,reduction:.5});
 expect(armorMitigation(5000,25000,reference)).toEqual({damage:2500,reduction:.5});
 expect(armorMitigation(2000,1000)).toEqual(armorMitigation(2000,10000,reference));
 expect(armorMitigation(9,4).damage).toBe(5);
 expect(armorMitigation(36,40).damage).toBe(11);
 expect(armorMitigation(144,40).damage).toBe(93);
});
it('gives progressively smaller reduction gains and keeps returns above the previous cap',()=>{
 const reductions=[0,20,40,60,80,100].map(a=>armorMitigation(36,a).reduction);
 const gains=reductions.slice(1).map((r,i)=>r-reductions[i]);
 for(let i=1;i<gains.length;i++){expect(gains[i]).toBeGreaterThan(0);expect(gains[i]).toBeLessThan(gains[i-1]);}
 expect(armorMitigation(36,80).reduction).toBeGreaterThan(.75);
 expect(armorMitigation(36,100).damage).toBeLessThan(armorMitigation(36,80).damage);
 expect(armorMitigation(36,160).reduction).toBeLessThan(.9);
 expect(armorMitigation(36,162).reduction).toBe(.9);
});
it('enforces the higher cap on actual integer damage, handles heavy hits and rejects invalid inputs',()=>{
 for(const hit of [1,2,9,10,35,36,99,144])for(const armor of [0,4,40,80,160,1000,Number.MAX_VALUE]){
  const r=armorMitigation(hit,armor);
  expect(r.reduction).toBeLessThanOrEqual(combatNumerics.armor.maxReduction);
  expect(r.damage).toBeGreaterThanOrEqual(Math.ceil(hit*(1-combatNumerics.armor.maxReduction)));
  expect(r.damage).toBeGreaterThanOrEqual(combatNumerics.armor.minimumDamage);
 }
 expect(armorMitigation(144,40).reduction).toBeLessThan(armorMitigation(36,40).reduction);
 expect(armorMitigation(0,1000).damage).toBe(0);
 for(const invalid of [NaN,Infinity,-1])expect(()=>armorMitigation(20,invalid)).toThrow();
});
it('reinforcement preserves starter returns and scales regional primary values, without reinforcing affixes',()=>{expect(gearContribution({...makeGear(1,'bow'),rank:3}).effective.attack).toBe(13);const sword={...makeGear(0,'sword'),attack:32,rank:5};expect(gearContribution(sword).enhancement.attack).toBe(15);expect(gearContribution(sword).effective.attack).toBe(47);const coat={...makeGear(2,'coat'),armor:14,rank:5};expect(gearContribution(coat).effective.armor).toBe(24);expect(gearContribution({...sword,affixes:[{id:'attack',name:'攻击',stat:'attack',value:20,tier:3 as const,description:'攻击 +20'}]})).toEqual(gearContribution(sword));});
it('rejects integer percentage affixes at the contract boundary and produces valid fractional values from the sole pool',()=>{const gear={...makeGear(0,crypto.randomUUID()),affixes:[{id:'crit',name:'暴击',tier:2,stat:'critChance',value:10,description:'10%'}]};expect(()=>gearSchema.parse(gear)).toThrow();gear.affixes[0].value=.1;expect(gearSchema.parse(gear).affixes[0].value).toBe(.1);for(const quality of ['magic','rare','legendary'] as const)for(let k=0;k<64;k++){const affixes=generateAffixes(quality,3);expect(new Set(affixes.map(a=>a.stat)).size).toBe(affixes.length);expect(()=>gearSchema.parse({...gear,affixes})).not.toThrow();}expect(gearAffixConfig.quality.legendary.count).toEqual([4,6]);});
it('restores current, v2 ratio and older flat combat checkpoints without changing their damage rule',()=>{
 const w=new World(regionById('meadow'),{hp:500,attack:20,armor:40,speed:6,mana:100,regen:0,effects:[]},[],[]),saved=w.exportCheckpoint();
 expect((World.restore(saved) as any).rules.combatNumerics.armor).toEqual(combatNumerics.armor);
 saved.data.rules.combatNumerics=structuredClone(recordedV2);
 const v2=World.restore(saved);(v2 as any).hurt(36);expect(v2.hero.hp).toBe(487);
 expect((World.restore(v2.exportCheckpoint()) as any).rules.combatNumerics.version).toBe(2);
 delete saved.data.rules.combatNumerics;
 const old=World.restore(saved);(old as any).hurt(36);expect(old.hero.hp).toBe(499);
 (w as any).hurt(36);expect(w.hero.hp).toBe(489);
});
it('rejects unknown or incomplete frozen armor rules instead of applying current defaults',()=>{
 const w=new World(regionById('meadow'),{hp:500,attack:20,armor:40,speed:6,mana:100,regen:0,effects:[]},[],[]),saved=w.exportCheckpoint();
 saved.data.rules.combatNumerics.armor.model='missing';expect(()=>World.restore(saved)).toThrow();
 saved.data.rules.combatNumerics.armor={...combatNumerics.armor,damageFactor:0};expect(()=>World.restore(saved)).toThrow();
 saved.data.rules.combatNumerics.armor={...combatNumerics.armor};saved.data.rules.combatNumerics.version=100;expect(()=>World.restore(saved)).toThrow('Unknown frozen');
 saved.data.rules.combatNumerics=null;expect(()=>World.restore(saved)).toThrow('Unknown frozen');
});
it('current numerical dungeon fixtures freeze the build and execute real skills with current goal and timer semantics',()=>{const d=structuredClone(dungeonContent.definitions.find(d=>d.id==='trial-meadow')!),s=campaignCharacter('starter');s.gear[0].attack=10000;const r=measureDungeon(d,[s],1,11);expect(r.success).toBe(true);expect(r.timeLimitSeconds).toBe(d.policy.timeLimitSeconds);expect(r.actors).toHaveLength(1);expect(r.actors[0].casts).toBeGreaterThan(0);expect(r.actors[0].skills).toEqual(s.skills);});
