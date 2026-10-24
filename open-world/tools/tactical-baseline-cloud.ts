/** Pure command construction for the write-once, isolated cloud measurement runner. */
export type TacticalBaselineRound='initial'|'validation';
export const tacticalBaselineArchivePaths=[
 'open-world/packages/simulation/tactical','open-world/packages/contracts/tactical.ts',
 'open-world/packages/content/tactical-archetypes.json','open-world/packages/content/tactical-graybox.json',
 'open-world/packages/content/tactical-boards.json','open-world/packages/content/tactical-content.ts',
 'open-world/package.json','open-world/tsconfig.json','open-world/tools/tactical-baseline.mjs',
] as const;
export const tacticalBaselineCloudRoot='/home/ubuntu/abyss/tactical-b1-20261024';
export function tacticalBaselineRound(args:readonly string[]):TacticalBaselineRound{
 if(args.length!==2||args[0]!=='--round'||!['initial','validation'].includes(args[1]))throw Error('Use --round initial | validation; no other arguments are permitted.');
 return args[1] as TacticalBaselineRound;
}
export function tacticalBaselineCloudPlan(input:{round:TacticalBaselineRound;head:string;sha256:string}){
 const round=tacticalBaselineRound(['--round',input.round]);
 if(!/^[0-9a-f]{40}$/.test(input.head))throw Error('Expected a committed 40-character Git HEAD.');
 if(!/^[0-9a-f]{64}$/.test(input.sha256))throw Error('Expected SHA-256 archive checksum.');
 const run=`${tacticalBaselineCloudRoot}/${round}`,work=`${run}/open-world`,archive=`${run}/${input.head}.tgz`,script=`${run}/${input.head}.sh`;
 const output=`${work}/.qa/tactical-b1/baseline`,summary=`${output}/${round}-summary.json`;
 const initial=`${tacticalBaselineCloudRoot}/initial/open-world/.qa/tactical-b1/baseline/initial-summary.json`;
 const guard=`test ! -e '${run}/started'\ntest ! -e '${run}/launch-lock'\ntest ! -e '${output}/${round}-started.json'\ntest ! -e '${summary}'`;
 const prepare=`set -eu\numask 077\n${guard}\nmkdir -p '${run}'\n`;
 const containerScript=`set -eu
test -d /app/node_modules
test -d /tsx/node_modules/tsx
test ! -e /work/node_modules
ln -s /app/node_modules /work/node_modules
if [ ! -e /app/node_modules/tsx ]; then ln -s /tsx/node_modules/tsx /app/node_modules/tsx; fi
node /work/tools/tactical-baseline.mjs --round ${round}`;
 const remoteScript=`set -eu
umask 077
${guard}
# Serialize extraction as well as execution, preserving the source of an in-flight run.
mkdir '${run}/launch-lock'
printf '%s  %s\\n' '${input.sha256}' '${archive}' | sha256sum -c - >/dev/null
tar -xzf '${archive}' -C '${run}'
test -f '${work}/tools/tactical-baseline.mjs'
${round==='validation'?`test -s '${initial}'
mkdir -p '${output}'
cp '${initial}' '${output}/initial-summary.json'`:`mkdir -p '${output}'`}
# Atomic, permanent guard. Never remove it on error or automatically restart a measurement.
mkdir '${run}/started'
printf '%s\\n' '${input.head}' > '${run}/started/source'
docker run --rm --cpus=1 --memory=1024m --network=none --user=0 --entrypoint sh --mount 'type=bind,src=${work},dst=/work' --workdir /work --env 'TACTICAL_BASELINE_SOURCE=${input.head}' abyss-staging-api:latest -c '${containerScript}' > '${run}/run.log' 2>&1
test -s '${summary}'
sha256sum '${summary}'
`;
 return {round,head:input.head,run,work,archive,script,summary,prepare,remoteScript};
}
