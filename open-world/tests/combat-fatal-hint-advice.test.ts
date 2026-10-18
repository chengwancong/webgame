import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
// B2 §6: directed tests for the killing blow, the hint fallback and the advice table.
import {it,expect} from 'vitest';
import {observeCombatReview,newCombatReview,resolveCombatReview,type CombatReviewHit,type CombatReviewRecord} from '../packages/simulation/combat-review.ts';
import {deathCause,selectCombatAdvice,maxCombatAdvice} from '../packages/rules/combat-advice.ts';
import {defaultSkillHint,skillHint,statusLabelList,maxSkillHintChars} from '../packages/content/combat-hints.ts';
import {monsterSkills,chapterBossSkills} from '../packages/content/chapter-combat.ts';
import {islandMonsterSkills,islandBossProfiles} from '../packages/content/island-enemy-combat.ts';
import {combatReviewSchema,combatFatalHitSchema} from '../packages/contracts/combat-review.ts';
import {combatReviewHtml,combatFatalHitHtml,combatAdviceHtml} from '../apps/web/src/combat-review-view.ts';
import {report,hits} from '../tools/copy-voice-scan.ts';
import type {CombatHitKind} from '../packages/contracts/combat-review.ts';
import type {DamageType,StatusKind} from '../packages/contracts/skill-mechanics.ts';

const hit=(over:Partial<CombatReviewHit>):CombatReviewHit=>({source:'霜狼',skill:'撕咬',amount:120,kind:'melee',damageType:'physical',statuses:[],hint:'它会贴近你再出手',...over});
const record=(hits:CombatReviewHit[]):CombatReviewRecord=>({lastTick:0,recent:{hero:hits}});

it('the killing blow is the last of the five recorded hits, the rest stay collapsed',()=>{
 // 记录端只留最近 5 次（observeCombatReview 里 shift），这里构造已满的 5 条。
 const m=record([hit({skill:'一',amount:10}),hit({skill:'二',amount:20}),hit({skill:'三',amount:30}),hit({skill:'四',amount:40}),hit({skill:'五',amount:50})]);
 const review=resolveCombatReview(m,'hero');combatReviewSchema.parse(review);
 expect(review.fatal?.skill).toBe('五');expect(review.fatal?.damage).toBe(50);
 // 主界面只显示这一条，其余最多 4 条进折叠区。
 expect(review.recent.length).toBe(4);expect(review.recent.join('')).not.toContain('五：50');
 expect(review.recent[0]).toContain('四：40');
});
it('a fatal hit carries enemy, move, damage, damage type, statuses and one hint',()=>{
 const review=resolveCombatReview(record([hit({source:'骨龙',skill:'烈焰吐息',amount:432.6,kind:'zone',damageType:'fire',statuses:['burn' as StatusKind],hint:'前方会烧起来，别站在正对面'})]),'hero');
 combatFatalHitSchema.parse(review.fatal);
 expect(review.fatal).toMatchObject({enemy:'骨龙',skill:'烈焰吐息',damage:433,damageType:'火焰',statuses:['灼烧'],hint:'前方会烧起来，别站在正对面'});
});
it('no record means no invented killer',()=>{const review=resolveCombatReview(undefined,'hero');expect(review.fatal).toBeNull();expect(review.advice).toEqual([]);expect(review.recent).toEqual([]);});

it('every authored and generated enemy move falls back to a typed hint within the limit',()=>{
 const authored:{id:string;name:string;hint?:string;kind:string;damageType?:DamageType|null}[]=[...Object.values(monsterSkills)];
 for(const boss of Object.values(chapterBossSkills))for(const s of boss.skills??[])authored.push(s);
 // 岛屿生成的首领技能在构建时并入 chapterBossSkills，这里连同生成的小怪技能一起查。
 const generated=[...Object.values(islandMonsterSkills),...Object.values(islandBossProfiles).flatMap(b=>b.skills??[])];
 expect(authored.length).toBeGreaterThan(10);expect(generated.length).toBeGreaterThan(50);
 for(const skill of [...authored,...generated]){
  const hint=skillHint(skill);
  expect(hint.length).toBeGreaterThan(0);expect(hint.length).toBeLessThanOrEqual(maxSkillHintChars);
 }
 expect(skillHint({kind:'zone',damageType:'fire'})).toBe(defaultSkillHint('zone','fire'));
 expect(skillHint({kind:'melee',hint:'它会绕到你身后出手'})).toBe('它会绕到你身后出手');
});
it('statuses render as short tags next to the move name',()=>{
 expect(statusLabelList([{kind:'slow' as StatusKind},{kind:'stun' as StatusKind},{kind:'slow' as StatusKind}])).toEqual(['减速','眩晕']);
 expect(statusLabelList(undefined)).toEqual([]);
 const html=combatFatalHitHtml({enemy:'骨龙',skill:'尾击重踏',damage:900,damageType:'物理',statuses:['减速','眩晕'],hint:'地面亮起后躲开',kind:'zone'});
 expect(html).toContain('骨龙 · 尾击重踏');expect(html).toContain('物理 900');expect(html).toContain('减速');expect(html).toContain('眩晕');
 expect(combatFatalHitHtml(null)).toContain('没记下这一击');
});

