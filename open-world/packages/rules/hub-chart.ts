import {currentGearCount} from './current-inventory.ts';
import {hubChallengeChoices} from './hub-challenges.ts';
import type {CharacterState} from '../contracts/index.ts';
import type {ChartNodeView,ChartView,ChartRegionId,HubReturnItem} from '../contracts/hub.ts';
import {hubChartContent,hubNodeById,type HubNodeDefinition} from '../content/hub-chart.ts';
import {settings} from '../content/index.ts';
import {worldTierChoices,activeWorldTier} from './world-tier.ts';
import {hubDay,type HubState} from './hub-state.ts';
import {isHexAffixedGear} from './hex-runes.ts';

export const HUB_DAILY_FIRST_CLEAR_LIMIT=10;
export const HUB_GATE_CLEARS=3;
export function hubDaily(h:HubState,now=Date.now()){return h.chart.daily.day===hubDay(now)?h.chart.daily.nodes:[];}
export function hubShardSlots(h:HubState){return Object.keys(h.chart.cleared).filter(id=>id.startsWith('wind-')).length>=2?1:0;}
export function hubGateQuests(s:CharacterState,h:HubState,region:ChartRegionId){
 // Completed server facts survive later equipment changes and talent refunds.
 // Public write() records these in Starsea; dock actions also retain the HUB fact.
 const recorded=(fact:string)=>h.chart.gateFacts.includes(fact)||Boolean(s.starsea?.seen.includes('hub-gate:'+fact));
 if(region==='wind')return [{text:'通关两个巢穴',done:Object.keys(h.chart.cleared).filter(id=>id.startsWith('wind-nest-')).length>=2},{text:'在工坊强化一次',done:recorded('enhance')}];
 if(region==='mist')return [{text:'穿上一件带「◆」的装备',done:recorded('equip-hex')||Object.values(s.equipment).some(id=>{const g=s.gear.find(g=>g.id===id);return g&&isHexAffixedGear(g);})},{text:'点一个天赋',done:recorded('talent')||Object.values(s.progression?.talents??{}).some(n=>n>0)},{text:'派一次采集船队',done:recorded('dispatch')}];
 return [];
}
const labels={story:'剧情',nest:'巢穴',hunt:'狩猎',tide:'怪潮',treasure:'寻宝',gate:'关口首领'};
const regionName=(id:string)=>hubChartContent.regions.find(r=>r.id===id)?.name??id;
function prerequisite(id:string){const n=hubNodeById.get(id);return n?`先通关 ${regionName(n.region)} · ${labels[n.kind]}${/\d$/.test(n.id)?' '+n.id.at(-1):''}`:'先完成开场';}
export function hubNodeStatus(s:CharacterState,h:HubState,n:HubNodeDefinition):{status:ChartNodeView['status'];lockReason?:string}{
 const cleared=h.chart.cleared;if(cleared[n.id])return {status:'cleared'};
 if(s.starsea?.prologue?.done===false)return {status:'locked',lockReason:'先完成开场'};
 if(n.region==='mist'&&!cleared['wind-gate'])return {status:'locked',lockReason:prerequisite('wind-gate')};
 if((n.kind==='hunt'||n.kind==='tide')&&!cleared['wind-gate']||n.kind==='treasure'&&!cleared['mist-gate'])return {status:'hidden',lockReason:labels[n.kind]+'尚未开放'};
 // 任务引导降级（2026-10-22）：航区内剧情/巢穴全开，按推荐等级自选；关口只看本航区打通了几个节点，不再挂剧情顺序和「关口任务」。
 if(n.kind==='gate'){const need=HUB_GATE_CLEARS-Object.keys(cleared).filter(id=>id.startsWith(n.region+'-')&&id!==n.id).length;return need>0?{status:'locked',lockReason:`再通关 ${need} 个${regionName(n.region)}节点`}:{status:'open'};}
 return {status:'open'};
}
export function hubRecommended(s:CharacterState,h:HubState){return hubChartContent.nodes.filter(n=>hubNodeStatus(s,h,n).status==='open').sort((a,b)=>(a.kind==='story'?0:a.kind==='nest'?1:2)-(b.kind==='story'?0:b.kind==='nest'?1:2)||hubChartContent.regions.findIndex(r=>r.id===a.region)-hubChartContent.regions.findIndex(r=>r.id===b.region)||a.id.localeCompare(b.id))[0];}
export function hubChartView(s:CharacterState,h:HubState,now=Date.now()):ChartView{
 const daily=hubDaily(h,now),recommended=hubRecommended(s,h),slots=hubShardSlots(h);
 return {regions:hubChartContent.regions.map(r=>{const open=r.status==='open'&&s.starsea?.prologue?.done!==false&&(r.id==='wind'||Boolean(h.chart.cleared['wind-gate']));return {id:r.id,name:r.name,levelRange:r.levelRange,status:open?(h.chart.cleared[r.id+'-gate']?'cleared':'open'):'locked',...(!open?{lockReason:r.status==='locked'?'后续航区尚未开放':r.id==='wind'?'先完成开场':prerequisite('wind-gate')}:{}),nodes:open?hubChartContent.nodes.filter(n=>n.region===r.id).map(n=>({id:n.id,region:n.region,kind:n.kind,name:n.kind==='gate'&&h.chart.cleared[n.id]?'重战 · '+n.name:n.name,line:n.line,dungeonId:n.dungeonId,...hubNodeStatus(s,h,n),recommendedLevel:n.recommendedLevel,estimatedMinutes:n.estimatedMinutes,firstClearReward:n.firstClearReward,firstClearDone:Boolean(h.chart.cleared[n.id]),firstClearBonusAvailable:daily.length<HUB_DAILY_FIRST_CLEAR_LIMIT&&!daily.includes(n.id),...(n.collectible?{collectible:{kind:n.collectible,owned:Boolean(h.chart.cleared[n.id])}}:{}),shardSlots:['story','gate'].includes(n.kind)?0:slots,challenges:hubChallengeChoices(s,n,now),publicDropNote:n.publicDropNote,...(h.chart.cleared[n.id]?{best:{seconds:h.chart.cleared[n.id].bestSeconds}}:{}),recommended:n.id===recommended?.id,links:n.links,pos:n.pos})):[]};}),lastRegion:h.chart.lastRegion,seaTier:{current:activeWorldTier(s),choices:worldTierChoices(s)},shards:{slotsUnlocked:slots,owned:hubChartContent.shards.filter(x=>(h.chart.shards[x.id]??0)>0).map(x=>({id:x.id,name:x.name,effect:x.effect,count:h.chart.shards[x.id]}))},bagFull:currentGearCount(s.gear)>=settings.capacity};
}
const unlocks=[
 ['stargate','星门','港口中央的石环亮了。从这里去任何航区。'],['forge','工坊开张','铜铃的炉子生好火了，带装备来强化。'],['shards','航图残页','把残页插进航图，能改这一趟掉什么。'],['hunt-tide','新的节点','航图上多了「狩猎」和「怪潮」。'],['dock','码头船队','米洛能派船去打通的航区采集，回来就领。'],['treasure','寻宝','限时开箱的节点出现了，宝箱里有图样和残页。'],['commissions','委托板','青芒在邮局挂起了委托，每天能做 8 条。'],
] as const;
export function queueHubUnlocks(s:CharacterState,h:HubState){const c=h.chart.cleared,ready=[s.starsea?.prologue?.done!==false,Object.keys(c).length>0,hubShardSlots(h)>0,Boolean(c['wind-gate']),Boolean(c['wind-gate']),Boolean(c['mist-gate']),Boolean(c['mist-gate'])];const added:HubReturnItem[]=[];unlocks.forEach(([id,title,text],i)=>{if(ready[i]&&!h.chart.unlocksSeen.includes(id)){const item:HubReturnItem={kind:'unlock',id,title,text};h.chart.unlocksSeen.push(id);h.chart.returnQueue.push({id,item});added.push(item);}});return added;}


