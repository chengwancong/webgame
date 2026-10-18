import {it,expect} from 'vitest';
import {makeGear,resolveBuild,resolveSkillAccess} from '../packages/rules/index.ts';
import {makeStarseaStarterWeapon} from '../packages/rules/starsea-starter.ts';
import {newStarseaState} from '../packages/rules/starsea.ts';
import {choosePrologueWeapon,finishPrologue} from '../packages/rules/starsea-prologue.ts';
import {applySkillRecovery,grantRouteSkill,skillSlotCount,signatureSealed,skillSealed,skillRecoveryView,spellIsland} from '../packages/rules/skill-recovery.ts';
import {prologueConfig} from '../packages/content/starsea/prologue.ts';
import {starterSkills,skillCatalog} from '../packages/content/index.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
// 招牌技找回、技能槽、法术按岛（docs/progression-goal-plan.md §4、§11.3：技能一个一个给）。
let n=0;const uuid=()=>'00000000-0000-4000-8000-'+String(++n).padStart(12,'0');
function character(family?:'sword'|'staff'|'hidden'):CharacterState{
 const gear=[makeStarseaStarterWeapon(uuid()),makeGear(2,uuid())];
 const start=family?prologueConfig.families.sword.starterSkills:starterSkills;
 const s={field:{gathered:[]},id:uuid(),name:'t',revision:0,build:1,level:1,xp:0,gold:0,material:0,gear,equipment:{weapon:gear[0].id,armor:gear[1].id},weaponLoadouts:{},skills:[...start],skillRanks:Object.fromEntries(start.map(id=>[id,1])),skillBooks:{},progress:{kills:0,regions:[],bosses:[],safe:'ss-map-wind',tasks:[]},starsea:newStarseaState()} as CharacterState;
 if(family){s.starsea!.prologue={done:false};choosePrologueWeapon(s,family);finishPrologue(s);}else delete s.starsea!.prologue;
 return s;
}
const finish=(s:CharacterState,task:string)=>{s.starsea!.done.push(task);const g={messages:[] as string[]};applySkillRecovery(s,task,g);return g.messages;};
const live=(s:CharacterState)=>resolveBuild(s).resolvedSkills.map(k=>k.id);
const access=(s:CharacterState,id:string)=>resolveSkillAccess(s).find(q=>q.id===id)!;

const choose=(s:CharacterState,choice:'a'|'b')=>{s.starsea!.quests['ss-c01-t04']={step:1,attempt:0,acceptedAt:0,choice};const g={messages:[] as string[]};grantRouteSkill(s,'ss-c01-t04',choice,g);return g.messages;};
it('sword: one skill at a time — cut, whirl, ward, route gift with slot 4, vortex blade swaps ward out',()=>{
 const s=character('sword');
 expect(s.skills).toEqual(['cut']);expect(live(s)).toEqual(['cut']);expect(skillSlotCount(s)).toBe(3);
 expect(signatureSealed(s,'whirl')).toBe(true);
 expect(access(s,'whirl')).toMatchObject({activated:false,eligible:false,blocked:'recovery',activation:{type:'recovery',task:'ss-c01-t01',order:1}});
 expect(access(s,'ward')).toMatchObject({activated:false,eligible:false,blocked:'task',activation:{type:'task',task:'ss-c01-t03'}});
 expect(finish(s,'ss-c01-t01')).toHaveLength(1);expect(live(s)).toEqual(['cut','whirl']);
 expect(finish(s,'ss-c01-t03')).toHaveLength(1);expect(skillSealed(s,'ward')).toBe(false);expect(live(s)).toEqual(['cut','whirl','ward']);
 expect(choose(s,'a')).toHaveLength(2);expect(skillSlotCount(s)).toBe(4);expect(live(s)).toEqual(['cut','whirl','ward','rush']);
 expect(finish(s,'ss-c01-t04')).toEqual([]);
 s.level=8;expect(access(s,'vortex_blade').blocked).toBe('recovery');
 const lines=finish(s,'ss-c01-t05');expect(lines).toHaveLength(2);expect(lines[1]).toContain('护身印');
 expect(s.skills).toEqual(['cut','whirl','vortex_blade','rush']);expect(access(s,'ward').activated).toBe(true);
 expect(skillRecoveryView(s)!.next).toMatchObject({skill:'leap_strike',task:'ss-c02-t03',order:3});
});
it('staff and hidden start with the weapon basic only; staff recovers chain at 落点求生',()=>{
 const s=character('staff');s.level=16;
 expect(live(s)).toEqual(['staff_strike']);
 for(const id of ['chain','nova','meteor','barrage'])expect(access(s,id).activation.type,id).toBe('recovery');
 finish(s,'ss-c01-t01');expect(live(s)).toEqual(['staff_strike','chain']);
 const h=character('hidden');expect(live(h)).toEqual(['throwing_knife']);finish(h,'ss-c01-t01');expect(live(h)).toEqual(['throwing_knife','fan_of_knives']);
});
it('spells need level plus the owning island: only 回春 belongs to 风栖; L14–15 moved to 赤炉',()=>{
 const s=character('hidden');s.level=10;
 expect(spellIsland('mend')).toBe('ss-map-wind');expect(spellIsland('frost')).toBe('ss-map-mist');expect(spellIsland('silence')).toBe('ss-map-mist');
 expect(spellIsland('arcane_missile')).toBe('ss-map-forge');expect(spellIsland('throwing_knife')).toBeUndefined();
 expect(access(s,'silence')).toMatchObject({eligible:false,blocked:'island',activation:{type:'island',island:'ss-map-mist',visited:false}});
 expect(access(s,'fireball').blocked).toBe('level');
 s.starsea!.islands.push('ss-map-mist');expect(access(s,'silence')).toMatchObject({eligible:true,action:'activate'});
 s.level=7;expect(access(s,'chain')).toMatchObject({activation:{type:'island',island:'ss-map-mist'}});
 const wind=skillRecoveryView(s)!.islands.find(i=>i.island==='ss-map-wind')!;expect(wind.skills).toEqual(['mend']);
});
it('route choice grants the matching weapon skill once per family',()=>{
 const s=character('sword');choose(s,'b');expect(s.skillRanks.dual_strike).toBe(1);
 const h=character('hidden');expect(choose(h,'a')).toHaveLength(2);expect(h.skillRanks.shadow_step).toBe(1);expect(h.skillRanks.dual_strike).toBeUndefined();
});
it('characters without a prologue keep the old rules',()=>{
 const s=character();s.level=8;
 expect(skillRecoveryView(s)).toBeUndefined();expect(skillSlotCount(s)).toBe(4);expect(signatureSealed(s,'whirl')).toBe(false);
 expect(live(s)).toContain('whirl');expect(access(s,'chain').activation.type).toBe(skillCatalog.find(k=>k.id==='chain')!.activation?'book':'level');
 const g={messages:[] as string[]};applySkillRecovery(s,'ss-c01-t05',g);expect(g.messages).toEqual([]);expect(s.skillRanks.blade_fury).toBeUndefined();
});
