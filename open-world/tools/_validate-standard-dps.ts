import {World,walkable,distance} from '../packages/simulation/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {starseaRegions} from '../packages/content/starsea/index.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {standard} from './standard-player-model.ts';
import {expectedCharacter} from './starsea-balance-model.ts';
const arena=structuredClone(starseaRegions.find(r=>r.id==='ss-map-wind')!);
const open=(()=>{for(let y=8;y<arena.height-8;y++)for(let x=8;x<arena.width-8;x++){const p={x,y};if(distance(p,arena.safe)<16)continue;if([p,{x:x-5,y},{x:x+5,y},{x,y:y-5},{x,y:y+5},{x:x+4,y:y+4},{x:x-4,y:y-4}].every(p=>walkable(arena,p,2)))return p;}throw Error('no ground');})();
function dps(c:any,L:number){const b=resolveBuild(c);const s=resolveMonsterSpawn({id:'dummy0',template:'ss-mon-dusk-blade',level:L,rank:'normal',x:open.x+2.5,y:open.y},monsterContent);s.hp=1e15;s.attack=0;s.monster!.baseStats.attack=0;s.monster!.ai.skillChance=0;
 const w=new World(structuredClone(arena),b.stats,b.resolvedSkills,[s],[],11);w.rules.monsters=structuredClone(monsterContent);w.hero.position={...open};w.anchor={...open};w.radius=40;w.setMode('auto');let dmg=0;
 for(let t=0;t<900;t++){w.step();for(const e of w.events)if(e.type==='hit_resolved'&&e.id!==w.playerId)dmg+=e.amount??0;}return dmg/30;}
for(const L of [21,37,50]){const base=dps(expectedCharacter(L),L),full=dps(standard(L),L);console.log(L,'base',Math.round(base),'standard',Math.round(full),'ratio',(full/base).toFixed(2));}
