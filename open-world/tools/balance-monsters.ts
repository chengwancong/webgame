import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {regions} from '../packages/content/index.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {dungeonSpawns} from '../packages/rules/dungeon-build.ts';
import {versions} from '../packages/contracts/index.ts';
import {sourceVersion} from './source-version.mjs';
const out='../docs/reviews/open-world/monster-model-20261003',sourceBefore=await sourceVersion(),before=JSON.parse(await readFile(out+'/before.json','utf8'));
const rows=[];for(const d of dungeonContent.definitions){const old=before.dungeons.find((p:any)=>p.id===d.id);assert(old);const current=regions.find(r=>r.id===d.stages.at(-1))!,recorded=before.regions.find((r:any)=>r.id===old.stages.at(-1));
 for(const tier of [...new Set([d.policy.minTier,d.policy.maxTier])])for(const stage of [0,d.stages.length-1]){
  const enemy=dungeonSpawns(current.spawns,d.policy,tier,stage,[]).find(s=>s.boss)!,oldEnemy=recorded.spawns.find((s:any)=>s.boss),p=old.policy,expected={hp:Math.max(1,Math.round(oldEnemy.hp*p.enemyScale.hp*(1+(tier-p.minTier)*p.tierRules.hpPerTier)*(1+stage*p.enemyScale.hpPerStage))),attack:Math.max(1,Math.round(oldEnemy.attack*p.enemyScale.attack*(1+(tier-p.minTier)*p.tierRules.attackPerTier)*(1+stage*p.enemyScale.attackPerStage)))};
  assert.equal(enemy.hp,expected.hp);assert.equal(enemy.attack,expected.attack);rows.push({id:d.id,entryLevel:d.level,monsterLevel:enemy.monster!.level,tier,stage,hp:enemy.hp,attack:enemy.attack,expected});
 }
}
const sourceAfter=await sourceVersion();assert.equal(sourceBefore.sha256,sourceAfter.sha256);
const report={versions,source:sourceBefore,sourceAfter,templates:monsterContent.templates.length,formula:'Template base x curve(level)/curve(referenceLevel) x rank x dungeon/tier/affix/stage factors. Round once after difficulty.',limits:'Boss HP and attack match the recorded ow-15 budget at minimum/maximum tiers and first/final stages. This does not assert identical AI outcomes or human difficulty. Normal species use distinct calibrated templates.',regions:regions.map(r=>({id:r.id,monsters:[...new Map(r.spawns.map(s=>[s.monster!.template+'-'+s.monster!.rank,{template:s.monster!.template,level:s.monster!.level,rank:s.monster!.rank,hp:s.hp,attack:s.attack,armor:s.monster!.armor}])).values()]})),bosses:rows};
await mkdir(out,{recursive:true});await writeFile(out+'/resolved.json',JSON.stringify(report,null,2));console.log(JSON.stringify({versions,sourceStable:true,templates:report.templates,bossChecks:rows.length,preserved:true}));
