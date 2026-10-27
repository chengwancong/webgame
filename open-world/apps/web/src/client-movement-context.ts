import type {Vec} from '../../../packages/contracts/index.ts';
import type {ClientMovementView} from '../../../packages/contracts/client-movement.ts';
import type {World} from '../../../packages/simulation/index.ts';
import type {ClientMovementDriver} from './client-movement-driver.ts';

export type ClientMovementPresentation={position:Vec;active:boolean;moving:boolean;facing:number;epoch:string;revision:number;handoffPosition?:Vec};
export function clientMovementContext(world:World){return {region:world.region,speed:world.movementSpeed(),radius:world.rules.bodyCollision.heroRadius,bodies:(position:Vec,reach:number)=>world.movementBodies(position,reach)};}
export function clientMovementAvailability(world:World,connected:boolean){return {alive:world.hero.hp>0,connected,blocked:world.statuses.some(s=>s.targetId===world.playerId&&s.ends>world.tick&&['stun','petrify','freeze','time_stop','root','fear'].includes(s.effect.kind))};}
export function clientMovementPresentation(driver:ClientMovementDriver,view:ClientMovementView,position:Vec):ClientMovementPresentation{
 return {position,active:driver.active,moving:driver.moving,facing:driver.facing,epoch:view.epoch,revision:view.revision,handoffPosition:driver.handoffPosition};
}