it('the death cause follows the move shape and element, not a skill id',()=>{
 expect(deathCause({kind:'melee' as CombatHitKind,damageType:'physical'})).toBe('burst');
 expect(deathCause({kind:'teleport' as CombatHitKind,damageType:'arcane'})).toBe('burst');
 expect(deathCause({kind:'summon' as CombatHitKind,damageType:'physical'})).toBe('burst');
 expect(deathCause({kind:'projectile' as CombatHitKind,damageType:'physical'})).toBe('area');
 expect(deathCause({kind:'zone' as CombatHitKind,damageType:'cold'})).toBe('element');
 expect(deathCause({kind:'melee' as CombatHitKind,damageType:'poison',statuses:['poison' as StatusKind]})).toBe('element');
});
it('each cause maps to at most three short buttons that open a real page',()=>{
 const labels=(c:Parameters<typeof selectCombatAdvice>[0],short=false)=>selectCombatAdvice(c,short).map(a=>a.label);
 expect(labels('burst')).toEqual(['控场技能','加生存天赋','强化护甲']);
 expect(labels('area')).toEqual(['加生存天赋','强化护甲']);
 expect(labels('element')[0]).toBe('换抗性装备');
 expect(labels('output')[0]).toBe('强化武器');
 for(const cause of ['burst','area','element','output','unknown'] as const){
  const advice=selectCombatAdvice(cause);
  expect(advice.length).toBeLessThanOrEqual(maxCombatAdvice);
  for(const a of advice){expect(a.label.length).toBeGreaterThan(0);expect(a.label.length).toBeLessThanOrEqual(6);expect(['skills','survival','damage','forge','bag']).toContain(a.target);}
  expect(new Set(advice.map(a=>a.label)).size).toBe(advice.length);
 }
 // 打不动首领时输出类建议排在前面，且不重复。
 const short=selectCombatAdvice('burst',true);
 expect(short.length).toBe(maxCombatAdvice);expect(short.map(a=>a.label)).toEqual(labels('output'));
 expect(selectCombatAdvice('area',true).map(a=>a.label)).toEqual(labels('output'));
});
it('a win has no killing-blow line and still shows the key progress',()=>{
 const review=resolveCombatReview(record([hit({skill:'烈焰吐息',amount:120,kind:'zone',damageType:'fire'})]),'hero');
 const won=combatReviewHtml(review,{stage:2,dungeon:null,materials:9,required:9,obtained:true},'这一场你赢了',false);
 expect(won).toContain('这一场你赢了');expect(won).not.toContain('你倒在了这里');
 expect(won).toContain('9 / 9');expect(won).toContain('钥匙已经到手');expect(won).not.toContain('review-fatal');expect(won).not.toContain('烈焰吐息');expect(won).not.toContain('试试这样做');
});
it('the settlement html shows one killing blow, its buttons and no measured numbers',()=>{
 const review=resolveCombatReview(record([hit({source:'霜狼',skill:'背刺',amount:880,kind:'melee',damageType:'physical',statuses:['slow' as StatusKind],hint:'它会绕到你身后出手'})]),'hero');
 const html=combatReviewHtml(review,{stage:7,dungeon:null,materials:4,required:12,obtained:false});
 expect(html).toContain('霜狼 · 背刺');expect(html).toContain('它会绕到你身后出手');expect(html).toContain('减速');
 expect(combatAdviceHtml(review.advice)).toContain('控场技能');
 expect(html).toContain('4 / 12');expect(html).toContain('会掉');
 for(const word of ['输出秒数','事件记录','占比','秒伤','DPS','阶段'])expect(html).not.toContain(word);
});
it('the settlement page has no banned words left',()=>{
 const found=report().bannedHits.filter(e=>e.group==='结算/失败页');
 expect(found.map(e=>`${e.file}:${e.line} [${e.words.join(',')}] ${e.text}`)).toEqual([]);
 expect(hits('你扛不住它的连击，先提升生存')).toEqual([]);
});

it('the hit event owns its damage type even when the skill default differs',()=>{
 const r=regionById('meadow'),w=new World(r,{hp:100,attack:10,armor:0,speed:6,mana:100,regen:0,effects:[]},[],r.spawns.slice(0,1)),review=newCombatReview();w.tick=1;
 observeCombatReview(review,w,[{type:'hit_resolved',id:w.playerId,sourceId:w.enemies[0].id,skill:'basic-melee',amount:7,damageType:'shadow',position:w.hero.position,tick:1}]);
 expect(resolveCombatReview(review,w.playerId).fatal?.damageType).toBe('暗影');
});
