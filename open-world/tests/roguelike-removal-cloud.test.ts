import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {removalArchiveAllowed,removalCloudPhase,removalCloudPlan,removalCloudStatusCommand,validateRemovalManifest} from '../tools/roguelike-removal-cloud.ts';

const head='a'.repeat(40),sha256='b'.repeat(64);
describe('removal cloud orchestration',()=>{
 it('accepts only derive or verify and rejects injection/tuning/apply flags',()=>{
  expect(removalCloudPhase(['--phase','derive'])).toBe('derive');expect(removalCloudPhase(['--phase','verify'])).toBe('verify');
  for(const args of [[],['derive'],['--phase','derive','--apply'],['--phase','../verify'],['--phase','verify; exit']])expect(()=>removalCloudPhase(args)).toThrow();
  expect(()=>removalCloudPlan({phase:'derive',head:'bad;touch',sha256})).toThrow();
 });
 it('allows required committed sources while excluding public/artifacts/images/secrets and saves',()=>{
  for(const path of ['open-world/tools/spine/cli.ts','open-world/assets/numerics/world-stage-timing.json','open-world/packages/content/dungeons.json','open-world/config/excel/节奏目标.xlsx','open-world/apps/api/src/hub-dungeon-runtime.ts','open-world/deploy/Dockerfile','open-world/.dockerignore'])expect(removalArchiveAllowed(path),path).toBe(true);
  for(const path of ['open-world/apps/web/src/main.ts','open-world/apps/web/public/art/third-party/tile.png','open-world/packages/content/icon.svg','open-world/tools/credentials.json','open-world/tools/.env','open-world/tools/archive.dump','open-world/tools/run.sqlite','open-world/tools/.runtime/state.json','open-world/.qa/raw.json','open-world/docs/reviews/old/result.json','open-world/packages/../secret'])expect(removalArchiveAllowed(path),path).toBe(false);
 });
 it('runs the real pnpm spine command in one networkless limited worker without database access',()=>{
  const plan=removalCloudPlan({phase:'derive',head,sha256}),s=plan.remoteScript;
  expect(s).toContain('docker build --target dependencies --tag abyss-spine-removal-worker');
  expect(s).toContain('--rm --cpus=1 --memory=1536m --network=none --user=0');
  expect(s.match(/--mount/g)).toHaveLength(2);expect(s).toContain(`src=${plan.work},dst=/work`);
  expect(s.indexOf('pnpm spine:check --help')).toBeLessThan(s.indexOf('Permanent phase marker'));
  expect(s).toContain('pnpm spine:check --roguelike-removal=derive --out=.runtime/roguelike-removal-20261024');
  expect(s).toContain('AW_SPINE_SOURCE_COMMIT='+head);expect(s).toContain('/app/node_modules/.bin/tsx');
  expect(s).toContain('export PATH=/app/node_modules/.bin:/tsx/node_modules/.bin:$PATH');
  expect(s).not.toMatch(/AW_DATABASE_URL|--env-file|docker compose|--apply/);
  expect(s).toContain('sha256sum -c -');expect(s).toContain('path.open(');
 });
 it('preserves derive output while overlaying verification source and blocks previously started phases',()=>{
  const plan=removalCloudPlan({phase:'verify',head,sha256}),s=plan.remoteScript;
  expect(s).toContain(`test ! -e '${plan.marker}'`);expect(s).toContain("verify-started.json'");
  for(const name of ['removal-plan.json','derive-summary.json','player-points.json'])expect(s).toContain(`test -s '${plan.output}/${name}'`);
  expect(s).toContain('tar -xzf');expect(s).not.toMatch(/(?:^|\n)\s*(rm|mv)\s/);
  expect(s).toContain('Permanent phase marker');expect(s).toContain('flock -n 9');
 });
 it('validates exact summary filenames/source/hash and permits retrieval without rerunning',()=>{
  const manifest={status:'complete',phase:'derive',commit:head,archiveSha256:sha256,files:['removal-plan.json','derive-summary.json','player-points.json'].map(name=>({name,sha256,bytes:1}))};
  expect(validateRemovalManifest(manifest,'derive',head)).toEqual(manifest);
  expect(()=>validateRemovalManifest({...manifest,files:[{name:'raw/all.json',sha256,bytes:1}]},'derive')).toThrow();
  expect(()=>validateRemovalManifest({...manifest,commit:'c'.repeat(40)},'derive',head)).toThrow();
  const status=removalCloudStatusCommand('verify');expect(status).not.toContain('pnpm');expect(status).not.toContain('docker');
  const source=readFileSync(new URL('../tools/roguelike-removal-cloud.mjs',import.meta.url),'utf8');
  expect(source.indexOf("if(status.status==='complete')")).toBeLessThan(source.indexOf("git(['read-tree',head])"));
  expect(source).not.toContain("from './spine/roguelike-removal");expect(source).toContain("G:/webgame/aw-deploy/roguelike-removal-20261024");
 });
});
