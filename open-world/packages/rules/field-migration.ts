import type {CharacterState} from '../contracts/index.ts';
import {fieldRegionInfo,regionById} from '../content/index.ts';
import {starseaIslands,starseaBossMaps} from '../content/starsea/index.ts';
import {worldTables} from '../content/world-tables.ts';
import {walkable} from '../simulation/navigation.ts';

/** Old characters entering a zoned field map (expansion plan §迁移): unlock only the landing
 * waypoint of an island they already reached and the boss-gate waypoint of a boss they already
 * beat — no other history is invented. A saved location that is not walkable on the new
 * geometry moves to the nearest unlocked waypoint (landing first when none is closer).
 * Idempotent; returns what changed for receipts and tests. */
export function migrateFieldEntry(s:CharacterState,region:string){
 const info=fieldRegionInfo(region),st=s.starsea;if(!info||!st)return {waypoints:[] as string[],moved:false};
 const island=info.island??region,index=starseaIslands.indexOf(island),boss=index>=0?starseaBossMaps[index]:undefined,map=worldTables.waypoints.filter(w=>w.region===region);
 const reached=map.filter(w=>!st.waypoints.includes(w.id)&&(w.kind==='landing'&&st.islands.includes(island)||w.kind==='boss'&&boss!==undefined&&st.bosses.includes(boss)));
 for(const w of reached)st.waypoints.push(w.id);
 let moved=false;const at=st.location;
 if(at?.map===region&&!walkable(regionById(region),at)){
  const open=map.filter(w=>st.waypoints.includes(w.id)),choices=open.length?open:map.filter(w=>w.kind==='landing');
  const best=choices.sort((a,b)=>Math.hypot(a.x-at.x,a.y-at.y)-Math.hypot(b.x-at.x,b.y-at.y))[0];
  if(best){st.location={map:region,x:best.x,y:best.y};moved=true;}
 }
 return {waypoints:reached.map(w=>w.id),moved};
}
