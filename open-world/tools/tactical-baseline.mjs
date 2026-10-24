// Serial, public-information tactical baseline. Raw rows remain in ignored .qa.
import {register} from 'tsx/esm/api';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
register();
const {tacticalBoards,tacticalGraybox}=await import('../packages/content/tactical-content.ts');
const {createTacticalEncounter,projectTacticalEncounter}=await import('../packages/simulation/tactical/encounter.ts');
const {chooseTacticalPlan,executeTacticalPlan}=await import('../packages/simulation/tactical/autopilot.ts');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const flags=process.argv.slice(2),round=flags[flags.indexOf('--round')+1];
if(flags.length!==2||flags[0]!=='--round'||!['initial','validation'].includes(round))throw Error('Use --round initial | validation. Each named run is write-once.');
const out=resolve(root,'.qa/tactical-b1/baseline'),summaryPath=resolve(out,round+'-summary.json');
mkdirSync(out,{recursive:true});
const marker=resolve(out,round+'-started.json');
if(existsSync(marker)||existsSync(summaryPath))throw Error('This baseline round was already started. Do not sweep/re-run it.');
if(round==='validation'&&!existsSync(resolve(out,'initial-summary.json')))throw Error('Initial measurement must complete first.');
const source=process.env.TACTICAL_BASELINE_SOURCE??execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
if(!/^[0-9a-f]{40}$/.test(source))throw Error('Invalid baseline source identity');
const seeds=[101,211,307,401,503,601,701,809,907,1009];
writeFileSync(marker,JSON.stringify({source,round,seeds,startedAt:new Date().toISOString()}));
const rows=[];
for(const board of tacticalBoards)for(const heroId of ['sword','hidden']){
 for(const seed of seeds){
  let state=createTacticalEncounter({battleId:`baseline-${board.id}-${heroId}-${seed}`,boardId:board.id,heroId,seed});
  let combinations=0,decisions=0,fizzles=0,downgrades=0;
  while(!state.outcome&&state.round<=50){
   downgrades+=state.intents.filter(i=>i.reason==='lethal-guard').length;
   const plan=chooseTacticalPlan(projectTacticalEncounter(state));
   combinations+=plan.legalCombinations;decisions++;
   const result=executeTacticalPlan(state,plan);state=result.state;
   fizzles+=result.events.filter(e=>e.type==='intent-fizzled').length;
  }
  const hero=state.units.find(u=>u.side==='hero');
  rows.push({boardId:board.id,difficulty:board.difficulty,heroId,seed,outcome:state.outcome??'round-limit',ER:Math.min(state.round,50),HL:1-hero.hp/hero.maxHp,fizzles,downgrades,legalCombinations:combinations/Math.max(1,decisions)});
 }
 console.log(JSON.stringify({round,completed:rows.length,total:100,boardId:board.id,heroId}));
}
const mean=(rows,key)=>rows.reduce((s,r)=>s+r[key],0)/rows.length;
const groups=[];
for(const board of tacticalBoards)for(const heroId of ['sword','hidden']){
 const r=rows.filter(x=>x.boardId===board.id&&x.heroId===heroId);
 groups.push({boardId:board.id,difficulty:board.difficulty,heroId,n:r.length,winRate:r.filter(x=>x.outcome==='win').length/r.length,ER:mean(r,'ER'),HL:mean(r,'HL'),fizzles:mean(r,'fizzles'),downgrades:mean(r,'downgrades'),legalCombinations:mean(r,'legalCombinations'),roundLimits:r.filter(x=>x.outcome==='round-limit').length});
}
const summary={round,source,seeds,n:rows.length,orchestration:tacticalGraybox.autopilot.defaults,targets:{normal:{ER:[2,3],HL:[0.1,0.25]},elite:{ER:[4,6],HL:[0.25,0.45]},boss:{ER:[8,12]}},groups,finishedAt:new Date().toISOString()};
writeFileSync(resolve(out,round+'-raw.json'),JSON.stringify(rows,null,2));
writeFileSync(summaryPath,JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
