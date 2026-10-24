import type {CharacterState} from '../contracts/index.ts';
import type {HubBuildingId,HubPortView} from '../contracts/hub.ts';
import {progressionConfig} from '../content/deep-progression.ts';
import {ensureProgression,gearOutput} from './deep-progression.ts';
import {requireHub,type HubState} from './hub-state.ts';
import {storyFeatureUnlocked,storyFeatureReason} from './story-campaign.ts';
import {ownedCrystalSources} from './crystal-progress.ts';

export const hubBuildings=[{id:'forge',name:'工坊',npc:'机巧师·铜铃'},{id:'shipyard',name:'船台',npc:'领航员·米洛'},{id:'post',name:'邮局',npc:'邮差·青芒'}] as const;
export const hubClaimKey=(building:HubBuildingId,tier:number)=>`hub:${building}:${tier}`;
export const hubTierClaimed=(s:CharacterState,building:HubBuildingId,tier:number)=>Boolean(s.progression?.reputationClaims.includes(hubClaimKey(building,tier)));
export const hubFleetLimit=(s:CharacterState)=>1+Number(hubTierClaimed(s,'shipyard',1))+Number(hubTierClaimed(s,'shipyard',3));
export const hubCommissionSlots=(s:CharacterState)=>hubTierClaimed(s,'post',2)?5:4;
// 功能开放只看玩到哪，不挂剧情任务（2026-10-22 任务引导降级）：工坊首次回港即开，码头击败风栖关口后开。
export const hubForgeOpen=(h:HubState)=>Object.keys(h.chart.cleared).length>0;
export const hubDockOpen=(h:HubState)=>Boolean(h.chart.cleared['wind-gate']);
export const hubCommissionsOpen=(h:HubState)=>Boolean(h.chart.cleared['mist-gate']);
export function addHubReputation(h:HubState,building:HubBuildingId,amount:number){requireHub(Number.isSafeInteger(amount)&&amount>=0,'HUB_REP','港口声望数值不合法。');h.port.rep[building]+=amount;}
function rewards(building:HubBuildingId,tier:number){
 const lines=['天赋点 +1'];
 if(building==='forge'){lines.push('工坊配方购买阶级 '+tier);if(tier===2)lines.push('稀有护甲 ×1');}
 if(building==='shipyard'){if(tier===1||tier===3)lines.push('采集船队 +1');}
 if(building==='post'){lines.push(`召唤碎片 ×${tier*progressionConfig.professionsRewards.reputationSummonShards}`);if(tier===2)lines.push('委托展示格 +1');}
 return lines;
}
export function hubPortView(s:CharacterState,h:HubState):HubPortView{
 return {buildings:hubBuildings.map(b=>({...b,rep:h.port.rep[b.id],tiers:progressionConfig.reputationThresholds.slice(1).map((threshold,i)=>{const tier=i+1,claimed=hubTierClaimed(s,b.id,tier);return {tier,threshold,rewards:rewards(b.id,tier),claimed,claimable:!claimed&&h.port.rep[b.id]>=threshold};})})),collectibles:{lifeCrystal:{owned:Math.min(12,ownedCrystalSources(s,'life').length),total:12},starCore:{owned:Math.min(6,ownedCrystalSources(s,'core').length),total:6}},systems:[
  {id:'forge',name:'工坊强化',open:hubForgeOpen(h),...(!hubForgeOpen(h)?{lockReason:'从星门打完第一个节点回港后开放'}:{})},
  {id:'dock',name:'码头派遣',open:hubDockOpen(h),...(!hubDockOpen(h)?{lockReason:'击败风栖关口首领后开放'}:{})},
  {id:'commissions',name:'委托板',open:hubCommissionsOpen(h),...(!hubCommissionsOpen(h)?{lockReason:'先通关 雾铃 · 关口首领'}:{})},
  ...(['grid','summons','aspects'] as const).map(id=>({id,name:{grid:'武器盘与突破',summons:'召唤石',aspects:'威能'}[id],open:storyFeatureUnlocked(s,id),...(!storyFeatureUnlocked(s,id)?{lockReason:storyFeatureReason(s,id)}:{})})),
  {id:'character',name:'角色突破',open:true},{id:'paragon',name:'巅峰等级',open:s.level>=50,...(s.level<50?{lockReason:'角色达到 50 级开放'}:{})},
 ]};
}
/** Called inside the command transaction. reputationClaims remains the only talent grant ledger. */
export function claimHubPortTier(s:CharacterState,h:HubState,building:HubBuildingId,tier:number){
 requireHub(hubBuildings.some(b=>b.id===building)&&Number.isInteger(tier)&&tier>=1&&tier<=4,'HUB_TIER','港口建设阶级不合法。');
 requireHub(h.port.rep[building]>=progressionConfig.reputationThresholds[tier],'HUB_REP','港口声望尚未达标。');
 const p=ensureProgression(s),key=hubClaimKey(building,tier);requireHub(!p.reputationClaims.includes(key),'HUB_CLAIMED','本阶建设奖励已经领取。');
 // Armor generation validates capacity before any claim is recorded.
 if(building==='forge'&&tier===2)gearOutput(s,'coat').quality='rare';
 p.reputationClaims.push(key);if(building==='post')p.materials.summon_shard=(p.materials.summon_shard??0)+tier*progressionConfig.professionsRewards.reputationSummonShards;
 s.build++;
 const id=`building:${building}:${tier}`;if(!h.chart.unlocksSeen.includes(id)){h.chart.unlocksSeen.push(id);h.chart.returnQueue.push({id,item:{kind:'unlock',id,title:`${hubBuildings.find(b=>b.id===building)!.name}建设`,text:`第 ${tier} 阶建设完成。${rewards(building,tier).join('；')}。`}});}
 return {building,tier,rewards:rewards(building,tier)};
}
