import type {Permit,Snapshot} from '../../../packages/contracts/index.ts';
import {World} from '../../../packages/simulation/index.ts';

/** A renewed permit owns the clock, report cursor and spawn epoch together. */
export function adoptCombatPermit(current:World,previous:Permit|undefined,permit:Permit,snapshot:Pick<Snapshot,'stats'|'resolvedSkills'|'build'>){
 if(permit.region!==current.region.id||permit.build!==snapshot.build)throw Error('战斗授权与当前构筑不一致，请恢复连接。');
 // A routine renewal must preserve in-flight casts and their paid cooldowns.
 if(previous?.build!==snapshot.build)current.applyBuild(snapshot.stats,snapshot.resolvedSkills);
 let world=current;
 if(previous?.id!==permit.id){
  const intent=current.movementIntent(),remaining=(until:number)=>permit.from_tick+Math.max(0,until-current.tick);
  world=new World(current.region,snapshot.stats,snapshot.resolvedSkills,permit.spawns,permit.completed,permit.seed);
  world.tick=permit.from_tick;
  world.hero={...current.hero,position:{...current.hero.position},shieldUntil:remaining(current.hero.shieldUntil),actionUntil:remaining(current.hero.actionUntil)};
  world.cooldowns=Object.fromEntries(Object.entries(current.cooldowns).map(([id,until])=>[id,remaining(until)]));
  world.heroSlowUntil=remaining(current.heroSlowUntil);world.radius=current.radius;world.avoidElite=current.avoidElite;world.targetPriority=current.targetPriority;world.autoSkills=current.autoSkills;
  world.setMode(current.mode);world.anchor={...current.anchor};
  if(intent.destination)world.go(intent.destination);world.control(intent.input.x,intent.input.y);
 }
 const known=new Set([...world.enemies,...world.phased].map(e=>e.id)),done=new Set(permit.completed);
 const added=permit.spawns.filter(s=>!known.has(s.id)&&!done.has(s.id));if(added.length)world.addSpawns(added);
 world.tick=permit.from_tick;
 return {world,permit,build:permit.build,lastTick:permit.from_tick,sequence:permit.sequence};
}
