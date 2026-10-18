import type {World} from '../../../packages/simulation/index.ts';
import {getBossDefinition} from '../../../packages/content/chapter-combat.ts';
/** Preview-only isolation: named boss spells must not be confused with fallback basic attacks. */
export function isolatePreviewBoss(world:World){for(const e of world.enemies)if(e.boss)e.cooldown=Number.MAX_SAFE_INTEGER;}
export function enemyPreviewDuration(id:string){
 const art=id==='frost'?'frost_queen':id==='void'?'abyss_lord':id==='beam'?'dragon_king':undefined;
 const skill=id==='frost'?'blizzard':id==='void'?'void_bolt':'ultimate',definition=art?getBossDefinition(art)?.skills.find(s=>s.id===skill):undefined;
 if(!definition)return id==='spike'?85:55;
 const active=definition.kind==='projectile'?40:definition.kind==='beam'?22:'duration' in definition?definition.duration??1:1;
 return 30+definition.windup+active+24;
}
