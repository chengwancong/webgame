import type {Snapshot} from '../../../packages/contracts/index.ts';
import {importHexCooldownView} from '../../../packages/simulation/hex-cooldowns.ts';

type View=NonNullable<Snapshot['hexCooldowns']>;
type Clock=()=>number;
const received=new WeakMap<object,{at:number;aged:number}>();
const monotonic:Clock=()=>performance.now();

/**
 * Remember when (monotonic clock) a server response carrying a HEX view arrived, plus how stale the receipt
 * body already was: serverNow (x-aw-server-now header) minus view.observedAt, both server clock. Missing/invalid
 * header degrades to 0 (old behaviour). Never compares browser Date.now with server time.
 */
export function stampHexCooldownView(value:unknown,now:Clock=monotonic,serverNow?:number){
 if(!value||typeof value!=='object')return;
 const o=value as {hexCooldowns?:unknown;snapshot?:{hexCooldowns?:unknown}};
 for(const v of [o.hexCooldowns,o.snapshot?.hexCooldowns]){
  if(!v||typeof v!=='object'||received.has(v))continue;
  const observedAt=(v as {observedAt?:unknown}).observedAt;
  const aged=typeof serverNow==='number'&&Number.isFinite(serverNow)&&typeof observedAt==='number'&&Number.isFinite(observedAt)?Math.max(0,serverNow-observedAt):0;
  received.set(v,{at:now(),aged});
 }
}

/** Import the server's HEX cooldown view into a freshly built World. No-op without a view. */
export function importSnapshotHexCooldowns(world:{comboReady:Record<string,number>;tick:number},snapshot:{hexCooldowns?:View}|undefined,now:Clock=monotonic){
 const view=snapshot?.hexCooldowns;if(!view)return;
 const r=received.get(view)??{at:now(),aged:0};
 importHexCooldownView(world.comboReady,world.tick,view,r.aged+Math.max(0,now()-r.at));
}
