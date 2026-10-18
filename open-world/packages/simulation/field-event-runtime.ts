import type {Spawn} from '../contracts/index.ts';
import type {WorldTables} from '../contracts/open-world.ts';
import {resolveMonsterSpawn} from '../rules/monster-stats.ts';
import {distance,walkable} from './navigation.ts';
import type {World} from './index.ts';
export type FieldEventDefinition=WorldTables['events'][number]&{holdSeconds?:number;monsterLevel:number};
export type FieldEventRun={id:string;definition:FieldEventDefinition;startedTick:number;endedTick?:number;wavesSpawned:number;nextWaveTick:number;enemies:string[];status:'running'|'success'|'failed';reason:'left-radius'|'objective-destroyed'|'hero-downed'|'time-limit'|null};
function random(seed:number){let value=seed>>>0;return()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
/** One generic executor for all authored points. It consumes the existing World
 * and its frozen catalogue; starting an event never creates/heals the hero. */
export function beginFieldEvent(world:World,definition:FieldEventDefinition,id:string):FieldEventRun{
 if(world.defense&&!world.defense.complete&&!world.defense.failed)throw Error('已有守护目标正在执行');
 if(!walkable(world.region,definition,.55)||distance(world.hero.position,definition)>4)throw Error('请先靠近事件物件');
 if(definition.kind==='defend'&&(!(definition.objectiveHp!>0)||!(definition.holdSeconds!>0)))throw Error('守护事件缺少声明的生命/守护时长');
 if(definition.kind==='horde'){
  const waves=definition.waves,swarm=waves.flat().filter(p=>p.rank==='normal'),elite=waves.flat().filter(p=>p.rank==='elite'),count=swarm.reduce((n,p)=>n+p.count,0);
  if(waves.length!==3||count<30||count>60||elite.reduce((n,p)=>n+p.count,0)!==1||swarm.some(p=>world.rules.monsters.templates.find(t=>t.id===p.template)?.role!=='swarm')||definition.waveIntervalSeconds*2>=30)throw Error('怪潮必须在30秒内生成三波30–60杂兵和1精英');
 }
 if(definition.waves.flat().some(p=>!['normal','elite'].includes(p.rank)))throw Error('事件波次只允许普通怪和精英');
 const run:FieldEventRun={id,definition:structuredClone(definition),startedTick:world.tick,wavesSpawned:0,nextWaveTick:world.tick,enemies:[],status:'running',reason:null};
 if(definition.kind==='defend')world.defense={position:{x:definition.x,y:definition.y},hp:definition.objectiveHp!,maxHp:definition.objectiveHp!,radius:definition.radius,requiredTicks:Math.round(definition.holdSeconds!*30),heldTicks:0,enemyIds:run.enemies,failed:false,complete:false};
 return run;
}
/** The server calls this on the World clock. A reconnect restores World and run
 * together; no wave is regenerated and no completed instance is paid twice. */
export function advanceFieldEvent(world:World,run:FieldEventRun,seed:number,difficulty={hp:1,attack:1,armor:1}):Spawn[]{
 if(run.status!=='running')return [];
 const row=run.definition,fail=(reason:NonNullable<FieldEventRun['reason']>)=>{run.status='failed';run.reason=reason;run.endedTick=world.tick;world.cancelSpawns(run.enemies);if(row.kind==='defend'&&world.defense){world.defense.failed=true;world.defense.enemyIds=[];}return [] as Spawn[];};
 if(distance(world.hero.position,row)>row.radius)return fail('left-radius');
 if(world.hero.hp<=0||world.defense?.downed&&row.kind==='defend')return fail('hero-downed');
 if(row.kind==='defend'&&(!world.defense||world.defense.hp<=0||world.defense.failed))return fail('objective-destroyed');
 const spawned:Spawn[]=[];
 while(run.wavesSpawned<row.waves.length&&world.tick>=run.nextWaveTick){
  const wave=run.wavesSpawned,next=random(seed+wave*65537),members=row.waves[wave].flatMap(p=>Array.from({length:p.count},()=>p)),positions:{x:number;y:number}[]=[];
  for(const [index,member]of members.entries()){
   const template=world.rules.monsters.templates.find(t=>t.id===member.template);if(!template)throw Error('未知事件怪物模板 '+member.template);
   let at:{x:number;y:number}|undefined;for(let tries=0;tries<256&&!at;tries++){const angle=next()*Math.PI*2,radius=row.kind==='horde'?36+next()*3:8+next()*4,p={x:row.x+Math.cos(angle)*radius,y:row.y+Math.sin(angle)*radius};if(walkable(world.region,p,.55)&&positions.every(q=>distance(p,q)>=1.2))at=p;}
   if(!at)throw Error('事件波次找不到声明范围内的合法生成点 '+row.id);
   positions.push(at);const level=row.monsterLevel;if(!Number.isInteger(level)||level<=0)throw Error('事件必须由分区解析并冻结怪物等级');
   const spawn=resolveMonsterSpawn({id:`world-event:${run.id}:${wave}:${index}`,template:member.template,level:level+(member.rank==='elite'?1:0),rank:member.rank,...at},world.rules.monsters,difficulty);spawned.push(spawn);run.enemies.push(spawn.id);
  }
  run.wavesSpawned++;run.nextWaveTick=run.startedTick+Math.round(run.wavesSpawned*row.waveIntervalSeconds*30);
 }
 if(spawned.length){world.addSpawns(spawned);const ids=new Set(spawned.map(s=>s.id));for(const enemy of world.enemies)if(ids.has(enemy.id))enemy.engaged=true;if(row.kind==='defend'&&world.defense){world.defense.enemyIds=[...run.enemies];world.defense.complete=false;}}
 const living=new Set(world.enemies.filter(e=>e.alive).map(e=>e.id)),cleared=run.wavesSpawned===row.waves.length&&run.enemies.length>0&&run.enemies.every(id=>!living.has(id));
 if(cleared&&(row.kind!=='defend'||world.defense!.heldTicks>=world.defense!.requiredTicks)){run.status='success';run.endedTick=world.tick;return spawned;}
 if(world.tick-run.startedTick>=Math.round(row.durationSeconds*30))return fail('time-limit');
 return spawned;
}
