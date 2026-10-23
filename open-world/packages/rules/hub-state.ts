import type {ChartRegionId,HubReturnItem} from '../contracts/hub.ts';

export type HubQueueEntry={id:string;item:HubReturnItem};
export type HubCommission={id:string;task:string;region:ChartRegionId;progress:number;xp:number;sources:string[]};
export type HubFleet={fleet:number;region:ChartRegionId|null;since:number;accruedMs:number;remainder:Record<string,number>};
export type HubState={
 chart:{cleared:Record<string,{firstAt:string;bestSeconds:number}>;daily:{day:string;nodes:string[]};lastRegion:ChartRegionId;shards:Record<string,number>;gateFacts:string[];returnQueue:HubQueueEntry[];unlocksSeen:string[];returnUnlockId?:string;returnSerial:number};
 port:{rep:{forge:number;shipyard:number;post:number}};
 dock:{fleets:HubFleet[];quickDay?:string};
 commissions:{day:string;banked:number;doneToday:number;slots:HubCommission[];sequence:number};
 /** M17 Z4 探索度：秘藏、锁门、钥匙；旧存档没有，读时补空。 */
 explore?:{caches:string[];doors:string[];keys:ChartRegionId[]};
 mode:'manual'|'semi'|'auto';lastSeenAt?:number;lastPortAt?:number;lastPortSession?:string;pendingPortSession?:boolean;portSessionsSeen?:string[];
};
/** Service day boundary is 05:00 UTC+8 = 21:00 UTC on the preceding date. */
export function hubDay(now=Date.now()){return new Date(now+3*3600000).toISOString().slice(0,10);}
export function hubNextReset(now=Date.now()){return new Date(Date.parse(hubDay(now)+'T00:00:00Z')+21*3600000).toISOString();}
export function newHubState(now=Date.now()):HubState{return {chart:{cleared:{},daily:{day:hubDay(now),nodes:[]},lastRegion:'wind',shards:{},gateFacts:[],returnQueue:[],unlocksSeen:[],returnSerial:0},port:{rep:{forge:0,shipyard:0,post:0}},dock:{fleets:[]},commissions:{day:hubDay(now),banked:8,doneToday:0,slots:[],sequence:0},explore:{caches:[],doors:[],keys:[]},mode:'semi'};}
export function normalizeHubState(raw:Partial<HubState>|null|undefined,now=Date.now()):HubState{
 const seed=newHubState(now);if(!raw)return seed;
 return {...seed,...raw,explore:{...seed.explore!,...raw.explore},chart:{...seed.chart,...raw.chart,daily:{...seed.chart.daily,...raw.chart?.daily}},port:{...seed.port,...raw.port,rep:{...seed.port.rep,...raw.port?.rep}},dock:{...seed.dock,...raw.dock},commissions:{...seed.commissions,...raw.commissions}};
}
export class HubOutsideError extends Error {constructor(public code:string,message:string){super(message);}}
export function requireHub(ok:unknown,code:string,message:string):asserts ok {if(!ok)throw new HubOutsideError(code,message);}
