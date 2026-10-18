// 数值来源已迁到 tools/spine；原算法保留作历史参考，不再形成第二个写入入口。
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {regionById} from '../packages/content/index.ts';
import {characterDungeonDefinition} from '../packages/rules/hardmode-dungeon.ts';
import {measureWallBasis} from './wall-probe.ts';
import {calibratedWallScale} from './apply-dungeon-walls.ts';
import {standard} from './standard-player-model.ts';
import {versions} from '../packages/contracts/index.ts';
import {auditNumericFlow} from './numeric-source-audit.ts';
import {legacySpineEntry} from './spine/legacy.ts';
if(process.argv[1]?.replaceAll('\\','/').endsWith('/calibrate-hardmode-dungeons.ts'))await legacySpineEntry('calibrate-hardmode-dungeons');
/** 历史算法仅保留源代码；当前CLI只执行上面的主干校验。 */
async function historicalCalibration(){
const bytes=await readFile('.design/standard-player-20261005/model.json'),flow=JSON.parse(await readFile('.design/numeric-flow-20261006/flow.json','utf8'));auditNumericFlow(flow,bytes);const raw=JSON.parse(await readFile('packages/content/dungeons.json','utf8')),changes=[];
for(const source of dungeonContent.definitions.filter(d=>d.hardmode)){const d=characterDungeonDefinition(source,true),target=flow.stages.find((s:any)=>s.index===d.numericStage),basis=measureWallBasis({definition:d,region:regionById(d.stages.at(-1)!),character:standard(Math.ceil(target.level)),stage:d.numericStage!,seed:41,seeds:[41],samplesPerRatio:1,maxSeconds:240,worldLine:'starsea'}),scale=calibratedWallScale(target,basis);raw.definitions.find((entry:any)=>entry.id===d.id).hardmode.enemyScale=scale;changes.push({dungeon:d.id,stage:d.numericStage,basis,target:{bossHp:target.bossHp,bossDps:target.bossDps},scale});}
await mkdir('docs/reviews/open-world-m2-m4/W10',{recursive:true});await writeFile('docs/reviews/open-world-m2-m4/W10/hardmode-wall-calibration.json',JSON.stringify({versions,source:'Current measured numeric-flow and actual30s World boss pressure; applies only new frozen encounters',changes},null,2));await writeFile('packages/content/dungeons.json',JSON.stringify(raw,null,2)+'\n');console.log(JSON.stringify({declared:changes.map(c=>({dungeon:c.dungeon,stage:c.stage,scale:c.scale}))}));

}
