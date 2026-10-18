/** 复用已存在的七个危险度原始样本，修正删失解释；不启动新World、不改游戏数值。 */
import {copyFile,mkdir} from 'node:fs/promises';
import {eliteAffixes} from '../../packages/content/elite-affixes.ts';
import {finishBudgetAudit} from './budget.ts';
import {readJson,save,data,stamp,evidence,decision} from './io.ts';
const review=process.argv[2];if(!review)throw Error('需要评审目录');const before=review+'/S8/measurement-repair/validation-budget/budget',out=review+'/S8/elite-audit-correction',final=review+'/S8/final-validation';await mkdir(out+'/arms',{recursive:true});
await copyFile(before+'/content-measurements.json',out+'/content-measurements.json');
const reused=[];for(const key of ['none',...Object.keys(eliteAffixes)]){const name='elite-budget-'+key+'.json',source=before+'/arms/'+name;await readJson(source);await copyFile(source,out+'/arms/'+name);reused.push(await evidence(source));}
await finishBudgetAudit(out,false);const audit=await readJson(out+'/audit-summary.json');await copyFile(out+'/audit-summary.json',final+'/budget/audit-summary.json');
const result=await readJson(final+'/validation.json');result.budget.rows=audit.rows;result.budget.counts=audit.counts;result.budget.censoredAudit={source:await evidence(out+'/elite-budget-summary.json'),reason:'不能把120秒删失当成真实TTD相等或功能型',newWorldRuns:0};result.checks.budget=audit.rows.every((r:any)=>r.inBand)&&result.budget.parity.every((r:any)=>r.passed);result.accepted=Object.values(result.checks).every(Boolean);
await save(final+'/validation.json',result);await save(final+'/validation-summary.json',{...result,budget:{counts:result.budget.counts,parity:result.budget.parity,censoredAudit:result.budget.censoredAudit},measurementStability:{maximum:result.measurementStability.maximum,failures:result.measurementStability.failures}});
await save(out+'/reuse-summary.json',{...stamp(),newWorldRuns:0,gameNumericWrites:0,reused,counts:audit.counts});
await save(data+'/spine-final-validation.json',{...stamp(),root:'docs/reviews/numeric-spine-20261013/S8/final-validation',localRoot:final,validation:await evidence(final+'/validation.json'),summary:await evidence(final+'/validation-summary.json')});
await decision('精英危险度的120秒删失不能归为功能型','七个原始样本全部存活到120秒，六项降低比例改为未知，不再把下界之比当0；实测越界与不可判定分列，不重跑World、不改游戏数值。','S8/elite-audit-correction/reuse-summary.json',review);
console.log(JSON.stringify({counts:audit.counts,newWorldRuns:0}));
