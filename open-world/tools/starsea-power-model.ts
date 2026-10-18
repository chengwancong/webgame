// 星潮海强度模型：用真实规则（resolveBuild / applyItemPower / resolveMonsterSpawn）构造各等级的“期望角色”，
// 输出主力技能单次命中与同级怪物生命的比值。运行：npx tsx tools/starsea-power-model.ts [--json]
import {randomUUID} from 'node:crypto';
import {gearBases,instantiateGearTemplate,resolveBuild} from '../packages/rules/index.ts';
import {applyItemPower,stageForItemLevel,qualityMaxRank} from '../packages/rules/item-power.ts';
import {collectionEquipment} from '../packages/content/equipment-runtime.ts';
import {skillCatalog} from '../packages/content/index.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {starseaCampaign,islandBands,hardmodeBands,bossLevels} from '../packages/content/starsea/index.ts';
import {newStarseaState} from '../packages/rules/starsea.ts';
import {armorMitigation} from '../packages/rules/combat-numerics.ts';
import type {CharacterState,GearQuality,Slot} from '../packages/contracts/index.ts';

const expectedRank=[2,4,6,7,8,9,11,12];
const slots:Slot[]=['weapon','armor','helmet','boots','accessory','ring'];
const artTier=(L:number)=>L>=17?3:L>=10?2:1;
type Build='white'|'normal';
export function character(L:number,build:Build,gearLevel=L):CharacterState{
 const bandIndex=islandBands.findIndex(([,hi])=>L<=hi),chapter=bandIndex<0?6:bandIndex+1,hard=L>bossLevels.at(-1)!;
 // “普通”搭配是混穿：每个部位来自不同谱系，不触发套装（成型搭配才凑套装）。
 const families=['sword','hammer','axe','staff','hidden','wand'];
 const gear=slots.map((slot,i)=>{
  const t=gearBases.find(g=>g.slot===slot&&collectionEquipment(g.base)?.tier===artTier(gearLevel)&&collectionEquipment(g.base)?.series==='standard'&&collectionEquipment(g.base)?.family===families[i])!;
  const quality:GearQuality=build==='white'?'common':slot==='weapon'?'rare':'magic';
  const affixes=build==='white'||!['weapon','accessory','ring'].includes(slot)?[]:[{id:'a',name:'攻击',stat:'attack',value:3,tier:1,description:''},...(slot==='weapon'&&L>=10?[{id:'b',name:'暴击率',stat:'critChance',value:.05,tier:2,description:''}]:[])];
  const g=applyItemPower(instantiateGearTemplate(t,randomUUID(),quality,affixes as any),gearLevel);
  g.rank=build==='white'||L<10?0:Math.min(qualityMaxRank[quality],expectedRank[stageForItemLevel(gearLevel).tier-1]);return g;
 });
 const st=newStarseaState();
 // 主干模型按「起手技齐全、4 个槽」推导（docs/progression-goal-plan.md §0）：不套用开场后的招牌技封存与技能槽规则。
 delete st.prologue;
 // 已经超过的岛：首领已击败。
 for(let n=1;n<=6;n++)if(hard||L>bossLevels[n-1])st.bosses.push('ss-map-boss-'+n);
 st.hardmode=hard;
 const usable=skillCatalog.filter(s=>(!s.weapons?.length||s.weapons.includes('sword'))&&!s.activation&&s.unlockLevel<=L&&s.damage>0&&s.cooldown<=90&&!['shield','heal'].includes(s.kind));
 const main=usable.sort((a,b)=>b.damage-a.damage)[0];
 const rank=Math.min(5,1+Math.floor(L/6));
 return {id:randomUUID(),name:'model',revision:0,build:1,level:L,xp:0,gold:0,material:0,gear,equipment:Object.fromEntries(gear.map(g=>[g.slot,g.id])),skills:[main.id],skillRanks:{[main.id]:rank},skillBooks:{},progress:{kills:0,regions:[],bosses:[],safe:'ss-map-port',tasks:[]},starsea:st} as unknown as CharacterState;
}
const monster=(L:number,rank:'normal'|'elite'|'boss')=>{
 const t=rank==='boss'?starseaCampaign.bosses[0].id:starseaCampaign.monsters.find(m=>m.rank===(rank==='elite'?'elite':'normal'))!.id;
 return resolveMonsterSpawn({id:'m',template:t,level:L,rank,x:0,y:0});
};
const average=(s:CharacterState)=>{const b=resolveBuild(s),sk=b.resolvedSkills[0],crit=Math.min(.5,b.stats.critChance??0);return sk.damage*(1+crit*((b.stats.critMultiplier??1.5)-1));};
const main=/starsea-power-model\.ts$/.test(process.argv[1]??'');
// 怪物生命曲线：普通怪 = 2.5 × “普通”搭配平均命中（装备落后 2 级）；1–9 级保留新手曲线。
if(main&&process.argv.includes('--write')){const {runBalanceModel}=await import('./starsea-balance-model.ts');await runBalanceModel();process.exit(0);}
const fmt=(n:number)=>n>=1e8?(n/1e8).toFixed(2)+'亿':n>=1e4?(n/1e4).toFixed(1)+'万':String(Math.round(n));
const rows=[];
if(main)for(const L of [1,3,5,7,9,10,13,16,17,20,22,23,25,27,28,30,32,33,35,37,38,40,42,45,48,50]){
 const out:Record<string,unknown>={L};
 for(const build of ['white','normal'] as Build[]){
  const s=character(L,build),b=resolveBuild(s),sk=b.resolvedSkills[0],crit=Math.min(.5,b.stats.critChance??0),avg=sk.damage*(1+crit*((b.stats.critMultiplier??1.5)-1));
  const n=monster(L,'normal'),e=monster(L,'elite'),boss=monster(L,'boss');
  out[build]={skill:sk.id,attack:b.stats.attack,add:b.stats.damageAdd,mult:b.stats.damageMult,hit:sk.damage,avg:Math.round(avg),normalHits:+(n.hp/avg).toFixed(1),eliteHits:+(e.hp/avg).toFixed(1),bossHits:+(boss.hp/avg).toFixed(0),hp:b.stats.hp,armor:b.stats.armor,
   // 同级普通怪单次攻击占角色生命的比例
   taken:+(armorMitigation(n.attack,b.stats.armor).damage/b.stats.hp*100).toFixed(1)};
 }
 rows.push(out);
}
if(!main){}else if(process.argv.includes('--json'))console.log(JSON.stringify(rows,null,1));
else{
 console.log('L  | 普通: 攻击  [+]   [×]   命中     平均   | 普通怪 精英 首领 (下) | 生命 护甲 受击% | 白板: 命中 普通怪(下)');
 for(const r of rows as any[]){const n=r.normal,w=r.white;console.log(`${String(r.L).padStart(2)} | ${String(n.attack).padStart(6)} ${n.add.toFixed(2)} ${n.mult.toFixed(2).padStart(5)} ${fmt(n.hit).padStart(7)} ${fmt(n.avg).padStart(7)} | ${String(n.normalHits).padStart(5)} ${String(n.eliteHits).padStart(5)} ${String(n.bossHits).padStart(5)} | ${String(n.hp).padStart(5)} ${String(n.armor).padStart(4)} ${String(n.taken).padStart(5)} | ${fmt(w.hit).padStart(7)} ${w.normalHits} (${n.skill})`);}
}
