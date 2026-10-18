// Deploy committed source only; assets and secrets stay outside Git.
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,readdirSync,existsSync,mkdtempSync,symlinkSync,rmSync,createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const project=path.join(root,'open-world'),out='G:/webgame/aw-deploy';
const flags=new Set(process.argv.slice(2));
const allowed=['--skip-web','--skip-api','--full-web','--no-mirror','--dry-run','--pull-backup'];
for(const flag of flags)if(!allowed.includes(flag))throw Error(`Unknown option: ${flag}`);
const dry=flags.has('--dry-run');
const ssh=process.platform==='win32'?'C:/Program Files/Git/usr/bin/ssh.exe':'ssh';
const scp=process.platform==='win32'?'C:/Program Files/Git/usr/bin/scp.exe':'scp';
const run=(cmd,args,options={})=>execFileSync(cmd,args,{cwd:root,stdio:'inherit',windowsHide:true,...options});
const capture=(cmd,args,options={})=>run(cmd,args,{stdio:'pipe',encoding:'utf8',maxBuffer:64*1024*1024,...options}).trim();
const remote=command=>run(ssh,['abyss-staging',command]);
const head=capture('git',['rev-parse','HEAD']);
const contracts=capture('git',['show',`${head}:open-world/packages/contracts/index.ts`]);
const expected=contracts.match(/export const versions=\{client:'([^']+)'/)?.[1];
if(!expected)throw Error('Cannot read committed client version');
const steps=[`Source ${head}; expected client ${expected}`,
 ...(!flags.has('--skip-api')?['Archive HEAD server source; scp; unpack; write SOURCE_COMMIT; compose up -d --build api']:[]),
 ...(!flags.has('--skip-web')?['Build isolated HEAD web source with local public assets using Vite',
 'SHA256 non-js/css/html manifest; upload code or full web-dist; recreate API after full replacement']:[]),
 'Poll /api/health and require matching client version',...(flags.has('--pull-backup')?['Pull latest verified database backup to local backups directory']:[]),...(!flags.has('--no-mirror')?['Push snapshot with tools/cloud-mirror.mjs']:[])];
