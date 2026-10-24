import assert from 'node:assert/strict';

export type RemovalCloudPhase='derive'|'verify';
export const removalCloudRoot='/home/ubuntu/abyss/roguelike-removal-20261024';
export const removalCloudOutput='.runtime/roguelike-removal-20261024';
export const removalArchiveRoots=[
 'open-world/packages','open-world/config','open-world/tools','open-world/apps/api/package.json','open-world/apps/api/src',
 'open-world/apps/web/package.json','open-world/apps/desktop/package.json','open-world/package.json',
 'open-world/pnpm-lock.yaml','open-world/pnpm-workspace.yaml','open-world/tsconfig.json','open-world/.dockerignore','open-world/deploy/Dockerfile',
 'open-world/assets/numerics/world-stage-timing.json',
] as const;
const headPattern=/^[0-9a-f]{40}$/,hashPattern=/^[0-9a-f]{64}$/;
const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
export function removalCloudPhase(args:readonly string[]):RemovalCloudPhase{
 assert(args.length===2&&args[0]==='--phase'&&['derive','verify'].includes(args[1]),'Use --phase derive|verify; no retry/apply/tuning options');
 return args[1] as RemovalCloudPhase;
}
export function removalArchiveAllowed(file:string){
 if(!removalArchiveRoots.some(root=>file===root||file.startsWith(root+'/')))return false;
 if(file.includes('..')||file.includes('\\')||/(^|\/)(public|node_modules|\.git|\.qa|\.runtime)(\/|$)/.test(file))return false;
 if(/(^|\/)(\.env(?:\.[^/]*)?|[^/]*credentials[^/]*|[^/]+\.(sql|dump|db|sqlite3?))$/i.test(file))return false;
 return !/\.(png|jpg|jpeg|gif|webp|bmp|tga|svg|ico|avif|psd|skel|atlas|spine|mp3|ogg|wav|mp4|webm|zip|gz|tgz|7z|tsbuildinfo)$/i.test(file);
}
export function removalPhaseFiles(phase:RemovalCloudPhase):readonly string[]{
 return phase==='derive'?['removal-plan.json','derive-summary.json','player-points.json']:['verify-summary.json'];
}
export type RemovalCloudManifest={status:'complete';phase:RemovalCloudPhase;commit:string;archiveSha256:string;files:{name:string;sha256:string;bytes:number}[]};
export function validateRemovalManifest(value:unknown,phase:RemovalCloudPhase,expectedCommit?:string):RemovalCloudManifest{
 const v=value as RemovalCloudManifest;
 assert(v&&v.status==='complete'&&v.phase===phase,'Unexpected phase completion metadata');
 assert(headPattern.test(v.commit)&&hashPattern.test(v.archiveSha256),'Invalid source/archive identity');
 if(expectedCommit)assert.equal(v.commit,expectedCommit,'Measurement source commit differs');
 assert(Array.isArray(v.files));assert.deepEqual(v.files.map(f=>f.name).sort(),[...removalPhaseFiles(phase)].sort(),'Unexpected downloaded files');
 for(const file of v.files)assert(hashPattern.test(file.sha256)&&Number.isSafeInteger(file.bytes)&&file.bytes>0&&file.bytes<=16*1024*1024,'Invalid output hash/size');
 return v;
}
function statusPython(phase:RemovalCloudPhase){
 return `import hashlib,json,pathlib
root=pathlib.Path(${JSON.stringify(removalCloudRoot)})
phase=${JSON.stringify(phase)}
marker=root/(phase+'-started.json')
output=root/'source'/'open-world'/${JSON.stringify(removalCloudOutput)}
names=${JSON.stringify(removalPhaseFiles(phase))}
if not marker.exists():
 print(json.dumps(dict(status='new',phase=phase)))
else:
 meta=json.loads(marker.read_text())
 if not all((output/name).is_file() for name in names):
  print(json.dumps(dict(status='started',phase=phase,commit=meta['commit'])))
 else:
  files=[]
  for name in names:
   raw=(output/name).read_bytes()
   if json.loads(raw)['commit']!=meta['commit']:raise RuntimeError('Output source identity mismatch')
   files.append(dict(name=name,sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw)))
  print(json.dumps(dict(status='complete',phase=phase,commit=meta['commit'],archiveSha256=meta['archiveSha256'],files=files)))
`;
}
export function removalCloudStatusCommand(phase:RemovalCloudPhase){removalCloudPhase(['--phase',phase]);return 'python3 -c '+quote(statusPython(phase));}
export function removalCloudPlan(input:{phase:RemovalCloudPhase;head:string;sha256:string}){
 const phase=removalCloudPhase(['--phase',input.phase]);assert(headPattern.test(input.head),'Expected committed HEAD');assert(hashPattern.test(input.sha256),'Expected archive SHA-256');
 const root=removalCloudRoot,work=root+'/source/open-world',upload=root+'/uploads',archive=upload+'/'+phase+'-'+input.head+'.tgz',script=upload+'/'+phase+'-'+input.head+'.sh',marker=root+'/'+phase+'-started.json',output=work+'/'+removalCloudOutput;
 const inspectArchive=`import pathlib,tarfile
with tarfile.open(${JSON.stringify(archive)},'r:gz') as archive:
 for item in archive.getmembers():
  path=pathlib.PurePosixPath(item.name)
  if path.is_absolute() or '..' in path.parts or not path.parts or path.parts[0]!='open-world':raise RuntimeError('Unsafe archive path')
  if any(part in ['public','.runtime','.qa','node_modules','.git'] for part in path.parts):raise RuntimeError('Unexpected runtime/public archive entry')
  if item.issym() or item.islnk() or not (item.isfile() or item.isdir()):raise RuntimeError('Unsupported archive entry')
`;
 const containerScript=`set -eu
umask 022
test -d /app/node_modules
test -f /tsx/node_modules/tsx/dist/cli.mjs
if [ -L /work/node_modules ]; then test "$(readlink /work/node_modules)" = /app/node_modules; else test ! -e /work/node_modules; ln -s /app/node_modules /work/node_modules; fi
if [ ! -e /app/node_modules/tsx ]; then ln -s /tsx/node_modules/tsx /app/node_modules/tsx; fi
mkdir -p /app/node_modules/.bin
if [ ! -e /app/node_modules/.bin/tsx ]; then ln -s /tsx/node_modules/tsx/dist/cli.mjs /app/node_modules/.bin/tsx; fi
export PATH=/app/node_modules/.bin:/tsx/node_modules/.bin:$PATH
pnpm spine:check --roguelike-removal=${phase} --out=${removalCloudOutput}`;
 const preflightScript=containerScript.replace(`pnpm spine:check --roguelike-removal=${phase} --out=${removalCloudOutput}`,'pnpm spine:check --help');
 const writeMarker=`import json,pathlib
path=pathlib.Path(${JSON.stringify(marker)})
with path.open('x') as stream:json.dump(dict(commit=${JSON.stringify(input.head)},archiveSha256=${JSON.stringify(input.sha256)},phase=${JSON.stringify(phase)}),stream)
`;
 const remoteScript=`set -eu
umask 077
mkdir -p '${root}'
exec 9>'${root}/execution.lock'
flock -n 9
test ! -e '${marker}'
test ! -e '${output}/${phase}-started.json'
${phase==='derive'?`test ! -e '${root}/verify-started.json'`:`test -s '${root}/derive-started.json'
test -s '${output}/removal-plan.json'
test -s '${output}/derive-summary.json'
test -s '${output}/player-points.json'`}
printf '%s  %s\\n' '${input.sha256}' '${archive}' | sha256sum -c - >/dev/null
python3 -c ${quote(inspectArchive)}
mkdir -p '${root}/source'
# The archive cannot contain .runtime. Overlay source only; prior raw cases/plan/points remain.
tar -xzf '${archive}' -C '${root}/source'
printf '%s\\n' '${input.head}' > '${root}/source/SOURCE_COMMIT'
test -f '${work}/deploy/Dockerfile'
if ! docker build --target dependencies --tag abyss-spine-removal-worker --file '${work}/deploy/Dockerfile' '${work}' > '${root}/${phase}-dependency-build.log' 2>&1; then
 echo 'Worker dependency build failed before measurement; inspect the isolated build log.' >&2
 exit 1
fi
test "$(cat '${root}/source/SOURCE_COMMIT')" = '${input.head}'
# Import the exact CLI dependency graph and check pnpm/tsx before the measurement marker.
# --help performs no simulation, writes no measurement, and does not consume a phase.
if ! docker run --rm --cpus=1 --memory=1536m --network=none --user=0 --entrypoint sh --mount 'type=bind,src=${work},dst=/work' --workdir /work --env 'AW_SPINE_SOURCE_COMMIT=${input.head}' abyss-spine-removal-worker -c ${quote(preflightScript)} > '${root}/${phase}-preflight.log' 2>&1; then
 echo 'Worker CLI import failed before measurement; inspect the isolated preflight log.' >&2
 exit 1
fi
# Permanent phase marker is created only after preparation, immediately before the sole run.
python3 -c ${quote(writeMarker)}
if ! docker run --rm --cpus=1 --memory=1536m --network=none --user=0 --entrypoint sh --mount 'type=bind,src=${work},dst=/work' --workdir /work --env 'AW_SPINE_SOURCE_COMMIT=${input.head}' abyss-spine-removal-worker -c ${quote(containerScript)} > '${root}/${phase}-run.log' 2>&1; then
 echo '${phase} failed or was interrupted; permanent marker retained; do not repeat measurement.' >&2
 exit 1
fi
${removalCloudStatusCommand(phase)}
`;
 return {phase,head:input.head,root,work,archive,script,output,marker,prepare:`set -eu\numask 077\nmkdir -p '${upload}'\n`,remoteScript,statusCommand:removalCloudStatusCommand(phase)};
}
