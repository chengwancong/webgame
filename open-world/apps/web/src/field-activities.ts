import {eventPointVisible} from './field-freeze-gate.ts';
import {importSnapshotHexCooldowns} from './hex-cooldown-import.ts';
import {interactionReach} from '../../../packages/rules/world-interactions.ts';
import type {FieldEventEffect} from './field-event-effects.ts';
import {statusBar,esc,helpHtml} from './ui-components.ts';
import {exploredAt} from '../../../packages/rules/exploration.ts';
import type {FieldMapView} from './field-controller.ts';
import {regionById} from '../../../packages/content/index.ts';
import type {Snapshot} from '../../../packages/contracts/index.ts';
import type {FieldActivityView} from '../../../packages/contracts/field-activities.ts';
import {worldTables} from '../../../packages/content/world-tables.ts';
import {World,distance,type WorldCheckpoint} from '../../../packages/simulation/index.ts';
import type {StarseaSceneObject} from './starsea-runtime-assets.ts';
import {api} from './network.ts';
import {hexActivityNotice} from './hex-combat-summary.ts';
type Deps={world:()=>World;snapshot:()=>Snapshot|undefined;lease:()=>string;ready:()=>boolean;write:(path:string,body:object)=>Promise<string|undefined>;replace:(world:World)=>void;settle:()=>Promise<unknown>;returned:()=>Promise<unknown>;notice:(text:string)=>void;refresh:()=>void;freeze?:()=>Readonly<import('../../../packages/contracts/field-freeze.ts').FieldFreeze>|undefined;dungeon:(id:string)=>void;plane:(dungeon:string,gate:string)=>void};
/** Displays server-owned instances. All combat movement, completion, cooldowns,
 * reward quantities and phase visibility come from the authoritative response. */
