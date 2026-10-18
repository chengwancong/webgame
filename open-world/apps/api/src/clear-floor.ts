import {comboToEffect} from '../../../packages/contracts/effects.ts';
import {upperBoundSupported} from '../../../packages/simulation/effect-rules.ts';
import type {CharacterState,Spawn,Vec} from '../../../packages/contracts/index.ts';
import {regionById} from '../../../packages/content/index.ts';
import {resolveBuild} from '../../../packages/rules/index.ts';
import {World} from '../../../packages/simulation/index.ts';

/** 抽查用的清场下限：服务端不逐帧跟随玩家战斗，只在开战时用角色当前构筑离线打一遍“最理想”的情况。
 * 理想 = 怪全贴脸挤在一起（范围技一次全中）、每下必暴击、角色不会受伤；所以得到的是任何真实战斗都快不过的时间。
 * 秒杀型构筑一两下就打完，下限自然很短；刮痧构筑下限就长。实际用时低于下限（留出容差）才判为异常。 */
export const clearFloorTolerance=.8;
const maxTicks=30*90;
export function minimumClearMs(s:CharacterState,region:string,center:Vec,spawns:Spawn[]):number{
 if(!spawns.length)return 0;
 const build=resolveBuild(s),stats={...build.stats,critChance:1,critMultiplier:Math.max(1,build.stats.critMultiplier??1.5)};
 if(!(build.stats.rules??build.stats.combos?.map(comboToEffect)??[]).every(upperBoundSupported))return 0;
 const packed=spawns.map((m,i)=>({...m,x:center.x+.9*Math.cos(i*2.4),y:center.y+.9*Math.sin(i*2.4)}));
 const w=new World(regionById(region),stats,build.resolvedSkills,packed,[],1);
 w.upperBound=true;w.hero.position={...center};w.anchor={...center};w.setMode('auto');
 // 怪物站桩不还手：不会打断、减速或控制角色，所以只会让下限更短（对玩家更宽松）。
 (w as unknown as {enemyStep:()=>void}).enemyStep=()=>{};
 const ids=new Set(packed.map(m=>m.id));
 for(let t=0;t<maxTicks;t++){
  w.hero.hp=stats.hp;w.paused=false;w.step();
  if(!w.enemies.some(e=>e.alive&&ids.has(e.id)))return Math.floor(w.tick/30*1000*clearFloorTolerance);
 }
 // 理想情况下也打不完说明离线模拟不可靠（例如路径卡住），宁可不设下限也不误伤玩家。
 return 0;
}
