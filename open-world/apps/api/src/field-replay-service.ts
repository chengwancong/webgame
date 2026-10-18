import {replayPilots} from '../../../packages/content/replay-pilots.ts';
import {worldTables} from '../../../packages/content/world-tables.ts';
export type FieldReplay={entry:string;seenEntries?:string[];visit:number;map:string;waypoint:string;label:string;x:number;y:number;done:boolean};
/** Presentation-only choice for explicit entries. Renewal and rule reload keep it frozen. */
export function beginFieldReplay(data:Record<string,any>,region:string,entry?:string){
 const pilot=replayPilots.fields.find(p=>p.region===region);if(!pilot)return;
 const previous=data.replayPilot as FieldReplay|undefined;if(previous&&(!entry||previous.entry===entry||previous.seenEntries?.includes(entry)))return;
 const visit=(previous?.visit??0)+1,goal=pilot.goals[(visit-1)%pilot.goals.length],point=worldTables.waypoints.find(w=>w.id===goal.waypoint&&w.region===region)!;
 data.replayPilot={entry:entry??'initial',seenEntries:[...(previous?.seenEntries??(previous?[previous.entry]:[])),entry??'initial'],visit,map:region,waypoint:point.id,label:goal.label.replace('{waypoint}',point.name),x:point.x,y:point.y,done:false} satisfies FieldReplay;
}
/** Only the existing server-validated observer can mark arrival. No award or quest state is touched. */
export function observeFieldReplay(data:Record<string,any>,region:string,position:{x:number;y:number},trusted:boolean,reach:number){const goal=data.replayPilot as FieldReplay|undefined;if(trusted&&goal?.map===region&&!goal.done&&Math.hypot(goal.x-position.x,goal.y-position.y)<=reach)goal.done=true;}
export function fieldReplayView(data:Record<string,any>){const goal=data.replayPilot as FieldReplay|undefined;if(!goal)return null;const {entry,seenEntries,...view}=goal;return view;}
