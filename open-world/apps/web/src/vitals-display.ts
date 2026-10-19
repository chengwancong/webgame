import type {Snapshot} from '../../../packages/contracts/index.ts';
import type {World} from '../../../packages/simulation/index.ts';
/** A local placeholder world must not replace the resolved snapshot while loading a safe scene. */
export function vitalsDisplay(world:World,snapshot:Pick<Snapshot,'stats'>,authoritative=false){
 const safe=!authoritative&&(world.region.id==='town'||world.region.id==='ss-map-port'||world.region.rest);
 return safe?{hp:snapshot.stats.hp,maxHp:snapshot.stats.hp,mana:snapshot.stats.mana,maxMana:snapshot.stats.mana}:
 {hp:Math.ceil(world.hero.hp),maxHp:world.stats.hp,mana:Math.floor(world.hero.mana),maxMana:world.stats.mana};
}
