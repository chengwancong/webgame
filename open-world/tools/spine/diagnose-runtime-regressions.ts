/** S8剩余实机逻辑失败的只读诊断，不写数值或降低测试要求。 */
import {World,walkable} from '../../packages/simulation/index.ts';
import {regionById} from '../../packages/content/index.ts';
import {dungeonContent} from '../../packages/content/dungeons.ts';
import {monsterContent,resolveMonsterContent} from '../../packages/content/monsters.ts';
import {dungeonSpawns} from '../../packages/rules/dungeon-build.ts';
import {resolveMonsterSpawn} from '../../packages/rules/monster-stats.ts';
import {readJson,save,review,data,stamp} from './io.ts';
import {interpolate} from './monsters.ts';
const player=await readJson(data+'/spine-player.json'),rows=[];
for(const d of dungeonContent.definitions.filter(d=>d.feature==='field-dungeon'&&d.area==='ss-map-rift'))for(const [stage,id] of d.stages.entries()){
 const region=regionById(id),spawns=dungeonSpawns(region.spawns,d.policy,d.policy.minTier,stage,[],monsterContent,'starsea'),focus=spawns.find(s=>s.boss)??spawns.find(s=>s.elite)??spawns[0];let position;
 for(const r of [1.25,2,3,4,5])for(let n=0;n<16&&!position;n++){const p={x:focus.x+Math.cos(n*Math.PI/8)*r,y:focus.y+Math.sin(n*Math.PI/8)*r};if(walkable(region,p,1))position=p;}
 if(!position)throw Error('没有合法测量站位');
 const w=new World({...region,safe:position},{hp:1e15,attack:0,armor:0,speed:0,mana:0,regen:0,effects:[]},[],spawns,[],41);w.setMode('manual');let damage=0,maxHit=0,hits=0;
 for(let tick=0;tick<900;tick++){w.step();for(const e of w.events)if(e.type==='hit_resolved'&&e.id===w.playerId){damage+=e.amount??0;maxHit=Math.max(maxHit,e.amount??0);hits++;}}
 rows.push({dungeon:d.id,stage,region:id,level:d.level,enemyScale:d.policy.enemyScale,stageEnemyScale:d.policy.stageEnemyScale?.[stage],count:spawns.length,boss:spawns.some(s=>s.boss),maximumAttack:Math.max(...spawns.map(s=>s.attack)),rawDps:damage/30,maxHit,hits,standardEHP:interpolate(player.points,d.level,'EHP'),impliedTTD:damage?interpolate(player.points,d.level,'EHP')/(damage/30):null});
}
const old=resolveMonsterContent(await readJson(review+'/S0/source-before/packages/content/monsters.json')),core=await readJson(review+'/S2/core-summary.json'),legacy=regionById('meadow-boss').spawns.filter(s=>s.boss).map(s=>{const before=resolveMonsterSpawn({id:s.id,template:s.monster!.template,level:s.monster!.level,rank:s.monster!.rank,x:s.x,y:s.y},old),level=s.monster!.level;return {template:s.monster!.template,level,hpBefore:before.hp,hpAfter:s.hp,attackBefore:before.attack,attackAfter:s.attack,S2D1:core.standards.find((p:any)=>p.level===1).D1,currentD1:interpolate(player.points,level,'D1')};});
await save(review+'/S8/runtime-regression-diagnosis-summary.json',{...stamp(),rows,legacy,readonly:true});console.log(JSON.stringify({rows,legacy}));
