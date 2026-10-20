import {expect,it} from 'vitest';
import type {CharacterState,Stats} from '../packages/contracts/index.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {statusEffectSchema} from '../packages/contracts/skill-mechanics.ts';
import {newCombatReview,observeCombatReview,resolveCombatReview} from '../packages/simulation/combat-review.ts';
import {gapDiagnosis} from '../packages/rules/gap-diagnosis.ts';
import {ensureProgression} from '../packages/rules/deep-progression.ts';
import {craftRecipes} from '../packages/content/crafting.ts';
import {ensureCrafting,previewCraft} from '../packages/rules/crafting.ts';
import {newStarseaState,starseaView} from '../packages/rules/starsea.ts';
import {starseaBossMaps,starseaIslands} from '../packages/content/starsea/index.ts';

const character=():CharacterState=>({id:crypto.randomUUID(),name:'报告回归',revision:3,build:1,level:10,xp:0,gold:0,material:0,gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:['ss-map-wind','ss-map-mist'],bosses:[],safe:'ss-map-port',tasks:[]}});
const potion=()=>craftRecipes.find(r=>r.output.kind==='consumable'&&r.output.stat==='shadowResist')!;

it('does not send a failure to an unlearned potion or mutate an old state',()=>{
 const s=character(),before=structuredClone(s);
 expect(gapDiagnosis(s,{damageType:'shadow'})).toBe('暗影抗不足 → 换抗性装备');
 expect(s).toEqual(before);
});
it('an owned resistance potion is usable without learning its recipe or opening its source island',()=>{
 const s=character();ensureProgression(s).consumables[potion().output.id!]=1;const before=structuredClone(s);
 expect(gapDiagnosis(s,{damageType:'暗影'})).toContain('背包已有');
 expect(gapDiagnosis(s,{damageType:'暗影'})).toContain(potion().name);
 expect(s).toEqual(before);
});
it('a known potion checks actual crafting conditions and never claims an unaffordable craft is ready',()=>{
 const s=character(),r=potion(),p=ensureProgression(s);s.progress.regions.push(r.island!);p.recipes.push(r.id);const c=ensureCrafting(s);c.professions[r.profession].level=50;
 if(r.facilityRequired)c.facilities[r.facilityRequired.id]=r.facilityRequired.level;
 const place={atForge:true,storyUnlocked:true,reason:'',maxCraftLevel:99};
 const blocked=previewCraft(s,{op:'craft',recipe:r.id},place);expect(blocked.enabled).toBe(false);
 const advice=gapDiagnosis(s,{damageType:'shadow'})!;expect(advice).toContain(blocked.reason);expect(advice).not.toContain('工坊可制作');expect(advice.length).toBeLessThanOrEqual(60);
 s.gold=1e9;for(const [id,n] of Object.entries(r.baseCost.materials))p.materials[id]=n+100;s.material=999;
 expect(previewCraft(s,{op:'craft',recipe:r.id},place).enabled).toBe(true);
 expect(gapDiagnosis(s,{damageType:'shadow'})).toContain('工坊可制作');
});

it('real periodic damage remains in cumulative and omitted damage and is not called a basic melee attack',()=>{
 const stats:Stats={hp:100,attack:1,armor:0,speed:6,mana:100,regen:0,effects:[]};
 const w=new World(regionById('meadow'),stats,[],[]),record=newCombatReview('server');
 w.applyStatus(w.playerId,statusEffectSchema.parse({kind:'burn',duration:8,interval:1,total:80,strength:0,damageType:'fire',scope:'hit',cleanse:true}),'hazard','report-dot-hazard');
 for(let n=0;n<8;n++){w.step();observeCombatReview(record,w);observeCombatReview(record,w);}
 const review=resolveCombatReview(record,w.playerId);
 expect(review.totalTaken).toBe(100-w.hero.hp);expect(review.totalTaken).toBe(80);expect(review.omittedTaken).toBe(30);
 expect(review.fatal).toMatchObject({skill:'灼烧持续伤害',damage:10,damageType:'火焰',statuses:['灼烧'],kind:'zone'});
 expect(review.recent).toHaveLength(4);expect(review.recent.every(h=>h.includes('灼烧持续伤害'))).toBe(true);
 expect(review.omittedTaken!+review.fatal!.damage+4*10).toBe(review.totalTaken);
});
it('authored hit labels retain the actual applied DOT status from the executor event',()=>{
 const w=new World(regionById('meadow'),{hp:100,attack:1,armor:0,speed:6,mana:100,regen:0,effects:[]},[],[]),record=newCombatReview();w.tick=1;
 observeCombatReview(record,w,[{type:'hit_resolved',id:w.playerId,position:w.hero.position,tick:1,amount:8,category:'periodic',damageType:'poison',status:'poison',skill:'basic-ranged'}]);
 expect(resolveCombatReview(record,w.playerId).fatal?.statuses).toEqual(['中毒']);
});

it.each([1,2])('after %i cleared island bosses an automatic onboarding tracker does not replace the next boss',cleared=>{
 const s=character();s.level=cleared===1?10:17;s.lastRegion='ss-map-port';s.starsea=newStarseaState();s.starsea.islands=starseaIslands.slice(0,cleared+1);s.starsea.bosses=starseaBossMaps.slice(0,cleared);
 const view=starseaView(s)!;expect(view.tracked).toBeNull();expect(view.recommend).toMatchObject({kind:'stage',map:starseaIslands[cleared]});
});
it('a manually selected unfinished task is preserved rather than falsely completing player progress',()=>{
 const s=character();s.level=17;s.lastRegion='ss-map-port';s.starsea=newStarseaState();s.starsea.islands=starseaIslands.slice(0,3);s.starsea.bosses=starseaBossMaps.slice(0,2);s.starsea.trackedManually=true;
 const tracked=s.starsea.tracked,done=[...s.starsea.done];const view=starseaView(s)!;expect(view.tracked).toBe(tracked);expect(s.starsea.done).toEqual(done);
});
