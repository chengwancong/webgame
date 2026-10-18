import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {benchPlayer,measurementVersion,type ResolvedPlayer} from './bench.ts';
import {resolvePlayer,standardState,standardLevels,referencePlayer} from './player.ts';
import {pacingProfiles} from '../pacing/profiles.ts';
import {median} from './math.ts';
import {versions} from '../../packages/contracts/index.ts';
export const spineReview='docs/reviews/numeric-spine-20261013';
export const dataRoot='tools/spine/data';
const digest=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
export async function measured(output:string,id:string,player:ResolvedPlayer,standardHp:number,seeds=[41,42,43]){
 const path=resolve(output,'arms',id+'.json'),signature=digest(JSON.stringify({versions,player,standardHp,seeds,bench:measurementVersion}));
 try{const prior=JSON.parse(await readFile(path,'utf8'));if(prior.signature!==signature)throw Error('测量输入已变化，不覆盖原始证据：'+path);return prior;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const result={signature,inputs:{player,standardHp},...benchPlayer(player,standardHp,seeds)};
 await mkdir(resolve(output,'arms'),{recursive:true});await writeFile(path,JSON.stringify(result,null,2)+'\n');console.log(id+' '+JSON.stringify(result.metrics));return result;
}
export async function measureCore(output=spineReview+'/S2'){
 await mkdir(output,{recursive:true});await mkdir(dataRoot,{recursive:true});
 const standards:any[]=[],parity:any[]=[],builds:any[]=[];
 for(const level of standardLevels){const state=standardState(level),player=resolvePlayer('standard-'+level,state),result=await measured(output,player.id,player,player.build.stats.hp);standards.push({state,resolved:player,...result});}
 for(const level of [10,20,30,40,50])for(const family of ['staff','hidden'] as const){const state=standardState(level,family),player=resolvePlayer(family+'-'+level,state),hp=standards.find(r=>r.level===level).resolved.build.stats.hp;parity.push({family,...await measured(output,player.id,player,hp)});}
 const hp50=standards.find(r=>r.level===50).resolved.build.stats.hp;
 for(const p of pacingProfiles){const {player}=referencePlayer(p.id);builds.push(await measured(output,p.id,player,hp50));}
 const axes=['D1','DN','B3','EHP','AV'] as const,anchor={...Object.fromEntries(axes.map(k=>[k,median(builds.map(r=>r.metrics[k]))])),r50:hp50/20};
 const stamp={versions,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),seeds:[41,42,43],measurementVersion};
 const anchorPath=dataRoot+'/spine-anchor.json';
 try{const old=JSON.parse(await readFile(anchorPath,'utf8'));if(JSON.stringify(old.anchor)!==JSON.stringify(anchor))throw Error('冻结锚点不允许改变');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;await writeFile(anchorPath,JSON.stringify({...stamp,anchor},null,2)+'\n');}
 const players=standards.map(r=>({level:r.level,...r.metrics,hp:r.resolved.build.stats.hp,armor:r.resolved.build.stats.armor,skills:r.resolved.build.skills.map((s:any)=>({id:s.id,damage:s.damage,cooldown:s.cooldown})),localSource:resolve(output,'arms',r.player+'.json')}));
 await writeFile(dataRoot+'/spine-player.json',JSON.stringify({...stamp,points:players,parity:parity.map(r=>({family:r.family,level:r.level,...r.metrics}))},null,2)+'\n');
 const sourceFiles=await Promise.all([...standards,...parity,...builds].map(async r=>{const name=typeof r.player==='string'?r.player:r.player.id,path=resolve(output,'arms',name+'.json');return {path,sha256:digest(await readFile(path))};}));
 const summary={...stamp,command:'node --import tsx tools/spine/measure.ts --core',anchor,standards:players,parity:parity.map(r=>({family:r.family,level:r.level,...r.metrics})),builds:builds.map(r=>({id:r.player,...r.metrics})),sourceFiles,sigma:Object.fromEntries(axes.map(k=>[k,(anchor as any)[k]/standards.find(r=>r.level===50).metrics[k]]))};
 await writeFile(output+'/core-summary.json',JSON.stringify(summary,null,2)+'\n');return summary;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)&&process.argv.includes('--core'))await measureCore();
