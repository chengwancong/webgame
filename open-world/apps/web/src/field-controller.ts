import type {FieldReplayGoal} from '../../../packages/contracts/replay-pilots.ts';
import {nearestWalkable} from './landing-nudge.ts';
import type {WorldPhaseView} from '../../../packages/contracts/open-world.ts';
import type {FieldCamps,Permit,Snapshot} from '../../../packages/contracts/index.ts';
import {fieldRegionInfo} from '../../../packages/content/index.ts';
import {worldTables,worldZoneAt} from '../../../packages/content/world-tables.ts';
import type {World} from '../../../packages/simulation/index.ts';
import {campSource} from '../../../packages/rules/world-camps.ts';
import {exploredAt,mergeExploration,revealExploration} from '../../../packages/rules/exploration.ts';
import {zoneGuide,type GuideTarget} from '../../../packages/rules/zone-guide.ts';
import {api} from './network.ts';
import {parseFieldFreeze,type FieldFreeze} from '../../../packages/contracts/field-freeze.ts';

/** Re-asks for streamed camp state and saves exploration; the current entry never respawns cleared camps. */
const pollMs=10000;
// 战斗上报每轮都换版本号：世界阶段没变时只在距上次读取满 3 秒后补读营地，不逐轮重读。
const revisionPollMs=3000;
/** Same reach as other world interactions (quest targets: 4.5 cells server-side). */
const waypointReach=4;
/** Engaged enemies this close block waypoint travel on the client. */
const combatReach=12;

export type FieldMapView={replay?:FieldReplayGoal|null;replayError?:string;activities?:import('./ui/minimap-data.ts').MapMarker[];explored:string;waypoints:{id:string;name:string;x:number;y:number;unlocked:boolean}[]};
type Deps={world:()=>World;permit:()=>Permit|undefined;snapshot:()=>Snapshot|undefined;lease:()=>string;ready:()=>boolean;failed:(e:unknown)=>void;banner:(text:string)=>void;refresh?:()=>void};

/** Field-region runtime on the client: camp streaming (load within 2 chunks, unload
 * idle members out of range), exploration fog, zone banners and waypoint lookups.
 * The server alone decides camp cycles, waypoint unlocks and travel. */
