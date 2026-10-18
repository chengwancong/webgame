// 数值来源已迁到 tools/spine；本文件保留历史探针，正式派生请使用 pnpm spine:check 与主干CLI。
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditNumericFlow} from './numeric-source-audit.ts';
export type WallTarget={index:number;bossHp:number;bossDps:number};
export type WallBasis={dungeon:string;stage:number;bossHp:number;rawDps:number;enemyScale:{hp:number;attack:number};versions:unknown;seed:number;samples:number};
/** A measured baseline includes its already-applied difficulty. Recalibration
 * writes a declaration for the next run; it never rescales an existing actor. */
export function calibratedWallScale(target:WallTarget,basis:WallBasis){if(target.index!==basis.stage||![target.bossHp,target.bossDps,basis.bossHp,basis.rawDps,basis.enemyScale.hp,basis.enemyScale.attack].every(v=>Number.isFinite(v)&&v>0)||basis.samples<1)throw Error('Wall calibration requires matching stage and actual positive baseline');return {hp:basis.enemyScale.hp*target.bossHp/basis.bossHp,attack:basis.enemyScale.attack*target.bossDps/basis.rawDps};}
export function applyDeclaredWalls<T extends {definitions:{id:string;policy?:{enemyScale?:{hp?:number;attack?:number;[key:string]:unknown};[key:string]:unknown}}[]}>(source:T,targets:readonly WallTarget[],bases:readonly WallBasis[]){const result=structuredClone(source),changes=[];if(!bases.length)throw Error('No actual wall basis measurements; no declarations were written');for(const basis of bases){const target=targets.find(t=>t.index===basis.stage),definition=result.definitions.find(d=>d.id===basis.dungeon);if(!target||!definition)throw Error('Unknown wall stage/dungeon '+basis.dungeon);const scale=calibratedWallScale(target,basis);definition.policy??={};definition.policy.enemyScale={...definition.policy.enemyScale,...scale};changes.push({dungeon:basis.dungeon,stage:basis.stage,before:basis.enemyScale,after:scale,basis});}return {content:result,changes};}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const at=process.argv.indexOf('--basis');if(at<0||!process.argv[at+1])throw Error('Pass --basis with actual wall-probe output');
 const source=JSON.parse(await readFile('packages/content/dungeons.json','utf8')),flow=JSON.parse(await readFile('.design/numeric-flow-20261006/flow.json','utf8')),basis=JSON.parse(await readFile(process.argv[at+1],'utf8'));
 auditNumericFlow(flow,await readFile('.design/standard-player-20261005/model.json'));
 const measurements=basis.rows??(basis.basis?[basis.basis]:undefined);if(!Array.isArray(measurements))throw Error('Basis file must contain actual wall-probe basis measurements');
 for(const measurement of measurements)for(const key of ['client','protocol','rules','assets','db'])if(measurement.versions?.[key]!==flow.versions[key])throw Error('Wall basis/model version mismatch '+key);
 const result=applyDeclaredWalls(source,flow.stages,measurements);
 const directory='docs/reviews/open-world-m2-m4/W3';await mkdir(directory,{recursive:true});await writeFile(directory+'/dungeon-walls-derived.json',JSON.stringify({flowVersions:flow.versions,changes:result.changes,applied:process.argv.includes('--apply')},null,2)+'\n');await writeFile(directory+'/dungeons-proposed.json',JSON.stringify(result.content,null,2)+'\n');if(process.argv.includes('--apply'))await writeFile('packages/content/dungeons.json',JSON.stringify(result.content,null,2)+'\n');console.log(JSON.stringify({declarations:result.changes.length,applied:process.argv.includes('--apply')}));
}
