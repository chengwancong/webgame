import {mkdir,writeFile} from 'node:fs/promises';
import {World} from '../packages/simulation/index.ts';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {regionById} from '../packages/content/index.ts';
import {challengeContent} from '../packages/content/progression-challenges.ts';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import {simulateChallenge} from '../packages/rules/progression-challenges.ts';
import {versions,type CharacterState} from '../packages/contracts/index.ts';
const rows=[];
for(const definition of dungeonContent.definitions.filter(d=>d.kind==='raid'&&d.mode==='simulation'))for(const seed of [11,23,47]){
 const members=Object.entries(definition.policy.party.roles).flatMap(([role,n])=>Array.from({length:n},(_,index)=>{
  const id=role+'-'+index,gear=[makeGear(0,id+'-weapon'),makeGear(2,id+'-armor'),makeGear(3,id+'-core')];gear.forEach(g=>g.rank=5);
  const skills=role==='healer'?['mend','ward','bolt','frost']:role==='tank'?['cut','ward','mend','whirl']:['bolt','chain','frost','mend'];
  const state:CharacterState={id,name:id,revision:0,build:1,level:definition.level,xp:0,gold:0,material:0,gear,equipment:{weapon:gear[0].id,armor:gear[1].id,core:gear[2].id},skills,skillRanks:Object.fromEntries(skills.map(s=>[s,5])),progress:{kills:0,regions:[],bosses:[],safe:'town',tasks:[]}};
  return {state,role:role as 'tank'|'healer'|'damage'};
 }));
 const old=simulateChallenge(members[0].state,challengeContent.entries.find(d=>d.id===definition.challenge)!,1,seed,'comparison',versions.rules,members),builds=members.map(m=>({...m,...resolveBuild(m.state)}));let tick=0,previous:World|undefined,stages=0;
 for(const [stage,id] of definition.stages.entries()){
  const region=structuredClone(regionById(id)),scale=definition.policy.enemyScale,w=new World(region,builds[0].stats,builds[0].resolvedSkills,region.spawns.map(e=>({...e,id:stage+':'+e.id,hp:Math.round(e.hp*scale.hp*(1+stage*scale.hpPerStage)),attack:Math.round(e.attack*scale.attack*(1+stage*scale.attackPerStage))})),[],seed+stage);w.tick=tick;w.supportRange=definition.policy.allyRange;
  for(const b of builds){w.addPlayer(b.state.id,b.stats,b.resolvedSkills);const before=previous?.players.get(b.state.id);if(before){w.players.get(b.state.id)!.hero.hp=before.hero.hp;w.players.get(b.state.id)!.hero.mana=before.hero.mana;w.players.get(b.state.id)!.cooldowns={...before.cooldowns};}w.forPlayer(b.state.id,()=>{w.setMode('auto');w.radius=Math.max(region.width,region.height);});}
  while(w.enemies.some(e=>e.alive)&&w.livingPlayers().length&&w.tick<definition.policy.timeLimitSeconds*30)w.step();tick=w.tick;previous=w;if(w.enemies.some(e=>e.alive))break;stages++;
 }
 rows.push({dungeon:definition.id,seed,level:definition.level,party:members.length,oldAggregate:{success:old.won,seconds:old.ticks/30},independentActors:{success:stages===definition.stages.length,stages,seconds:tick/30,survivors:previous?.livingPlayers().length??0}});
}
const report={versions,policy:'full-auto, configured roles, existing base gear rank 5 and equipped skills rank 5',samples:rows.length,limits:['Core benchmark, not a natural leveling or human difficulty result','No loot, gear acquisition or server latency simulation','Manual rescue is excluded; server automatic mode can rescue downed actors','Aggregate and actor combat are structurally different; enemy damage is applied to actual targets'],rows};await mkdir('../docs/reviews/open-world/dungeon-lifecycle',{recursive:true});await writeFile('../docs/reviews/open-world/dungeon-lifecycle/balance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
