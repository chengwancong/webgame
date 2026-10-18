// 把当前 HEAD 去掉美术/音频等二进制素材后，作为快照提交推到云端私有仓库（remote 名 cloud）。
// 只用临时索引与 refs/cloud-mirror/main，不碰工作区、暂存区与本地分支。
//   node tools/cloud-mirror.mjs            生成快照并推送
//   node tools/cloud-mirror.mjs --dry-run  只统计，不建提交、不推送
import {execFileSync} from 'node:child_process';
import {rmSync} from 'node:fs';
import path from 'node:path';

const dryRun=process.argv.includes('--dry-run');
const MIRROR_REF='refs/cloud-mirror/main';
const REMOTE='cloud';
// 素材不上云（阶段 1 决定）：图片、音视频、Spine 二进制/图集、压缩包、数据库转储。
const EXCLUDED_EXT=new Set(['png','jpg','jpeg','webp','gif','bmp','tga','psd','kra','webm','mp4','mov','ogg','mp3','wav','m4a','flac','skel','atlas','spine','zip','7z','rar','dump']);
const MAX_BYTES=20*1024*1024;

const git=(args,opts={})=>execFileSync('git',args,{encoding:'utf8',maxBuffer:1<<30,...opts});
const root=git(['rev-parse','--show-toplevel']).trim();
const gitDir=path.resolve(root,git(['rev-parse','--git-dir'],{cwd:root}).trim());
const index=path.join(gitDir,'cloud-mirror.index');
const env={...process.env,GIT_INDEX_FILE:index};
const run=(args,opts={})=>git(args,{cwd:root,env,...opts});

try{
 const head=run(['rev-parse','HEAD']).trim();
 run(['read-tree','HEAD']);
 // ls-files -s 无大小；用 ls-tree -l 取 blob 大小。
 const entries=run(['ls-tree','-r','-l','-z','HEAD']).split('\0').filter(Boolean).map(line=>{
  const [meta,file]=line.split('\t');const size=Number(meta.trim().split(/\s+/)[3]);return {file,size:Number.isFinite(size)?size:0};
 });
 const drop=[];let keptBytes=0,dropBytes=0;
 for(const {file,size} of entries){
  const ext=path.extname(file).slice(1).toLowerCase();
  if(EXCLUDED_EXT.has(ext)||size>MAX_BYTES){drop.push(file);dropBytes+=size;}else keptBytes+=size;
 }
 if(drop.length)run(['update-index','--force-remove','-z','--stdin'],{input:drop.join('\0')});
 const tree=run(['write-tree']).trim();
 const mb=b=>(b/1048576).toFixed(1)+'MB';
 console.log(`源提交 ${head.slice(0,9)}：保留 ${entries.length-drop.length} 个文件 ${mb(keptBytes)}，排除 ${drop.length} 个 ${mb(dropBytes)}`);
 if(dryRun){console.log('dry-run：未建提交、未推送');process.exit(0);}
 let parent='';try{parent=run(['rev-parse','--verify','-q',MIRROR_REF]).trim();}catch{}
 if(parent&&run(['rev-parse',parent+'^{tree}']).trim()===tree)console.log('内容与上次快照相同，跳过新提交');
 else{
  const subject=run(['log','-1','--format=%s',head]).trim();
  const commit=run(['commit-tree',tree,...(parent?['-p',parent]:[]),'-m',`snapshot ${head.slice(0,9)}: ${subject}`,'-m',`Source-Commit: ${head}`]).trim();
  run(['update-ref',MIRROR_REF,commit]);
  console.log(`快照提交 ${commit.slice(0,9)}`);
 }
 execFileSync('git',['push',REMOTE,`${MIRROR_REF}:refs/heads/main`],{cwd:root,stdio:'inherit'});
}finally{rmSync(index,{force:true});}
