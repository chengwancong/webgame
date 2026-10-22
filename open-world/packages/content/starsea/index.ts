import worldNight from '../world-night.json';
import type {Region} from '../index.ts';
import type {Spawn,Vec} from '../../contracts/index.ts';
import type {MonsterRank} from '../../contracts/monsters.ts';
import {resolveMonsterSpawn} from '../../rules/monster-stats.ts';
import {tasks,steps,routes,chapters,npcs,dialogueLines} from '../task-tables.ts';
import campaignSource from './campaign.json';
import {starseaBalance} from './balance.ts';
import {findPath} from '../../simulation/navigation.ts';
import {decorationBlockers,type StarseaDecoration} from './collision.ts';
import port from './maps/ss-map-port.json';
import wind from './maps/ss-map-wind.json';
import mist from './maps/ss-map-mist.json';
import forge from './maps/ss-map-forge.json';
import frost from './maps/ss-map-frost.json';
import rift from './maps/ss-map-rift.json';
import dragon from './maps/ss-map-dragon.json';
import boss1 from './maps/ss-map-boss-1.json';
import boss2 from './maps/ss-map-boss-2.json';
import boss3 from './maps/ss-map-boss-3.json';
import boss4 from './maps/ss-map-boss-4.json';
import boss5 from './maps/ss-map-boss-5.json';
import boss6 from './maps/ss-map-boss-6.json';

export type StarseaMapSource={id:string;name:string;kind:'hub'|'island'|'boss';chapter:number;width:number;height:number;theme:{key:string;description:string};safe:{id:string;x:number;y:number;w:number;h:number}[];obstacles:{x:number;y:number;w:number;h:number}[];landmarks:{id:string;x:number;y:number}[];spawns:{id:string;artId:string;level:number;rank:string;position:Vec}[];roads:{points:[number,number][]}[];decorations:StarseaDecoration[]};
type DialogueLine={speaker:string;text:string};
export type StarseaTask={id:string;title:string;kind:string;goal:string;speaker:string;accept:DialogueLine[];player:DialogueLine[];complete:DialogueLine[];landmark:string;required:number;requires:string;completionEvent:string;locationMap:string;resources:string[]};
export type StarseaChoice={id:string;name:string;landmark:string;enemies:string[];goal:string;risk:string};
export type StarseaChapter={n:number;id:string;title:string;island:string;map:string;giver:string;ally:string;feature:string;reveal:string;choice:{task:number;a:StarseaChoice;b:StarseaChoice;after:string};tasks:StarseaTask[]};
export type StarseaNpc={id:string;name:string;role:string;voice?:string;idle:string[]};
// 从配置表构建 chapters/npcs，怪物数据暂时保留旧源
const seaChapters=chapters.filter(c=>c.campaign==='starsea').sort((a,b)=>a.order-b.order);
const seaTasks=tasks.filter(t=>t.campaign==='starsea');
const seaNpcs=npcs.filter(n=>n.campaign==='starsea');
const builtChapters:StarseaChapter[]=seaChapters.map(c=>{
 const chTasks=seaTasks.filter(t=>t.chapter===c.id).sort((a,b)=>a.order-b.order);
 const chooseTask=chTasks.find(t=>steps.find(s=>s.task===t.id&&s.op==='choose'));
 const chooseIndex=chooseTask?chTasks.indexOf(chooseTask):-1;
 const rts=chooseTask?routes.filter(r=>r.task===chooseTask.id):[];
 const a=rts.find(r=>r.slot==='a'),b=rts.find(r=>r.slot==='b');
 return {n:c.order,id:c.id,title:c.title,island:c.island??'',map:c.map,giver:c.giver,ally:c.ally,feature:c.feature_text??'',reveal:c.reveal??'',
  choice:{task:chooseIndex,a:a?{id:a.id,name:a.name,landmark:a.landmark??'',enemies:a.enemies,goal:a.goal??'',risk:a.risk??''}:{id:'',name:'',landmark:'',enemies:[],goal:'',risk:''},b:b?{id:b.id,name:b.name,landmark:b.landmark??'',enemies:b.enemies,goal:b.goal??'',risk:b.risk??''}:{id:'',name:'',landmark:'',enemies:[],goal:'',risk:''},after:c.choice_after??''},
  tasks:chTasks.map(t=>{const st=steps.filter(s=>s.task===t.id).sort((a,b)=>a.seq-b.seq);const first=st[0];
   return {id:t.id,title:t.title,kind:t.kind??'',goal:t.goal,speaker:t.giver??'',accept:dialogueLines(t.dialog_accept??''),player:[],complete:dialogueLines(t.dialog_complete??''),
    landmark:first?.landmark??'',required:first?.count??0,requires:t.pre??'',completionEvent:'',locationMap:first?.map??'',resources:[...new Set([...st.flatMap(s=>[s.prop,s.npc,...s.enemies]).filter(Boolean) as string[]])]};})};
});
const oldCampaign=campaignSource as any;
export const starseaCampaign={version:'table-driven',campaignId:'starsea',title:'星潮海',
 npcs:seaNpcs.map(n=>({id:n.id,name:n.name,role:n.role,voice:n.voice,idle:dialogueLines(n.idle??'').map(l=>l.text)})),
 monsters:oldCampaign.monsters as {id:string;name:string;chapter:number[];rank:'normal'|'elite';rule:string;height:number}[],
 bosses:oldCampaign.bosses as {id:string;name:string;chapter:number;base:string}[],
 chapters:builtChapters};
