import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {planeAssets,promptFor} from '../assets/open-world/plane-kits-spec.mjs';
const root=resolve(import.meta.dirname,'..'),group=join(root,'assets/open-world/plane-kits'),[action,id,state='default',arg]=process.argv.slice(2);
const read=async p=>JSON.parse(await readFile(p,'utf8')),save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
if(action==='queue'){
 const queue=planeAssets.filter(a=>a.kit===id&&!a.baseId&&a.kind!=='spine-fx').flatMap(a=>a.states.map(s=>promptFor(a,s)));
 const offset=Number(state)||0,count=Number(arg)||8;console.log(JSON.stringify(queue.slice(offset,offset+count)));process.exit(0);
}
const a=planeAssets.find(a=>a.id===id);if(!a||!a.states.includes(state))throw Error('未知资源或状态');
const p=promptFor(a,state),path=join(root,p.output),logPath=join(group,'production-state.json');
let log;try{log=await read(logPath);}catch(e){if(e.code!=='ENOENT')throw e;log={schemaVersion:1,attempts:[],approved:[],rejected:[]};}
if(action==='save'){
 await mkdir(resolve(path,'..'),{recursive:true});await copyFile(arg,path);const m=await sharp(path).metadata();log.attempts.push({id,state,source:arg,output:p.output,width:m.width,height:m.height,alpha:m.hasAlpha});await save(logPath,log);console.log(JSON.stringify(log.attempts.at(-1)));
}else if(action==='approve'){
 const bytes=await readFile(path),m=await sharp(bytes).metadata();if(!['ground','ambient'].includes(a.kind)&&!m.hasAlpha)throw Error('不能批准无透明通道的独立件');
 let review;try{review=await read(join(group,'review.json'));}catch(e){if(e.code!=='ENOENT')throw e;review={schemaVersion:1,sources:{},browserUsed:false,gameplayIntegrated:false};}
 review.sources[p.output]={sha256:createHash('sha256').update(bytes).digest('hex'),accepted:true,visualNote:arg??'已目视检查：造型、明亮度、描边、完整轮廓。',seamVerified:false};await save(join(group,'review.json'),review);if(!log.approved.includes(p.output))log.approved.push(p.output);await save(logPath,log);
}else if(action==='reject'){
 log.rejected.push({id,state,output:p.output,reason:arg});await save(logPath,log);
}else throw Error('支持 queue、save、approve、reject');
