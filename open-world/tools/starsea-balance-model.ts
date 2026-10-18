// 数值来源已迁到 tools/spine；本文件保留历史探针，正式派生请使用 pnpm spine:check 与主干CLI。
// Sole numerical generator for starsea. Measurements consume the real frozen
// World, resolved equipment, skills, armor and monster catalogue, at 30 Hz.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {World,walkable,distance} from '../packages/simulation/index.ts';
import {resolveBuild,xpThreshold,applyXp} from '../packages/rules/index.ts';
import {resolveMonsterSpawn,monsterLevelValues} from '../packages/rules/monster-stats.ts';
import {monsterContent,resolveMonsterContent,type MonsterContent} from '../packages/content/monsters.ts';
import {starseaCampaign,starseaRegions,starseaMaps,starseaIslands,placementLevel,starseaBalance,bossLevels} from '../packages/content/starsea/index.ts';
import {campLevel,campMembers} from '../packages/rules/world-camps.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import '../packages/content/open-world/index.ts';
import {tasks,chapters} from '../packages/content/task-tables.ts';
import {skillCatalog,type Region} from '../packages/content/index.ts';
import {starseaKillReward} from '../apps/api/src/economy.ts';
import {versions,type CharacterState,type Spawn} from '../packages/contracts/index.ts';
import type {MonsterRank} from '../packages/contracts/monsters.ts';
import {character} from './starsea-power-model.ts';
import {starseaTaskSteps} from '../packages/rules/starsea.ts';
import encounterBalance from '../packages/content/encounter-balance.json';

export const TARGET={normal:{ttk:2.5,ttd:40},elite:{ttk:10,ttd:20},boss:{ttk:[60,75,75,75,75,75],ttd:30}};
export const SEEDS=[11,23,47,71,101];
export const STARTER_WEAPON={template:'standard-sword-t1-weapon',quality:'rare',attackAffix:3};
export const STARTER_JEWELRY=[{template:'standard-hidden-t1-necklace',slot:'accessory',quality:'magic',attackAffix:3},{template:'standard-wand-t1-ring',slot:'ring',quality:'magic',attackAffix:3}];
const DPS_SECONDS=30,TTD_SECONDS=60,FIGHT_LIMIT=180,ITERATIONS=6,ERROR=.05;
const style:Record<string,[number,number]>={melee:[1,1],ranged:[.85,1.1],shaman:[.85,1.05],charger:[.95,1],guard:[1.3,.85],summoner:[.9,.9],assassin:[.8,1.15],artillery:[.85,1.1]};
const root=fileURLToPath(new URL('..',import.meta.url));
const at=(p:string)=>path.join(root,p),round=(n:number,d=3)=>Number(n.toFixed(d));
const mean=(v:number[])=>v.reduce((a,b)=>a+b,0)/v.length;
const summary=(v:number[])=>({mean:mean(v),sd:Math.sqrt(mean(v.map(x=>(x-mean(v))**2))),samples:v});
const representative='ss-mon-dusk-blade';
export function configureMeasurements(options:{shieldRatio?:number;shieldDuration?:number;meadowWindup?:number;contactCooldown?:number;contactRange?:number;weakMultiplier?:number;weakRatio?:number;bossKeys?:string[];pressureOverrides?:Record<string,{hpRatio:number;maxMultiplier:number}>;spellScales?:Record<string,number>}){
 if(options.shieldRatio!==undefined)starseaBalance.supportShieldHpRatio=options.shieldRatio;
 if(options.shieldDuration!==undefined)starseaBalance.supportShieldDuration=options.shieldDuration;
 if(options.meadowWindup!==undefined)encounterBalance.starseaMeadowSlamWindup=options.meadowWindup;
 if(options.contactCooldown!==undefined)encounterBalance.starseaBossContact.cooldown=options.contactCooldown;
 if(options.contactRange!==undefined)encounterBalance.starseaBossContact.range=options.contactRange;
 if(options.weakMultiplier!==undefined)encounterBalance.starseaBossContact.weakHpMultiplier=options.weakMultiplier;
 if(options.weakRatio!==undefined)encounterBalance.starseaBossContact.weakHpRatio=options.weakRatio;
 if(options.bossKeys)encounterBalance.starseaBossContact.bossKeys=options.bossKeys;
 if(options.pressureOverrides)Object.assign(encounterBalance.starseaBossContact.pressure,options.pressureOverrides);
 if(options.spellScales)encounterBalance.starseaBossContact.spellScales={...(encounterBalance.starseaBossContact.spellScales??{}),...options.spellScales} as typeof encounterBalance.starseaBossContact.spellScales;
}
const arena=structuredClone(starseaRegions.find(r=>r.id==='ss-map-wind')!);
const open=(()=>{for(let y=8;y<arena.height-8;y++)for(let x=8;x<arena.width-8;x++){const p={x,y};if(distance(p,arena.safe)<16)continue;if([p,{x:x-5,y},{x:x+5,y},{x,y:y-5},{x,y:y+5},{x:x+4,y:y+4},{x:x-4,y:y-4}].every(p=>walkable(arena,p,2)))return p;}throw Error('No open measurement ground');})();

