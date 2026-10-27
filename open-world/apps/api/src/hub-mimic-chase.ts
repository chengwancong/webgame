import {distance,findPath,walkable,type World,type Entity} from '../../../packages/simulation/index.ts';
import type {Vec} from '../../../packages/contracts/index.ts';
import type {TreasureChaseRules} from '../../../packages/content/treasure-chase.ts';
import type {HubRunState} from './hub-dungeon-runtime.ts';
import {segmentContact} from '../../../packages/simulation/collision.ts';

/** Destination selection happens once at awakening. World owns every later move. */
export function mimicChaseDestinations(w:World,enemy:Entity,opener:Vec,rules:TreasureChaseRules):Vec[]{
 const radius=enemy.boss?w.rules.bodyCollision.bossRadius:enemy.elite?w.rules.bodyCollision.eliteRadius:w.rules.bodyCollision.enemyRadius;
 const points:Vec[]=[];let from={...enemy.position};
 const escape=Math.atan2(from.y-opener.y,from.x-opener.x),turn=enemy.id.split('').reduce((n,c)=>n+c.charCodeAt(0),0)%2?1:-1;
 for(let leg=0;leg<rules.legs;leg++){
  const heading=escape+turn*leg*Math.PI/2;let chosen:Vec|undefined,fallback:Vec|undefined;
  for(const span of [rules.routeDistance,rules.minimumRouteDistance]){
   for(const angle of rules.candidateTurns){
    const a=heading+angle*Math.PI/180,p={x:Math.max(1+radius,Math.min(w.region.width-1-radius,from.x+Math.cos(a)*span)),y:Math.max(1+radius,Math.min(w.region.height-1-radius,from.y+Math.sin(a)*span))};
    if(distance(from,p)<rules.minimumRouteDistance-.01||!walkable(w.region,p,radius))continue;
    const path=findPath(w.region,from,p,radius);if(!path.length)continue;
    let length=0,last=from,blocked=false;for(const point of path){length+=distance(last,point);if(segmentContact(last,point,opener,radius+w.rules.bodyCollision.heroRadius)!==null)blocked=true;last=point;}
    if(length>rules.maximumPathLength)continue;
    if(blocked){fallback??=p;continue;}chosen=p;break;
   }
   if(chosen)break;
  }
  chosen??=fallback;if(!chosen)break;points.push(chosen);from=chosen;
 }
 return points;
}

/** Called only after the service has spawned the existing elite and frozen its id. */
export function startHubMimicChase(w:World,state:HubRunState,stage:number):boolean{
 const mimic=state.mimic,rules=state.mimicRules;if(!mimic||mimic.stage!==stage||!mimic.enemy||!rules)return false;
 const enemy=w.enemies.find(e=>e.id===mimic.enemy&&e.alive);if(!enemy)return false;if(enemy.chase){mimic.chase=true;return true;}
 const player=mimic.player?w.players.get(mimic.player):undefined,opener=player?.hero.position??w.hero.position;
 const speed=Math.min(enemy.monster?.ai.speed??w.rules.aiRules.profiles[enemy.kind].speed,player?.stats.speed??w.stats.speed);
 // A future map with no route degrades explicitly to cornered combat. Record
 // the encounter so that the same intro is not guaranteed endlessly.
 const destinations=mimicChaseDestinations(w,enemy,opener,rules);if(!Number.isFinite(speed)||speed<=0)return false;
 const ticks=(seconds:number)=>Math.max(1,Math.round(seconds*w.rules.settings.tickRate));
 const started=w.startEnemyChase(enemy.id,destinations,{speed,wakeTicks:ticks(rules.wakeSeconds),totalTicks:ticks(rules.totalSeconds),restTicks:ticks(rules.restSeconds),interceptTicks:ticks(rules.interceptSeconds),stallTicks:ticks(rules.stalledSeconds),arrivalRadius:rules.arrivalRadius,interceptRadius:rules.interceptRadius,interceptApproach:rules.interceptApproach});
 if(started)mimic.chase=true;return started;
}

export function hubMimicChaseView(w:World|undefined,state:HubRunState,stage:number){
 const mimic=state.mimic;if(!w||!state.mimicRules||!mimic||mimic.stage!==stage||mimic.done)return;
 const enemy=w.enemies.find(e=>e.id===mimic.enemy&&e.alive),chase=enemy?.chase;if(!enemy||!chase)return;
 const intercept=['waking','running'].includes(chase.phase)?chase.destinations[chase.leg]:undefined;
 return {chestId:mimic.chest,enemyId:enemy.id,phase:chase.phase,position:{...enemy.position},...(intercept?{intercept:{...intercept}}:{}),remainingSeconds:chase.phase==='cornered'?0:Math.max(0,(chase.until-w.tick)/w.rules.settings.tickRate),interceptions:chase.interceptions};
}
