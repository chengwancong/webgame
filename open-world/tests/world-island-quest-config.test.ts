import '../packages/content/open-world/index.ts';
import {expect,it} from 'vitest';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {worldTables} from '../packages/content/world-tables.ts';
import {tasks,conditions,npcPositions,rumors} from '../packages/content/task-tables.ts';
import {conditionMet} from '../packages/rules/quest-conditions.ts';
import {newStarseaState,starseaView} from '../packages/rules/starsea.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
import {resolveNpcPhase} from '../packages/rules/world-phase.ts';
const sources=Object.fromEntries(['world','npcs','tasks','chapters','dialogue'].map(name=>[name+'.json',JSON.parse(readFileSync('config/json/'+name+'.json','utf8'))]));
function check(data:typeof sources){return execFileSync(process.env.AW_PYTHON??'python3',['-X','utf8','-c',"import sys,json;sys.path.insert(0,'tools');from config_quest_check import validate_quest_config;validate_quest_config(json.load(sys.stdin));print('accepted')"],{input:JSON.stringify(data),encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe']});}
it('rejects all three required deliberate progression breaks for each authored island',()=>{
 const evidence=[];
 for(const island of worldTables.islands){const chapter='ss-c'+String(island.chapter).padStart(2,'0'),clues=tasks.filter(t=>t.chapter===chapter&&['A','B','C'].includes(t.thread??'')),other=tasks.find(t=>t.chapter&&t.chapter!==chapter&&t.series?.startsWith('isle-'))!;
  const mutations=[
   {kind:'remove feature fallback',apply:(d:typeof sources)=>{d['tasks.json'].conditions=d['tasks.json'].conditions.filter((c:any)=>c.target!=='feature:forge'||!['level','waypoint'].includes(c.kind));}},
   {kind:'two clues depend on each other',apply:(d:typeof sources)=>{if(clues.length<2)throw Error('Island lacks two clues');for(const [a,b]of [[clues[0],clues[1]],[clues[1],clues[0]]])d['tasks.json'].conditions.push({target:a.id,group:1,kind:'task',value:b.id,path:'guide'});}},
   {kind:'cross-island task prerequisite',apply:(d:typeof sources)=>d['tasks.json'].conditions.push({target:clues[0].id,group:1,kind:'task',value:other.id,path:'guide'})}
  ];
  expect(check(structuredClone(sources))).toContain('accepted');
  for(const mutation of mutations){const data=structuredClone(sources);mutation.apply(data);let rejected='';try{check(data);}catch(error){rejected=String(error);}expect(rejected,mutation.kind).toMatch(/缺少非任务兜底|条件图有环|跨岛任务前置/);evidence.push({island:island.region,case:mutation.kind,rejected:true,reason:rejected});}
 }
 mkdirSync('docs/reviews/open-world-m2-m4/W4',{recursive:true});writeFileSync('docs/reviews/open-world-m2-m4/W4/config-deliberate-breaks.json',JSON.stringify({passed:true,validator:'Actual config_quest_check used by config:export/check',evidence},null,2));
},60000);
