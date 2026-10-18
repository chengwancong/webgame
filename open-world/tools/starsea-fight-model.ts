// 星潮海实战模型：用真实战斗核心（World）让新角色在半自动下迎战一组怪物，记录胜负、用时和剩余生命。
// 运行：npx tsx tools/starsea-fight-model.ts
import {randomUUID} from 'node:crypto';
import {World} from '../packages/simulation/index.ts';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import {applyItemPower} from '../packages/rules/item-power.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {starseaRegions,starseaCampaign} from '../packages/content/starsea/index.ts';
import {newStarseaState} from '../packages/rules/starsea.ts';
import {makeStarseaStarterWeapon,makeStarseaStarterJewelry} from '../packages/rules/starsea-starter.ts';
import type {CharacterState} from '../packages/contracts/index.ts';

/** 刚出生的角色：初始武器与护甲，只有初始技能。 */
export function freshCharacter(level:number):CharacterState{
 const gear=[makeGear(0,randomUUID()),makeGear(2,randomUUID())].map(g=>applyItemPower(g,1));
 gear[0]=makeStarseaStarterWeapon(gear[0].id);
 gear.push(...makeStarseaStarterJewelry([randomUUID(),randomUUID()]));
 return {id:randomUUID(),name:'model',revision:0,build:1,level,xp:0,gold:0,material:0,gear,equipment:{weapon:gear[0].id,armor:gear[1].id,accessory:gear[2].id,ring:gear[3].id},skills:['cut','ward','whirl'],skillRanks:{cut:1,ward:1,whirl:1},skillBooks:{},progress:{kills:0,regions:[],bosses:[],safe:'ss-map-port',tasks:[]},starsea:newStarseaState()} as unknown as CharacterState;
}
export function fight(s:CharacterState,foes:{template:string;level:number;rank:'normal'|'elite'|'boss'}[],seed=7,seconds=90){
 const region=structuredClone(starseaRegions.find(r=>r.id==='ss-map-wind')!);region.spawns=[];
 const at=region.safe,b=resolveBuild(s);
 const spawns=foes.map((f,i)=>resolveMonsterSpawn({id:'f'+i,template:f.template,level:f.level,rank:f.rank,x:at.x+3+(i%2),y:at.y+(i>>1)-1}));
 const w=new World(region,b.stats,b.resolvedSkills,spawns,[],seed);w.setMode('semi');
 let dealt=0,taken=0;
 for(let t=0;t<seconds*30;t++){w.step();for(const e of w.events){if(e.type==='hit_resolved'){if(e.id===w.playerId)taken+=e.amount??0;else dealt+=e.amount??0;}}if(w.hero.hp<=0||w.enemies.every(e=>!e.alive))break;}
 return {win:w.hero.hp>0&&w.enemies.every(e=>!e.alive),seconds:Math.round(w.tick/3)/10,hpLeft:Math.round(w.hero.hp/b.stats.hp*100)+'%',alive:w.enemies.filter(e=>e.alive).length,dps:Math.round(dealt/(w.tick/30)),takenDps:Math.round(taken/(w.tick/30)),heroHp:b.stats.hp};
}
if(/starsea-fight-model\.ts$/.test(process.argv[1]??'')){
 const normal=starseaCampaign.monsters.filter(m=>m.rank==='normal'&&m.chapter.includes(1)).map(m=>m.id),elite=starseaCampaign.monsters.find(m=>m.rank==='elite'&&m.chapter.includes(1))!.id;
 for(const [heroL,monL,count,withElite] of [[1,1,2,false],[2,3,3,false],[2,4,4,false],[3,5,4,true],[5,5,4,true],[7,7,4,true],[9,9,1,false]] as const){
  const foes=[...Array.from({length:count},(_,i)=>({template:normal[i%normal.length],level:monL,rank:'normal' as const})),...(withElite?[{template:elite,level:monL+1,rank:'elite' as const}]:[])];
  console.log(`英雄 L${heroL} vs ${count}×L${monL}${withElite?' + 精英':''}:`,JSON.stringify(fight(freshCharacter(heroL),foes)));
 }
}
