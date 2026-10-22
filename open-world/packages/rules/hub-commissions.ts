import type {CharacterState} from '../contracts/index.ts';
import type {ChartRegionId,HubCommissionsView} from '../contracts/hub.ts';
import type {TaskRow} from '../contracts/task-tables.ts';
import {tasks} from '../content/task-tables.ts';
import {applyXp} from './index.ts';
import {hubDay,requireHub,type HubState} from './hub-state.ts';
import {addHubReputation,hubCommissionsOpen,hubCommissionSlots} from './hub-port.ts';

type CommissionRow=TaskRow&{hub_commission?:boolean;hub_node?:string};
export type HubCommissionEconomy={commissionGoldScale?:number;commissionXpShare?:number};
function commissionReward(xp:number,gold:number,economy:HubCommissionEconomy){
 const goldScale=economy.commissionGoldScale??1,xpShare=economy.commissionXpShare??.5;
 requireHub(Number.isFinite(goldScale)&&goldScale>=0&&goldScale<=1&&Number.isFinite(xpShare)&&xpShare>=0&&xpShare<=.5,'HUB_COMMISSION_REWARD','委托奖励配置不合法。');
 return {xp:Math.round(xp*xpShare),gold:Math.round(gold*goldScale)};
}
export function hubCommissionPool(){return (tasks as CommissionRow[]).filter(t=>/^ow-(wind|mist)-bounty-/.test(t.id)||t.hub_commission&&Boolean(t.hub_node));}
const regionOf=(t:CommissionRow):ChartRegionId=>t.id.match(/^ow-(wind|mist)-/)?.[1] as ChartRegionId;
const goal=(t:CommissionRow)=>t.hub_node?1:t.cond_count??1;
const rowFor=(id:string)=>hubCommissionPool().find(t=>t.id===id);
export function refreshHubCommissions(h:HubState,now=Date.now()){
 const day=hubDay(now);if(day<=h.commissions.day)return;
 const elapsed=Math.floor((Date.parse(day)-Date.parse(h.commissions.day))/86400000);h.commissions.banked=Math.min(24,h.commissions.banked+Math.max(0,elapsed)*8);h.commissions.day=day;h.commissions.doneToday=0;
}
/** No manual accept and no legacy bounty cooldown; current offers survive a daily reset. */
export function fillHubCommissions(s:CharacterState,h:HubState,now=Date.now()){
 refreshHubCommissions(h,now);if(!hubCommissionsOpen(h))return;
 const pool=hubCommissionPool().filter(t=>regionOf(t)==='wind'||regionOf(t)==='mist'&&Boolean(h.chart.cleared['wind-gate']));
 requireHub(pool.length>0,'HUB_COMMISSION_POOL','委托池尚未配置。');
 while(h.commissions.slots.length<hubCommissionSlots(s)){
  const used=new Set(h.commissions.slots.map(b=>b.task)),fresh=pool.filter(t=>!used.has(t.id)),from=fresh.length?fresh:pool,index=h.commissions.sequence++,row=from[index%from.length];
  h.commissions.slots.push({id:`commission:${index+1}`,task:row.id,region:regionOf(row),progress:0,xp:0,sources:[]});
 }
}
export function hubCommissionsView(s:CharacterState,h:HubState,repPerClaim=0,economy:HubCommissionEconomy={}):HubCommissionsView{
 return {slots:hubCommissionsOpen(h)?h.commissions.slots.map(b=>{const row=rowFor(b.task);requireHub(row,'HUB_COMMISSION_GONE','这条委托已下架。');return {id:b.id,title:row.title,region:b.region,target:{text:row.goal,progress:b.progress,goal:goal(row)},reward:{...commissionReward(b.xp,row.reward_gold??0,economy),rep:repPerClaim},status:b.progress>=goal(row)?'ready' as const:'active' as const};}):[],doneToday:h.commissions.doneToday,limitToday:8,banked:h.commissions.banked};
}
/** Only invoke with a server-confirmed instance kill, never client-submitted kill totals. */
export function countHubCommissionKill(h:HubState,kill:{source:string;region:ChartRegionId;template?:string;elite:boolean;xp:number}){
 if(!hubCommissionsOpen(h))return [];
 requireHub(Number.isFinite(kill.xp)&&kill.xp>=0,'HUB_KILL','击杀经验不合法。');const advanced:string[]=[];
 for(const b of h.commissions.slots){const row=rowFor(b.task);if(!row||row.hub_node||b.region!==kill.region||b.progress>=goal(row)||row.cond_value&&row.cond_value!==kill.template||row.elite&&!kill.elite||(b.sources??=[]).includes(kill.source))continue;b.sources.push(kill.source);b.progress++;b.xp+=kill.xp;advanced.push(b.id);}
 return advanced;
}
export function countHubCommissionNodeClear(h:HubState,nodeId:string,source:string,xp=0){
 if(!hubCommissionsOpen(h))return [];
 const advanced:string[]=[];for(const b of h.commissions.slots){const row=rowFor(b.task);if(!row?.hub_node||!(nodeId===row.hub_node||nodeId.startsWith(row.hub_node+'-'))||b.progress>=goal(row)||(b.sources??=[]).includes(source))continue;b.sources.push(source);b.progress++;b.xp+=Math.max(0,xp);advanced.push(b.id);}return advanced;
}
export function commandHubCommission(s:CharacterState,h:HubState,input:{op:'claim'|'abandon';id:string},repPerClaim=0,now=Date.now(),economy:HubCommissionEconomy={}){
 requireHub(hubCommissionsOpen(h),'HUB_COMMISSION_LOCKED','先通关 雾铃 · 关口首领，开放委托板。');
 const at=h.commissions.slots.findIndex(b=>b.id===input.id),b=h.commissions.slots[at],row=b&&rowFor(b.task);requireHub(b&&row,'HUB_COMMISSION_GONE','这条委托已经领取或更换。');
 const reward={xp:0,gold:0,rep:0};
 if(input.op==='claim'){
  requireHub(b.progress>=goal(row),'HUB_COMMISSION_UNFINISHED','委托目标尚未完成。');refreshHubCommissions(h,now);
  requireHub(h.commissions.doneToday<8&&h.commissions.banked>0,'HUB_COMMISSION_LIMIT','今日委托次数已用完，明天 05:00 刷新。');
  requireHub(Number.isSafeInteger(repPerClaim)&&repPerClaim>=0,'HUB_REP','委托声望配置不合法。');
  Object.assign(reward,commissionReward(b.xp,row.reward_gold??0,economy));reward.rep=repPerClaim;
  s.gold+=reward.gold;applyXp(s,reward.xp);addHubReputation(h,'post',reward.rep);h.commissions.doneToday++;h.commissions.banked--;
 }
 h.commissions.slots.splice(at,1);fillHubCommissions(s,h,now);return reward;
}
