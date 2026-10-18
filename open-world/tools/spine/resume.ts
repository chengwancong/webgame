/** 中断恢复只核验前置和混杂因素；绝不覆盖S0初始快照。 */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {prerequisites,root,review} from './preflight.ts';
export async function resume(){
 const baseline=JSON.parse(await readFile(resolve(review,'S0/workspace-baseline.json'),'utf8'));
 const pre=await prerequisites(),drift=[];
 for(const file of baseline.files){
  try{const actual=createHash('sha256').update(await readFile(resolve(root,file.file))).digest('hex');if(actual!==file.sha256)drift.push({file:file.file,before:file.sha256,after:actual});}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;drift.push({file:file.file,before:file.sha256,after:null});}
 }
 const result={checkedAt:new Date().toISOString(),prerequisite:pre,baselineHead:baseline.head,drift,
  next:pre.passed?'保留S0快照，记录外部漂移后补齐S0正式Excel/JSON目标表，再实现S1真实测量台；按progress.md续接。':'硬阻塞6仍存在；本期独立准备结果保留，等待三期自己的C7提交。'};
 await writeFile(resolve(review,'S0/resume-check.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({prerequisitePassed:pre.passed,head:pre.head,driftCount:drift.length,blocker:pre.blocker,next:result.next}));
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))if(!(await resume()).prerequisite.passed)process.exitCode=2;