for(const step of steps)console.log(step);
if(dry)process.exit(0);
mkdirSync(out,{recursive:true});
// Fail closed on concurrent invocations; remove only the lock this process acquired.
const lock=path.join(out,'deploy-staging.lock');
try{mkdirSync(lock);}catch{throw Error(`Deployment already running or stale lock: ${lock}`);}
let snapshot;
try{
 if(capture('git',['status','--porcelain','--untracked-files=no']))console.warn('WARNING: dirty workspace; deploying committed HEAD source only.');
 if(!flags.has('--skip-api')){
  const archive=path.join(out,'server-src.tgz');
  const files=['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','.dockerignore','apps/api','apps/web/package.json','apps/desktop/package.json','packages','config','deploy'].map(p=>'open-world/'+p);
  run('git',['archive','--format=tar.gz',`--output=${archive}`,head,...files]);
  run(scp,[archive,'abyss-staging:/tmp/abyss-server-src.tgz']);
  remote(`set -eu; cd ~/abyss; rm -rf open-world/apps open-world/packages open-world/config; tar -xzf /tmp/abyss-server-src.tgz; printf '%s\\n' '${head}' > SOURCE_COMMIT; cd open-world/deploy; docker compose up -d --build api`);
 }
 if(!flags.has('--skip-web')){
  snapshot=mkdtempSync(path.join(out,'web-head-'));
  const webEntries=capture('git',['ls-tree','--name-only',head,'open-world/apps/web/']).split('\n').filter(p=>p!=='open-world/apps/web/public');
  const source=path.join(out,'web-source.tgz');
  run('git',['archive','--format=tar.gz',`--output=${source}`,head,...webEntries,'open-world/packages','open-world/config','open-world/package.json','open-world/tsconfig.json']);
  run('tar',['-xzf',source,'-C',snapshot]);
  const work=path.join(snapshot,'open-world');
  symlinkSync(path.join(project,'node_modules'),path.join(work,'node_modules'),'junction');
  // Public is deploy-time artwork/audio, including locally generated untracked assets.
  symlinkSync(path.join(project,'apps/web/public'),path.join(work,'apps/web/public'),'junction');
  const dist=path.join(out,'web-dist');
  run(process.execPath,[path.join(project,'node_modules/vite/bin/vite.js'),'build','--config',path.join(work,'apps/web/vite.config.ts'),'--outDir',dist,'--emptyOutDir'],{cwd:work});
  const all=[];
  function walk(dir,prefix=''){for(const e of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const rel=prefix+e.name;if(e.isDirectory())walk(path.join(dir,e.name),rel+'/');else if(e.isFile())all.push(rel);else throw Error(`Unexpected dist entry: ${rel}`);}}
  walk(dist);
  const manifest={};
  for(const file of all.filter(f=>!(/\.(js|css|html)$/i.test(f)))){
   const hash=createHash('sha256');for await(const chunk of createReadStream(path.join(dist,file)))hash.update(chunk);manifest[file]=hash.digest('hex');
  }
  const manifestFile=path.join(out,'web-dist-manifest.json');
  const text=JSON.stringify(manifest,null,2)+'\n';
  const full=flags.has('--full-web')||!existsSync(manifestFile)||readFileSync(manifestFile,'utf8')!==text;
  const archive=path.join(out,'web-upload.tar');
  if(full){
   console.log(`Full web upload (${all.length} files)`);
   run('tar',['-cf',archive,'-C',dist,'.']);
  }else{
   console.log('Asset hashes unchanged; uploading HTML/JS/CSS only');
   const list=path.join(out,'web-code-files.txt');writeFileSync(list,all.filter(f=>/\.(js|css|html)$/i.test(f)).join('\n')+'\n');
   run('tar',['-cf',archive,'-C',dist,'-T',list]);
  }
  run(scp,[archive,'abyss-staging:/tmp/abyss-web-upload.tar']);
  if(full)remote('set -eu; cd ~/abyss/open-world/deploy; test ! -e web-dist.new; mkdir web-dist.new; tar -xf /tmp/abyss-web-upload.tar -C web-dist.new; test ! -e web-dist.previous; if test -d web-dist; then mv web-dist web-dist.previous; fi; mv web-dist.new web-dist; docker compose up -d --force-recreate api; rm -rf web-dist.previous; rm /tmp/abyss-web-upload.tar');
  else remote('set -eu; tar -xf /tmp/abyss-web-upload.tar -C ~/abyss/open-world/deploy/web-dist; rm /tmp/abyss-web-upload.tar');
  writeFileSync(manifestFile,text);
 }
 let actual='unavailable',healthy=false;
 for(let n=0;n<60;n++){
  try{const response=await fetch('https://43-165-179-11.sslip.io/api/health',{signal:AbortSignal.timeout(5000)});const health=await response.json();actual=health.versions?.client??'missing';if(response.ok&&health.ok&&actual===expected){console.log('Health OK '+JSON.stringify(health.versions));healthy=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,2000));
 }
 if(!healthy)throw Error(`Health version mismatch: expected=${expected}, actual=${actual}`);
 if(flags.has('--pull-backup')){
  const latest=capture(ssh,['abyss-staging',"find ~/abyss/backups -maxdepth 1 -type f -name 'abyss-*.sql.gz' -printf '%f\\n' | sort | tail -n 1"]);
  if(!/^abyss-\d{8}T\d{6}Z\.sql\.gz$/.test(latest))throw Error('No valid remote backup found');
  remote(`gzip -t ~/abyss/backups/${latest}`);
  const backupDir=path.join(out,'backups');mkdirSync(backupDir,{recursive:true});
  run(scp,[`abyss-staging:abyss/backups/${latest}`,path.join(backupDir,latest)]);
  console.log(`Backup downloaded: ${latest}`);
 }
 if(capture('git',['rev-parse','HEAD'])!==head)throw Error('HEAD changed during deployment; rerun before mirroring');
 if(!flags.has('--no-mirror'))run(process.execPath,[path.join(project,'tools/cloud-mirror.mjs')]);
 console.log(`Deployment verified: ${head}`);
}finally{
 if(snapshot)rmSync(snapshot,{recursive:true,force:true});
 rmSync(lock,{recursive:true});
}
