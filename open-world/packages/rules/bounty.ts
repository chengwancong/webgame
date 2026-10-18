import type {StarseaState} from '../contracts/starsea.ts';
import type {TaskRow} from '../contracts/task-tables.ts';
import {tasks} from '../content/task-tables.ts';
import {worldTables} from '../content/world-tables.ts';
import {monsterContent} from '../content/monsters.ts';
import {campSource} from './world-camps.ts';

/** Repeatable bounties (content plan §6.3): three slots per zone on the outpost board.
 * Only server-confirmed camp kills count; xp = the counted kills' xp × 0.5; no gear.
 * Each offer has a unique instance id; a claimed slot cools down, then redraws from the zone's pool. */
export const bountySlots=3;
export const bountyXpShare=.5;
export type Bounty=StarseaState['bounties'][number];
type Fail=(code:string,message:string)=>never;

export const bountyRows=tasks.filter(t=>t.type==='bounty');
for(const t of bountyRows){
 if(!t.zone||!worldTables.zones.some(z=>z.id===t.zone)||t.cond_kind!=='kills'||!t.cond_count||!t.repeat_cooldown_seconds||!t.pool)throw Error('悬赏配置不完整 '+t.id);
 if(t.cond_value&&!monsterContent.templates.some(m=>m.id===t.cond_value))throw Error('悬赏怪物模板不存在 '+t.id+':'+t.cond_value);
}
export const bountyRow=(id:string)=>bountyRows.find(t=>t.id===id);
export const bountyNeed=(t:TaskRow)=>t.cond_count!;

/** Fill empty slots and slots whose cooldown ended. `pick` and `uuid` are injected so the
 * server owns randomness; distinct rows are preferred among the zone's live offers. */
export function bountyBoard(st:StarseaState,zone:string,now:number,pick:(n:number)=>number,uuid:()=>string){
 const pool=bountyRows.filter(t=>t.zone===zone);if(!pool.length)return [];
 for(let i=1;i<=bountySlots;i++){
  const slot=`${zone}:${i}`,at=st.bounties.findIndex(b=>b.slot===slot),old=st.bounties[at];
  if(old&&!(old.cooldownUntil!==undefined&&now>=old.cooldownUntil))continue;
  const taken=new Set(st.bounties.filter(b=>b.zone===zone&&b.slot!==slot&&b.cooldownUntil===undefined).map(b=>b.task)),fresh=pool.filter(t=>!taken.has(t.id)),from=fresh.length?fresh:pool;
  const next:Bounty={slot,zone,task:from[pick(from.length)].id,instance:uuid(),progress:0,xp:0};
  if(old)st.bounties[at]=next;else st.bounties.push(next);
 }
 return st.bounties.filter(b=>b.zone===zone).sort((a,b)=>a.slot.localeCompare(b.slot));
}

function live(st:StarseaState,instance:string,fail:Fail){
 const b=st.bounties.find(b=>b.instance===instance);if(!b||b.cooldownUntil!==undefined)fail('BOUNTY_GONE','这条悬赏已经领取或刷新。');
 return {b:b!,row:bountyRow(b!.task)??fail('BOUNTY_GONE','这条悬赏已经下架。')};
}
export function acceptBounty(st:StarseaState,instance:string,now:number,fail:Fail){
 const {b}=live(st,instance,fail);if(b.acceptedAt===undefined)b.acceptedAt=now;return b;
}
/** Abandon resets progress; the offer stays on the board. */
export function abandonBounty(st:StarseaState,instance:string,fail:Fail){
 const {b}=live(st,instance,fail);delete b.acceptedAt;b.progress=0;b.xp=0;return b;
}
/** Settled in the kill transaction: camp kills of the bounty's zone (template / elite
 * filters from the row) advance every accepted, unfinished bounty there. */
export function countBountyKill(st:StarseaState,kill:{source:string;template?:string;elite:boolean;xp:number}){
 const at=campSource(kill.source),camp=at&&(worldTables.camps.find(c=>c.id===at.camp)??worldTables.patrols.find(c=>c.id===at.camp));if(!camp)return [];
 const advanced:Bounty[]=[];
 for(const b of st.bounties){
  if(b.zone!==camp.zone||b.acceptedAt===undefined||b.cooldownUntil!==undefined)continue;
  const row=bountyRow(b.task);if(!row||b.progress>=bountyNeed(row))continue;
  if(row.cond_value&&row.cond_value!==kill.template||row.elite&&!kill.elite)continue;
  b.progress++;b.xp+=kill.xp;advanced.push(b);
 }
 return advanced;
}
/** Claim once: the slot turns into a cooldown, so the same instance can never pay twice. */
export function claimBounty(st:StarseaState,instance:string,now:number,fail:Fail){
 const {b,row}=live(st,instance,fail);if(b.acceptedAt===undefined||b.progress<bountyNeed(row))fail('BOUNTY_UNFINISHED','悬赏目标尚未完成。');
 const reward={xp:Math.round(b.xp*bountyXpShare),gold:row.reward_gold??0,material:row.reward_material??0};
 Object.assign(b,{progress:0,xp:0,cooldownUntil:now+row.repeat_cooldown_seconds!*1000});delete b.acceptedAt;
 return {row,reward};
}
