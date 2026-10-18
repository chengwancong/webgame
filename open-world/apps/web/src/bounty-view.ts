import type {Snapshot} from '../../../packages/contracts/index.ts';
import {worldTables} from '../../../packages/content/world-tables.ts';
import {bountyNeed,bountyRow,type Bounty} from '../../../packages/rules/bounty.ts';
import {buttonHtml,escapeHtml} from './ui/primitives.ts';

export type BountyRowView={instance:string;title:string;goal:string;progress:number;need:number;state:'offer'|'active'|'ready'|'cooling';seconds:number;gold:number;material:number};
export type BountyView={zone:string;rows:BountyRowView[]};

/** Same reach as the server's board check. */
const boardReach=4;
/** Activated outpost the hero stands beside, if any. */
export function nearbyOutpost(s:Snapshot|undefined,region:string,hero:{x:number;y:number}){
 return worldTables.waypoints.find(w=>(s?.worldView?.waypoints.includes(w.id)??(!w.when&&!w.until))&&w.kind==='outpost'&&w.region===region&&Math.hypot(w.x-hero.x,w.y-hero.y)<=boardReach&&s?.starsea?.waypoints?.includes(w.id));
}
function row(b:Bounty,now:number):BountyRowView|undefined{
 const t=bountyRow(b.task);if(!t)return;const need=bountyNeed(t);
 const state=b.cooldownUntil!==undefined?'cooling':b.acceptedAt===undefined?'offer':b.progress>=need?'ready':'active';
 return {instance:b.instance,title:t.title,goal:t.goal,progress:b.progress,need,state,seconds:Math.max(0,Math.ceil(((b.cooldownUntil??now)-now)/1000)),gold:t.reward_gold??0,material:t.reward_material??0};
}
/** Board of one zone, from the server-filled slots in the snapshot. */
export function bountyView(s:Snapshot|undefined,zone:string,now=Date.now()):BountyView|undefined{
 const st=s?.starsea;if(!st)return;const z=worldTables.zones.find(z=>z.id===zone);if(!z)return;
 return {zone:z.name,rows:st.bounties.filter(b=>b.zone===zone).sort((a,b)=>a.slot.localeCompare(b.slot)).map(b=>row(b,now)).filter((r):r is BountyRowView=>Boolean(r))};
}
/** Accepted bounties anywhere, for the one-line completion notice. */
export function readyBounties(s:Snapshot|undefined){return (s?.starsea?.bounties??[]).map(b=>row(b,Date.now())).filter(r=>r?.state==='ready').map(r=>({instance:r!.instance,title:r!.title}));}

export function bountyHtml(v:BountyView,busy:boolean){
 if(!v.rows.length)return '<p class="ui-caption">这片分区暂时没有悬赏。</p>';
 const line=(r:BountyRowView)=>{
  const status=r.state==='cooling'?`刷新中 · ${Math.ceil(r.seconds/60)} 分钟`:r.state==='offer'?'未接取':r.state==='ready'?'已完成':`${r.progress} / ${r.need}`;
  const actions=r.state==='offer'?buttonHtml('接取',{action:'bounty-accept',id:r.instance,variant:'primary',disabled:busy})
   :r.state==='ready'?buttonHtml('领取',{action:'bounty-claim',id:r.instance,variant:'primary',disabled:busy})
   :r.state==='active'?buttonHtml('放弃',{action:'bounty-abandon',id:r.instance,variant:'secondary',disabled:busy}):'';
  return `<li class="bounty-row" data-state="${r.state}"><div><b>${escapeHtml(r.state==='cooling'?'悬赏刷新中':r.title)}</b> <span class="ui-caption">${escapeHtml(status)}</span><p class="ui-caption">${r.state==='cooling'?'':escapeHtml(`${r.goal} · 奖励：经验（击杀经验的一半）、${r.gold} 金币、${r.material} 材料`)}</p></div><div class="region-map-actions">${actions}</div></li>`;
 };
 return `<p class="ui-caption">只计本区营地的击杀；接取后开始计数。</p><ul class="bounty-board" aria-label="悬赏">${v.rows.map(line).join('')}</ul>`;
}
