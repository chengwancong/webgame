import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import {applyItemPower} from '../packages/rules/item-power.ts';
import {newStarseaState,applyStarseaOp,starseaCurrentStep} from '../packages/rules/starsea.ts';
import {regionById,starterSkills} from '../packages/content/index.ts';
import {World,distance} from '../packages/simulation/index.ts';
import {engineDefense} from '../packages/content/starsea/defense.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
const samples=[];
for(const ward of [false,true])for(let seed=1;seed<=20;seed++){
 const gear=[makeGear(0,'sword'),makeGear(2,'coat')].map(g=>applyItemPower(g,1)),s:CharacterState={id:'measurement',name:'原始开局装备',revision:0,build:1,level:3,xp:0,gold:0,material:0,gear,equipment:{weapon:'sword',armor:'coat'},skills:[...starterSkills],skillRanks:Object.fromEntries(starterSkills.map(id=>[id,1])),skillBooks:{},progress:{kills:0,regions:[],bosses:[],safe:'ss-map-wind',tasks:[]},starsea:newStarseaState()};
 s.starsea!.task=2;s.starsea!.openingComplete=true;s.starsea!.attempt=seed;const wave=applyStarseaOp(s,'interact',{region:'ss-map-wind',target:'object:engine'}),step=starseaCurrentStep(s)!,build=resolveBuild(s),w=new World(regionById('ss-map-wind'),build.stats,build.resolvedSkills,wave.spawns,[],seed);
 if(build.resolvedSkills.map(s=>s.id).join(',')!==starterSkills.join(','))throw Error('Measurement build differs from requested starter bar');
 w.setMode('manual');w.hero.position={x:step.points[0].x+1.5,y:step.points[0].y};w.defense={position:{x:step.points[0].x,y:step.points[0].y},hp:engineDefense.hp,maxHp:engineDefense.hp,radius:engineDefense.radius,requiredTicks:engineDefense.holdTicks,heldTicks:0,enemyIds:wave.spawns.map(m=>m.id),failed:false,complete:false};let minHp=w.hero.hp;
 for(let i=0;i<1800&&!w.defense.failed&&!w.defense.complete;i++){const target=w.enemies.filter(e=>e.alive).sort((a,b)=>distance(a.position,w.hero.position)-distance(b.position,w.hero.position))[0];if(target&&distance(target.position,w.hero.position)>1.8&&distance(target.position,w.defense.position)<5.8)w.go(target.position);else w.cancelWalk();w.cast('cut');if(w.enemies.filter(e=>e.alive&&distance(e.position,w.hero.position)<=3.5).length>=2)w.cast('whirl');if(ward&&w.hero.hp<build.stats.hp*.9)w.cast('ward');w.step();minHp=Math.min(minHp,w.hero.hp);}
 samples.push({seed,ward,won:w.defense.complete,seconds:w.tick/30,minHp:Math.round(minHp),maxHp:build.stats.hp,engineHp:w.defense.hp,kills:w.kills.length});
}
const groups=[false,true].map(ward=>{const rows=samples.filter(s=>s.ward===ward);return {ward,wins:rows.filter(s=>s.won).length,samples:rows.length,meanSeconds:rows.reduce((a,s)=>a+s.seconds,0)/rows.length,meanLowestHpPercent:rows.reduce((a,s)=>a+s.minHp/s.maxHp*100,0)/rows.length};});
const folder=resolve('../docs/reviews/open-world/weapon-story-20261004');mkdirSync(folder,{recursive:true});writeFileSync(resolve(folder,'engine-balance.json'),JSON.stringify({rules:'ow-23',strategy:'controlled Lv3, original item-level1 sword and coat, no upgrades; manually approach within defense radius, use cut, whirl on two targets, optional ward below90%HP; task wave only, excludes other field monsters',config:engineDefense,groups,samples},null,2));console.log(JSON.stringify(groups));
