import type {DungeonDefinition} from '../contracts/dungeons.ts';
import {hubDungeonTemplateSchema} from '../contracts/hub-dungeons.ts';
import {regionById,registerDungeonRegion,regions,type Region} from './index.ts';
import {resolveMonsterSpawn} from '../rules/monster-stats.ts';
import {starseaMap} from './starsea/index.ts';
import {tasks,steps,routes,dialogueLines} from './task-tables.ts';
import {hubChartContent} from './hub-chart.ts';
import {worldTables,worldZoneAt} from './world-tables.ts';
import {campSpawns} from '../rules/world-camps.ts';
import {applyEncounterOverrides} from '../rules/encounter-overrides.ts';
import {engineDefense} from './starsea/defense.ts';

export type HubStoryStep={task:string;seq:number;op:string;key:string;label:string;map?:string;zone?:string;landmark?:string;npc?:string;prop?:string;count?:number;enemies?:string[];seconds?:number;defense?:string;encounter_hp?:number;encounter_attack?:number;dialogueGroup?:string;dialogue?:{speaker:string;text:string}[]};
export type HubStorySegment={steps:HubStoryStep[];region:string};
const storyTasks:Record<string,string[]>={'wind-story-1':['ss-c01-t01'],'wind-story-2':['ss-c01-t03'],'wind-story-3':['ss-c01-t04'],'mist-story-1':['ss-c02-t01','ss-c02-t02'],'mist-story-2':['ss-c02-t03'],'mist-story-3':['ss-c02-t04']};
export const hubStorySegments=new Map<string,HubStorySegment[]>();
const objectives={story:'story-fact',nest:'reach-portal',hunt:'defeat-boss',tide:'defend-beacon',treasure:'open-chests',gate:'defeat-boss'} as const;
const at=(r:Region,id:string)=>r.landmarks.find(x=>x.kind===id||x.name===id)??r.safe;

/** D1: cut the original task's rectangle; collision outside its bounds is not retained. */
export function cropHubStoryRegion(source:Region,id:string,part:HubStoryStep[],level:number):Region{
  const points=part.map(s=>at(source,s.landmark??'landing')),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const x=Math.max(0,Math.floor(Math.min(...xs)-12)),y=Math.max(0,Math.floor(Math.min(...ys)-12));
  const width=Math.min(source.width-x,Math.ceil(Math.max(...xs)-x+14)),height=Math.min(source.height-y,Math.ceil(Math.max(...ys)-y+14));
  const inside=(p:{x:number;y:number})=>p.x>=x&&p.y>=y&&p.x<x+width&&p.y<y+height;
  const shift=(p:{x:number;y:number})=>({x:p.x-x,y:p.y-y});
  const landmarks=source.landmarks.filter(inside).map(l=>({...l,...shift(l)}));
  const safe={x:3,y:3},portal={x:width-4,y:height-4};
  // Safe ingress/egress and target clearings are cropped from existing collision.
  const centers=[safe,portal,...points.map(shift)];
  const obstacles=source.obstacles.filter(o=>o.x+o.w>x&&o.y+o.h>y&&o.x<x+width&&o.y<y+height).map(o=>({x:Math.max(1,o.x-x),y:Math.max(1,o.y-y),w:Math.min(o.x+o.w-x,width-1)-Math.max(1,o.x-x),h:Math.min(o.y+o.h-y,height-1)-Math.max(1,o.y-y)})).filter(o=>o.w>0&&o.h>0&&!centers.some(p=>p.x>=o.x-3&&p.x<=o.x+o.w+3&&p.y>=o.y-3&&p.y<=o.y+o.h+3));
  obstacles.push({x:0,y:0,w:width,h:1},{x:0,y:height-1,w:width,h:1},{x:0,y:0,w:1,h:height},{x:width-1,y:0,w:1,h:height});
  return {...structuredClone(source),id,presentationKey:source.id+':crop:'+x+','+y,sprint:false,roam:false,rest:false,boss:false,width,height,safe,portal,obstacles,landmarks,spawns:[]};
}

/** 2–3 段，每段只围绕一处地标裁图：按数量平分会把相距两百多格的两处目标切进同一段，
 *  裁出跨海的长条图，目标落在虚空（Grok：抢救船台）。地标组多于 3 组时合并相距最近的相邻两组。 */