export class FieldController{
 private replay?:FieldReplayGoal|null;private replayError='';
 private phase?:WorldPhaseView;private revision=-1;private phaseKey='';private stale=false;
 private key='';private at=0;private pending?:Promise<void>;private error='';
 /** Members the hero killed here: never re-added even if a report is still in flight. */
 private gone=new Set<string>();
 private world?:World;private zone='';
 /** Server-published switches (GET /api/content.fieldFreeze); all false until read or if unreadable, so the UI never hides on a guess. */
 private freezeState:Readonly<FieldFreeze>=parseFieldFreeze();private freezeAsked=false;private freezeRetryAt=0;
 /** Fog revealed locally since entering; merged upward with the saved bitmap. */
 private explored='';private sent='';private cell='';
 private guideKey='';private guided?:GuideTarget;
 /** Cleared camps are not reselected after a local timer; only server-supplied living camps clear the mark. */
 private empty=new Map<string,number>();private autoZone='';
 constructor(private deps:Deps){}
 freeze(){return this.freezeState;}
 private loadFreeze(){if(this.freezeAsked||performance.now()<this.freezeRetryAt)return;this.freezeAsked=true;api<{fieldFreeze?:unknown}>('content').then(v=>{try{this.freezeState=parseFieldFreeze(v.fieldFreeze??{});this.deps.refresh?.();}catch{/* unknown shape: keep entries visible, server still refuses */}}).catch(()=>{this.freezeAsked=false;this.freezeRetryAt=performance.now()+30000;});}
 active(){return Boolean(fieldRegionInfo(this.deps.world().region.id));}
 step(now=performance.now()){
  const w=this.deps.world(),p=this.deps.permit(),info=fieldRegionInfo(w.region.id);
  if(w!==this.world){this.world=w;this.replay=undefined;this.replayError='';this.phase=undefined;this.revision=-1;this.gone.clear();this.empty.clear();this.key='';this.zone='';this.autoZone='';this.cell='';this.explored=this.sent=this.saved(w.region.id);}
  if(!info)return;
  this.loadFreeze();
  const snapshot=this.deps.snapshot();if(snapshot&&snapshot.revision!==this.revision){this.revision=snapshot.revision;this.phase=snapshot.worldView;const phaseKey=JSON.stringify(snapshot.worldView??null);if(phaseKey!==this.phaseKey){this.phaseKey=phaseKey;this.key='';}else this.stale=true;}
  this.reveal(w);this.announce(w);this.roam(w,now);
  if(!p||p.region!==w.region.id||this.pending||!this.deps.ready())return;
  for(const k of w.kills)this.gone.add(k.source_id);
  const key=p.id+':'+Math.floor(w.hero.position.x/info.chunkCells)+','+Math.floor(w.hero.position.y/info.chunkCells);
  if(key===this.key&&now-this.at<(this.stale?revisionPollMs:pollMs))return;
  this.key=key;this.at=now;this.stale=false;
  const position={x:Math.round(w.hero.position.x*10)/10,y:Math.round(w.hero.position.y*10)/10},explored=this.explored;
  this.pending=api<FieldCamps>('field/camps',{lease_id:this.deps.lease(),permit_id:p.id,position,...(explored!==this.sent?{explored}:{})}).then(v=>{this.sent=explored;this.apply(w,v);return this.loadReplay(w);}).catch(e=>{this.error=e instanceof Error?e.message:String(e);this.deps.failed(e);}).finally(()=>{this.pending=undefined;});
 }
 /** Full auto stays in the zone it was started in (expansion plan §3.3): living enemies there
  * first, then the nearest uncleared camp in that zone; when none remains it explains the next explicit action. */
 private roam(w:World,now:number){
  if(w.mode!=='auto'){this.autoZone='';w.roamGuide=undefined;return;}
  if(!this.autoZone)this.autoZone=worldZoneAt(w.region.id,w.hero.position)?.id??'';
  const zone=(this.phase?.zones.length?this.phase.zones:worldTables.zones).find(z=>z.id===this.autoZone);if(!zone){w.roamGuide=undefined;return;}
  // Loaded camps whose members are all down count as empty at once, before the next poll.
  const groups=new Map<string,boolean>();for(const e of w.enemies){const at=campSource(e.id);if(at)groups.set(at.camp,(groups.get(at.camp)??false)||e.alive);}
  for(const [camp,alive] of groups)if(alive)this.empty.delete(camp);else if(!this.empty.has(camp))this.empty.set(camp,now);
  if(w.roamGuide?.bounds===zone.rect)return;
  w.roamGuide={bounds:zone.rect,emptyReason:'这片已清空，去下一片或回港。',next:()=>{const h=w.hero.position;
   return worldTables.camps.filter(c=>(this.phase?.camps.includes(c.id)??(!c.when&&!c.until))&&c.zone===zone.id&&!this.empty.has(c.id)).sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y))[0];}};
 }
 private async loadReplay(w:World){const before=JSON.stringify([this.replay,this.replayError]);try{const v=await api<{goal:FieldReplayGoal|null}>('field/replay-goal?region='+encodeURIComponent(w.region.id));if(this.deps.world()!==w)return;const old=this.replay;this.replay=v.goal;this.replayError='';if(old&&v.goal?.visit===old.visit&&!old.done&&v.goal.done)this.deps.banner('走访完成：'+v.goal.label);}catch{if(this.deps.world()!==w)return;this.replayError='走访目标还没读到，稍后再看。';}if(before!==JSON.stringify([this.replay,this.replayError]))this.deps.refresh?.();}
 /** Hero within reach of a waypoint of this map, if any. */
 nearbyWaypoint(){const w=this.deps.world();if(this.freezeState.waypoints)return undefined;return worldTables.waypoints.filter(w=>this.phase?.waypoints.includes(w.id)??(!w.when&&!w.until)).find(x=>x.region===w.region.id&&Math.hypot(x.x-w.hero.position.x,x.y-w.hero.position.y)<=waypointReach);}
 unlocked(id:string){return Boolean(this.deps.snapshot()?.starsea?.waypoints?.includes(id));}
 /** Client-side courtesy check; the server refuses travel during quest waves too. */
 inCombat(){const w=this.deps.world();return w.enemies.some(e=>e.alive&&e.engaged&&Math.hypot(e.position.x-w.hero.position.x,e.position.y-w.hero.position.y)<=combatReach);}
 /** Full-map data: fog bitmap plus waypoints standing in explored cells (or unlocked). */
 mapView():FieldMapView|undefined{
  const w=this.deps.world();if(!this.active())return;const {width,height}=w.region;
  return {replay:this.replay?.map===w.region.id?this.replay:undefined,replayError:this.replayError,explored:this.explored,waypoints:this.freezeState.waypoints?[]:worldTables.waypoints.filter(x=>x.region===w.region.id&&(this.phase?.waypoints.includes(x.id)??(!x.when&&!x.until))).map(x=>({id:x.id,name:x.name,x:x.x,y:x.y,unlocked:this.unlocked(x.id)})).filter(x=>x.unlocked||exploredAt(this.explored,width,height,x))};
 }
 /** Guide target adjusted for zones: other-zone targets point at an unlocked waypoint
  * there or at this zone's exit. The route is re-planned per 8-cell move, not per frame. */
 route(target:GuideTarget|undefined){
  const w=this.deps.world();if(!target||!this.active())return target;
  const unlocked=this.deps.snapshot()?.starsea?.waypoints??[],key=[w.region.id,Math.floor(w.hero.position.x/8),Math.floor(w.hero.position.y/8),target.x,target.y,target.label,unlocked.length].join(':');
  if(key!==this.guideKey){this.guideKey=key;this.guided=zoneGuide(w.region,w.hero.position,target,unlocked);}
  return this.guided;
 }
 /** Move the local hero after the server accepted the travel. */
 arrive(id:string){const w=this.deps.world(),target=worldTables.waypoints.filter(w=>this.phase?.waypoints.includes(w.id)??(!w.when&&!w.until)).find(x=>x.id===id&&x.region===w.region.id);if(!target)return;w.setMode(w.mode);w.hero.position=nearestWalkable(w.region,{x:target.x,y:target.y});w.anchor={...w.hero.position};this.key='';}
 private saved(region:string){return this.deps.snapshot()?.world?.exploration?.[region]??'';}
 private reveal(w:World){
  const cell=Math.floor(w.hero.position.x/8)+','+Math.floor(w.hero.position.y/8);if(cell===this.cell)return;this.cell=cell;
  const {width,height}=w.region;try{this.explored=mergeExploration(revealExploration(this.explored,width,height,w.hero.position),this.saved(w.region.id),width,height);}catch{/* off-map positions are not explored */}
 }
 private announce(w:World){
  const geometry=worldZoneAt(w.region.id,w.hero.position),zone=this.phase?.zones.find(z=>z.id===geometry?.id);if(!geometry||geometry.id===this.zone)return;const first=!this.zone;this.zone=geometry.id;
  // Entering the map already shows the region banner; later zone changes get their own.
  if(!first)this.deps.banner(zone?`${zone.name} · Lv.${zone.levelBand[0]}–${zone.levelBand[1]}`:`${geometry.name} · 等级待同步`);
 }
 private apply(w:World,view:FieldCamps){
  if(this.deps.world()!==w||view.region!==w.region.id)return;
  this.phase=view.world_view??this.deps.snapshot()?.worldView;
  try{this.explored=mergeExploration(this.explored,view.explored,w.region.width,w.region.height);}catch{/* keep local fog */}
  for(const k of w.kills)this.gone.add(k.source_id);
  // Derived from the world itself, so members a renewed permit re-created are unloaded too.
  const near=new Set(view.camps.map(c=>c.id)),far=w.enemies.filter(e=>{const at=campSource(e.id);return at&&!near.has(at.camp);});
  for(const e of far)if(!e.alive)this.gone.add(e.id);
  if(far.length)w.removeSpawns(far.map(e=>e.id));
  for(const camp of view.camps)if(camp.spawns.length)this.empty.delete(camp.id);else if(!this.empty.has(camp.id))this.empty.set(camp.id,performance.now());
  const present=new Set(w.enemies.map(e=>e.id));
  for(const camp of view.camps){
   const added=camp.spawns.filter(m=>!present.has(m.id)&&!this.gone.has(m.id));if(added.length)w.addSpawns(added);
   const unbound=w.enemies.filter(e=>e.alive&&!e.home&&!e.monster?.patrol&&campSource(e.id)?.camp===camp.id).map(e=>e.id);if(unbound.length)w.bindCamp(camp,unbound);
  }
 }
 /** Diagnostics for QA probes. */
 inspect(){const w=this.deps.world(),members=w.enemies.filter(e=>campSource(e.id));return {camps:new Set(members.map(e=>campSource(e.id)!.camp)).size,members:members.length,living:members.filter(e=>e.alive).length,gone:this.gone.size,key:this.key,pending:Boolean(this.pending),error:this.error,region:this.active(),zone:this.zone,inCombat:this.inCombat(),explored:this.explored};}
}
