import {World} from '../packages/simulation/index.ts';
import {regions,skillCatalog} from '../packages/content/index.ts';
import {makeGear} from '../packages/rules/index.ts';
import {resolveMeasuredBuild} from './measured-build.ts';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {versions,type CharacterState} from '../packages/contracts/index.ts';
import {sourceVersion} from './source-version.mjs';
const builds={melee:['cut','whirl','ward','mend'],ranged:['bolt','chain','frost','mend'],burn:['ember','frost','ward','mend']};
const rows=[];const factor=Number(process.argv.find(a=>a.startsWith('--hp='))?.split('=')[1]??1);
for(const [build,skills]of Object.entries(builds))for(const level of [1,3,5])for(const seed of [11,23,47,71,101]){
 const gear=[makeGear(build==='ranged'?1:0,'weapon'),makeGear(2,'armor'),makeGear(build==='burn'?4:3,'core')];
 const state:CharacterState={id:'model',name:'policy',revision:0,build:1,level,xp:0,gold:0,material:0,gear,equipment:{weapon:'weapon',armor:'armor',core:'core'},skills,skillRanks:Object.fromEntries(skills.map(id=>[id,1])),progress:{kills:0,regions:[],bosses:[],safe:'town',tasks:[]}};
 const resolved=resolveMeasuredBuild(state),region=regions.find(r=>r.id===(level===1?'meadow-boss':level===3?'forest-boss':'rift-boss'))!;
 const w=new World(region,resolved.stats,resolved.resolvedSkills,region.spawns.map(m=>({...m,hp:Math.round(m.hp*factor)})),[],seed);w.setMode('auto');w.radius=20;
 let casts=0,hitEvents=0,damageDealt=0;for(let i=0;i<5400&&w.hero.hp>0&&w.enemies.some(e=>e.alive);i++){w.step();casts+=w.events.filter(e=>e.type==='cast_started'&&e.sourceId==='hero').length;for(const e of w.events)if(e.type==='hit_resolved'&&e.id!=='hero'){hitEvents++;damageDealt+=e.amount??0;}}
 if(!casts||!hitEvents||damageDealt<=0)throw Error('Measurement did not execute offensive skills: '+build+' L'+level+' seed '+seed);
 rows.push({model_version:'armed-core-2',rules:versions.rules,policy:'full-auto-v2',seed,build,level,hp_factor:factor,resolvedSkills:resolved.resolvedSkills.map(sk=>({id:sk.id,rank:state.skillRanks[sk.id],damage:sk.damage,cooldown:sk.cooldown})),stats:resolved.stats,casts,hitEvents,damageDealt,win:w.enemies.every(e=>!e.alive),seconds:w.tick/30,hp:w.hero.hp,mana:Math.round(w.hero.mana),stop:w.stopReason||'horizon'});
}
const report={versions,source:await sourceVersion(),model:'armed-core-2',question:'How do three explicitly activated rank-1 loadouts perform?',assumptions:['Controlled fixtures explicitly grant the selected skills, including book/level skills; not a natural L1 character','No reward/drop or acquisition simulation','Server-resolved skills and gear','Bot win rate is not human difficulty'],samples:rows.length,rows};
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);if(out){await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