export function storyChunks(all:HubStoryStep[],island:Region):HubStoryStep[][]{
  const groups:HubStoryStep[][]=[];for(const s of all){const last=groups.at(-1);if(last&&(last[0].landmark??'landing')===(s.landmark??'landing'))last.push(s);else groups.push([s]);}
  if(groups.length===1){const size=Math.ceil(all.length/Math.min(3,Math.max(2,all.length))),out:HubStoryStep[][]=[];for(let i=0;i<all.length;i+=size)out.push(all.slice(i,i+size));return out;}
  const spot=(g:HubStoryStep[])=>at(island,g[0].landmark??'landing');
  while(groups.length>3){let best=0,gap=Infinity;for(let i=0;i<groups.length-1;i++){const a=spot(groups[i]),b=spot(groups[i+1]),d=Math.hypot(a.x-b.x,a.y-b.y);if(d<gap){gap=d;best=i;}}groups.splice(best,2,[...groups[best],...groups[best+1]]);}
  return groups;
}

export function buildHubDungeonDefinitions(base:DungeonDefinition[]):DungeonDefinition[]{
 const out=[...base];
 for(const region of ['wind','mist'] as const){
  const island='ss-map-'+region,level=region==='wind'?4:10;
  for(const kind of ['story','nest','hunt','tide','treasure','gate'] as const)for(let number=1;number<=(kind==='story'||kind==='nest'?3:1);number++){
   const node=region+'-'+kind+(kind==='story'||kind==='nest'?'-'+number:'');
   const seed=base.find(d=>d.id==='field-'+region+'-'+(kind==='nest'?number:1));if(!seed)throw Error('Missing hub dungeon seed '+node);
   let d=structuredClone(seed);d.id=kind==='nest'?d.id:kind==='story'?'story-'+region+'-'+number:'hub-'+region+'-'+kind;
   d.requires=[];delete d.feature;delete d.story;delete d.bossAccess;
   d.policy.returnRegion='ss-map-port';d.policy.party={min:1,max:1,roles:{},defaultRole:'adventurer'};d.policy.plane={passageRadius:1.2,exitRadius:1.2};
   d.policy.timeLimitSeconds=kind==='treasure'?180:kind==='hunt'||kind==='tide'?600:900;
   d.policy.augments={enabled:true,choices:3,rerolls:1,roundCount:kind==='nest'||kind==='tide'?3:kind==='story'?2:1};
   d.reward={gold:0,xp:0,material:0};d.level=kind==='story'?region==='wind'?1:8:seed.level;
   if(kind!=='nest'){delete d.numericStage;delete d.hardmode;delete d.policy.stageEnemyScale;d.policy.normalGoals={killCount:1,eliteCount:0};}
   if(kind==='gate'){d.stages=['ss-map-boss-'+(region==='wind'?1:2)];const boss=regionById(d.stages[0]).spawns.find(s=>s.boss);if(!boss?.monster)throw Error('Missing authored gate boss '+node);d.policy.monsterLevel=boss.monster.level;d.level=hubChartContent.nodes.find(n=>n.id===node)!.recommendedLevel;}
   else if(kind==='hunt')d.stages=[region==='wind'?'plane-wind-nest-cave-2':'ss-dg-mist-1-3'];
   else if(kind==='tide')d.stages=Array(4).fill(region==='wind'?'plane-wind-nest-crypt-1':'ss-dg-mist-2-1');
   else if(kind==='treasure')d.stages=[region==='wind'?'plane-wind-nest-maze-1':'ss-dg-mist-3-2'];
   else if(kind==='story'){
    // Story encounters keep their authored quest/zone levels and overrides.
    // Only B4's separate combatScale may rebalance them, never a nest's level.
    d.policy.monsterLevel=null;d.policy.enemyScale={hp:1,attack:1,hpPerStage:0,attackPerStage:0};d.level=hubChartContent.nodes.find(n=>n.id===node)!.recommendedLevel;
    const row=hubChartContent.nodes.find(n=>n.id===node);
    const originals=(row?.storySteps??steps.filter(s=>storyTasks[node].includes(s.task))) as unknown as HubStoryStep[];
    if(!originals.length)throw Error('Missing hub story steps '+node);
    const all:HubStoryStep[]=[];
    for(const taskId of [...new Set(originals.map(s=>s.task))]){const task=tasks.find(t=>t.id===taskId);if(!task)throw Error('Missing story task '+taskId);const group=originals.filter(s=>s.task===taskId),accept=dialogueLines(task.dialog_accept??''),complete=dialogueLines(task.dialog_complete??'');
     if(accept.length)all.push({task:taskId,seq:0,op:'talk',key:'intro',label:task.goal,npc:task.giver,landmark:group[0].landmark,dialogueGroup:task.dialog_accept,dialogue:accept});
     all.push(...group);
     if(complete.length)all.push({task:taskId,seq:999,op:'talk',key:'complete-dialogue',label:task.title,npc:task.giver,landmark:group.at(-1)?.landmark,dialogueGroup:task.dialog_complete,dialogue:complete});
    }
    const parts:HubStorySegment[]=[];
    for(const part of storyChunks(all,regionById(island))){const id='hub-map-'+node+'-'+(parts.length+1);if(!regions.some(r=>r.id===id))registerDungeonRegion(cropHubStoryRegion(regionById(island),id,part,level),island);parts.push({steps:structuredClone(part),region:id});}
    hubStorySegments.set(node,parts);d.stages=parts.map(p=>p.region);d.policy.augments.roundCount=parts.length;
   }
   d.hub=hubDungeonTemplateSchema.parse({node,kind,objective:objectives[kind],augmentRounds:d.policy.augments.roundCount});
   d.name=hubChartContent.nodes.find(n=>n.id===node)?.name??d.name;
   const existing=out.findIndex(x=>x.id===d.id);if(existing>=0)out[existing]=d;else out.push(d);
  }
 }
 return out;
}

