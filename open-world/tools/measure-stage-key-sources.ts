// 数值来源已迁到 tools/spine；本文件保留历史探针，正式派生请使用 pnpm spine:check 与主干CLI。
import {mkdir,writeFile} from 'node:fs/promises';
import {standard} from './standard-player-model.ts';
import {stageTimings} from './world-stage-schedule.ts';
import {World} from '../packages/simulation/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {resolveMonsterSpawn,monsterLevelValues} from '../packages/rules/monster-stats.ts';
import {versions} from '../packages/contracts/index.ts';
const rows=[],seeds=[41,73,107],template=monsterContent.templates.filter(t=>t.curve==='starsea'&&!t.bossKey).sort((a,b)=>a.base.hp/monsterLevelValues('starsea',a.referenceLevel).hp-b.base.hp/monsterLevelValues('starsea',b.referenceLevel).hp)[0];
if(!template)throw Error('No executable starsea encounter template');
for(const stage of stageTimings){const samples=[];for(const seed of seeds){const c=standard(Math.ceil(stage.level),new Set(),stage.clear-.001),build=resolveBuild(c);if(!build.resolvedSkills.length)throw Error('No actual active stage skills '+stage.index);
 const spawns=Array.from({length:3},(_,n)=>resolveMonsterSpawn({id:'source:'+n,template:template.id,rank:'elite',level:c.level,x:14+n*3,y:10})),w=new World({id:'stage-source-probe',name:'阶段来源探针',subtitle:'受控三精英遭遇',width:48,height:48,safe:{x:10,y:10},portal:{x:5,y:5},theme:'wind',boss:false,auto:true,obstacles:[],landmarks:[],spawns:[]},build.stats,build.resolvedSkills,spawns,[],seed);w.setMode('auto');let kills=0;
 for(let i=0;i<2700&&w.hero.hp>0&&kills<3;i++){w.step();kills+=w.kills.splice(0).filter(k=>k.source_id.startsWith('source:')).length;}
 samples.push({seed,kills,seconds:w.tick/30,survived:w.hero.hp>0,completed:kills===3,hp:build.stats.hp,hpLeft:w.hero.hp,skills:build.resolvedSkills.map(s=>({id:s.id,rank:c.skillRanks[s.id],damage:s.damage}))});
 }const kills=samples.reduce((n,s)=>n+s.kills,0),seconds=samples.reduce((n,s)=>n+s.seconds,0);rows.push({stage:stage.index,elitePerMinute:kills/seconds*60,samples});}
const report={versions,seeds,template:template.id,rows,limits:['Real World, actual standard build and before-clear acquisition clock; no HP, mana, cooldown or invulnerability grants.','Controlled empty48-cell three-elite encounter measures the generic source executor; six-island geometry, loading, chest and rare source frequencies are separately recalibrated in W4–W11.','Uncompleted or dead samples remain in the denominator and report. This is not natural acquisition or player pacing evidence.']};
await mkdir('docs/reviews/open-world-m2-m4/W3',{recursive:true});await writeFile('docs/reviews/open-world-m2-m4/W3/key-source-basis.json',JSON.stringify(report,null,2));console.log(JSON.stringify({stages:rows.length,samples:rows.reduce((n,r)=>n+r.samples.length,0),zeroStages:rows.filter(r=>r.elitePerMinute<=0).map(r=>r.stage),failedSamples:rows.flatMap(r=>r.samples.filter(s=>!s.completed).map(s=>({stage:r.stage,seed:s.seed,kills:s.kills,seconds:s.seconds})))}));
