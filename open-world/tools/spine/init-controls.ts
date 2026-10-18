/** 生成无效果变化的可配置控制表；真正的数值修改仍只由apply执行。 */
import {access,readFile,copyFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {skillCatalog} from '../../packages/content/index.ts';
import {talentDefinitions,paragonDefinitions} from '../../packages/content/deep-progression.ts';
import {save,review,sha} from './io.ts';
for(const [file,value]of [
 ['packages/content/skill-coefficients.json',Object.fromEntries(skillCatalog.map(s=>[s.id,1]))],
 ['packages/content/progression-node-values.json',Object.fromEntries([...talentDefinitions,...paragonDefinitions].map(n=>[n.id,n.modifiers.map(m=>m.value)]))],
] as const){try{await access(file);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;await save(file,value);}}
const files=['packages/content/skills-expanded.ts','packages/content/deep-progression.ts','packages/rules/inscriptions.ts','packages/content/inscriptions.ts','packages/rules/augment-descriptions.ts','packages/rules/set-bonus-descriptions.ts','tools/apply-monster-curve.ts','tools/apply-world-tier-curve.ts','tools/calibrate-hardmode-dungeons.ts','tools/recalibrate-legacy-dungeons.ts','tools/propose-world-numeric-refresh.ts','tools/numeric-source-audit.ts','apps/api/src/app.ts','packages/contracts/index.ts','package.json','../AGENTS.md'];
const rows=[];for(const file of files){const path=resolve(review,'S0/resume-own-base',file.startsWith('../')?'repo-AGENTS.md':file);try{await access(path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;await mkdir(dirname(path),{recursive:true});await copyFile(file,path);}rows.push({file,before:sha(await readFile(path)),snapshot:path});}await save(review+'/S0/resume-own-base-summary.json',{files:rows});
