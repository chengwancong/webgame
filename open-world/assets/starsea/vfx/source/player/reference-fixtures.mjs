/** Reference artwork fixtures only. These create no game entities, damage or persistent state. */
export function buildReferenceFixture(asset,{facing=1,sourcePosition={x:0,y:0},targetPosition}={}){
 const f=asset.runtime.fixture,ref=asset.runtime.timeline.reference;
 const localTarget=targetPosition??(f.kind==='melee'?{x:facing,y:-facing}:f.kind==='buff'?{x:sourcePosition.x+facing,y:sourcePosition.y-facing}:f.kind==='summon'?{x:sourcePosition.x+.6,y:sourcePosition.y+.6}:{x:facing*4,y:-facing*4});
 const distance=Math.hypot(localTarget.x-sourcePosition.x,localTarget.y-sourcePosition.y),speed=ref.projectile?.speed??.5,flight=f.kind==='projectile'?Math.ceil(distance/speed):0,activate=f.windupTicks+f.delayTicks,hit=flight?f.windupTicks+flight:activate;
 const resolvedDuration=f.kind==='trap'?1:f.durationTicks,activeEnd=activate+resolvedDuration,end=flight?hit+1:['zone','trap','buff','summon','beam'].includes(f.kind)?activeEnd:hit+1;
 let geometry={kind:'none'};
 if(f.kind==='beam')geometry={kind:'beam',origin:{...sourcePosition},target:{...localTarget},halfWidth:f.halfWidth,reach:f.reach};
 else if(f.radius)geometry={kind:'circle',center:{...localTarget},radius:f.radius};
 return {...f,durationTicks:resolvedDuration,placedDurationTicks:f.kind==='trap'?f.delayTicks:undefined,activate,hit,end,total:Math.max(end,hit+60,f.windupTicks+90),cancel:Math.max(1,Math.floor(Math.max(f.windupTicks,30)/2)),flight,sourcePosition:{...sourcePosition},targetPosition:localTarget,geometry,facing,referenceOnly:true,referenceLimits:'Samples recorded rule parameters and event schema; intended artwork contact points are fixture inputs, not a combat-execution proof.'};
}
export function referenceEventsAt(asset,tick,{facing=1,sourcePosition,targetPosition,launchScreen,contactScreen,phaseActive=false,mode='normal',targetId='ss-mon-dusk-blade'}={}){
 const f=buildReferenceFixture(asset,{facing,sourcePosition,targetPosition}),events=[],sourceId=f.actorId,castId='reference-'+asset.id,cancelled=['death','interrupt','phase-end'].includes(mode)&&tick>=f.cancel;
 const event=(type,at,data={})=>events.push({effectId:asset.id,castId,sourceId,type,tick:at,...data});
 event('cast_started',0,{resolved:{windupTicks:f.windupTicks,delayTicks:f.delayTicks,durationTicks:f.durationTicks},geometry:f.geometry,position:f.targetPosition});
 if(phaseActive&&asset.runtime.secondaryClips.phase_exhaust)event('phase-active',0);
 if(tick>=f.windupTicks&&(!cancelled||f.windupTicks<f.cancel)){
  event('cast_released',f.windupTicks,{position:f.targetPosition});
  if(f.kind==='projectile'){
   const direction={x:f.targetPosition.x-f.sourcePosition.x,y:f.targetPosition.y-f.sourcePosition.y};event('projectile_spawned',f.windupTicks,{projectileId:'ref-projectile',position:f.sourcePosition,screenPosition:launchScreen,direction});
   if(tick<f.hit){const p=Math.min(1,(tick-f.windupTicks)/Math.max(1,f.flight));event('projectile_snapshot',tick,{projectileId:'ref-projectile',position:{x:f.sourcePosition.x+direction.x*p,y:f.sourcePosition.y+direction.y*p},screenPosition:launchScreen&&contactScreen?{x:launchScreen.x+(contactScreen.x-launchScreen.x)*p,y:launchScreen.y+(contactScreen.y-launchScreen.y)*p}:undefined,direction});}
  }
  if(f.kind==='trap')event('effect_armed',f.windupTicks,{position:f.targetPosition,durationTicks:f.placedDurationTicks});
 }
 if(tick>=f.activate&&(!cancelled||f.activate<f.cancel)&&['zone','trap','buff','summon','beam','dash'].includes(f.kind))event('effect_activated',f.activate,{position:f.targetPosition,durationTicks:f.durationTicks,geometry:f.geometry});
 if(tick>=f.hit&&(!cancelled||f.hit<f.cancel)){
  if(f.kind==='projectile')event('projectile_ended',f.hit,{projectileId:'ref-projectile'});
  if(!['summon','buff'].includes(f.kind))event('hit_resolved',f.hit,{position:f.targetPosition,screenPosition:contactScreen,targetId});
  if(f.kind==='summon')event('summon_appeared',f.hit,{position:f.targetPosition});
  const status=asset.runtime.timeline.reference.statuses?.[0];if(status)event('status_applied',f.hit,{targetId,durationTicks:status.duration});
 }
 if(tick>=f.end)event('effect_ended',f.end,{position:f.targetPosition});
 if(cancelled){if(mode==='phase-end')event('interrupted',f.cancel,{position:f.targetPosition});event(mode==='death'?'death':mode==='phase-end'?'phase-end':'interrupted',f.cancel,{position:f.targetPosition});}
 return {fixture:f,events:events.sort((a,b)=>a.tick-b.tick)};
}
