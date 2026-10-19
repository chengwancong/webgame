// Ingress-only deployment; never restarts the game API or database.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync, rmdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
if (!readFileSync(path.join(root, 'deploy/compose.yaml'), 'utf8').includes('  web-gate:')) {
  throw Error('站点验证已按用户要求停用；不再部署网页验证服务。');
}
const out = 'G:/webgame/aw-deploy', release = 'web-gate-' + Date.now(), artifact = path.join(out, release);
if (process.argv.slice(2).some(x => x !== '--check-only')) throw Error('Only --check-only is supported');
const checkOnly = process.argv.includes('--check-only');
const ssh = 'C:/Program Files/Git/usr/bin/ssh.exe', scp = 'C:/Program Files/Git/usr/bin/scp.exe';
const run = (bin, args, options = {}) => execFileSync(bin, args, { cwd: root, windowsHide: true, stdio: 'inherit', ...options });
const capture = (bin, args) => run(bin, args, { stdio: 'pipe', encoding: 'utf8' }).trim();
const lock = path.join(out, 'deploy-staging.lock');
mkdirSync(out, { recursive: true }); mkdirSync(lock);
writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, release }));
mkdirSync(artifact);
try {
  const files = ['deploy/Caddyfile', 'deploy/compose.yaml', 'deploy/web-gate/Dockerfile', 'deploy/web-gate/page.mjs', 'deploy/web-gate/server.mjs', 'deploy/web-gate/test.mjs', 'deploy/web-gate/router-test.mjs', 'apps/web/src/ui/tokens.css', 'tools/deploy-web-gate.sh'];
  const source = capture('git', ['rev-parse', 'HEAD']);
  if (!checkOnly) {
    for (const file of files) {
      const committed = run('git', ['show', source + ':open-world/' + file], { stdio: 'pipe' });
      if (committed.toString().replaceAll('\r\n', '\n') !== readFileSync(path.join(root, file), 'utf8').replaceAll('\r\n', '\n')) throw Error('Commit gate source before deployment: ' + file);
    }
  }
  writeFileSync(path.join(artifact, 'source.json'), JSON.stringify({ source, release, checkOnly, files: Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(path.join(root, f))).digest('hex')])) }, null, 2));
  const archive = path.join(artifact, 'source.tgz');
  run('tar', ['-czf', archive, ...files]);
  run(scp, [archive, 'abyss-staging:/tmp/' + release + '.tgz']);
  run(scp, [path.join(root, 'tools/deploy-web-gate.sh'), 'abyss-staging:/tmp/' + release + '.sh']);
  const hash = createHash('sha256').update(readFileSync(archive)).digest('hex');
  run(ssh, ['abyss-staging', 'flock -n /home/ubuntu/abyss/.deploy-lock bash /tmp/' + release + '.sh ' + [release, hash, source, checkOnly ? 'check' : 'deploy'].join(' ')]);
  console.log(JSON.stringify({ release, artifact, source, checkOnly }));
} finally { rmSync(path.join(lock, 'owner.json')); rmdirSync(lock); }
