import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {remoteWebBuildScript} from '../tools/deploy-remote-web.ts';

const input={release:'release-0123456789ab-1792800000000',head:'0123456789abcdef0123456789abcdef01234567',versions:{client:'0.0.1',protocol:1,rules:'test-1',assets:'v1',db:1}};
const runnerFrom=(script:string)=>{
 const match=script.match(/printf '%s' '([A-Za-z0-9+/=]+)' \| base64 -d/);
 if(!match)throw Error('Missing remote build runner');
 return Buffer.from(match[1],'base64').toString('utf8');
};
describe('source-only remote frontend deployment safeguards',()=>{
 it('rejects shell/path injection before constructing a remote cleanup or build command',()=>{
  for(const release of ['release-../../live','release-0123456789ab-1; reboot','/home/ubuntu/abyss'])expect(()=>remoteWebBuildScript({...input,release})).toThrow('Invalid remote build identity');
  expect(()=>remoteWebBuildScript({...input,head:"'; echo bad; '"})).toThrow('Invalid remote build identity');
 });
 it('limits the build container, disables install scripts and never mounts the live release',()=>{
  const script=remoteWebBuildScript(input);
  expect(script).toContain('--cpus=1.5 --memory=1536m');
  expect(script).toContain('pnpm install --ignore-scripts --frozen-lockfile');
  expect(script).toContain('--env ELECTRON_SKIP_BINARY_DOWNLOAD=1 --env PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1');
  expect(script).toContain('source=$work/open-world,target=/work');
  expect(script).not.toContain('/home/ubuntu/abyss');
  expect(script).not.toContain('.env');
  expect(script).toContain('archiveSha256=digest');
 });
 it('keeps production entry points, adds tactical and never copies a public asset directory',()=>{
  const runner=runnerFrom(remoteWebBuildScript(input));
  expect(runner).toContain("mode:'production'");
  expect(runner).toContain('publicDir:false');
  expect(runner).toContain("input:{...existing,tactical:path.join(root,'apps/web/tactical-board.html')}");
  expect(runner).not.toContain("mode:'qa'");
  expect(runner).toContain("['index.html','tactical-board.html']");
  expect(runner).toContain(JSON.stringify({source:input.head,versions:input.versions,release:input.release}));
 });
 it('keeps the old API running until the candidate image passed its version assertion',()=>{
  const deploy=readFileSync(new URL('../tools/deploy-staging.mjs',import.meta.url),'utf8');
  const build=deploy.indexOf('docker compose build api'),candidate=deploy.indexOf('docker run --rm --entrypoint node'),stop=deploy.indexOf('docker compose stop api');
  expect(build).toBeGreaterThan(-1);
  expect(candidate).toBeGreaterThan(build);
  expect(stop).toBeGreaterThan(candidate);
  expect(deploy).toContain('if [ "$apiStopped" = 1 ] || [ "$switched" = 1 ]; then');
  expect(deploy).toContain("'open-world/pnpm-lock.yaml','open-world/pnpm-workspace.yaml'");
  expect(deploy).toContain('Remote web archive checksum mismatch');
 });
 it('archives regular files only so unlink-first cannot remove a populated assets directory',()=>{
  const script=remoteWebBuildScript(input);
  expect(script).toContain('find . -type f -print0');
  expect(script).toContain('tar --no-recursion --null -czf');
  expect(script).toContain('-T "$work/web-files.list"');
  expect(script).not.toContain('-C "$work/open-world/web-output" .');
 });
});
