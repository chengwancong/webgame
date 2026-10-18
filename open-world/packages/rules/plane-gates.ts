import type {CharacterState} from '../contracts/index.ts';
import {worldProgressSchema,type PlaneGateView,type PlaneProgress,type WorldTables} from '../contracts/open-world.ts';
import {worldTables} from '../content/world-tables.ts';
import {conditionMet} from './quest-conditions.ts';
import {worldPhaseVisible} from './world-phase.ts';
/** 箱庭位面入口（plane-world-design F1 / F8）。状态只由服务端按角色算；客户端只画。 */
export type PlaneGate=WorldTables['planeGates'][number];
type Character=Pick<CharacterState,'level'|'starsea'>&{world?:CharacterState['world']};
type Point={x:number;y:number};
/** Interact discovery and plane entry trust only an observer position the server recorded this recently. */
export const PLANE_OBSERVER_MS=3000;
export class PlaneGateError extends Error{constructor(readonly code:string,message:string){super(message);}}
/** Read-only view of the stored progress (old saves → empty). */
export function planeProgress(character:Character):PlaneProgress{return worldProgressSchema.parse(character.world??{}).planes;}
function entry(planes:PlaneProgress,id:string){return planes[id]??={found:false,clears:0,secrets:[]};}
function found(character:Character,gate:PlaneGate,planes:PlaneProgress){return !!planes[gate.id]?.found||gate.discover==='fact'&&conditionMet(character,gate.fact!);}
export function planeGateState(character:Character,gate:PlaneGate,now:number,planes=planeProgress(character)):PlaneGateView{
 const row=planes[gate.id],clears=row?.clears??0,cooldownUntil=row?.cooldownUntil&&row.cooldownUntil>now?row.cooldownUntil:undefined;
 const state=!found(character,gate,planes)?'hidden':gate.requires&&!conditionMet(character,gate.requires)?'locked':!gate.repeatable&&clears>0?'cleared':cooldownUntil?'cooldown':'open';
 return {id:gate.id,state,clears,...(state==='cooldown'?{cooldownUntil}:{})};
}
/** Gates in the character's current world phase, with per-character state. */
export function resolvePlaneGates(character:Character,now:number,tables:WorldTables=worldTables):PlaneGateView[]{
 const planes=planeProgress(character);return tables.planeGates.filter(g=>worldPhaseVisible(character,g)).map(g=>planeGateState(character,g,now,planes));
}
function writable(character:Character){const world=worldProgressSchema.parse(character.world??{});character.world=world;return world.planes;}
/** Proximity and fact discovery for a server-trusted observer position. Mutates
 * `character.world.planes`; returns the newly found gate ids (for the toast). */
export function discoverPlaneGates(character:Character,region:string,position:Point,now:number,tables:WorldTables=worldTables):string[]{
 const candidates=tables.planeGates.filter(g=>g.region===region&&g.discover!=='interact'&&worldPhaseVisible(character,g));
 const current=planeProgress(character),fresh=candidates.filter(g=>!current[g.id]?.found&&(g.discover==='fact'?conditionMet(character,g.fact!):Math.hypot(g.x-position.x,g.y-position.y)<=g.discoverRadius));
 if(!fresh.length)return [];const planes=writable(character);
 for(const g of fresh){const row=entry(planes,g.id);row.found=true;row.foundAt=now;}
 return fresh.map(g=>g.id);
}
function gateNear(character:Character,id:string,region:string,position:Point,tables:WorldTables){
 const gate=tables.planeGates.find(g=>g.id===id);if(!gate||!worldPhaseVisible(character,gate))throw new PlaneGateError('PLANE_GATE','这里没有这个入口。');
 if(gate.region!==region||Math.hypot(gate.x-position.x,gate.y-position.y)>gate.interactRadius)throw new PlaneGateError('PLANE_GATE_FAR','请走到入口旁边。');
 return gate;
}
/** Interact discovery (破墙、拨开藤蔓、摇铃): the observer must stand within interactRadius. Idempotent. */
export function interactPlaneGate(character:Character,id:string,region:string,position:Point,now:number,tables:WorldTables=worldTables){
 const gate=gateNear(character,id,region,position,tables);
 if(gate.discover==='fact'&&!conditionMet(character,gate.fact!))throw new PlaneGateError('PLANE_GATE_SEALED','入口还没有被打开。');
 const planes=writable(character),row=entry(planes,gate.id),fresh=!row.found;if(fresh){row.found=true;row.foundAt=now;}
 return {gate,fresh};
}
/** Entry validation used by the plane instance (F2). Throws a player-facing reason. */
export function assertPlaneGateEnterable(character:Character,id:string,region:string,position:Point,now:number,tables:WorldTables=worldTables){
 const gate=gateNear(character,id,region,position,tables),view=planeGateState(character,gate,now);
 if(view.state==='hidden')throw new PlaneGateError('PLANE_GATE_HIDDEN','还没有发现这个入口。');
 if(view.state==='locked')throw new PlaneGateError('PLANE_GATE_LOCKED','条件还没满足，暂时进不去。');
 if(view.state==='cleared')throw new PlaneGateError('PLANE_GATE_CLEARED','这里已经探索完了。');
 if(view.state==='cooldown')throw new PlaneGateError('PLANE_GATE_COOLDOWN','入口还在平复，稍后再来。');
 return gate;
}
/** Called once per committed clear (idempotency is the instance's job). */
export function recordPlaneClear(character:Character,gate:PlaneGate,now:number,tables:WorldTables=worldTables){
 if(!tables.planeGates.includes(gate))throw new PlaneGateError('PLANE_GATE','这里没有这个入口。');
 const planes=writable(character),row=entry(planes,gate.id);row.found=true;row.foundAt??=now;row.clears++;row.firstClearAt??=now;
 if(gate.cooldownSeconds>0)row.cooldownUntil=now+gate.cooldownSeconds*1000;
 return row;
}
