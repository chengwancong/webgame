import type {CharacterState} from '../contracts/index.ts';
import type {ChartRegionId,TodayView} from '../contracts/hub.ts';
import {craftMaterialById} from '../content/crafting.ts';
import {ensureProgression} from './deep-progression.ts';
import {hubDockOpen,hubFleetLimit} from './hub-port.ts';
import {hubDay,requireHub,type HubState,type HubFleet} from './hub-state.ts';

export type HubDockRate={goldPerHour:number;materialsPerHour:Record<string,number>};
export type HubDockRates=Partial<Record<ChartRegionId,HubDockRate>>;
export type HubDockReward={gold:number;materials:Record<string,number>};
const hour=3600000,cap=12*hour;
export function accrueHubDock(h:HubState,now=Date.now()){
 for(const f of h.dock.fleets){f.accruedMs=Math.min(cap,Math.max(0,f.accruedMs)+Math.max(0,now-f.since));f.since=Math.max(f.since,now);}
}
export function hubDockTargetAllowed(h:HubState,region:ChartRegionId){return region!=='deep'&&(Boolean(h.chart.cleared[region+'-gate'])||region===h.chart.lastRegion&&Object.keys(h.chart.cleared).some(id=>id.startsWith(region+'-nest-')));}
export function hubDockView(s:CharacterState,h:HubState,now=Date.now()):TodayView['dock']{
 const open=hubDockOpen(h),maxFleets=hubFleetLimit(s),fleets=Array.from({length:maxFleets},(_,i)=>{const f=h.dock.fleets.find(f=>f.fleet===i+1);return {fleet:i+1,region:f?.region??null,accruedHours:f?Math.min(cap,f.accruedMs+Math.max(0,now-f.since))/hour:0,cap:12 as const};});
 return {open,fleets,maxFleets,quickAvailable:open&&h.dock.quickDay!==hubDay(now)&&fleets.some(f=>f.region!==null),pendingCollect:open&&fleets.some(f=>f.accruedHours>0)};
}
function rateFor(region:ChartRegionId,rates:HubDockRates):HubDockRate{
 const rate=rates[region]??{goldPerHour:0,materialsPerHour:{}};
 requireHub(Number.isFinite(rate.goldPerHour)&&rate.goldPerHour>=0,'HUB_RATE','码头收益配置不合法。');
 for(const[id,n]of Object.entries(rate.materialsPerHour)){const m=craftMaterialById.get(id);requireHub(m?.tier==='T1'&&['ore','plant'].includes(m.kind)&&m.island==='ss-map-'+region&&Number.isFinite(n)&&n>=0,'HUB_RATE','码头仅产本航区的一阶采集材料。');}
 return rate;
}
function collectHours(f:HubFleet,hours:number,rate:HubDockRate):HubDockReward{
 const raw={gold:rate.goldPerHour*hours,...Object.fromEntries(Object.entries(rate.materialsPerHour).map(([id,n])=>[id,n*hours]))},out:HubDockReward={gold:0,materials:{}};
 for(const[id,n]of Object.entries(raw)){const total=n+(f.remainder[id]??0),whole=Math.floor(total+1e-9);f.remainder[id]=Math.max(0,total-whole);if(id==='gold')out.gold=whole;else if(whole)out.materials[id]=whole;}
 return out;
}
function credit(s:CharacterState,reward:HubDockReward){s.gold+=reward.gold;const p=ensureProgression(s);for(const[id,n]of Object.entries(reward.materials))p.materials[id]=(p.materials[id]??0)+n;}
/** Mutations are called under character row lock with the normal idempotent command receipt. */
export function commandHubDock(s:CharacterState,h:HubState,input:{op:'send'|'collect'|'quick';fleet?:number;region?:ChartRegionId},rates:HubDockRates={},now=Date.now()):HubDockReward{
 requireHub(hubDockOpen(h),'HUB_DOCK_LOCKED','先通关 雾铃 · 剧情 1，开放码头派遣。');
 const fleet=input.fleet??1;requireHub(Number.isInteger(fleet)&&fleet>=1&&fleet<=hubFleetLimit(s),'HUB_FLEET','这支船队尚未开放。');
 const found=h.dock.fleets.find(f=>f.fleet===fleet);
 if(input.op==='send'){
  requireHub(input.region&&hubDockTargetAllowed(h,input.region),'HUB_DESTINATION','请先通关该航区关口，或通关当前航区的一个巢穴。');rateFor(input.region,rates);
  if(found?.region===input.region)return {gold:0,materials:{}};
  // Changing destination settles the old route first; never lose an offline balance.
  const oldRate=found?.region?rateFor(found.region,rates):undefined;accrueHubDock(h,now);
  const reward=found&&oldRate?collectHours(found,found.accruedMs/hour,oldRate):{gold:0,materials:{}};
  const next:HubFleet={fleet,region:input.region,since:now,accruedMs:0,remainder:found?.remainder??{}};if(found)Object.assign(found,next);else h.dock.fleets.push(next);
  credit(s,reward);if(!h.chart.gateFacts.includes('dispatch'))h.chart.gateFacts.push('dispatch');return reward;
 }
 requireHub(found?.region,'HUB_DOCK_EMPTY','请先派遣这支船队。');const rate=rateFor(found.region,rates);
 if(input.op==='quick')requireHub(h.dock.quickDay!==hubDay(now),'HUB_QUICK_USED','今日快速收益已领取，明天 05:00 刷新。');
 accrueHubDock(h,now);const reward=collectHours(found,input.op==='quick'?2:found.accruedMs/hour,rate);
 if(input.op==='quick')h.dock.quickDay=hubDay(now);else found.accruedMs=0;
 credit(s,reward);return reward;
}
