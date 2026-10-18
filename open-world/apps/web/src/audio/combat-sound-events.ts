import type {World,CombatEvent} from '../../../../packages/simulation/index.ts';
import {soundProfile} from './sound-profiles.ts';
export type SoundDispatch={key:string;stage:'cast'|'release'|'impact'|'loop'|'tick'|'warning'|'end'|'flight';tick:number;position:{x:number;y:number};sourceId?:string;monster?:boolean;thickness?:number;boss?:string};
export class CombatSoundEvents{
 private region='';private tick=-1;private seen=new Set<string>();private flights=new Set<number>();private chains=new Map<string,number>();private statusTicks=new Map<string,number>();
 consume(w:World):SoundDispatch[]{
  if(this.region!==w.region.id||w.tick<this.tick){this.seen.clear();this.flights.clear();this.chains.clear();this.statusTicks.clear();}if(this.region===w.region.id&&w.tick===this.tick)return [];this.region=w.region.id;this.tick=w.tick;this.seen.clear();
  const out:SoundDispatch[]=[],hits=new Map<string,{event:CombatEvent;count:number}>();
  const emit=(e:CombatEvent,stage:SoundDispatch['stage'],thickness=0)=>{const key=e.vfxKey??(e.skill?(e.id===w.playerId?'player/':w.enemies.find(n=>n.id===(e.sourceId??e.id))?.boss?'boss/':'monster/')+e.skill:'');if(!key)return;const p=soundProfile(key);if(!p?.[stage])return;const cast=key+':'+e.sourceId+':'+(e.castId??e.tick),id=cast+':'+stage;if(this.seen.has(id))return;this.seen.add(id);
   if(p.key==='player/chain'&&stage==='impact'){const n=this.chains.get(cast)??0;if(n>=4)return;this.chains.set(cast,n+1);}const source=w.enemies.find(n=>n.id===(e.sourceId??e.id));out.push({key,stage,tick:e.tick,position:key.startsWith('monster/')?source?.position??e.position:e.position,sourceId:e.sourceId,monster:key.startsWith('monster/')||key.startsWith('status/')&&e.id!==w.playerId,thickness,...(stage==='warning'?{boss:source?.monster?.template??source?.art??e.id}:{})});};
  for(const e of w.events){
   if(e.type==='status_changed'&&e.status&&['applied','refreshed'].includes(e.change??''))emit({...e,vfxKey:'status/'+e.status},'cast');
   if(e.type==='status_changed'&&e.status&&['expired','cleansed','broken','consumed','source_lost'].includes(e.change??''))emit({...e,vfxKey:'status/'+e.status},'end');
   if(e.type==='effect_triggered'&&e.vfxKey?.startsWith('combo/'))emit(e,'release');
   if(e.type==='danger_started')emit(e,'warning');
   if(e.type==='cast_started')emit(e,'cast');if(e.type==='cast_released')emit(e,'release');if(e.type==='effect_activated')emit(e,'loop');
   if(e.type==='hit_resolved'&&(e.amount??0)>0){if(e.category==='periodic'&&e.status){if(e.tick-(this.statusTicks.get(e.status+':'+e.id)??-Infinity)>=30){this.statusTicks.set(e.status+':'+e.id,e.tick);emit({...e,vfxKey:'status/'+e.status},'tick');}continue;}const id=(e.vfxKey??e.skill)+':'+e.sourceId+':'+(e.castId??e.tick)+':'+e.tick;const old=hits.get(id);hits.set(id,{event:e,count:(old?.count??0)+1});}}
  for(const {event,count}of hits.values())emit(event,'impact',Math.min(2,count-1));
  for(const p of w.projectiles){if(this.flights.has(p.id))continue;this.flights.add(p.id);emit({type:'cast_released',id:p.sourceId??w.playerId,sourceId:p.sourceId,vfxKey:p.vfxKey,castId:p.castId,position:p.origin??p.position,tick:w.tick,skill:p.skill},'flight');}
  this.flights=new Set(w.projectiles.map(p=>p.id));
  if(w.tick%30===0)for(const z of w.zones)if(z.life>0&&z.delay<=0)emit({type:'effect_activated',id:z.sourceId??w.playerId,sourceId:z.sourceId,vfxKey:z.vfxKey,castId:z.castId,position:z.position,tick:w.tick,skill:z.skill},'loop');
  if(this.chains.size>256)this.chains.clear();return out;
 }
}