export const starseaMaps:StarseaMapSource[]=([port,wind,mist,forge,frost,rift,dragon,boss1,boss2,boss3,boss4,boss5,boss6] as unknown as StarseaMapSource[]).map(m=>({...m,obstacles:decorationBlockers(m.decorations).map(({x,y,w,h})=>({x,y,w,h}))}));
export const starseaHub='ss-map-port';
export const starseaIslands=['ss-map-wind','ss-map-mist','ss-map-forge','ss-map-frost','ss-map-rift','ss-map-dragon'];
/** 分章掉落：每座岛偏重两个装备系（服务端掉落权重 ×3），航图上公开显示，想凑哪套就去哪座岛刷。 */
export const starseaLootFocus:readonly (readonly ('sword'|'hammer'|'axe'|'staff'|'hidden'|'wand')[])[]=[['sword','hidden'],['staff','wand'],['hammer','axe'],['wand','hidden'],['staff','sword'],['axe','hammer']];
export const starseaBossMaps=starseaIslands.map((_,i)=>'ss-map-boss-'+(i+1));
export const isStarseaRegion=(id:string)=>id.startsWith('ss-map-');

/** 岛屿等级段（docs/hybrid-implementation.md §3）。裂星潮后六岛整体升阶到 38–52。 */
export {starseaBalance};
export const islandBands=starseaBalance.islandBands;
export const hardmodeBands:[number,number][]=[[38,41],[40,43],[42,45],[44,47],[46,49],[48,52]];
export const bossLevels=starseaBalance.bossLevels,hardmodeBossLevels=[42,44,46,48,50,52];
export function islandBand(chapter:number,hardmode=false){const band=(hardmode?hardmodeBands:islandBands)[chapter-1];if(!band)throw Error('Unknown starsea chapter '+chapter);return band;}

// Deterministic placement: the same island always has the same field population.
function random(seed:string){let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);return()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return ((h>>>0)%100000)/100000;};}
const inside=(p:Vec,r:{x:number;y:number;w:number;h:number},margin=0)=>p.x>=r.x-margin&&p.x<=r.x+r.w+margin&&p.y>=r.y-margin&&p.y<=r.y+r.h+margin;
const landmark=(m:StarseaMapSource,id:string)=>m.landmarks.find(l=>l.id===id);
/** 生命星晶与星核（泰拉瑞亚的生命水晶）：每岛 2 处生命星晶（各 +5% 最大生命），裂星潮后每岛 1 处星核（伤害 [×]1.1）。
 * 位置按地图确定性挑选：避开安全区、碰撞、任务地标，尽量藏在远离道路和地标的角落。 */
export type StarseaRelic={id:string;kind:'life'|'core';map:string;name:string;x:number;y:number};
export const lifeCrystalHp=.05;
/** 星潮夜：同一座岛累计击杀多少只野怪触发一次入侵，入侵规模。 */
export const tideNightKills=worldNight.killThreshold,tideNightSize=worldNight.count;
function relicSpots(m:StarseaMapSource):Vec[]{
 const roads=m.roads.flatMap(r=>r.points.map(([x,y])=>({x,y}))),marks=m.landmarks.map(l=>({x:l.x,y:l.y})),chosen:Vec[]=[];
 const free=(p:Vec)=>!m.safe.some(s=>inside(p,s,3))&&!m.obstacles.some(o=>inside(p,o,2))&&marks.every(l=>Math.hypot(p.x-l.x,p.y-l.y)>=8);
 const cells:Vec[]=[];for(let y=5;y<=m.height-6;y+=2)for(let x=5;x<=m.width-6;x+=2){const p={x,y};if(free(p))cells.push(p);}
 const near=(p:Vec,list:Vec[])=>list.reduce((d,q)=>Math.min(d,Math.hypot(p.x-q.x,p.y-q.y)),99);
 for(let k=0;k<3;k++){const best=cells.map(p=>({p,score:Math.min(near(p,marks),near(p,roads)*1.5,near(p,chosen)*.8)})).sort((a,b)=>b.score-a.score||a.p.y-b.p.y||a.p.x-b.p.x)[0];if(best)chosen.push(best.p);}
 return chosen;
}
export function placementLevel(chapter:number,progress:number,rank:MonsterRank,hardmode=false){
 if(rank==='boss')return (hardmode?hardmodeBossLevels:bossLevels)[chapter-1];
 const [low,high]=islandBand(chapter,hardmode);return Math.min(hardmode?high:high+(rank==='elite'?1:0),Math.round(low+(high-low)*progress)+(rank==='elite'?1:0));
}
export function starseaSpawns(m:StarseaMapSource,hardmode=false):Spawn[]{return m.kind==='boss'?m.spawns.map(p=>resolveMonsterSpawn({id:p.id,template:p.artId,level:placementLevel(m.chapter,1,'boss',hardmode),rank:'boss',x:p.position.x,y:p.position.y})):[];}

