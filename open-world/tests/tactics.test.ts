// 27 号 R2 托管编排：规则层单测 + 验收（同一遭遇默认编排 vs 调整编排各 10 次，击杀时间或承伤要有可见差异）。
import {it,expect,describe} from 'vitest';
import rows from './fixtures/build-variety-r1/legacy-builds.json';
import {World} from '../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../packages/content/index.ts';
import {skillSchema,snapshotSchema,type CharacterState,type Spawn,type Skill} from '../packages/contracts/index.ts';
import {tacticsSchema,type Tactics} from '../packages/contracts/tactics.ts';
import {defaultTactics,resolveTactics,tacticsProblem} from '../packages/rules/tactics.ts';
import {saveLoadout,applyLoadout,loadoutDirty} from '../packages/rules/zhangjian.ts';
const skill=(id:string)=>skillSchema.parse(structuredClone(skillCatalog.find(s=>s.id===id)));
const mob=(id:string,kind:Spawn['kind'],x:number,y:number,hp:number,attack:number,elite=false):Spawn=>({id,name:id,kind,x,y,hp,attack,elite,boss:false,art:'raider'});
const jit=(seed:number,i:number)=>((seed*37+i*91)%17)/17-.5;
// 10 级角色的面板（level-stats：攻 30、速 6、蓝 100、回蓝 10），生命放大到不会倒下，承伤照记。
function fight(skills:Skill[],spawns:Spawn[],tactics:Tactics|undefined,seed:number){
 const w=new World({...regionById('meadow'),safe:{x:20,y:20},obstacles:[]},{hp:3000,attack:30,armor:0,speed:6,mana:100,regen:10,effects:[]},skills,spawns,[],seed);
 w.radius=60;w.setMode('auto');w.tactics=tactics;let taken=0,last=w.hero.hp,ticks=0;
 for(;ticks<30*120&&w.enemies.some(e=>e.alive);ticks++){w.step();taken+=Math.max(0,last-w.hero.hp);last=w.hero.hp;}
 return {ticks,taken,cleared:w.enemies.every(e=>!e.alive)};
}
function compare(skills:Skill[],spawns:(seed:number)=>Spawn[],tuned:Tactics){
 const mean=(t:Tactics)=>{const rs=Array.from({length:10},(_,i)=>fight(skills,spawns(i+1),t,i+1));expect(rs.every(r=>r.cleared)).toBe(true);return {ticks:rs.reduce((n,r)=>n+r.ticks,0)/10,taken:rs.reduce((n,r)=>n+r.taken,0)/10};};
 return {base:mean(resolveTactics(undefined,skills)),tuned:mean(tuned)};
}
const mage=[skill('arcane_missile'),skill('lance'),skill('fireball'),skill('meteor')],bow=[skill('bolt'),skill('pierce_arrow')],bow3=[skill('bolt'),skill('pierce_arrow'),skill('snipe')];

