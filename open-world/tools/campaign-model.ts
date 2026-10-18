import {dungeonContent} from '../packages/content/dungeons.ts';
import {World,distance} from '../packages/simulation/index.ts';
import {regions,starterSkills,skillCatalog,settings} from '../packages/content/index.ts';
import {makeGear,resolveBuild,applyXp,upgradeCost,skillUpgradeCost,gearBases,gearContribution} from '../packages/rules/index.ts';
import {rewardFor,rewards,dropProfileFor,rollGearDrop,scaleWorldGear,pickRegionalGearTemplate,equipmentDropRules,worldGearTemplates} from '../apps/api/src/economy.ts';
import {generateAffixes} from '../packages/rules/affix-generator.ts';
import {progressionGearTemplates} from '../packages/content/deep-progression.ts';
import {resolveMeasuredBuild} from './measured-build.ts';
import type {CharacterState,Spawn} from '../packages/contracts/index.ts';
import {storyChapters} from '../packages/content/story-campaign.ts';

export function campaignCharacter(style:'starter'|'melee'|'ranged'){
 const gear=[makeGear(style==='ranged'?1:0,'weapon'),makeGear(2,'armor'),makeGear(3,'accessory'),makeGear(5,'core'),makeGear(style==='ranged'?0:1,'spare-weapon'),makeGear(4,'fire-core')];
 return {id:'campaign',name:style,revision:0,build:1,level:1,xp:0,gold:0,material:0,gear,equipment:{weapon:'weapon',armor:'armor'},skills:style==='ranged'?['bolt','ward']:[...starterSkills],skillRanks:Object.fromEntries((style==='ranged'?['bolt','ward']:starterSkills).map(id=>[id,1])),progress:{kills:0,regions:['town','meadow'],bosses:[],safe:'town',tasks:[]}} as CharacterState;
}
function gain(region:string,m:Spawn){
 return rewardFor(region,m.boss?'boss':m.elite?'elite':'normal');
}
export type CampaignOptions={loot?:boolean;farmAfterBoss?:boolean;farmSeconds?:Record<string,number>};
export function simulateCampaign(seed:number,style:'starter'|'melee'|'ranged',budget=false,options:CampaignOptions={}){
 const state=campaignCharacter(style),rows=[];
 let rng=seed>>>0;const random={float:()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;},int:(min:number,max:number)=>min+Math.floor(random.float()*(max-min))};
 const templates=worldGearTemplates(gearBases);
 const completed=new Map<string,string[]>();let serial=0,completedBosses=0;
 const score=()=>{const s=resolveBuild(state).stats;return s.attack+s.armor*1.5+s.hp/15+s.regen*2+s.mana/50+(s.lifesteal??0)*100+(s.critChance??0)*s.attack*.5+(s.cdr??0)*s.attack;};
 for(const chapter of storyChapters){const area=regions.find(r=>r.id===chapter.area)!;
  const stages=[{region:area,phase:'gate'}, {region:regions.find(r=>r.id===area.id+'-boss')!,phase:'boss'},...(options.farmAfterBoss?[{region:area,phase:'farm'}]:[])];
  for(const {region,phase} of stages){
   const preferred=style==='melee'?['cut','whirl','ward','mend']:style==='ranged'?['bolt','pierce_arrow','ward','mend']:['cut','whirl','ward','mend'];
   for(const id of preferred){const def=skillCatalog.find(s=>s.id===id)!;if(!def.activation&&state.level>=def.unlockLevel)state.skillRanks[id]??=1;}
   state.skills=preferred.filter(id=>state.skillRanks[id]);
   if(budget){if(completedBosses>0){state.equipment.accessory??='accessory';state.equipment.core??='core';}for(const g of state.gear.filter(g=>Object.values(state.equipment).includes(g.id))){const price=upgradeCost(g.rank);if(g.rank<Math.min(3,completedBosses)&&state.gold>=price.gold&&state.material>=price.material){state.gold-=price.gold;state.material-=price.material;g.rank++;}}
    for(const id of state.skills){const rank=state.skillRanks[id],price=skillUpgradeCost(rank);if(rank<Math.min(3,1+Math.floor(state.level/4))&&state.gold>=price.gold&&state.material>=price.material){state.gold-=price.gold;state.material-=price.material;state.skillRanks[id]++;}}
   }
   const resolved=resolveMeasuredBuild(state),spawns=region.spawns.map(m=>({...m,id:`${region.id}:1:${m.id}`}));
   const world=new World(region,resolved.stats,resolved.resolvedSkills,spawns,phase==='farm'?completed.get(area.id)??[]:[],seed);world.setMode('auto');world.radius=region.boss?Math.max(region.width,region.height):20;
   let damageTaken=0,casts=0,killed=0,elites=0,lastProgress=0,repositions=0,swaps=0,salvaged=0;const loot:CharacterState['gear']=[];
   const done=()=>phase==='farm'?(world.tick>=(options.farmSeconds?.[area.id]??60)*30||world.enemies.every(e=>!e.alive||!e.reward)):region.boss?world.enemies.every(e=>!e.alive||!e.reward):killed>=6&&elites>=1;
   const entryLevel=state.level;
   const timeLimitSeconds=dungeonContent.definitions.find(d=>d.id==='trial-'+area.id)!.policy.timeLimitSeconds;
   while(world.tick<timeLimitSeconds*settings.tickRate&&world.hero.hp>0&&!done()){
    world.step();damageTaken+=world.events.filter(e=>e.type==='hit_resolved'&&e.id==='hero').reduce((n,e)=>n+(e.amount??0),0);casts+=world.events.filter(e=>e.type==='cast_started'&&e.sourceId==='hero').length;
    if(!region.boss&&world.tick-lastProgress>300&&world.mode==='auto'&&world.autoState==='等待敌群刷新'){
     const target=world.enemies.filter(e=>e.alive&&e.reward).sort((a,b)=>distance(a.position,world.hero.position)-distance(b.position,world.hero.position))[0];
     if(target){world.go({x:target.position.x-2,y:target.position.y});lastProgress=world.tick;repositions++;}
    }
    if(world.mode==='semi'&&(!world.movementIntent().destination||world.tick-lastProgress>90)){world.cancelWalk();world.setMode('auto');lastProgress=world.tick;}
    const newKills=world.kills.splice(0);
    if(newKills.length){lastProgress=world.tick;for(const k of newKills){const m=spawns.find(m=>m.id===k.source_id);if(!m)continue;const reward=gain(region.id,m);state.gold+=reward.gold;state.material+=reward.material;applyXp(state,reward.xp);killed++;if(m.elite)elites++;
      if(!m.boss)completed.set(area.id,[...(completed.get(area.id)??[]),m.id]);
      if(options.loot){const profile=dropProfileFor(area.id),quality=rollGearDrop(m,profile,m.boss&&!state.progress.bosses.includes(region.id),random.int);if(quality){const base=pickRegionalGearTemplate(templates,area.id,equipmentDropRules,random.int),g={...scaleWorldGear(base,profile),id:'loot-'+(++serial),rank:0,locked:false,quality,affixes:generateAffixes(quality,profile.maxAffixTier,random)};loot.push(g);}}
     }
     const build=resolveMeasuredBuild(state);world.applyBuild(build.stats,build.resolvedSkills);
    }
   }
   if(done()&&world.hero.hp>0)for(const gear of loot){
    const oldId=state.equipment[gear.slot],before=score();state.gear.push(gear);state.equipment[gear.slot]=gear.id;
    const better=score()>before+.01;
    if(!better){state.equipment[gear.slot]=oldId;state.gear=state.gear.filter(g=>g.id!==gear.id);}
    else{swaps++;if(oldId)state.gear=state.gear.filter(g=>g.id!==oldId);}
    if(!better||oldId){state.material+=rewards.salvageMaterial;salvaged++;}resolveBuild(state);
   }
   const exitStats=resolveBuild(state).stats;
   const row={seed,style,budget,region:region.id,phase,boss:region.boss,entryLevel,exitLevel:state.level,win:done()&&world.hero.hp>0,damageTaken,casts,timeLimitSeconds,seconds:Math.round(world.tick/30*100)/100,hp:world.hero.hp,hpMax:world.stats.hp,kills:killed,elites,repositions,gold:state.gold,material:state.material,stop:world.stopReason,resolvedSkills:resolved.resolvedSkills.map(sk=>({id:sk.id,damage:sk.damage,rank:state.skillRanks[sk.id]})),entryStats:resolved.stats,exitStats,skillRanks:{...state.skillRanks},position:{...world.hero.position},drops:loot.length,swaps,salvaged,equipment:state.gear.filter(g=>Object.values(state.equipment).includes(g.id)).map(g=>({base:g.base,slot:g.slot,quality:g.quality,rank:g.rank,...gearContribution(g).effective,affixes:g.affixes})),diagnostic:done()?undefined:{position:world.hero.position,mode:world.mode,auto:world.autoState,mana:world.hero.mana,intent:world.movementIntent(),enemies:world.enemies.filter(e=>e.alive&&e.reward).map(e=>({id:e.id,hp:e.hp,position:e.position}))}};rows.push(row);
   if(!row.win)return {seed,style,budget,complete:false,rows};
   if(region.boss){completedBosses++;state.progress.bosses.push(region.id);if(area.next)state.progress.regions.push(area.next);}
  }
 }
 return {seed,style,budget,complete:true,rows};
}