export function hubStoryRoute(task:string,id:string){return hubStoryRoutes(task).find(r=>r.id===id);}
export function hubStoryRoutes(task:string){const snapshot=hubChartContent.nodes.flatMap(n=>n.storyRoutes).filter(r=>r.task===task);return snapshot.length?snapshot as unknown as typeof routes:routes.filter(r=>r.task===task);}
export function hubStorySpawns(step:HubStoryStep,region:Region,route:string|null,instance:string,level:number){
 if(step.op==='clear_camp'){const camp=worldTables.camps.find(c=>c.id===step.key);if(!camp)throw Error('Missing migrated story camp '+step.key);return campSpawns(regionById(camp.region),worldTables,camp,1).map((s,i)=>({...s,id:instance+':story:'+step.task+':'+step.seq+':'+i,x:region.safe.x+4+i%3,y:region.safe.y+4+Math.floor(i/3)}));}
 const arts=step.op==='route_battle'?hubStoryRoute(step.task,route??'')?.enemies:step.enemies;
 if(!arts?.length)throw Error('Missing story encounter enemies '+step.task+':'+step.seq);
 const point=at(region,step.landmark??'landing'),source=regionById(step.map!),originalPoint=at(source,step.op==='route_battle'?hubStoryRoute(step.task,route??'')?.landmark??step.landmark??'landing':step.landmark??'landing');
 const zone=worldZoneAt(step.map!,originalPoint)??worldTables.zones.find(z=>z.id===step.zone);if(!zone)throw Error('Missing authored story zone '+step.task+':'+step.seq);
 const elite=arts.find(a=>a.startsWith('ss-elite-')),normals=arts.filter(a=>!a.startsWith('ss-elite-')),allowsElite=tasks.find(t=>t.id===step.task)?.elite;
 return Array.from({length:step.count??1},(_,i)=>{const rank=elite&&i===0&&allowsElite?'elite':'normal',template=rank==='elite'?elite!:normals[i%normals.length]??elite!,authoredLevel=Math.min(52,zone.levelBand[0]+(step.seq-1)%(zone.levelBand[1]-zone.levelBand[0]+1)+(rank==='elite'?1:0));return applyEncounterOverrides(resolveMonsterSpawn({id:instance+':story:'+step.task+':'+step.seq+':'+i,template,rank,level:authoredLevel,x:Math.max(2,Math.min(region.width-3,point.x+3+i%3)),y:Math.max(2,Math.min(region.height-3,point.y+3+Math.floor(i/3)))},undefined,step.op==='defend'?{hp:engineDefense.hpMultiplier,attack:engineDefense.attackMultiplier,armor:1}:undefined),step);});
}