/** 地区横幅副标题。地图 theme.description 是给美术的场景说明，不给玩家看。 */
const starseaSubtitles:Record<string,string>={'ss-map-port':'群岛的主港，每次远航都从这里出发','ss-map-wind':'草坡上的旧船台，常年吹着海风','ss-map-mist':'雾铃声里的林间邮路','ss-map-forge':'炉火不熄的工坊之岛','ss-map-frost':'冻舰沉睡的冰原与观测站','ss-map-rift':'界隙撕开的废城与难民营','ss-map-dragon':'龙骨与旧航网守着的誓约之地'};
export function starseaRegion(m:StarseaMapSource):Region{
 const at=(id:string)=>{const l=landmark(m,id);if(!l)throw Error(`Starsea map ${m.id} lacks landmark ${id}`);return {x:l.x,y:l.y};};
 const safe=m.kind==='hub'?{x:14,y:20}:m.kind==='boss'?at('safe'):at('landing'),portal=m.kind==='hub'?at('stargate'):safe;
 // 首领场以地点为名，副标题写首领。
 const boss=m.kind==='boss'?starseaCampaign.bosses[m.chapter-1]:undefined;
 return {id:m.id,presentationKey:m.id,name:boss?m.theme.description:m.name,subtitle:boss?'首领 · '+boss.name:starseaSubtitles[m.id]??'',width:m.width,height:m.height,theme:'starsea-'+m.theme.key,safe,portal,bossPortal:m.kind==='island'?at('gate'):undefined,
  sprint:m.kind==='island',boss:m.kind==='boss',auto:m.kind!=='hub',rest:m.kind==='hub',calmRegen:m.kind==='island'?.03:undefined,aggroRadius:m.kind==='island'?8:undefined,roam:m.kind==='island'||undefined,obstacles:m.obstacles.map(o=>({...o})),spawns:starseaSpawns(m),landmarks:m.landmarks.map(l=>({name:l.id,x:l.x,y:l.y,kind:l.id}))};
}
export const starseaRegions:Region[]=starseaMaps.map(starseaRegion);
const formalStarseaMaps=new Map<string,StarseaMapSource>();
/** Formal maps retain their island IDs. Quest/NPC locations consume the same
 * generated geometry and landmarks as field combat and the browser. */
export function registerStarseaFieldMap(map:StarseaMapSource){if(map.kind!=='island'||map.width!==512||map.height!==512||!starseaIslands.includes(map.id))throw Error('Invalid formal starsea island '+map.id);formalStarseaMaps.set(map.id,map);const at=starseaMaps.findIndex(m=>m.id===map.id);if(at>=0)starseaMaps[at]=map;}
export const starseaMap=(id:string)=>{const m=formalStarseaMaps.get(id)??starseaMaps.find(m=>m.id===id);if(!m)throw Error('Unknown starsea map '+id);return m;};
export const starseaChapterOf=(mapId:string)=>starseaMap(mapId).chapter;
export const starseaRelics:StarseaRelic[]=starseaIslands.flatMap(id=>{const m=starseaMap(id),spots=relicSpots(m),island=id.replace('ss-map-','');if(spots.length<3)throw Error('No room for relics on '+id);
 return [{id:'life-'+island+'-1',kind:'life' as const,map:id,name:'生命星晶',...spots[0]},{id:'life-'+island+'-2',kind:'life' as const,map:id,name:'生命星晶',...spots[1]},{id:'core-'+island,kind:'core' as const,map:id,name:'星核',...spots[2]}];});
