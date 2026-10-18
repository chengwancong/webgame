// 数值来源已迁到 tools/spine；本文件保留历史探针，正式派生请使用 pnpm spine:check 与主干CLI。
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import type {WorldCamp} from '../packages/contracts/open-world.ts';
import {monsterContent,type MonsterContent} from '../packages/content/monsters.ts';
import {campMembers} from '../packages/rules/world-camps.ts';
import {auditNumericFlow} from './numeric-source-audit.ts';
export type RoleHealth={swarm:number;normal:number;ranged:number};
/** Fixed content-stage health budget; it never reads a live player's power. */
export function proposeCampHealth(camp:WorldCamp,targets:RoleHealth,content:MonsterContent=monsterContent){
 if(Object.values(targets).some(v=>!Number.isFinite(v)||v<=0))throw Error('Camp health targets must be positive measured declarations');
 const members=campMembers(camp,content),roles={swarm:0,normal:0,ranged:0},healthWeights=Object.fromEntries(Object.entries(targets).map(([role,hp])=>[role,Math.ceil(hp)])) as RoleHealth;let health=0;
 for(const member of members){if(member.rank==='boss')throw Error('Field budget cannot host bosses');const template=content.templates.find(t=>t.id===member.template);if(!template)throw Error('Missing actual camp template');roles[template.role]++;health+=healthWeights[template.role]*content.ranks[member.rank].hp;}
 if(!members.length)throw Error('Camp health needs actual members');
 const proposed=structuredClone(camp);proposed.budget={...proposed.budget,count:members.length,health:Math.ceil(health),roles:Object.fromEntries(Object.entries(roles).filter(([,count])=>count>0)),healthWeights};
 const key=(p:typeof members[number])=>p.template+'/'+p.rank,counts=(rows:typeof members)=>Object.fromEntries([...new Set(rows.map(key))].sort().map(k=>[k,rows.filter(r=>key(r)===k).length]));
 if(JSON.stringify(counts(members))!==JSON.stringify(counts(campMembers(proposed,content))))throw Error('Budget proposal changed actual template/rank population');
 return {proposed,roles,health,limits:['The original member/template/rank population is retained. Role weights are fixed stage declarations derived from measured primary hits and the authored normal target, not live player scaling.','Runtime largest-remainder allocation rounds individual HP. Verify actual spawned swarm HP and first-hit crossing; do not infer acceptance from the budget formula alone.']};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const modelBytes=await readFile('.design/standard-player-20261005/model.json'),flow=JSON.parse(await readFile('.design/numeric-flow-20261006/flow.json','utf8')),swarm=JSON.parse(await readFile('docs/reviews/open-world-m2-m4/W3/swarm-health-derived.json','utf8'));const audit=auditNumericFlow(flow,modelBytes),hash=createHash('sha256').update(modelBytes).digest('hex');if(swarm.modelSha256!==hash)throw Error('Swarm budget proposal refers to an older measured model');
 const rows=flow.stages.map((stage:any)=>{const line=swarm.lines.find((s:any)=>s.stage===stage.index);if(!line)throw Error('Missing actual stage primary hit');return {stage:stage.index,level:stage.level,roleHealth:{swarm:Math.ceil(line.hp),normal:Math.ceil(stage.normalHp),ranged:Math.ceil(stage.normalHp*monsterContent.roles.ranged.hpShare)}};});
 const directory='docs/reviews/open-world-m2-m4/W3/numeric-refresh';await mkdir(directory,{recursive:true});await writeFile(directory+'/camp-health-targets.json',JSON.stringify({generated:new Date().toISOString(),applied:false,audit,decision:swarm.decision,rows,formula:'health = sum(roleHealth[role] * declared rank HP factor for every actual member); healthWeights = roleHealth; roles/count preserve actual population',limits:['This is an authoring proposal for fixed stage camp budgets; formal world table writes remain owned by main integration.','After formal adoption, run the fixed-seed pack and wall acceptance once; keep the fixed target population and1.5/1.8 thresholds. If it fails, use one documented tuning pass and retest.']},null,2)+'\n');console.log(JSON.stringify({stages:rows.length,applied:false}));
}
