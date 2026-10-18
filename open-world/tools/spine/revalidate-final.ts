/** 授权复核：重跑受影响场景，未变化的原始三种子日程经依赖核验后复用。 */
import assert from 'node:assert/strict';
import {writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validateSpine} from './validate.ts';
import {worldTables} from '../../packages/content/world-tables.ts';
import {campMembers} from '../../packages/rules/world-camps.ts';
import {regionById} from '../../packages/content/index.ts';
import {pacingTargets} from '../../packages/content/pacing-targets.ts';
import {readJson,save,data,stamp,sha,evidence} from './io.ts';
const root=process.argv[2];if(!root)throw Error('需要原评审目录绝对路径');const output=root+'/S8/final-validation';
const original=await readJson(root+'/S7/V3/validation.json'),builds=await readJson(root+'/S8/measurement-repair/validation-builds/validation.json'),budget=await readJson(root+'/S8/measurement-repair/validation-budget/validation.json'),inputProof=await readJson(root+'/S8/isolated-inputs-summary.json');assert.equal(inputProof.mismatches.length,0);assert.equal(inputProof.matched,803);
const monsters=await readJson('packages/content/monsters.json'),before=structuredClone(monsters),bossRepair=await readJson(root+'/S8/runtime-repair/campaign-bosses-plan.json');
for(const c of bossRepair.changes){assert.equal(c.file,'packages/content/monsters.json');assert.equal(before.templates[c.path[1]].curve,'campaign');before.templates[c.path[1]].base=c.before;}
const changedTemplates=new Set(bossRepair.rows.map((r:any)=>r.template)),fieldTemplates=new Set(worldTables.camps.flatMap(c=>campMembers(c).map(m=>m.template))),storyTemplates=new Set(pacingTargets.milestones.filter(m=>m.kind==='boss').flatMap(m=>regionById(m.id).spawns.map(s=>s.monster?.template)));
for(const id of changedTemplates){assert(!fieldTemplates.has(id as string),'旧区首领被野外营地复用，必须重跑日程');assert(!storyTemplates.has(id as string),'旧区首领被故事首领复用，必须重跑日程');}
const oldWorld=await readJson(root+'/S7/correction-2/world/world-summary.json');assert.equal(sha(JSON.stringify(before)),oldWorld.monsterSha256,'V3以来还存在其他怪物改动，日程不能复用');
const worldPlan=await readJson(root+'/S8/runtime-repair/world/world-plan.json');for(const c of worldPlan.changes)if(c.file==='packages/content/world-tiers.json'){assert.deepEqual(c.path,['tiers',3,'monster']);assert.equal(c.before.hp,c.after.hp);}
const calendars=[];for(const row of original.calendar.rows){const raw=await readJson(row.source.path),r=raw.results[0];assert.equal(r.strategy,'no-quests');assert.equal(r.finalState.world.worldTier,1);assert(!r.events.some((e:any)=>e.kind==='dungeon'));calendars.push({seed:row.seed,source:await evidence(row.source.path),worldTier:1,dungeons:0});}
const field=await validateSpine('field',output+'/field-rerun'),walls=await validateSpine('walls',output+'/walls-rerun');
const checks={builds:builds.checks.builds,calendar:original.checks.calendar,walls:walls.checks.walls,field:field.checks.field,budget:budget.checks.budget,guard:original.checks.guard&&field.checks.guard&&walls.checks.guard};
const result={...stamp(),suite:'authorized-revalidation',checks,builds:builds.builds,calendar:original.calendar,walls:walls.walls,field:field.field,budget:budget.budget,guard:{...original.guard,maximumKillsPerSecond:Math.max(original.guard.maximumKillsPerSecond,field.guard.maximumKillsPerSecond)},accepted:Object.values(checks).every(Boolean),measurementStability:await readJson(data+'/spine-measurement-stability.json'),reuse:{calendar:calendars,reason:'标准人及391内容配对共803组战斗输入相等；新增游戏数值只涉及旧区首领、地城难度和T4攻击。原日程只走星潮海T1、没有地城；原三种子证据不冒称本次新跑。',inputProof:await evidence(root+'/S8/isolated-inputs-summary.json'),originalV3:await evidence(root+'/S7/V3/validation.json')},revalidated:['M2：冻结输入B3、13标准人点、10平价配置、207权重、281来源','M3：8构筑及五场景','M6：546项预算','M10：野外及六首领墙']};
await save(output+'/validation.json',result);await save(output+'/validation-summary.json',{...result,budget:{counts:result.budget.counts,parity:result.budget.parity},measurementStability:{maximum:result.measurementStability.maximum,failures:result.measurementStability.failures}});
await mkdir(output+'/budget',{recursive:true});await copyFile(root+'/S8/measurement-repair/validation-budget/budget/audit-summary.json',output+'/budget/audit-summary.json');
await save(data+'/spine-final-validation.json',{...stamp(),root:output,validation:await evidence(output+'/validation.json'),summary:await evidence(output+'/validation-summary.json')});
console.log(JSON.stringify({checks,budget:result.budget.counts,oneHit:result.field.oneHitRate,calendar:result.calendar.minutes,accepted:result.accepted}));
