import type {Snapshot} from '../../../packages/contracts/index.ts';
import {skillCatalog} from '../../../packages/content/index.ts';
import {skillWeapons} from '../../../packages/content/skill-weapons.ts';
import {grantRows,recoveryRows,routeRows,slotRows} from '../../../packages/rules/skill-slots.ts';
import {craftTierPreview} from '../../../packages/rules/craft-tier-preview.ts';
/** 成长卡片（docs/progression-goal-plan.md §4）：找回演出、开槽、登岛可学、升级新招式（每次升级最多一张）。
 * 只比较前后两次快照；首次观察只记基线。老角色（没有 skillRecovery）不弹。 */
export type GrowthCard={title:string;lines:{speaker:string;text:string}[]};
export type GrowthMark={equipped?:string[];level:number;recovered:string[];slots:number;islands:string[];eligible:string[];gifts:string[]};
const nameOf=(id:string)=>skillCatalog.find(k=>k.id===id)?.name??id;
// 任务送的招（抢救船台的护身印、进港路选路送的招）：服务端只改技能，演出靠前后快照比出来。
const giftRows=(family:string)=>[...grantRows.filter(r=>!r.family||r.family===family),...routeRows.filter(r=>r.family===family)];
export function growthMark(s:Snapshot):GrowthMark|undefined{const r=s.skillRecovery;if(!r)return;return {equipped:[...s.skills],level:s.level,recovered:[...r.recovered],slots:r.slots,islands:r.islands.filter(i=>i.visited).map(i=>i.island),eligible:s.skillAccess.filter(q=>!q.activated&&q.eligible).map(q=>q.id),gifts:giftRows(r.family).filter(g=>s.skillAccess.some(q=>q.id===g.skill&&q.activated)).map(g=>g.skill)};}
export function growthCards(before:GrowthMark|undefined,s:Snapshot):GrowthCard[]{
 const after=growthMark(s),r=s.skillRecovery;if(!before||!after||!r)return [];const cards:GrowthCard[]=[];
 for(const id of after.recovered.filter(id=>!before.recovered.includes(id))){const row=recoveryRows.find(x=>x.family===r.family&&x.skill===id);cards.push({title:`刻片复苏 · ${nameOf(id)}`,lines:[{speaker:'刻片',text:`刻片一闪，${nameOf(id)}回来了（${row?.order??''}/${r.total}）。`},...(row?[{speaker:'',text:row.line}]:[])]});}
 if(after.slots>before.slots){const row=slotRows.find(x=>x.slots===after.slots);cards.push({title:'技能位 +1',lines:[{speaker:'刻片',text:row?.line??`现在有 ${after.slots} 个技能位。`}]});}
 for(const row of giftRows(r.family).filter(g=>after.gifts.includes(g.skill)&&!before.gifts.includes(g.skill)))cards.push({title:`新招式 · ${nameOf(row.skill)}`,lines:[{speaker:'',text:row.line}]});
 for(const island of r.islands.filter(i=>i.visited&&!before.islands.includes(i.island)&&s.starseaView?.islands.some(x=>x.map===i.island&&x.open)))cards.push({title:`${island.name} · ${s.lastRegion===island.island?'本岛可学':'可前往学习'}`,lines:[{speaker:'',text:'可学习：'+island.skills.map(id=>{const k=skillCatalog.find(x=>x.id===id);return nameOf(id)+(k&&k.unlockLevel>s.level?`（${k.unlockLevel}级）`:'');}).join('、')+'。'}]});
 if(after.level>before.level){
  const fresh=s.skillAccess.filter(q=>!q.activated&&q.eligible&&!before.eligible.includes(q.id)&&q.weaponCompatible!==false).map(q=>skillCatalog.find(k=>k.id===q.id)!).filter(Boolean);
  // 每次升级最多一张：本武器技优先，其次解锁等级最低；其余在技能页显示「可激活」。
  const pick=fresh.sort((a,b)=>Number(!skillWeapons[a.id]?.length)-Number(!skillWeapons[b.id]?.length)||a.unlockLevel-b.unlockLevel)[0];
  if(pick)cards.push({title:`新招式 · ${pick.name}`,lines:[{speaker:'',text:pick.description},{speaker:'',text:fresh.length>1?`另有 ${fresh.length-1} 个技能可以激活，去技能页看看。`:'去技能页激活它。'}]});
 }
 for(const id of s.skills.filter(id=>before.equipped&&!before.equipped.includes(id))){const equipped={speaker:'',text:`已自动装配到第 ${s.skills.indexOf(id)+1} 栏。`},existing=cards.find(c=>c.title.includes(nameOf(id)));if(existing)existing.lines.push(equipped);else cards.push({title:`新招式 · ${nameOf(id)}`,lines:[equipped,{speaker:'',text:skillCatalog.find(k=>k.id===id)?.description??''}]});}
 return cards;
}
/** 追踪条成长行：下一次找回（G2 钉选目标接在这里）。 */
export function trackerGoals(s:Snapshot):import('./hud-context.ts').TrackerGoal[]{
 const out:import('./hud-context.ts').TrackerGoal[]=[],goal=s.craftGoal,next=s.skillRecovery?.next;
 // 钉选装备：材料一项项写全，凑齐后改成可打造（docs/progression-goal-plan.md §5.1）。
 if(goal&&(!s.starsea||s.starsea.features.includes('forge'))){const short=[...goal.materials.map(m=>({name:m.name,have:m.have,need:m.need})),...(goal.gold.have<goal.gold.need?[{name:'金币',...goal.gold}]:[])];out.push({kind:'目标',title:goal.name,goal:goal.ready?'可在工坊打造':short.map(m=>`${m.name} ${m.have}/${m.need}`).join(' · '),action:'goal-craft',id:goal.recipe,full:true});}
 const tier=craftTierPreview(s);if(tier)out.push({kind:'换代',title:`到 ${tier.level} 级`,goal:`工坊可打造 T${tier.tier}（主属性 ×${tier.ratio}）`,action:'goal-craft',id:tier.recipe,full:true});
 if(next)out.push({kind:'找回',title:next.name,goal:`完成「${next.taskName}」`,action:'panel',id:'skills'});
 return out;
}