describe('编排规则',()=>{
 it('默认编排按技能栏顺序、最近目标、有投射物保持距离、保命开',()=>{
  expect(defaultTactics(mage)).toEqual({order:mage.map(s=>s.id),target:'near',stance:'range',survival:true,conditions:{}});
  expect(defaultTactics([skill('cut'),skill('whirl')]).stance).toBe('close');
 });
 it('存档编排对齐当前技能栏：卸下的去掉、新装的补在末尾、条件跟着走',()=>{
  const saved:Tactics={order:['meteor','gone','lance'],target:'elite',stance:'kite',survival:false,conditions:{meteor:'crowd',gone:'manual'}};
  expect(resolveTactics(saved,mage)).toEqual({order:['meteor','lance','arcane_missile','fireball'],target:'elite',stance:'kite',survival:false,conditions:{meteor:'crowd'}});
 });
 it('服务端校验：格式、重复、技能栏外的技能都拒',()=>{
  const ok={...defaultTactics(mage)};
  expect(tacticsProblem(ok,mage.map(s=>s.id))).toBe('');
  expect(tacticsProblem({...ok,target:'random'},mage.map(s=>s.id))).toBe('编排格式不对。');
  expect(tacticsProblem({...ok,order:['lance','lance']},mage.map(s=>s.id))).toBe('技能顺序里有重复。');
  expect(tacticsProblem({...ok,conditions:{snipe:'elite'}},mage.map(s=>s.id))).toBe('编排里有不在技能栏的技能。');
  expect(tacticsSchema.safeParse({...ok,script:'if hp<50'}).success).toBe(false);
 });
 it('编排随方案保存、切换方案换回各自的编排；方案没存编排就回默认',()=>{
  const s=structuredClone(rows[0].state) as unknown as CharacterState;
  saveLoadout(s,0);s.tactics={order:[...s.skills],target:'elite',stance:'kite',survival:false,conditions:{}};expect(loadoutDirty(s)).toBe(true);
  saveLoadout(s,1);expect(s.loadouts!.slots[1]!.tactics?.target).toBe('elite');
  applyLoadout(s,0);expect(s.tactics).toBeUndefined();
  applyLoadout(s,1);expect(s.tactics?.stance).toBe('kite');expect(loadoutDirty(s)).toBe(false);
  expect(snapshotSchema.shape.tactics.safeParse(s.tactics).success).toBe(true);
 });
 it('「不自动放」的技能自动战斗不放；没有编排的旧世界照旧逻辑',()=>{
  const sword=[skill('cut'),skill('whirl')],spawns=Array.from({length:4},(_,i)=>mob('m'+i,'melee',23,19+i*.6,400,1));
  const casts=(t:Tactics|undefined)=>{const w=new World({...regionById('meadow'),safe:{x:20,y:20},obstacles:[]},{hp:3000,attack:30,armor:0,speed:6,mana:100,regen:10,effects:[]},sword,spawns.map(s=>({...s})),[],3);w.radius=40;w.setMode('auto');w.tactics=t;const seen=new Set<string>();for(let i=0;i<240;i++){w.step();for(const e of w.events)if(e.type==='cast_started'&&e.skill)seen.add(e.skill);}return seen;};
  expect(casts({...defaultTactics(sword),conditions:{whirl:'manual'}}).has('whirl')).toBe(false);
  expect(casts(undefined).has('whirl')).toBe(true);
 });
});

describe('验收：默认 vs 调整，各 10 次',()=>{
 it('优先级：法师先攒蓝放陨石（只在扎堆时放），清一群怪明显更快',()=>{
  const pack=(seed:number)=>Array.from({length:7},(_,i)=>mob('m'+i,'melee',30+jit(seed,i)*2,20+(i-3)*.8,300,6));
  const r=compare(mage,pack,{...defaultTactics(mage),order:['meteor','fireball','lance','arcane_missile'],conditions:{meteor:'crowd'}});
  expect(r.tuned.ticks).toBeLessThan(r.base.ticks*.8);
 });
 it('站位：弓手风筝近战追兵，承伤明显更少（代价是打得稍慢）',()=>{
  const chasers=(seed:number)=>Array.from({length:3},(_,i)=>mob('c'+i,'melee',30+jit(seed,i)*3,17+i*3,420,14));
  const r=compare(bow,chasers,{...defaultTactics(bow),stance:'kite'});
  expect(r.tuned.taken).toBeLessThan(r.base.taken*.75);
 });
 it('目标：远程优先先点掉后排射手，承伤明显更少',()=>{
  const shooters=(seed:number)=>[...Array.from({length:5},(_,i)=>mob('m'+i,'melee',27+jit(seed,i),18+i,250,3)),mob('r0','ranged',33+jit(seed,8),17,250,12),mob('r1','ranged',33+jit(seed,9),23,250,12)];
  const r=compare(bow3,shooters,{...defaultTactics(bow3),target:'ranged'});
  expect(r.tuned.taken).toBeLessThan(r.base.taken*.8);
 });
 it('目标：精英优先先打掉高攻精英，更快且承伤更少',()=>{
  const brute=(seed:number)=>[...Array.from({length:5},(_,i)=>mob('m'+i,'melee',27+jit(seed,i),18+i,250,3)),mob('e0','melee',30+jit(seed,8),20,900,25,true)];
  const r=compare(bow3,brute,{...defaultTactics(bow3),target:'elite'});
  expect(r.tuned.ticks).toBeLessThan(r.base.ticks*.95);expect(r.tuned.taken).toBeLessThan(r.base.taken*.9);
 });
},60000);
