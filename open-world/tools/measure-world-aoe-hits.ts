// 数值来源已迁到 tools/spine；本文件保留历史探针，正式派生请使用 pnpm spine:check 与主干CLI。
import {mkdir,writeFile} from 'node:fs/promises';
import {standard} from './standard-player-model.ts';
import {measureAoeHit} from './world-aoe-hit-probe.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {versions} from '../packages/contracts/index.ts';
const rows=[];
for(let level=1;level<=60;level++){
 const character=standard(level),resolved=resolveBuild(character),skill=resolved.resolvedSkills.find(s=>s.kind==='area');
 if(!skill)throw Error('Standard build has no active AOE at L'+level);
 rows.push(measureAoeHit(character,skill.id,41));
}
const output='docs/reviews/open-world-m2-m4/W3';await mkdir(output,{recursive:true});
await writeFile(output+'/aoe-hit-baseline.json',JSON.stringify({versions,seed:41,samples:rows.length,schedule:'Existing R8 standard schedule; W3 phase redistribution is not yet applied.',controlled:true,limits:['First direct noncritical hit against a zero-armour nonattacking high-life target.','No DPS/TTK/acquisition/success-rate claim.','Critical permission override belongs only to these private measurement Worlds.'],rows},null,2)+'\n');
console.log(JSON.stringify({passed:true,levels:rows.length,first:rows[0].hitAoe,last:rows.at(-1)!.hitAoe,output}));
