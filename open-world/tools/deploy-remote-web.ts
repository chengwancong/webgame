import type {ReleaseVersions} from './deploy-versions.ts';

const shellQuote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";

/** Generates an isolated source-only build; it never mounts the live release or its secrets. */
export function remoteWebBuildScript(input:{release:string;head:string;versions:ReleaseVersions}):string{
 if(!/^release-[0-9a-f]{12}-[0-9]+$/.test(input.release)||!/^([0-9a-f]{40}|[0-9a-f]{64})$/.test(input.head))throw Error('Invalid remote build identity');
 const metadata={source:input.head,versions:input.versions,release:input.release};
 const runner=`import {build,loadConfigFromFile} from 'vite';
import {existsSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const root=process.cwd(),configFile=path.join(root,'apps/web/vite.config.ts');
const loaded=await loadConfigFromFile({command:'build',mode:'production'},configFile);
if(!loaded)throw Error('Missing committed Vite configuration');
const existing=loaded.config.build?.rollupOptions?.input;
if(!existing||typeof existing!=='object'||Array.isArray(existing))throw Error('Expected named Vite entry points');
const outDir=path.join(root,'web-output');
await build({configFile,mode:'production',publicDir:false,build:{outDir,emptyOutDir:true,rollupOptions:{input:{...existing,tactical:path.join(root,'apps/web/tactical-board.html')}}}});
for(const entry of ['index.html','tactical-board.html'])if(!existsSync(path.join(outDir,entry)))throw Error('Missing built entry '+entry);
writeFileSync(path.join(outDir,'build-info.json'),JSON.stringify(${JSON.stringify(metadata)}));
`;
 const digest=`import os,json,hashlib
archive='/tmp/${input.release}.web.tgz'
root='/tmp/${input.release}.web-build/open-world/web-output'
files=0
for parent,dirs,names in os.walk(root):
 for name in dirs+names:
  if os.path.islink(os.path.join(parent,name)):raise RuntimeError('Symlink in web output')
 files+=len(names)
with open(archive,'rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
with open(os.path.join(root,'build-info.json')) as stream:metadata=json.load(stream)
print(json.dumps(dict(metadata,archiveSha256=digest,archiveBytes=os.path.getsize(archive),files=files)))
`;
 const containerCommand='trap \'chown -R "$BUILD_UID:$BUILD_GID" /work\' EXIT; corepack enable; pnpm install --ignore-scripts --frozen-lockfile --store-dir /pnpm/store; node .remote-web-build.mjs';
 return `set -eu
work=/tmp/${input.release}.web-build
test ! -e "$work"
mkdir -p "$work"
cleanup() {
 case "$work" in /tmp/release-*.web-build) rm -rf -- "$work" ;; *) exit 1 ;; esac
}
trap cleanup EXIT
tar -xzf /tmp/${input.release}.web-source.tgz -C "$work"
printf '%s' ${shellQuote(Buffer.from(runner).toString('base64'))} | base64 -d > "$work/open-world/.remote-web-build.mjs"
if ! docker run --rm --cpus=1.5 --memory=1536m \\
 --mount "type=bind,source=$work/open-world,target=/work" \\
 --mount type=volume,source=abyss-staging-web-pnpm,target=/pnpm/store \\
 --workdir /work \\
 --env ELECTRON_SKIP_BINARY_DOWNLOAD=1 --env PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \\
 --env COREPACK_ENABLE_DOWNLOAD_PROMPT=0 --env CI=1 \\
 --env "BUILD_UID=$(id -u)" --env "BUILD_GID=$(id -g)" \\
 node:24-bookworm-slim sh -eu -c ${shellQuote(containerCommand)} > "$work/build.log" 2>&1; then
 tail -n 30 "$work/build.log" >&2
 exit 1
fi
# The activation path uses --unlink-first to break staged hardlinks safely. Archive only
# files: a directory entry would try to unlink the existing, non-empty assets directory.
(cd "$work/open-world/web-output" && find . -type f -print0) > "$work/web-files.list"
tar --no-recursion --null -czf /tmp/${input.release}.web.tgz -C "$work/open-world/web-output" -T "$work/web-files.list"
python3 -c ${shellQuote(digest)}
`;
}
