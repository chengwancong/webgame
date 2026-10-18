import '../packages/content/open-world/index.ts';
import {mkdir,writeFile} from 'node:fs/promises';
import {worldTables} from '../packages/content/world-tables.ts';
import {tasks,steps} from '../packages/content/task-tables.ts';
import {starseaMap,bossLevels} from '../packages/content/starsea/index.ts';
import {regionById} from '../packages/content/index.ts';
import {applyXp,xpThreshold} from '../packages/rules/index.ts';
import {campSpawns} from '../packages/rules/world-camps.ts';
import {starseaKillReward} from '../apps/api/src/economy.ts';
import {expectedCharacter} from './starsea-balance-model.ts';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function islandStoryLevelBudget(n:number){
const island=worldTables.islands.find(i=>i.chapter===n);if(!island)throw Error('An authored island is required');
const region=regionById(island.region),chapter='ss-c'+String(n).padStart(2,'0'),story=tasks.filter(t=>t.chapter===chapter&&(t.series==='onboarding'||t.series==='isle-'+n)&&!['converge','return'].includes(t.thread??'')).sort((a,b)=>a.order-b.order);
const route=[region.safe,...story.flatMap(t=>steps.filter(s=>s.task===t.id&&s.map===region.id).map(s=>starseaMap(region.id).landmarks.find(l=>l.id===s.landmark)).filter((p):p is NonNullable<typeof p>=>Boolean(p))),region.bossPortal!];
function segment(p:{x:number;y:number},a:{x:number;y:number},b:{x:number;y:number}){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
const camps=worldTables.camps.filter(c=>c.region===region.id&&route.slice(1).some((b,i)=>segment(c,route[i],b)<=12)),character=expectedCharacter(worldTables.zones.filter(z=>z.region===region.id).reduce((v,z)=>Math.min(v,z.levelBand[0]),Infinity));character.xp=0;
const sources=[];for(const task of story){const before=character.level;applyXp(character,task.reward_xp??0);sources.push({kind:'story',id:task.id,xp:task.reward_xp??0,before,after:character.level});}
for(const camp of camps){const enemies=campSpawns(region,worldTables,camp,1),before=character.level;let xp=0;for(const enemy of enemies){const gain=starseaKillReward(enemy.monster!.level,enemy.monster!.rank,character.level,region.id,false);xp+=gain.xp;applyXp(character,gain.xp);}sources.push({kind:'on-route camp',id:camp.id,enemies:enemies.map(e=>({template:e.monster!.template,level:e.monster!.level,rank:e.monster!.rank})),xp,before,after:character.level});}
const required=bossLevels[n-1]-1,relativeGap=Math.max(0,(required-character.level)/required),report={chapter:n,region:region.id,startLevel:sources[0]?.before,finalLevel:character.level,requiredLevel:required,passes:character.level>=required||relativeGap<=.05,thresholdPassed:character.level>=required,relativeGap,acceptedByUserTolerance:character.level<required&&relativeGap<=.05,nextLevelXp:xpThreshold(character.level),route,camps:camps.length,storyTasks:story.length,sources,limits:['Level/reward budget check through the actual applyXp and monster reward owners. It grants only declared pre-boss story rewards and camps within12 cells of the story route.','This is the planned XP path, not a combat victory, gear acquisition or traversal-time measurement. Real World and PG execution is covered by the separate driver and combat probes.','Task-exclusive enemy XP is omitted, making this a conservative pre-boss budget. No side quest, exploration, bounty, boss or return reward is included.']};
return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const n=Number(process.argv[2]),report=islandStoryLevelBudget(n),directory='docs/reviews/open-world-m2-m4/W'+(n+3);await mkdir(directory,{recursive:true});await writeFile(directory+'/story-level-budget.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({chapter:n,startLevel:report.startLevel,finalLevel:report.finalLevel,requiredLevel:report.requiredLevel,onRouteCamps:report.camps,passes:report.passes}));}
