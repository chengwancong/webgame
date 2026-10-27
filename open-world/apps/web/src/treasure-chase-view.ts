import type {HubDungeonPublic} from '../../../packages/contracts/hub-dungeons.ts';
import type {MapMarker} from './ui/minimap-data.ts';

export type TreasureChase=NonNullable<HubDungeonPublic['chase']>;

/** The next interception point is server-authored. The client never predicts a
 * route or an escape result merely to draw the guide. */
export function treasureChaseGoal(chase:TreasureChase|undefined):{x:number;y:number;label:string}|undefined{
 if(!chase)return;
 const target=chase.phase==='running'&&chase.intercept?chase.intercept:chase.position;
 const label=chase.phase==='waking'?'宝箱长腿了，盯住它！'
  :chase.phase==='running'?(chase.intercept?'抢到前方，截住宝箱怪':'追上宝箱怪，夺回宝物')
  :chase.phase==='staggered'?'宝箱怪喘息中，趁机攻击':'宝箱怪跑不动了，夺回宝箱';
 return {x:target.x,y:target.y,label};
}

export function treasureChaseStatus(chase:TreasureChase):{label:string;tone:'neutral'|'warning'|'info'|'success'}{
 const states={waking:{label:'宝箱苏醒',tone:'neutral'},running:{label:'正在逃跑',tone:'warning'},staggered:{label:'喘息中',tone:'info'},cornered:{label:'已堵住',tone:'success'}} as const;
 const state=states[chase.phase];
 return {label:state.label+(chase.interceptions>0?' · 堵截 '+chase.interceptions+' 次':''),tone:state.tone};
}

/** Keep the usual NPC/activity markers, while giving the active chase first
 * choice of the radar's existing offscreen objective arrow. */
export function withTreasureChaseMarker(markers:readonly MapMarker[],chase:TreasureChase|undefined):MapMarker[]{
 const goal=treasureChaseGoal(chase);if(!goal||!chase)return [...markers];
 return [{id:'treasure-chase:'+chase.enemyId,name:goal.label,x:goal.x,y:goal.y,main:true,priority:-1},...markers];
}