/** Controlled expected build. Sword books are added only when the content
 * actually awards a compatible book. Activation/ranks never silently disappear. */
export function expectedCharacter(L:number,chapter?:number){
 const c=character(L,'normal',Math.max(1,L-2));
 c.skills=['cut','whirl','ward'];c.skillRanks={};
 const books=chapters.filter(ch=>ch.campaign==='starsea'&&(chapter?ch.order<chapter:bossLevels[ch.order-1]<L)).flatMap(ch=>ch.skills);
 const compatible=skillCatalog.filter(s=>books.includes(s.id)&&(!s.weapons?.length||s.weapons.includes('sword')));
 if(compatible.length)c.skills.push(compatible.sort((a,b)=>b.damage-a.damage)[0].id);
 for(const id of c.skills)c.skillRanks[id]=Math.min(5,1+Math.floor(L/6));
 c.skillBooks=Object.fromEntries(books.map(id=>[id,1]));
 const b=resolveBuild(c);if(b.resolvedSkills.map(s=>s.id).join()!==c.skills.join())throw Error(`Build mismatch L${L}: ${c.skills} => ${b.resolvedSkills.map(s=>s.id)}`);
 return c;
}
function setup(c:CharacterState,spawns:Spawn[],seed:number,region=arena,origin=open){
 const b=resolveBuild(c),w=new World(structuredClone(region),b.stats,b.resolvedSkills,spawns,[],seed);
 w.rules.monsters=structuredClone(working);w.hero.position={...origin};w.anchor={...origin};w.radius=40;return {b,w};
}
let working=structuredClone(monsterContent);
export function useCandidate(){const folder=at('.design/starsea-balance-20261005');working=resolveMonsterContent(JSON.parse(fs.readFileSync(path.join(folder,'candidate-monsters.json'),'utf8')));Object.assign(starseaBalance,JSON.parse(fs.readFileSync(path.join(folder,'candidate-balance.json'),'utf8')));Object.assign(encounterBalance,JSON.parse(fs.readFileSync(path.join(folder,'candidate-encounter.json'),'utf8')));}
export function snapshotModel(){return {monsters:structuredClone(working),balance:structuredClone(starseaBalance),encounter:structuredClone(encounterBalance)};}
export function scaleBossHp(index:number,factor:number){const t=working.templates.find(t=>t.id===starseaCampaign.bosses[index].id)!;t.base.hp*=factor;}
export function calibrateBossAttack(index:number){const t=working.templates.find(t=>t.id===starseaCampaign.bosses[index].id)!,L=bossLevels[index];for(let i=0;i<ITERATIONS;i++){const m=incoming(t.id,L,'boss',index+1),target=m.hp/TARGET.boss.ttd;if(Math.abs(m.mean/target-1)<=ERROR)return m;t.base.attack=Math.max(.01,t.base.attack*target/m.mean);}return incoming(t.id,L,'boss',index+1);}
function ground(template:string){const boss=starseaCampaign.bosses.find(b=>b.id===template),region=boss?starseaRegions.find(r=>r.id==='ss-map-boss-'+boss.chapter)!:arena,spot=boss?region.spawns[0]:{x:open.x+2.5,y:open.y},origin=boss?{x:spot.x-2.5,y:spot.y}:open;if(!walkable(region,origin,.55))throw Error('Invalid fight origin '+region.id);return {boss,region,spot,origin};}
function spawn(template:string,L:number,rank:MonsterRank,id='foe',p={x:open.x+2.5,y:open.y}){return resolveMonsterSpawn({id,template,level:L,rank,...p},working);}
function dps(L:number,count:number){
 const c=expectedCharacter(L),b=resolveBuild(c),values:number[]=[],casts:Record<string,number>={};
 for(const seed of SEEDS){const foes=Array.from({length:count},(_,i)=>{const angle=i*Math.PI*2/count,s=spawn(representative,L,'normal','dummy'+i,{x:open.x+2*Math.cos(angle),y:open.y+2*Math.sin(angle)});s.hp=1e9;s.attack=0;s.monster!.baseStats.attack=0;s.monster!.ai.skillChance=0;return s;});
  const {w}=setup(c,foes,seed);w.setMode('auto');let damage=0;
  for(let t=0;t<DPS_SECONDS*30;t++){w.step();for(const e of w.events){if(e.type==='hit_resolved'&&e.id!==w.playerId)damage+=e.amount??0;if(e.type==='cast_started'&&e.id===w.playerId)casts[e.skill!]=(casts[e.skill!]??0)+1;}}
  if(w.enemies.some(e=>!e.alive)||!damage)throw Error('Invalid dummy measurement L'+L);values.push(damage/DPS_SECONDS);
 }
 return {...summary(values),hp:b.stats.hp,armor:b.stats.armor,skills:c.skills,ranks:c.skillRanks,casts};
}
function incoming(template:string,L:number,rank:MonsterRank,chapter?:number){
 const c=expectedCharacter(L,chapter),b=resolveBuild(c),values:number[]=[],peaks:number[]=[];
 for(const seed of SEEDS){const {region,origin,spot}=ground(template),s=spawn(template,L,rank,'foe',spot),{w}=setup(c,[s],seed,region,origin);w.stats={...b.stats,hp:1e9};w.hero.hp=1e9;w.skills=rank==='boss'?b.resolvedSkills.filter(s=>!['shield','heal'].includes(s.kind)):[];w.targetId=s.id;w.region.calmRegen=undefined;w.setMode(rank==='boss'?'semi':'manual');let damage=0,peak=0;
  for(let t=0;t<TTD_SECONDS*30;t++){
   // Fear/push must not strand a manual dummy outside attack range for the
   // remainder of the sample: this is a controlled stationary damage probe.
   w.hero.position={...origin};
   // Include every configured boss phase in the standing damage measurement.
   if(rank==='boss'){const e=w.enemies[0];e.hp=e.maxHp*([1,.65,.3,.1][Math.min(3,Math.floor(t/450))]);}
   w.step();for(const e of w.events)if(e.type==='hit_resolved'&&e.id===w.playerId){damage+=e.amount??0;peak=Math.max(peak,e.amount??0);}
  }
  if(!damage)throw Error('No incoming damage '+template);values.push(damage/TTD_SECONDS);peaks.push(peak);
 }
 return {...summary(values),peak:Math.max(...peaks),hp:b.stats.hp,ttd:b.stats.hp/mean(values)};
}
export function measureFight(L:number,template:string,monsterLevel=L,rank:MonsterRank='normal',count=1,seed=11,chapter?:number,groups=1,unkillable=false){
 const {boss,region,spot,origin}=ground(template);
 const c=expectedCharacter(L,chapter),foes=Array.from({length:count},(_,i)=>spawn(template,monsterLevel,rank,'foe'+i,{x:spot.x+(i%2)*1.3,y:spot.y+(i>>1)*1.3}));
 const {b,w}=setup(c,foes,seed,region,origin);if(unkillable)w.hero.hp=1e9;w.setMode('auto');let peak=0,casts=0,damage=0,finished=0;
 for(let t=0;t<FIGHT_LIMIT*30;t++){
  w.step();for(const e of w.events){if(e.type==='hit_resolved'&&e.id===w.playerId)peak=Math.max(peak,e.amount??0);if(e.type==='hit_resolved'&&e.id!==w.playerId)damage+=e.amount??0;if(e.type==='cast_started'&&e.id===w.playerId)casts++;}
  if(w.hero.hp<=0)break;
  if(boss?!w.enemies.some(e=>e.boss&&e.alive):w.enemies.every(e=>!e.alive)){finished++;if(finished>=groups)break;w.addSpawns(Array.from({length:count},(_,i)=>spawn(template,monsterLevel,rank,`group${finished}-${i}`,{x:w.hero.position.x+2.5+(i%2)*1.3,y:w.hero.position.y+(i>>1)*1.3})));}
 }
 return {seed,win:w.hero.hp>0&&finished===groups,seconds:w.tick/30,hpLeft:w.hero.hp/b.stats.hp,peak,casts,damage,alive:w.enemies.filter(e=>e.alive).length,remainingHp:w.enemies.reduce((n,e)=>n+Math.max(0,e.hp),0),remainingBossHp:w.enemies.filter(e=>e.boss).reduce((n,e)=>n+Math.max(0,e.hp),0)};
}
const fight=measureFight;
function setBases(){
 const first=working.curves.starsea[0];
 for(const t of working.templates.filter(t=>t.id.startsWith('ss-'))){
  const boss=starseaCampaign.bosses.find(b=>b.id===t.id),elite=starseaCampaign.monsters.find(m=>m.id===t.id)?.rank==='elite';const rank=boss?'boss':elite?'elite':'normal',f=style[t.kind];t.referenceLevel=1;
  t.base.hp=first.hp*f[0]*(boss?TARGET.boss.ttk[boss.chapter-1]/TARGET.normal.ttk:elite?TARGET.elite.ttk/TARGET.normal.ttk:1)/working.ranks[rank].hp;
  t.base.attack=first.attack*f[1]*(elite?2:1)/working.ranks[rank].attack;
  if(boss){t.base.hp*=starseaBalance.bossHpCalibration?.[boss.chapter-1]??1;t.base.attack*=starseaBalance.bossAttackCalibration?.[boss.chapter-1]??1;}
  // Existing armor style, including each boss's distinct armor, is retained.
  const old=monsterContent.templates.find(x=>x.id===t.id)!;
  t.base.armor=old.base.armor*first.armor/monsterLevelValues('starsea',old.referenceLevel).armor;
 }
}
function progression(){
 const next:{version:number;generator:string;islandBands:number[][];bossLevels:number[];killXpMultipliers:number[];bossXpMultipliers:number[];taskXp:number[][]}=structuredClone(starseaBalance),state=expectedCharacter(1);state.level=1;state.xp=0;
 const flow:any[]=[];const xpTo=(L:number)=>{let total=0;for(let l=state.level;l<L;l++)total+=xpThreshold(l);return total-state.xp;};
 next.taskXp=[];
 Object.assign(next,{starterWeapon:STARTER_WEAPON,starterJewelry:STARTER_JEWELRY,supportShieldHpRatio:starseaBalance.supportShieldHpRatio,supportShieldDuration:starseaBalance.supportShieldDuration});
 for(let chapter=1;chapter<=6;chapter++){
  const i=chapter-1,end=next.islandBands[i][1],start=state.level;next.islandBands[i][0]=start;next.bossLevels[i]=end+2;
  const rows=tasks.filter(t=>t.campaign==='starsea'&&t.chapter===starseaCampaign.chapters[i].id).sort((a,b)=>a.order-b.order),weights=rows.map(t=>t.reward_xp??1);
  const budget=xpTo(end)+Math.floor(xpThreshold(end)*.2),taskTotal=Math.round(budget*.4);
  const taskXp=weights.map((v,j)=>j<4?Math.round(taskTotal*v/weights.slice(0,4).reduce((a,b)=>a+b,0)):0);
  taskXp[3]+=taskTotal-taskXp.slice(0,4).reduce((a,b)=>a+b,0);
  const before=structuredClone(state);
  const camps=worldTables.camps.filter(c=>c.region===starseaIslands[i]);
  const foes=camps.flatMap(c=>campMembers(c).map(m=>({level:campLevel(worldTables,c,starseaMaps.find(map=>map.id===c.region)!.landmarks.find(p=>p.id==='landing')!,m.rank as 'normal'|'elite'|'rare'),rank:m.rank})));
  // Binary search integer XP against the actual level-gap penalties.
  const questWaves=rows.slice(0,4).map((row,t)=>starseaTaskSteps(starseaCampaign.chapters[i],t,'a').filter(s=>s.op==='wave').flatMap(step=>Array.from({length:step.size},(_,n)=>{const elite=Boolean(row.elite&&n===0&&step.size>=3&&step.enemies.some(id=>id.startsWith('ss-elite-')));return {level:Math.round(start+(end-start)*t/6)+(elite?1:0),rank:elite?'elite' as const:'normal' as const};})));
  const cleared=(factor:number)=>{const s=structuredClone(before);let xp=0,questXp=0;const gain=(m:typeof foes[number])=>{const gap=s.level-m.level,penalty=gap>=10?.1:gap>=5?.5:1;return Math.max(1,Math.round(30*1.12**(m.level-1)*(m.rank==='elite'?2.5:1)*penalty*factor));};
   for(let t=0;t<4;t++){let waveXp=0;for(const m of questWaves[t])waveXp+=gain(m);applyXp(s,waveXp);xp+=waveXp;questXp+=waveXp;applyXp(s,taskXp[t]);}
   for(const m of foes){const amount=gain(m);applyXp(s,amount);xp+=amount;}return {s,xp,questXp};};
  const desired=budget-taskTotal;let low=0,high=1;while(cleared(high).xp<desired)high*=2;
  for(let t=0;t<50;t++){const mid=(low+high)/2;if(cleared(mid).xp>=desired)high=mid;else low=mid;}
  next.killXpMultipliers[i]=round(high,9);const clear=cleared(next.killXpMultipliers[i]);Object.assign(state,clear.s);
  if(state.level!==end)throw Error('XP arrival mismatch chapter '+chapter);
  const afterClear=state.level,nextStart=chapter<6?end+2:38,postBudget=xpTo(nextStart)+Math.floor(xpThreshold(nextStart)*.1),bossXp=Math.round(postBudget*.3);
  next.bossXpMultipliers[i]=bossXp/(600*1.12**(next.bossLevels[i]-1));applyXp(state,bossXp);
  const finalTasks=postBudget-bossXp,w=weights[4]+weights[5];taskXp[4]=Math.round(finalTasks*weights[4]/w);taskXp[5]=finalTasks-taskXp[4];applyXp(state,taskXp[4]+taskXp[5]);next.taskXp.push(taskXp);
  flow.push({chapter,start,end:afterClear,boss:next.bossLevels[i],after:state.level,monsters:foes.length,questMonsters:questWaves.flat().length,taskXp:taskTotal,fieldXp:clear.xp,questKillXp:clear.questXp,taskShare:taskTotal/(taskTotal+clear.xp),factor:next.killXpMultipliers[i],xpBefore:before.xp,xpAfter:state.xp});
 }
 return {next,flow};
}
export async function runBalanceModel(){
 configureMeasurements({bossKeys:['forest-boss','rift-boss','frost_queen','abyss_lord','dragon_king']});
 const baseline=structuredClone(monsterContent),progress=progression(),rows:any[]=[],iterations:any[]=[],checks:any[]=[];
 const sampleOnly=process.argv.includes('--sample'),bossOnly=process.argv.includes('--boss-only'),levels=sampleOnly?[1,6,8,13,21,37,60]:Array.from({length:60},(_,i)=>i+1);
 console.log('Measuring DPS (single / four), seeds',SEEDS.join(','),'levels',levels.length);
 if(bossOnly)rows.push(...JSON.parse(fs.readFileSync(at('.design/starsea-balance-20261005/model.json'),'utf8')).rows);
 else for(const L of levels){const single=dps(L,1),group=dps(L,4);rows.push({level:L,dps1:single,dpsN:group});}
 if(sampleOnly){console.log(JSON.stringify(rows,null,2));return;}
 if(!bossOnly){working.curves.starsea=rows.map(r=>({level:r.level,hp:Math.round(r.dps1.mean*TARGET.normal.ttk),attack:monsterLevelValues('starsea',r.level,baseline).attack,armor:monsterLevelValues('starsea',r.level,baseline).armor}));
 // The original rank table is never edited. All ss-* target differences live
 // in template bases, normalized against each template's reference point.
 setBases();console.log('Calibrating normal attacks by measured post-armor damage');
 for(const row of rows){const L=row.level,point=working.curves.starsea[L-1];for(let iteration=0;iteration<ITERATIONS;iteration++){
   if(L===1)setBases();const m=incoming(representative,L,'normal'),target=m.hp/TARGET.normal.ttd,error=m.mean/target-1;
   iterations.push({template:representative,level:L,iteration,attack:point.attack,target,measured:m.mean,error});if(Math.abs(error)<=ERROR)break;
   point.attack=Math.max(1,point.attack*target/m.mean);
  }
  if(L>1)point.attack=Math.max(working.curves.starsea[L-2].attack,point.attack);
 }
 // Rebase the styled attacks onto the final L1 curve, then independently tune
 // every elite, ranged/caster/artillery and all six different boss AIs.
 setBases();
 const special=working.templates.filter(t=>t.id.startsWith('ss-')&&(starseaCampaign.monsters.find(m=>m.id===t.id)?.rank==='elite'||['ranged','shaman','artillery'].includes(t.kind)||starseaCampaign.bosses.some(b=>b.id===t.id)));
 for(const t of special){const boss=starseaCampaign.bosses.find(b=>b.id===t.id),elite=starseaCampaign.monsters.find(m=>m.id===t.id)?.rank==='elite',chapter=boss?.chapter??starseaCampaign.monsters.find(m=>m.id===t.id)!.chapter[0],rank=boss?'boss':elite?'elite':'normal',L=boss?progress.next.bossLevels[chapter-1]:Math.round(mean(progress.next.islandBands[chapter-1]));
  for(let iteration=0;iteration<ITERATIONS;iteration++){const m=incoming(t.id,L,rank,chapter),target=m.hp/(boss?TARGET.boss.ttd:elite?TARGET.elite.ttd:TARGET.normal.ttd),error=m.mean/target-1;
   iterations.push({template:t.id,level:L,iteration,attack:t.base.attack,target,measured:m.mean,error,peak:m.peak});if(Math.abs(error)<=ERROR)break;t.base.attack=Math.max(.01,t.base.attack*target/m.mean);
  }
 }
 }
 // A boss's actual uptime includes its telegraphs, summons and player movement.
 // Calibrate the template HP against that real AI after the DPS-derived baseline.
 for(const [i,boss] of starseaCampaign.bosses.entries()){
  const t=working.templates.find(t=>t.id===boss.id)!,L=progress.next.bossLevels[i];
  for(let iteration=0;iteration<ITERATIONS;iteration++){const m=incoming(t.id,L,'boss',i+1),target=m.hp/TARGET.boss.ttd;if(Math.abs(m.mean/target-1)<=ERROR)break;t.base.attack=Math.max(.01,t.base.attack*target/m.mean);}
  if(starseaBalance.bossHpCalibration){iterations.push({template:boss.id,kind:'fitted real-AI uptime',hpFactor:starseaBalance.bossHpCalibration[i]});continue;}
  for(let iteration=0;iteration<6;iteration++){
   let samples=SEEDS.map(seed=>fight(L,boss.id,L,'boss',1,seed,i+1));
   if(samples.some(s=>!s.win))samples=SEEDS.map(seed=>fight(L,boss.id,L,'boss',1,seed,i+1,1,true));
   const seconds=mean(samples.map(s=>s.seconds)),target=TARGET.boss.ttk[i];
   iterations.push({template:boss.id,kind:'boss HP uptime',iteration,hp:t.base.hp,seconds,target});
   if(Math.abs(seconds/target-1)<=ERROR)break;t.base.hp*=target/seconds;
  }
  // Retain a little room below the 90-second arrival ceiling for random boss
  // cycles, without changing ranks or the ordinary/elite curves.
  for(let iteration=0;iteration<3;iteration++){
   const samples=SEEDS.map(seed=>fight(progress.next.islandBands[i][1],boss.id,L,'boss',1,seed,i+1)),seconds=Math.max(...samples.filter(s=>s.win).map(s=>s.seconds));
   if(seconds<=90)break;t.base.hp*=85/seconds;iterations.push({template:boss.id,kind:'arrival ceiling',iteration,seconds,target:85});
  }
  for(let iteration=0;iteration<ITERATIONS;iteration++){
   const m=incoming(t.id,L,'boss',i+1),target=m.hp/TARGET.boss.ttd,error=m.mean/target-1;
   iterations.push({template:t.id,kind:'boss final attack',iteration,attack:t.base.attack,target,measured:m.mean,error});
   if(Math.abs(error)<=ERROR)break;t.base.attack=Math.max(.01,t.base.attack*target/m.mean);
  }
 }
 console.log('Validating single, four-pack, three-pack and boss fights');
 if(!bossOnly)for(const row of rows){const L=row.level,single=SEEDS.map(seed=>fight(L,representative,L,'normal',1,seed)),group=SEEDS.map(seed=>fight(L,representative,L,'normal',4,seed)),chain=SEEDS.map(seed=>fight(L,representative,L,'normal',4,seed,undefined,3));
  const eliteTemplate=starseaCampaign.monsters.find(m=>m.rank==='elite')!.id,elite=SEEDS.map(seed=>fight(L,eliteTemplate,L,'elite',1,seed)),normalIn=incoming(representative,L,'normal'),eliteIn=incoming(eliteTemplate,L,'elite');
  row.normal={hp:spawn(representative,L,'normal').hp,attack:spawn(representative,L,'normal').attack,ttk:mean(single.map(s=>s.seconds)),ttd:normalIn.ttd,samples:single};
  row.elite={hp:spawn(eliteTemplate,L,'elite').hp,attack:spawn(eliteTemplate,L,'elite').attack,ttk:mean(elite.map(s=>s.seconds)),ttd:eliteIn.ttd,samples:elite};row.groups={samples:group,chain};
  checks.push({name:`L${L} normal`,ok:single.every(s=>s.win)&&row.normal.ttk>=2&&row.normal.ttk<=3.5},{name:`L${L} four-pack`,ok:group.every(s=>s.win&&s.seconds<=12&&s.hpLeft>=.5)},{name:`L${L} three-pack`,ok:chain.every(s=>s.win)},{name:`L${L} elite`,ok:elite.every(s=>s.win)&&row.elite.ttk>=8&&row.elite.ttk<=14&&eliteIn.ttd>=15&&eliteIn.ttd<=25});
 }
 const bosses=starseaCampaign.bosses.map((b,i)=>{const E=progress.next.islandBands[i][1],L=progress.next.bossLevels[i],arrival=SEEDS.map(seed=>fight(E,b.id,L,'boss',1,seed,i+1)),same=SEEDS.map(seed=>fight(L,b.id,L,'boss',1,seed,i+1)),incomingDamage=incoming(b.id,L,'boss',i+1),m=spawn(b.id,L,'boss');
  const arrivalWins=arrival.filter(s=>s.win),rate=arrivalWins.length/SEEDS.length;
  checks.push({name:`chapter ${i+1} arrival boss`,ok:rate>=.6&&rate<=.8&&arrivalWins.every(s=>s.seconds>=50&&s.seconds<=90)},{name:`chapter ${i+1} same-level boss`,ok:same.every(s=>s.win&&s.hpLeft>=.3)},{name:`chapter ${i+1} boss single-hit`,ok:incomingDamage.peak<=incomingDamage.hp*.4});
  return {chapter:i+1,template:b.id,level:L,arrivalLevel:E,hp:m.hp,attack:m.attack,arrival,same,ttd:incomingDamage.ttd,peakRatio:incomingDamage.peak/incomingDamage.hp};});
 for(const row of rows){const i=progress.next.bossLevels.findIndex(L=>row.level<=L),b=starseaCampaign.bosses[i<0?5:i],s=spawn(b.id,row.level,'boss');row.boss={template:b.id,hp:s.hp,attack:s.attack,armor:s.monster!.armor};row.errors={normalTTK:row.normal.ttk/TARGET.normal.ttk-1,normalDamage:TARGET.normal.ttd/row.normal.ttd-1,eliteTTK:row.elite.ttk/TARGET.elite.ttk-1,eliteDamage:TARGET.elite.ttd/row.elite.ttd-1};}
 resolveMonsterContent(working);
 const report={versions,seeds:SEEDS,measurement:{strategy:'sword normal mixed equipment two levels behind; explicitly activated skills/ranks; automatic fights; manual standing TTD; real World 30 Hz',dpsSeconds:DPS_SECONDS,ttdSeconds:TTD_SECONDS,fightLimitSeconds:FIGHT_LIMIT,iterations:ITERATIONS,samples:SEEDS.length,openGround:open,controlledGrants:true},targets:TARGET,progression:progress.flow,rows,bosses,iterations,checks,failures:checks.filter(c=>!c.ok)};
 const folder=at('.design/starsea-balance-20261005');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'model.json'),JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(path.join(folder,'candidate-monsters.json'),JSON.stringify(working,null,2)+'\n');fs.writeFileSync(path.join(folder,'candidate-balance.json'),JSON.stringify(progress.next,null,2)+'\n');fs.writeFileSync(path.join(folder,'candidate-encounter.json'),JSON.stringify(encounterBalance,null,2)+'\n');
 const md=['# 星潮海 TTK/TTD 模型',`规则 ${versions.rules}；客户端 ${versions.client}；protocol ${versions.protocol}；seeds ${SEEDS.join(' / ')}；每项 ${SEEDS.length} 样本。DPS ${DPS_SECONDS}s，承伤 ${TTD_SECONDS}s，战斗上限 ${FIGHT_LIMIT}s，攻击迭代最多 ${ITERATIONS} 轮。`,report.measurement.strategy,'受控期望构筑，不代表自然养成；当前章节没有授予剑系技能书，使用 cut / whirl / ward。','## 经验与等级','|章|开始|到首领|首领|交任务后|野怪数|任务占比|野外系数|','|---|---|---|---|---|---|---|---|',...progress.flow.map(r=>`|${r.chapter}|${r.start}|${r.end}|${r.boss}|${r.after}|${r.monsters}|${round(r.taskShare*100,1)}%|${round(r.factor)}|`),'## 逐级曲线（平均秒伤 ± 标准差）','|L|DPS₁|DPS₄|玩家HP|Armor|普通HP/ATK|普通TTK/TTD|精英HP/ATK|精英TTK/TTD|','|---|---|---|---|---|---|---|---|---|',...rows.map(r=>`|${r.level}|${round(r.dps1.mean)} ± ${round(r.dps1.sd)}|${round(r.dpsN.mean)} ± ${round(r.dpsN.sd)}|${r.dps1.hp}|${r.dps1.armor}|${r.normal.hp}/${r.normal.attack}|${round(r.normal.ttk)}/${round(r.normal.ttd)}|${r.elite.hp}/${r.elite.attack}|${round(r.elite.ttk)}/${round(r.elite.ttd)}|`),'## 六首领验收','|章|等级|HP|攻击|到达等级胜率|到达胜场用时|同级胜率|同级最低剩余HP|站桩TTD|最高单击占HP|','|---|---|---|---|---|---|---|---|---|---|',...bosses.map(b=>`|${b.chapter}|${b.level}|${b.hp}|${b.attack}|${b.arrival.filter(s=>s.win).length}/5|${b.arrival.filter(s=>s.win).map(s=>round(s.seconds,1)).join('/')}|${b.same.filter(s=>s.win).length}/5|${round(Math.min(...b.same.map(s=>s.hpLeft))*100,1)}%|${round(b.ttd)}|${round(b.peakRatio*100,1)}%|`),'## 未通过项',...report.failures.map(c=>'- '+c.name),'详见 model.json：逐种子施法/伤害/失败样本与全部攻击迭代。'];
 fs.writeFileSync(path.join(folder,'model.md'),md.map(line=>line.startsWith('#')?'\n'+line+'\n':line).join('\n').trim()+'\n');
 const written=process.argv.includes('--write')&&!bossOnly&&!report.failures.length;
 if(written){const latest=JSON.parse(fs.readFileSync(at('packages/content/monsters.json'),'utf8'));if(JSON.stringify(latest.ranks)!==JSON.stringify(baseline.ranks))throw Error('Shared ranks changed during measurement');latest.curves.starsea=working.curves.starsea;const tuned=new Map(working.templates.filter(t=>t.id.startsWith('ss-')).map(t=>[t.id,t]));latest.templates=latest.templates.map((t:any)=>t.id.startsWith('ss-')?tuned.get(t.id)??t:t);fs.writeFileSync(at('packages/content/monsters.json'),JSON.stringify(latest,null,2)+'\n');fs.writeFileSync(at('packages/content/starsea/balance.json'),JSON.stringify(progress.next,null,2)+'\n');fs.writeFileSync(at('packages/content/encounter-balance.json'),JSON.stringify(encounterBalance,null,2)+'\n');}
 console.log(JSON.stringify({output:folder,written,writeRequested:process.argv.includes('--write'),failures:report.failures.map(c=>c.name),bosses:bosses.map(b=>({chapter:b.chapter,arrival:b.arrival.filter(s=>s.win).length,same:b.same.filter(s=>s.win).length,ttd:round(b.ttd),minHp:round(Math.min(...b.same.map(s=>s.hpLeft)))}))},null,2));
 if(report.failures.length)process.exitCode=2;
}
if(/starsea-balance-model\.ts$/.test(process.argv[1]??''))await runBalanceModel();
