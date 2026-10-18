import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import type {CharacterState,Gear} from '../packages/contracts/index.ts';
import {versions} from '../packages/contracts/index.ts';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import {ensureProgression,progressionMultipliers} from '../packages/rules/deep-progression.ts';
import {challengeContent} from '../packages/content/progression-challenges.ts';
import {simulateChallenge} from '../packages/rules/progression-challenges.ts';

function character(style:'starter'|'ordinary'|'mixed'|'omega'){
 const main=makeGear(0,randomUUID()),armor=makeGear(2,randomUUID()),s:CharacterState={id:randomUUID(),name:style,revision:0,build:1,level:50,xp:0,gold:0,material:0,gear:[main,armor],equipment:{weapon:main.id,armor:armor.id},skills:['cut','whirl','ward','mend'],skillRanks:{cut:5,whirl:5,ward:5,mend:5},progress:{kills:0,regions:['town','meadow','forest','rift','tundra','abyss','dragonbone'],bosses:[],safe:'town',tasks:[]}};
 const p=ensureProgression(s);
 const bases=style==='starter'?[]:style==='ordinary'?['blade','blade','blade','blade','bow','bow','bow','bow']:style==='mixed'?['omega-blade','omega-blade','omega-bow','omega-bow','blade','blade','bow','bow']:Array(8).fill('omega-blade');
 for(const base of bases){const g:Gear=base==='blade'||base==='bow'?makeGear(base==='blade'?0:1,randomUUID()):{id:randomUUID(),base,name:base,slot:'weapon',attack:base==='omega-blade'?15:12,armor:0,effect:'none',rank:0,locked:false,quality:'rare',affixes:[]};s.gear.push(g);}
 ensureProgression(s);p.weaponGrid=s.gear.filter(g=>g.slot==='weapon').map(g=>g.id).concat(Array(9).fill(null)).slice(0,9);
 if(style!=='starter')for(const g of s.gear.filter(g=>g.slot==='weapon'))p.weapons[g.id]={level:150,uncap:5};
 return s;
}
const seeds=[11,41,97],styles=['starter','ordinary','mixed','omega'] as const,builds=styles.map(style=>({style,state:character(style)}));
const details=builds.map(({style,state})=>{const build=resolveBuild(state);if(!Object.values(build.stats).filter(v=>typeof v==='number').every(Number.isFinite)||!build.resolvedSkills.every(s=>Number.isFinite(s.damage)))throw Error('Non-finite progression build');return {style,stats:build.stats,multipliers:progressionMultipliers(state),whirlDamage:build.resolvedSkills.find(s=>s.id==='whirl')!.damage};});
const samples=builds.flatMap(({style,state})=>['high-meadow','high-forest','nightmare'].flatMap(id=>seeds.map(seed=>{const definition=challengeContent.entries.find(d=>d.id===id)!;const result=simulateChallenge(state,definition,1,seed,randomUUID(),versions.rules);return {style,challenge:id,seed,won:result.won,ticks:result.ticks,seconds:result.ticks/30,remainingHp:result.remainingHp};})));
const report={versions,policy:'Server resolveBuild + actual World full-auto. Four controlled Lv50 fixtures, equal gear/skill ranks; ordinary/mixed/omega have Lv150 five-star grid weapons. No fixture enters player saves.',seeds,builds:details,mixedVsOrdinary:details[2].whirlDamage/details[1].whirlDamage,samples,limitations:'Three deterministic seeds per build/challenge; validates finite multipliers, relative damage and bounded combat. Does not prove 10/30/50-hour acquisition pacing, broad build balance, human teamwork or retention.'};
if(details[3].multipliers.omegaAttack>32||details.some(d=>d.multipliers.omegaSkill>27))throw Error('Multiplier cap exceeded');
await mkdir(new URL('../../docs/reviews/open-world/deep-progression-20261001/',import.meta.url),{recursive:true});await writeFile(new URL('../../docs/reviews/open-world/deep-progression-20261001/balance-result.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:true,mixedVsOrdinary:report.mixedVsOrdinary,builds:details.map(d=>({style:d.style,attack:d.stats.attack,whirl:d.whirlDamage})),wins:samples.filter(s=>s.won).length,samples:samples.length}));
