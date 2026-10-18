import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {World,type CombatEvent} from '../packages/simulation/index.ts';
import {skillCatalog,type Region} from '../packages/content/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {versions,type CharacterState,type Skill,type Stats,type Spawn} from '../packages/contracts/index.ts';
const pairs=[['frost_blade','dual_strike'],['thunder_dash','rush'],['magma_slam','ground_slam'],['venom_cleave','rampage'],['frost_quake','cleave'],['fire_arrow','poison_arrow'],['thunder_arrow','chain'],['night_volley','volley'],['toxic_bomb','ember'],['shadow_blade','blade_flurry'],['night_veil','death_lotus'],['static_field','slow_field'],['dark_grasp','petrify'],['miasma','frost']] as const;
const region:Region={id:'rs-measure',name:'受控单技能测量',subtitle:'',theme:'meadow',width:60,height:40,safe:{x:10,y:10},portal:{x:4,y:4},obstacles:[],spawns:[],landmarks:[],boss:false,auto:false};
const seeds=[41,73,107],levels=[10,20,50],windowTicks=9000,warmupTicks=900,limitTicks=7200;
function build(id:string,level:number){const state:CharacterState={id:'rs-measure',name:'受控授予',revision:1,build:1,level,xp:0,gold:0,material:0,gear:[],equipment:{},skills:[id],skillRanks:{[id]:1},progress:{safe:'town',regions:['town'],bosses:[],tasks:[],kills:0}};const b=resolveBuild(state),skill=b.skillAccess.find(k=>k.id===id)?.current;assert(skill,id+' activation missing');const stats:Stats={...b.stats,weapon:undefined,hp:1000000,mana:1000000,regen:0,critChance:0};return {state,stats,skill};}
function run(id:string,level:number,seed:number,target:Spawn,ttk=false){const {state,stats,skill}=build(id,level),w=new World(region,stats,[skill],[target],[],seed);assert.deepEqual(w.skills.map(s=>s.id),state.skills);w.setMode('manual');w.enemies.forEach(e=>e.cooldown=1000000);let direct=0,periodic=0,casts=0,death:number|null=null;const hitLog:Pick<CombatEvent,'tick'|'amount'|'category'>[]=[];
 for(let i=0;i<(ttk?limitTicks:windowTicks+warmupTicks);i++){
  if(w.tick>=(w.cooldowns[id]??0)&&w.tick>=w.hero.actionUntil)w.cast(id,w.enemies[0]);w.step();
  for(const e of w.events){if(e.type==='cast_started'&&e.skill===id)casts++;if(e.type==='hit_resolved'&&e.id===target.id){if(ttk)hitLog.push({tick:e.tick,amount:e.amount,category:e.category});if(w.tick>warmupTicks){if(e.category==='direct')direct+=e.amount??0;else periodic+=e.amount??0;}}}
  if(!w.enemies[0].alive){death=w.tick;break;}
 }
 return {requested:state.skills,executed:w.skills.map(s=>s.id),rank:1,stats,skill,seed,casts,direct,periodic,dps:(direct+periodic)/(windowTicks/30),ttk:death===null?null:death/30,failed:ttk&&death===null,...(ttk?{hits:hitLog,target}: {})};
}
const comparisons=[];
for(const [id,reference] of pairs){const a=run(id,50,41,{id:'target',name:'无甲耐久靶',x:12,y:10,hp:100000000,attack:0,kind:'melee',boss:false,elite:false,art:'raider'}),b=run(reference,50,41,{id:'target',name:'无甲耐久靶',x:12,y:10,hp:100000000,attack:0,kind:'melee',boss:false,elite:false,art:'raider'}),difference=a.dps/b.dps-1,deferred=id==='fire_arrow';comparisons.push({id,reference,difference,inBand:Math.abs(difference)<=.10001,deferred,new:a,old:b});}
const samples=[];for(const level of levels)for(const seed of seeds)for(const [id,reference] of pairs)for(const selected of [id,reference])samples.push({id:selected,level,...run(selected,level,seed,resolveMonsterSpawn({id:'target',template:'raider',level,rank:'normal',x:12,y:10}),true)});
const report={versions,mode:'controlled grant, explicit rank 1, same attack budget for each pair',seeds,levels,windowTicks,warmupTicks,limitTicks,sampleCount:samples.length,limitations:['No gear or build triggers. Weapon filter explicitly bypassed for cross-weapon references.','High HP/mana and disabled enemy attacks isolate skill output. Not natural progression or complete BD balance.','Fire arrow vs old poison arrow is deferred to R8 by user decision.'],comparisons,samples,failed:samples.filter(s=>s.failed).map(s=>({id:s.id,level:s.level,seed:s.seed})),outOfBand:comparisons.filter(c=>!c.inBand&&!c.deferred).map(c=>({id:c.id,reference:c.reference,difference:c.difference}))};
const out='docs/reviews/build-variety-rs-20261006';await mkdir(out,{recursive:true});await writeFile(out+'/measurements.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({versions,sampleCount:report.sampleCount,failed:report.failed,outOfBand:report.outOfBand,comparisons:comparisons.map(c=>({id:c.id,reference:c.reference,dps:c.new.dps,referenceDps:c.old.dps,difference:c.difference,deferred:c.deferred}))}));
