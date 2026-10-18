/** S8：原历史fixture保留；新规则数值的确定性全帧快照另存，断言结构不变。 */
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import oldBuilds from '../../tests/fixtures/build-variety-r1/legacy-builds.json';
import oldPoison from '../../tests/fixtures/build-variety-rs/poison-before.json';
import {resolveBuild} from '../../packages/rules/index.ts';
import {World,type CombatEvent} from '../../packages/simulation/index.ts';
import {regionById,type Region} from '../../packages/content/index.ts';
import type {CharacterState} from '../../packages/contracts/index.ts';
import {combatOutcomeEvents} from '../../tests/fixtures/combat-outcome-events.ts';
import {trace} from '../../tests/fixtures/combat-feedback-scenario.ts';
import {stamp,save,review,evidence} from './io.ts';
const folder='tests/fixtures/numeric-spine',rawFolder=review+'/S8/golden-raw',digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');await mkdir(folder,{recursive:true});await mkdir(rawFolder,{recursive:true});
const rows=oldBuilds.map(row=>{const build=resolveBuild(structuredClone(row.state) as unknown as CharacterState),w=new World({...regionById('meadow'),obstacles:[],safe:{x:10,y:10}},build.stats,build.resolvedSkills,[{id:'target',name:'靶',x:12,y:10,hp:1000000,attack:3,kind:'melee',elite:false,boss:false,art:'raider'}],[],41);w.setMode('auto');const events=[];for(let i=0;i<300;i++){w.step();events.push(...w.events.filter(e=>e.type!=='effect_triggered').map(({ruleId,source,action,...event})=>event));}return {...row,build,events:combatOutcomeEvents(events)};});
await writeFile(rawFolder+'/legacy-builds.json',JSON.stringify(rows)+'\n');await writeFile(folder+'/legacy-builds-summary.json',JSON.stringify(rows.map(r=>({weapon:r.weapon,build:digest(r.build),events:digest(r.events)})))+'\n');
const poison={...oldPoison,rows:oldPoison.rows.map(row=>{const s:CharacterState={id:'fixture',name:'受控授予',level:row.level,revision:1,build:1,xp:0,gold:10000,material:0,gear:[],equipment:{},skills:[row.id],skillRanks:{[row.id]:row.rank},progress:{kills:0,regions:['town'],bosses:[],safe:'town',tasks:[]}},b=resolveBuild(s),skill=b.skillAccess.find(k=>k.id===row.id)!.current!,w=new World(oldPoison.region as Region,{...b.stats,weapon:undefined,hp:100000,mana:10000,regen:0,critChance:.2,lifesteal:.1},[skill],[{id:'target',name:'靶',x:12,y:10,hp:1000000,attack:0,kind:'ranged',boss:false,elite:false,art:'raider'}],[],41);w.setMode('manual');w.enemies.forEach(e=>e.cooldown=100000);if(!w.cast(row.id))throw Error('snapshot cast failed');const events:CombatEvent[]=[];for(let i=0;i<oldPoison.ticks;i++){w.step();events.push(...w.events.filter(e=>['cast_started','cast_released','hit_resolved','status_applied','status_expired'].includes(e.type)));}return {...row,skill,events:combatOutcomeEvents(events)};})};
await writeFile(rawFolder+'/poison.json',JSON.stringify(poison)+'\n');await writeFile(folder+'/poison-summary.json',JSON.stringify(poison.rows.map(r=>({id:r.id,level:r.level,rank:r.rank,skill:digest(r.skill),events:digest(r.events)})))+'\n');const feedback=trace();await writeFile(rawFolder+'/combat-feedback.json',JSON.stringify({...stamp(),trace:feedback})+'\n');await writeFile(folder+'/combat-feedback-summary.json',JSON.stringify({trace:digest(feedback)})+'\n');
await save(review+'/S8/golden-refresh-summary.json',{...stamp(),basis:'S3技能系数、S5及两轮怪物派生改变伤害和击杀帧；历史fixture保留，全参数/全帧/RNG以完整JSON的SHA256精确比较，无字段省略。原始快照只留本机。',files:await Promise.all(['legacy-builds.json','poison.json','combat-feedback.json'].map(n=>evidence(rawFolder+'/'+n)))});
