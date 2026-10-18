import {skillCatalog,regionById} from '../../packages/content/index.ts';
export const vfxScenarios=[...skillCatalog.map(s=>({id:s.id,type:'player'})),...['frost_queen','abyss_lord','dragon_king'].map(id=>({id,type:'boss'})),...['frost_wolf','snow_ranger','ice_elemental','frost_giant','shadow_stalker','bone_mage','abomination','shadow_lord','dragon_whelp','dragon_guard','dragon_priest'].map(id=>({id,type:'monster'}))];
export function runVfxScenario(Ctor:new(...args:any[])=>any,scenario:{id:string;type:string},recordedArmor=false){
 const region={...regionById('meadow'),safe:{x:12,y:12},landmarks:[],obstacles:[]},spawn=(id:string,x:number,y:number,art='raider')=>({id,x,y,name:id,kind:'ranged',hp:10000,attack:13,elite:false,boss:false,art});
 const player=scenario.type==='player',skill=skillCatalog.find(s=>s.id===(player?scenario.id:'cut'))!,stats={hp:10000,attack:20,armor:5,speed:6,mana:1000,regen:0,effects:[]};
 const r=['single','area'].includes(skill.kind)?1.8:4,spawns=player?[spawn('one',12+r,12),spawn('two',12+r+.8,13.5)]:[{...spawn('enemy',16,12,scenario.id),boss:scenario.type==='boss'}];
 const w=new Ctor(region,stats,[skill],spawns,[],73);w.mode='manual';if(skill.kind==='heal')w.hero.hp=5000;
 // The golden file records the pre-ratio armor rule. Preserve its trace rather
 // than replacing historical evidence with the current balance output.
 if(recordedArmor&&w.rules)delete w.rules.combatNumerics;
 if(player){w.enemies.forEach((e:any)=>e.cooldown=999999);w.cast(skill.id,w.enemies[0]);}else w.enemies[0].hp=1000;
 const samples=[];for(let i=0;i<(player?120:900);i++){w.step();if(i%30===0)samples.push(structuredClone({tick:w.tick,hero:w.hero,projectiles:w.projectiles.map((p:any)=>({position:p.position,damage:p.damage,life:p.life})),zones:w.zones.map((z:any)=>({position:z.position,radius:z.radius,damage:z.damage,life:z.life,delay:z.delay})),enemies:w.enemies.map((e:any)=>({id:e.id,hp:e.hp,position:e.position,action:e.action,alive:e.alive})),kills:w.kills.map((k:any)=>({...k}))}));}
 return JSON.parse(JSON.stringify(samples));
}
