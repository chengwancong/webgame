import {describe,it,expect} from 'vitest';
import {skillCatalog,regionById} from '../packages/content/index.ts';
import {skillSchema,type Skill} from '../packages/contracts/index.ts';
import {skillPatchSchema} from '../packages/contracts/skill-patches.ts';
import {applySkillPatches} from '../packages/rules/skill-patches.ts';
import {permitsWeapon} from '../packages/contracts/weapons.ts';
import {World} from '../packages/simulation/index.ts';
const skill=(id:string)=>structuredClone(skillCatalog.find(s=>s.id===id)!);
describe('server skill parameter patches',()=>{
 it('clones its input, rederives elemental tags and shares radius with explosion judgement',()=>{
  const raw=skill('fireball'),before=structuredClone(raw);
  const out=applySkillPatches(raw,[{skills:['fireball'],ops:[{path:'mechanics.damageType',op:'set',value:'cold'},{path:'projectiles',op:'add',value:2},{path:'radius',op:'mul',value:1.3},{path:'damage',op:'mul',value:1.35}]}]);
  expect(out.projectiles).toBe(3);expect(out.damage).toBe(Math.round(raw.damage*1.35));expect(out.mechanics!.projectile!.explosionRadius).toBe(out.radius);
  expect(out.tags).toContain('cold');expect(out.tags).not.toContain('fire');expect(raw).toEqual(before);expect(skillSchema.safeParse(out).success).toBe(true);
 });
 it('supports return arrows without copying a skill identifier into the executor',()=>{
  const out=applySkillPatches(skill('fire_arrow'),[{tags:['projectile'],ops:[{path:'mechanics.projectile.returns',op:'set',value:true}]}]);
  expect(out.mechanics!.projectile!.returns).toBe(true);
 });
 it('requires all supplied filters and derives tags after each previous patch',()=>{
  const raw=skill('fireball');
  const out=applySkillPatches(raw,[{skills:['fire_arrow'],tags:['fire'],ops:[{path:'damage',op:'mul',value:10}]},{ops:[{path:'mechanics.damageType',op:'set',value:'cold'}]},{tags:['cold'],ops:[{path:'damage',op:'mul',value:2}]}]);
  expect(out.damage).toBe(raw.damage*2);
 });
 it('appends validated status definitions without aliasing either source',()=>{
  const raw=skill('cut'),status={kind:'slow',scope:'hit',duration:60,strength:.3,cleanse:true};
  const out=applySkillPatches(raw,[{ops:[{path:'mechanics.statuses',op:'append',value:[status]}]}]);
  expect(out.mechanics!.statuses.at(-1)!.kind).toBe('slow');out.mechanics!.statuses.at(-1)!.strength=.2;
  expect(status.strength).toBe(.3);expect(raw.mechanics!.statuses).not.toContainEqual(status);
 });
 it.each(['__proto__.polluted','constructor.prototype.polluted','mechanics.unknown','mechanics.zone'])('rejects unregistered path %s',path=>{
  expect(()=>applySkillPatches(skill('cut'),[{ops:[{path,op:'set',value:1}]}] as never)).toThrow();expect(({} as any).polluted).toBeUndefined();
 });
 it.each([NaN,Infinity,'2',null])('rejects invalid numeric operands %s',value=>{
  expect(skillPatchSchema.safeParse({ops:[{path:'damage',op:'mul',value}]}).success).toBe(false);
 });
 it('rejects schema-invalid results rather than silently clamping content',()=>{
  expect(()=>applySkillPatches(skill('fireball'),[{ops:[{path:'projectiles',op:'set',value:100}]}])).toThrow();
  expect(()=>applySkillPatches(skill('fireball'),[{ops:[{path:'mechanics.damageType',op:'set',value:'unregistered'}]}])).toThrow();
  expect(()=>applySkillPatches(skill('cut'),[{ops:[{path:'mechanics.statuses',op:'append',value:[{kind:'poison',scope:'hit',duration:90,strength:0,cleanse:true}]}]}])).toThrow();
 });
 it('updates the declared cooldown resolution with the final patched cooldown',()=>{
  const raw=skill('cut');raw.resolution={attackShare:1,baseCooldown:raw.cooldown,skillCooldownReduction:0,statsCooldownReduction:0,effectiveCooldownReduction:0,cooldownCap:.75,finalCooldown:raw.cooldown};
  const out=applySkillPatches(raw,[{ops:[{path:'cooldown',op:'mul',value:.5}]}]);
  expect(out.cooldown).toBe(Math.round(raw.cooldown*.5));expect(out.resolution!.finalCooldown).toBe(out.cooldown);expect(out.resolution!.baseCooldown).toBe(out.cooldown);
 });
 it('retains the RS half split for transformed hit poison while leaving zone poison independent',()=>{
  const poison=skill('poison_arrow'),changed=applySkillPatches(poison,[{ops:[{path:'damage',op:'mul',value:3}]}]);expect(changed.damage).toBe(84);expect(changed.mechanics!.statuses.find(s=>s.kind==='poison')!.total).toBe(42);expect(poison.mechanics!.statuses.find(s=>s.kind==='poison')!.total).toBe(14);
  const zone=skill('miasma'),total=zone.mechanics!.statuses.find(s=>s.kind==='poison')!.total;expect(applySkillPatches(zone,[{ops:[{path:'damage',op:'mul',value:3}]}]).mechanics!.statuses.find(s=>s.kind==='poison')!.total).toBe(total);
  expect(()=>applySkillPatches(poison,[{ops:[{path:'mechanics.statuses',op:'set',value:[{...poison.mechanics!.statuses[0],total:-1}]}]}])).toThrow('Invalid');
 });
 it('can declare a transformation-specific weapon allowance without widening the original skill',()=>{
  const raw=skill('whirl'),out=applySkillPatches(raw,[{skills:['whirl'],ops:[{path:'weapons',op:'set',value:['sword','hammer','axe']}]}]);expect(permitsWeapon(raw.weapons??[],'hammer')).toBe(false);expect(permitsWeapon(out.weapons??[],'hammer')).toBe(true);expect(permitsWeapon(out.weapons??[],'bow')).toBe(false);expect(()=>applySkillPatches(raw,[{ops:[{path:'weapons',op:'set',value:['unknown']}]}])).toThrow();
 });
 it('the combat executor consumes the transformed allowance and leaves an untransformed hammer cast blocked',()=>{
  const raw=skill('whirl'),out=applySkillPatches(raw,[{skills:['whirl'],ops:[{path:'weapons',op:'set',value:['sword','hammer','axe']}]}]),make=(s:Skill)=>{const w=new World({...regionById('meadow'),obstacles:[],safe:{x:10,y:10}},{weapon:'hammer',hp:1000,attack:20,armor:20,speed:6,mana:500,regen:0,effects:[]},[s],[{id:'t',name:'靶',kind:'ranged',x:12,y:10,hp:10000,attack:0,boss:false,elite:false,art:'raider'}]);w.setMode('manual');w.enemies[0].cooldown=100000;return w;},blocked=make(raw),enabled=make(out);
  expect(blocked.cast('whirl',blocked.enemies[0])).toBe(false);expect(blocked.lastCastFailure).toBe('weapon');expect(enabled.cast('whirl',enabled.enemies[0])).toBe(true);for(let i=0;i<out.windup+1;i++)enabled.step();expect(enabled.enemies[0].hp).toBeLessThan(10000);
 });
});

it('explicit whole-skill periodic scaling preserves poison inclusion and independent zone budgets',()=>{
 const patch={scalePeriodicBudget:true,ops:[{path:'damage' as const,op:'mul' as const,value:3}]},fire=applySkillPatches(skill('fire_arrow'),[patch]),hit=applySkillPatches(skill('poison_arrow'),[patch]),zone=applySkillPatches(skill('miasma'),[patch]);
 expect(fire.damage).toBe(90);expect(fire.mechanics!.statuses.find(s=>s.kind==='burn')!.total).toBe(27);expect(hit.damage).toBe(84);expect(hit.mechanics!.statuses.find(s=>s.kind==='poison')!.total).toBe(42);expect(zone.damage).toBe(12);expect(zone.mechanics!.statuses.find(s=>s.kind==='poison')!.total).toBe(18);
 expect(skillPatchSchema.safeParse({scalePeriodicBudget:true,ops:[{path:'radius',op:'mul',value:2}]}).success).toBe(false);
});