export class FieldActivities{
 effects:FieldEventEffect[]=[];private effectTransitions=new Set<string>();
 activities:FieldActivityView[]=[];sequence=0;private pending=false;private at=0;private prior?:World;private current?:FieldActivityView;private inputAt=0;private movement='';private claiming='';private end='';private renderedTick=-1;private renderInstance='';private inputPending=false;private refreshAt=0;
 constructor(private deps:Deps){}
 get running(){return Boolean(this.current?.status==='running');}
 get authoritative(){return Boolean(this.current?.battle&&['running','success','failed'].includes(this.current.status));}
 async restore(){await this.poll();return this.authoritative;}
 step(now=performance.now()){if(this.pending||!this.deps.ready()||now-this.at<(this.authoritative?100:3000))return;this.at=now;void this.poll();}
 private async poll(){if(this.pending)return;this.pending=true;const previous=this.current;try{
  const view=await api<{activities:FieldActivityView[]}>('field/activity');this.activities=view.activities;
  const active=this.activities.find(a=>['running','success','failed'].includes(a.status)&&a.battle&&(a.status!=='failed'||a.instance!==this.end));
  if(active){if(!this.prior){const existing=this.deps.world(),s=this.deps.snapshot()!;this.prior=existing.region.id===active.region?existing:new World(regionById(active.region),s.stats,s.resolvedSkills,[],[],1);}this.current=active;const row=worldTables.events.find(e=>e.id===active.target),transition=active.instance+':'+active.status,resource=active.status==='running'?row?.startEffect:active.status==='success'?row?.successEffect:row?.failureEffect;if(resource&&!this.effectTransitions.has(transition)){this.effectTransitions.add(transition);this.effects.push({id:transition,resource,...active.position,startedTick:active.tick});if(this.effects.length>20)this.effects.splice(0,this.effects.length-20);}const restored=World.restore(active.battle as WorldCheckpoint);if(this.renderInstance!==active.instance){this.renderInstance=active.instance;this.renderedTick=-1;}restored.events=restored.events.filter(e=>e.tick>this.renderedTick);this.renderedTick=active.tick;this.deps.replace(restored);this.sequence++;
   if(active.status==='success'&&this.claiming!==active.instance){this.claiming=active.instance;const hexNote=hexActivityNotice(active.hexCombatStats);const result=await this.deps.write('field/activity/claim',{instance:active.instance});if(result==='success'){this.deps.notice(active.name+'完成，收益已结算');if(hexNote)this.deps.notice(hexNote);await this.finish();}else this.claiming='';}
   else if(active.status==='failed'&&this.end!==active.instance){this.end=active.instance;this.deps.notice(active.reason);await this.finish();}
  }
  if(!active&&this.current)await this.finish();
  const now=performance.now();if(previous?.instance!==this.current?.instance||previous?.status!==this.current?.status||now-this.refreshAt>=250){this.refreshAt=now;this.deps.refresh();}
 }catch(error){this.deps.notice(error instanceof Error?error.message:'世界活动暂时无法同步');}finally{this.pending=false;}}
 private async finish(){const current=this.deps.world(),prior=this.prior;this.current=undefined;this.prior=undefined;if(prior){prior.carrySoloRunState(current);prior.hero.position={...current.hero.position};prior.anchor={...prior.hero.position};prior.setMode('auto');this.deps.replace(prior);}await this.deps.returned();if(prior)importSnapshotHexCooldowns(this.deps.world(),this.deps.snapshot());}
 async interact(id:string){if(this.running)return;const object=this.objects().find(o=>o.id===id);if(!object||distance(object.position,this.deps.world().hero.position)>(object.reach??interactionReach.activity))return;
  if(id.startsWith('field-dungeon:')){this.deps.dungeon(id.slice('field-dungeon:'.length));return;}
  if(id.startsWith('plane-gate:')){const gate=worldTables.planeGates.find(g=>'plane-gate:'+g.id===id);if(gate)this.deps.plane(gate.plane,gate.id);return;}
  const kind=id.startsWith('field-event:')?'event':id.startsWith('field-rare:')?'rare':'chest',target=id.slice(id.indexOf(':')+1);await this.deps.settle();const result=await this.deps.write('field/activity/start',{kind,target,region:this.deps.world().region.id,position:{...this.deps.world().hero.position}});if(result!=='success')return;
  const view=await api<{activities:FieldActivityView[]}>('field/activity');this.activities=view.activities;const started=this.activities.find(a=>a.target===target)!;
  if(kind==='chest'){await this.deps.write('field/activity/claim',{instance:started.instance});await this.poll();}else await this.poll();
 }
 move(x:number,y:number){x=Math.max(-1,Math.min(1,x));y=Math.max(-1,Math.min(1,y));const key=x+','+y,now=performance.now();if(!this.running||this.inputPending||key===this.movement&&(!x&&!y||now-this.inputAt<400))return;this.inputAt=now;this.movement=key;void this.input({movement:{x,y}});}
 go(destination:{x:number;y:number}){void this.input({destination});}
 mode(mode:'manual'|'semi'|'auto'){void this.input({mode});}
 cast(index:number,target?:{x:number;y:number}){const skill=this.deps.world().skills[index];if(skill)void this.input({skill:skill.id,...(target?{target}:{})});}
 private async input(body:object){if(!this.running||this.inputPending)return;this.inputPending=true;try{await api('field/activity/input',{lease_id:this.deps.lease(),instance:this.current!.instance,...body});}catch(error){this.movement='';this.deps.notice(error instanceof Error?error.message:'世界活动输入未送达');}finally{this.inputPending=false;}}
 objects():StarseaSceneObject[]{const s=this.deps.snapshot(),region=this.deps.world().region.id,phase=s?.worldView;if(!s)return [];const view=(id:string)=>this.activities.find(a=>a.target===id),visible=(key:'events'|'chests'|'rares'|'dungeonEntrances',row:{id:string;when?:string;until?:string})=>phase?.[key].includes(row.id)??(!row.when&&!row.until),out:StarseaSceneObject[]=[];
  for(const row of worldTables.events)if(row.region===region&&visible('events',row)){const status=view(row.id);if(!eventPointVisible(this.deps.freeze?.(),status?.status))continue;out.push({id:'field-event:'+row.id,artId:status?.status==='running'?row.activeResource??row.resource:status?.status==='cooldown'?row.cooldownResource??row.resource:row.resource,position:{x:row.x,y:row.y},name:row.name,label:status?.status==='cooldown'?`冷却 ${Math.ceil(status.remainingSeconds)}秒`:'开始事件',enabled:!status||['ready','failed'].includes(status.status)});}
  for(const row of worldTables.chests)if(row.region===region&&visible('chests',row)){const opened=view(row.id)?.status==='claimed';out.push({id:'field-chest:'+row.id,artId:opened?row.openResource:row.resource,position:{x:row.x,y:row.y},name:'宝箱',reach:interactionReach.activity,label:opened?'已开启':'打开宝箱',enabled:!opened});}
  for(const row of worldTables.rares)if(row.region===region&&visible('rares',row)){const status=view(row.id);if(status&&['running','success','cooldown'].includes(status.status))continue;out.push({id:'field-rare:'+row.id,artId:row.resource,position:status?.position??row.spots[0],name:row.name,label:'挑战稀有',enabled:!status||['ready','failed'].includes(status.status)});}
  for(const row of worldTables.dungeonEntrances)if(row.region===region&&visible('dungeonEntrances',row))out.push({id:'field-dungeon:'+row.id,artId:row.resource,position:{x:row.x,y:row.y},name:'地城入口',label:'查看地城',enabled:s.starsea?.features.includes('field-dungeon')??false});
  // Plane gates: discovery and state are server-owned (world view); hidden gates are not drawn.
  for(const row of worldTables.planeGates)if(row.region===region){const state=phase?.planeGates.find(g=>g.id===row.id)?.state??'hidden';if(state==='hidden')continue;out.push({id:'plane-gate:'+row.id,artId:row.resource,position:{x:row.x,y:row.y},name:row.name,label:{open:'进入位面',locked:'尚未开启',cooldown:'冷却中',cleared:'已通关'}[state],enabled:state==='open'});}
  return out;
 }
 markers(field:FieldMapView){const world=this.deps.world();return this.objects().filter(o=>exploredAt(field.explored,world.region.width,world.region.height,o.position)).map(o=>({id:o.id,name:o.name+' · '+o.label,x:o.position.x,y:o.position.y,main:false,question:false,resource:worldTables.events.find(e=>'field-event:'+e.id===o.id)?.markerResource??o.artId}));}
 renderHud(){if(!this.authoritative)return;const hud=document.getElementById('dungeon-hud');if(!hud)return;const current=this.current!;hud.hidden=false;document.body.dataset.dungeonActive='true';hud.innerHTML=`<div class="dungeon-running-head"><strong>${esc(current.name)}</strong><span>${Math.ceil(current.remainingSeconds)} 秒</span></div><div class="dungeon-hud-body">${statusBar('neutral',current.total?current.killed/current.total:0,`击败 ${current.killed} / ${current.total} · 波次 ${current.waves} / ${current.waveCount}`)}${current.objectiveMaxHp?statusBar('hp',current.objectiveHp!/current.objectiveMaxHp,`守护目标 ${Math.ceil(current.objectiveHp!)} / ${current.objectiveMaxHp}`):''}${helpHtml('离开活动范围会失败；断线后活动继续运行。')}</div>`;}
 nearest(){return this.objects().filter(o=>o.enabled&&distance(o.position,this.deps.world().hero.position)<=(o.reach??interactionReach.activity)).sort((a,b)=>distance(a.position,this.deps.world().hero.position)-distance(b.position,this.deps.world().hero.position))[0];}
 inspect(){return {running:this.running,authoritative:this.authoritative,sequence:this.sequence,current:this.current&&{instance:this.current.instance,target:this.current.target,status:this.current.status,tick:this.current.tick},activities:this.activities.map(a=>({target:a.target,status:a.status,tick:a.tick}))};}
}
