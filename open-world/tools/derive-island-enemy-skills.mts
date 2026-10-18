import {readFile,writeFile} from 'node:fs/promises';
import plan from '../packages/content/island-enemy-skill-plan.json';
import {monsterContent} from '../packages/content/monsters.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {World} from '../packages/simulation/index.ts';
import {standard} from './standard-player-model.ts';
const multipliers:Record<string,number>={},rows=[];
for(const island of plan.islands){const level=[6,12,19,25][island.chapter-1],state=standard(level),build=resolveBuild(state),region={id:'damage-inverse',name:'伤害反求',subtitle:'受控',width:32,height:32,safe:{x:10,y:10},portal:{x:2,y:2},theme:'meadow',obstacles:[],landmarks:[],spawns:[],boss:false,auto:false};
 for(const skill of [...island.monsters,...island.bosses]){
  if(skill.kind==='buff'){multipliers[skill.id]=0;continue;}
  const boss=skill.id.includes('_boss_'),templates=Object.entries(island.bindings).filter(([,b])=>b.skillIds.includes(skill.id)).map(([id])=>monsterContent.templates.find(t=>t.id===id)!).filter(Boolean),rank=boss?'boss':'normal';
  const referenceAttack=Math.max(...templates.map(t=>resolveMonsterSpawn({id:'basis',template:t.id,level,rank:t.id.includes('rare')?'rare':t.id.includes('elite')?'elite':rank,x:12,y:10}).attack),1),ttd=boss?island.targetTtd.boss:island.targetTtd.normal,damageTicks=skill.kind==='zone'?Math.max(1,Math.ceil(skill.duration/30)):1,targetTaken=build.stats.hp/ttd*(skill.cooldown/30)*skill.threatShare/damageTicks;
  const defence={hp:build.stats.hp,attack:0,armor:build.stats.armor,speed:build.stats.speed,mana:build.stats.mana,regen:0,effects:[],damageReduction:build.stats.damageReduction,allResist:build.stats.allResist,dodge:0,blockChance:0};
  const taken=(amount:number)=>{const world=new World(region,defence,[],[],[],41),before=world.hero.hp;(world as any).hurt(amount,undefined,{damageType:skill.damageType,category:'direct',scaled:true});return before-world.hero.hp;};
  let low=1,high=Math.max(1,Math.ceil(targetTaken));while(taken(high)<targetTaken&&high<1e9)high*=2;while(low<high){const middle=Math.floor((low+high)/2);if(taken(middle)>=targetTaken)high=middle;else low=middle+1;}
  multipliers[skill.id]=low/referenceAttack;rows.push({skill:skill.id,level,player:{hp:build.stats.hp,armor:build.stats.armor},targetTtd:ttd,referenceAttack,rawHit:low,targetTaken,multiplier:multipliers[skill.id],owner:'actual World.hurt inverse; existing defence/effect rules'});
 }
}
await writeFile('packages/content/island-enemy-skill-damage.json',JSON.stringify({version:1,source:'derive-island-enemy-skills.mts; fixed seed41; HP/armour/target TTD inverse',multipliers,rows},null,2)+'\n');console.log(JSON.stringify({derived:rows.length,skills:Object.keys(multipliers).length}));
