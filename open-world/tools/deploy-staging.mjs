// Publish one committed source snapshot. Assets and secrets remain outside Git.
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,readdirSync,existsSync,mkdtempSync,symlinkSync,rmSync,rmdirSync,createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {committedVersions,assertReleaseVersions} from './deploy-versions.ts';
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url))),project=path.join(root,'open-world'),out='G:/webgame/aw-deploy';
const flags=new Set(process.argv.slice(2)),allowed=['--skip-web','--skip-api','--full-web','--no-mirror','--dry-run','--pull-backup'];
for(const flag of flags)if(!allowed.includes(flag))throw Error(`Unknown option: ${flag}`);
const ssh=process.platform==='win32'?'C:/Program Files/Git/usr/bin/ssh.exe':'ssh',scp=process.platform==='win32'?'C:/Program Files/Git/usr/bin/scp.exe':'scp';
const run=(cmd,args,options={})=>execFileSync(cmd,args,{cwd:root,stdio:'inherit',windowsHide:true,...options});
const capture=(cmd,args,options={})=>run(cmd,args,{stdio:'pipe',encoding:'utf8',maxBuffer:64*1024*1024,...options}).trim();
const remote=command=>run(ssh,['abyss-staging',command]),readRemote=command=>capture(ssh,['abyss-staging',command]);
const quote=s=>"'"+String(s).replaceAll("'","'\\''")+"'";
const head=capture('git',['rev-parse','HEAD']),expectedVersions=committedVersions(capture('git',['show',`${head}:open-world/packages/contracts/index.ts`]));
const release='release-'+head.slice(0,12)+'-'+Date.now(),artifact=path.join(out,release);
const api=!flags.has('--skip-api'),web=!flags.has('--skip-web');
console.log(JSON.stringify({source:head,versions:expectedVersions,api,web,steps:['isolated client build with local stop/build/restore','hash delta upload and server archive','verify candidate protocol/rules/assets before activation','stop API, build, atomic source/client activation, restore with rollback','verify health and mirror committed source']}));
if(flags.has('--dry-run'))process.exit(0);
mkdirSync(out,{recursive:true});const lock=path.join(out,'deploy-staging.lock');
try{mkdirSync(lock);}catch{throw Error('Deployment already running: '+lock);}
writeFileSync(path.join(lock,'owner.json'),JSON.stringify({pid:process.pid,release,head}));mkdirSync(artifact);
let snapshot;
async function hash(file){const h=createHash('sha256');for await(const c of createReadStream(file))h.update(c);return h.digest('hex');}
async function healthy(){const r=await fetch('https://43-165-179-11.sslip.io/api/health',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Health HTTP '+r.status);const h=await r.json();if(!h.ok)throw Error('Health not ready');assertReleaseVersions(h.versions,expectedVersions);return h;}
try{
 if(capture('git',['status','--porcelain','--untracked-files=no']))console.warn('Dirty workspace: only committed source is deployed; local public assets are copied.');
 const before=readRemote('cat ~/abyss/SOURCE_COMMIT 2>/dev/null || true');
 let manifest;
 if(web){
  snapshot=mkdtempSync(path.join(out,'web-head-'));
  const webEntries=capture('git',['ls-tree','--name-only',head,'open-world/apps/web/']).split('\n').filter(p=>p!=='open-world/apps/web/public');
  const source=path.join(artifact,'web-source.tgz');run('git',['archive','--format=tar.gz','--output='+source,head,...webEntries,'open-world/packages','open-world/config','open-world/package.json','open-world/tsconfig.json']);run('tar',['-xzf',source,'-C',snapshot]);
  const work=path.join(snapshot,'open-world');for(const item of ['node_modules','apps/web/public','assets','.design'])if(!existsSync(path.join(work,item)))symlinkSync(path.join(project,item),path.join(work,item),'junction');
  const dist=path.join(artifact,'web-dist');
  try{run(process.execPath,[path.join(project,'tools/local-service.mjs'),'stop'],{cwd:project});run(process.execPath,[path.join(project,'node_modules/vite/bin/vite.js'),'build','--config',path.join(work,'apps/web/vite.config.ts'),'--outDir',dist,'--emptyOutDir'],{cwd:work});}
  finally{run(process.execPath,[path.join(project,'tools/local-service.mjs'),'start'],{cwd:project});}
  writeFileSync(path.join(dist,'build-info.json'),JSON.stringify({source:head,versions:expectedVersions,release}));
  const files=[];function walk(dir,prefix=''){for(const e of readdirSync(dir,{withFileTypes:true})){const name=prefix+e.name;if(e.isDirectory())walk(path.join(dir,e.name),name+'/');else if(e.isFile())files.push(name);else throw Error('Unexpected artifact entry: '+name);}}walk(dist);
  const python="import os,json,hashlib\nroot=os.path.expanduser('~/abyss/open-world/deploy/web-dist')\nm={}\nfor d,_,files in os.walk(root):\n for f in files:\n  p=os.path.join(d,f)\n  with open(p,'rb') as h:m[os.path.relpath(p,root)]=hashlib.file_digest(h,'sha256').hexdigest()\nprint(json.dumps(m))";
  const old=flags.has('--full-web')?{}:JSON.parse(readRemote('python3 -c '+quote("import base64;exec(base64.b64decode('"+Buffer.from(python).toString('base64')+"'))")));
  manifest={};for(const f of files)manifest[f]=await hash(path.join(dist,f));
  const changed=files.filter(f=>manifest[f]!==old[f]).sort((a,b)=>Number(a==='index.html')-Number(b==='index.html'));
  writeFileSync(path.join(artifact,'web-manifest.json'),JSON.stringify(manifest,null,2));writeFileSync(path.join(artifact,'web-files.txt'),changed.join('\n')+'\n');
  const upload=path.join(artifact,'web-upload.tgz');run('tar',['-czf',upload,'-C',dist,'-T',path.join(artifact,'web-files.txt')]);console.log(`Uploading ${changed.length}/${files.length} changed web files`);run(scp,[upload,`abyss-staging:/tmp/${release}.web.tgz`]);
  if(readRemote(`sha256sum /tmp/${release}.web.tgz`).split(/\s/)[0]!==await hash(upload))throw Error('Web archive checksum mismatch');
 }else if(api){
  const current=JSON.parse(readRemote('cat ~/abyss/open-world/deploy/web-dist/build-info.json'));assertReleaseVersions(current.versions,expectedVersions);
 }
 if(api){const archive=path.join(artifact,'server-src.tgz'),files=['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','.dockerignore','apps/api','apps/web/package.json','apps/desktop/package.json','packages','config','deploy'].map(p=>'open-world/'+p);run('git',['archive','--format=tar.gz','--output='+archive,head,...files]);run(scp,[archive,`abyss-staging:/tmp/${release}.server.tgz`]);if(readRemote(`sha256sum /tmp/${release}.server.tgz`).split(/\s/)[0]!==await hash(archive))throw Error('Server archive checksum mismatch');}
 if(api||web){
  if(capture('git',['rev-parse','HEAD'])!==head)throw Error('HEAD changed; activation cancelled');
  if(readRemote('cat ~/abyss/SOURCE_COMMIT 2>/dev/null || true')!==before)throw Error('Another release changed the API; activation cancelled');
  const versionCheck=`import {versions} from '/app/packages/contracts/index.ts';const expected=${JSON.stringify(expectedVersions)};for(const key of Object.keys(expected))if(versions[key]!==expected[key])throw Error('Candidate '+key+' mismatch');console.log(JSON.stringify(versions));`;
  const healthCheck=`const r=await fetch('http://127.0.0.1:8611/api/health');const h=await r.json();const expected=${JSON.stringify(expectedVersions)};if(!r.ok||!h.ok||Object.keys(expected).some(k=>h.versions[k]!==expected[k]))process.exit(1);console.log(JSON.stringify(h));`;
  const script=`set -eu
cd /home/ubuntu/abyss
stage=/home/ubuntu/abyss/releases/${release}
previous=/home/ubuntu/abyss/previous-${release}
mkdir -p "$stage"
${api?`tar -xzf /tmp/${release}.server.tgz -C "$stage"`:'mkdir -p "$stage/open-world/deploy"'}
cp open-world/deploy/.env "$stage/open-world/deploy/.env"
chmod 600 "$stage/open-world/deploy/.env"
cp -al open-world/deploy/web-dist "$stage/open-world/deploy/web-dist"
${web?`tar --unlink-first -xzf /tmp/${release}.web.tgz -C "$stage/open-world/deploy/web-dist"`:''}
test "$(cat SOURCE_COMMIT)" = ${quote(before)}
cd open-world/deploy
oldImage=$(docker inspect "$(docker compose ps -q api)" --format '{{.Image}}')
docker tag "$oldImage" abyss-staging-api:before-${release}
switched=0
rollback() {
 code=$?
 trap - EXIT
 if [ "$code" -ne 0 ]; then
  echo "ROLLBACK $(date -Is)"
  ${api?`if [ "$switched" = 1 ]; then mv /home/ubuntu/abyss/open-world "$stage/failed-open-world"; mv "$previous" /home/ubuntu/abyss/open-world; fi`:`if [ "$switched" = 1 ]; then mv /home/ubuntu/abyss/open-world/deploy/web-dist "$stage/failed-web"; mv "$previous" /home/ubuntu/abyss/open-world/deploy/web-dist; fi`}
  docker tag abyss-staging-api:before-${release} abyss-staging-api:latest
  cd /home/ubuntu/abyss/open-world/deploy
  docker compose up -d --no-build --force-recreate api
 fi
 exit "$code"
}
trap rollback EXIT
echo "STOP $(date -Is)"
docker compose stop api
${api?`cd "$stage/open-world/deploy"
echo "BUILD $(date -Is)"
docker compose build api`:''}
# Inspect the actual candidate runtime, not a client-version string or port-open check.
docker run --rm --entrypoint node abyss-staging-api:latest --import /tsx/node_modules/tsx/dist/loader.mjs --input-type=module -e ${quote(versionCheck)}
${api?`mv /home/ubuntu/abyss/open-world "$previous"
mv "$stage/open-world" /home/ubuntu/abyss/open-world`:`mv /home/ubuntu/abyss/open-world/deploy/web-dist "$previous"
mv "$stage/open-world/deploy/web-dist" /home/ubuntu/abyss/open-world/deploy/web-dist`}
switched=1
cd /home/ubuntu/abyss/open-world/deploy
echo "RESTORE $(date -Is)"
docker compose up -d --no-build --force-recreate api
for n in $(seq 1 40); do
 if docker compose exec -T api node --input-type=module -e ${quote(healthCheck)}; then
  ${api?`printf '%s\\n' '${head}' > /home/ubuntu/abyss/SOURCE_COMMIT`:''}
  echo "HEALTHY $(date -Is)"
  trap - EXIT
  exit 0
 fi
 sleep 2
done
exit 1
`;
  const scriptFile=path.join(artifact,'activate.sh');writeFileSync(scriptFile,script);run(scp,[scriptFile,`abyss-staging:/tmp/${release}.activate.sh`]);remote(`flock -n /home/ubuntu/abyss/.deploy-lock bash /tmp/${release}.activate.sh`);
 }
 const health=await healthy();writeFileSync(path.join(artifact,'health.json'),JSON.stringify(health,null,2));console.log('Health OK '+JSON.stringify(health.versions));
 if(manifest)writeFileSync(path.join(out,'web-dist-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 if(flags.has('--pull-backup')){const latest=readRemote("find ~/abyss/backups -maxdepth 1 -type f -name 'abyss-*.sql.gz' -printf '%f\\n' | sort | tail -n 1");if(!/^abyss-\d{8}T\d{6}Z\.sql\.gz$/.test(latest))throw Error('No verified backup found');remote(`gzip -t ~/abyss/backups/${latest}`);const backupDir=path.join(out,'backups');mkdirSync(backupDir,{recursive:true});run(scp,[`abyss-staging:abyss/backups/${latest}`,path.join(backupDir,latest)]);console.log('Backup downloaded: '+latest);}
 if(capture('git',['rev-parse','HEAD'])!==head)throw Error('HEAD changed before mirror');
 if(!flags.has('--no-mirror'))run(process.execPath,[path.join(project,'tools/cloud-mirror.mjs')]);
 console.log(`Deployment verified: ${head}; evidence: ${artifact}`);
}finally{
 if(snapshot){const rel=path.relative(out,snapshot);if(rel.startsWith('..')||path.isAbsolute(rel))throw Error('Unsafe snapshot cleanup');rmSync(snapshot,{recursive:true,force:true});}
 const owner=JSON.parse(readFileSync(path.join(lock,'owner.json'),'utf8'));if(owner.release===release){rmSync(path.join(lock,'owner.json'));rmdirSync(lock);}
}
