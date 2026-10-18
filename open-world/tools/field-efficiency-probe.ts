// 数值来源已迁到 tools/spine；本文件保留历史探针，正式派生请使用 pnpm spine:check 与主干CLI。
/** 实战效率探针：体感 TTK ÷ 站桩理论 TTK。
 * 普通/精英：真实岛屿地图、真实刷怪点、自动模式；单只用时 = 首次命中 → 死亡。
 * 首领：真实首领地图，首领生命放大不死，60 秒内伤害 ÷ 站桩 DPS。
 * 构筑用怪物曲线拟合时的基准人 expectedCharacter(L)；玩家不死（只测输出效率）。
 * 输出 .design/standard-player-20261005/efficiency.json */
import '../packages/content/open-world/index.ts';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {worldTables} from '../packages/content/world-tables.ts';
import {regionById,settings,fieldRegionInfo} from '../packages/content/index.ts';
import {probeFieldZone} from './field-zone-probe.ts';
import {standard} from './standard-player-model.ts';
import {stageTimings} from './world-stage-schedule.ts';
import {World,walkable,distance} from '../packages/simulation/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {starseaRegions} from '../packages/content/starsea/index.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {versions} from '../packages/contracts/index.ts';
import {expectedCharacter} from './starsea-balance-model.ts';

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain&&process.argv.includes('--region')){
 const args=process.argv.slice(2),value=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];},id=value('--region')!,r=regionById(id),info=fieldRegionInfo(id),selected=value('--zone');
 if(!info)throw Error('Per-zone probe requires a registered camp-streaming region');
 const zones=worldTables.zones.filter(z=>z.region===id&&(!selected||selected===z.id));if(!zones.length)throw Error('No authored region zones matched');
 const count=Number(value('--samples')??2),baseSeed=Number(value('--seed')??41);if(!Number.isInteger(count)||count<1)throw Error('Sample count must be positive');
 const seeds=Array.from({length:count},(_,i)=>baseSeed+i*32),stageNumber=value('--stage'),stage=stageNumber===undefined?undefined:stageTimings[Number(stageNumber)-1];if(stageNumber!==undefined&&!stage)throw Error('Unknown numeric stage');
 const phase=value('--at')??'clear';if(!['start','clear','end'].includes(phase))throw Error('Clock must be start, clear or end');
 const at=stage?.[phase as 'start'|'clear'|'end'],startText=value('--start'),coordinates=startText?.split(',').map(Number);if(coordinates&&(coordinates.length!==2||coordinates.some(v=>!Number.isFinite(v))))throw Error('Start must be x,y');
 const reports=zones.map(zone=>probeFieldZone({region:r,tables:worldTables,zone:zone.id,character:standard(Number(value('--level')??(stage?Math.ceil(stage.level):Math.ceil((zone.levelBand[0]+zone.levelBand[1])/2))),new Set(),at),seeds,seconds:Number(value('--seconds')??180),chunkCells:info.chunkCells??settings.chunkSize,start:coordinates?{x:coordinates[0],y:coordinates[1]}:undefined}));
 const report={generated:new Date().toISOString(),versions,region:id,fieldQa:info.qa,numericStage:stage?.index??null,clock:at??null,clockPhase:stage?phase:null,sourceHashes:Object.fromEntries(['config/json/world.json','packages/content/monsters.json'].map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),reports};
 const output=value('--out')??`docs/reviews/open-world-m2-m4/W3/field-${id}-${phase}.json`;fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,fieldQa:info.qa,zones:reports.map(r=>({zone:r.zone.id,...r.summary}))}));
}
if(isMain&&!process.argv.includes('--region')){
const SEEDS=[11,23],FIELD_SECONDS=180,BOSS_SECONDS=60,TICK=30;
const ISLANDS=[['ss-map-wind','ss-map-boss-1'],['ss-map-mist','ss-map-boss-2'],['ss-map-forge','ss-map-boss-3'],['ss-map-frost','ss-map-boss-4'],['ss-map-rift','ss-map-boss-5'],['ss-map-dragon','ss-map-boss-6']];
const region=(id:string)=>structuredClone(starseaRegions.find(r=>r.id===id)!);
const arena=region('ss-map-wind');
const open=(()=>{for(let y=8;y<arena.height-8;y++)for(let x=8;x<arena.width-8;x++){const p={x,y};if(distance(p,arena.safe)<16)continue;if([p,{x:x-5,y},{x:x+5,y},{x,y:y-5},{x,y:y+5}].every(p=>walkable(arena,p,2)))return p;}throw Error('no ground');})();
const resolve=(r:any,boost=1)=>r.spawns.map((m:any)=>{if(!m.monster)return m;const s=resolveMonsterSpawn({id:m.id,x:m.x,y:m.y,template:m.monster.template,level:m.monster.level,rank:m.monster.rank},monsterContent);s.hp*=boost;return s;});
const hits=(w:World,cb:(id:string,amount:number)=>void)=>{for(const e of w.events)if(e.type==='hit_resolved'&&e.id!==w.playerId)cb(e.id!,e.amount??0);};

function stationary(L:number){const c=expectedCharacter(L),b=resolveBuild(c);let total=0;
 for(const seed of SEEDS){const s=resolveMonsterSpawn({id:'dummy0',template:'ss-mon-dusk-blade',level:L,rank:'normal',x:open.x+2.5,y:open.y},monsterContent);s.hp=1e15;s.attack=0;s.monster!.baseStats.attack=0;s.monster!.ai.skillChance=0;
  const w=new World(structuredClone(arena),b.stats,b.resolvedSkills,[s],[],seed);w.hero.position={...open};w.anchor={...open};w.radius=40;w.setMode('auto');
  for(let t=0;t<30*TICK;t++){w.step();hits(w,(_,a)=>total+=a);}}
 return total/30/SEEDS.length;}

function field(id:string,L:number,dps:number){const c=expectedCharacter(L),b=resolveBuild(c);let hpKilled=0,killTime=0,kills=0,damage=0,engaged=0;
 for(const seed of SEEDS){const r=region(id),sp=resolve(r),w=new World(r,{...b.stats,hp:1e9},b.resolvedSkills,sp,[],seed);w.hero.hp=1e9;w.setMode('auto');
  const first:Record<string,number>={},done=new Set<string>();
  for(let t=0;t<FIELD_SECONDS*TICK;t++){w.step();hits(w,(target,a)=>{damage+=a;if(first[target]===undefined)first[target]=t;});
   for(const e of w.enemies)if(!e.alive&&first[e.id]!==undefined&&!done.has(e.id)){done.add(e.id);kills++;killTime+=(t-first[e.id]+1)/TICK;hpKilled+=e.maxHp;}
   if(w.enemies.some(e=>e.alive&&first[e.id]!==undefined&&!done.has(e.id)))engaged++;}}
 const theory=hpKilled/dps;
 return {kills,meanKillSeconds:killTime/Math.max(1,kills),theoryKillSeconds:theory/Math.max(1,kills),killEfficiency:theory/Math.max(1e-9,killTime),
  clearDps:damage/(FIELD_SECONDS*SEEDS.length),clearEfficiency:damage/(FIELD_SECONDS*SEEDS.length)/dps,engagedShare:engaged/(FIELD_SECONDS*TICK*SEEDS.length)};}

function boss(id:string,L:number,dps:number){const c=expectedCharacter(L),b=resolveBuild(c);let damage=0;
 for(const seed of SEEDS){const r=region(id),sp=resolve(r,1000),spot=sp.find((e:any)=>e.boss)!,w=new World(r,{...b.stats,hp:1e9},b.resolvedSkills,sp,[],seed);w.hero.hp=1e9;w.hero.position={x:spot.x-2.5,y:spot.y};w.anchor={...w.hero.position};w.radius=Math.max(r.width,r.height);w.targetId=spot.id;w.setMode('auto');
  for(let t=0;t<BOSS_SECONDS*TICK;t++){w.step();hits(w,(_,a)=>damage+=a);}}
 return {dps:damage/(BOSS_SECONDS*SEEDS.length),efficiency:damage/(BOSS_SECONDS*SEEDS.length)/dps};}

const out=[];
for(const [index,[island,bossMap]] of ISLANDS.entries()){
 const lv=region(island).spawns.filter((s:any)=>s.monster).map((s:any)=>s.monster.level),L=Math.round((Math.min(...lv)+Math.max(...lv))/2);
 const bossL=region(bossMap).spawns.find((s:any)=>s.monster)!.monster!.level;
 const d=stationary(L),f=field(island,L,d),db=stationary(bossL),bo=boss(bossMap,bossL,db);
 const row={chapter:index+1,island,level:L,stationaryDps:d,field:f,bossLevel:bossL,bossStationaryDps:db,boss:bo};out.push(row);
 console.log(`c0${index+1} L${L} 站桩${d.toFixed(0)} | 实地 击杀${f.kills} 单只体感${f.meanKillSeconds.toFixed(2)}s 理论${f.theoryKillSeconds.toFixed(2)}s 效率${f.killEfficiency.toFixed(2)} 清图效率${f.clearEfficiency.toFixed(2)} 交战占比${(f.engagedShare*100).toFixed(0)}% | 首领L${bossL} 效率${bo.efficiency.toFixed(2)}`);
}
const dir=path.join(process.cwd(),'.design','standard-player-20261005');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'efficiency.json'),JSON.stringify({generated:new Date().toISOString(),versions,seeds:SEEDS,fieldSeconds:FIELD_SECONDS,bossSeconds:BOSS_SECONDS,build:'expectedCharacter(L)（怪物曲线拟合基准人），玩家不死',rows:out},null,1));
}
