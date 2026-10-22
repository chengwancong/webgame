import type {PoolClient} from 'pg';
import type {CharacterState,Receipt} from '../../../packages/contracts/index.ts';
import {recordHubFact} from '../../../packages/rules/starsea.ts';
import {tasks} from '../../../packages/content/task-tables.ts';
import {isHexAffixedGear} from '../../../packages/rules/hex-runes.ts';
import {applyXp} from '../../../packages/rules/index.ts';
import {queueHubUnlocks} from '../../../packages/rules/hub-chart.ts';
import {readHubState,saveHubState} from './hub-state.ts';
import {arriveHubOutside,recordHubOutsideActivity,pendingHubOutsideNumbers,type HubOutsideNumbers} from './hub-outside-service.ts';
import {archiveQuestCompletions} from './quest-journal.ts';

export const HUB_PORT={map:'ss-map-port',x:14,y:20} as const;
export function moveToHubPort(s:CharacterState){
 if(s.starsea){s.starsea.location={...HUB_PORT};s.starsea.wave=null;}
 s.lastRegion=HUB_PORT.map;s.progress.safe=HUB_PORT.map;delete s.progress.safePoint;
}
/** Called for actual arrivals/login, not repeated chart/today reads. */
export async function arriveAtHub(c:PoolClient,s:CharacterState,now=Date.now()){
 const h=await readHubState(c,s.id,now);queueHubUnlocks(s,h);await arriveHubOutside(c,s,h,now);
}
type Mutation={delta?:Receipt['delta'];questCompletions?:{id:string;xp:number;gold:number}[]};
/** All event counts come from confirmed pre/post state inside the existing receipt
 * transaction. Receipt retries never call this helper. */
export async function recordHubMutation(c:PoolClient,s:CharacterState,body:any,result:Mutation,before:CharacterState,numbers:HubOutsideNumbers=pendingHubOutsideNumbers){
 if(!s.starsea)return;
 const h=await readHubState(c,s.id),op=body.operation??body.action??'',facts:string[]=[];
 if(op==='crafting.action'&&body.action?.op==='craft')recordHubOutsideActivity(h,'craft',numbers,result.delta?.gear?.length??body.action.count??1);
 const removed=before.gear.filter(g=>!s.gear.some(n=>n.id===g.id)).length;
 if(removed&&(/salvage/.test(op)||body.action==='salvage'))recordHubOutsideActivity(h,'salvage',numbers,removed);
 const enhanced=s.gear.filter(g=>g.rank>(before.gear.find(old=>old.id===g.id)?.rank??g.rank)).length;
 if(enhanced){recordHubOutsideActivity(h,'enhance',numbers,enhanced);facts.push('hub-gate:enhance');}
 if(s.gear.some(g=>isHexAffixedGear(g)&&Object.values(s.equipment).includes(g.id)))facts.push('hub-gate:equip-hex');
 if(JSON.stringify(s.progression?.talents)!==JSON.stringify(before.progression?.talents))facts.push('hub-gate:talent');
 const sideCount=result.questCompletions?.filter(q=>!q.id.startsWith('hub-gate-')&&tasks.some(t=>t.id===q.id&&t.type==='side')).length??0;if(sideCount)recordHubOutsideActivity(h,'side',numbers,sideCount);
 for(const fact of facts){const gain=recordHubFact(s,fact);s.gold+=gain.gold;applyXp(s,gain.xp);result.delta??={gold:0,xp:0,material:0};result.delta.gold+=gain.gold;result.delta.xp+=gain.xp;if(gain.completed.length)archiveQuestCompletions(s,gain.completed,body.command_id,new Date().toISOString());}
 h.lastSeenAt=Date.now();queueHubUnlocks(s,h);await saveHubState(c,s.id,h);
}
