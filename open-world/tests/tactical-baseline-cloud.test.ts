import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {tacticalBaselineArchivePaths,tacticalBaselineRound,tacticalBaselineCloudPlan} from '../tools/tactical-baseline-cloud.ts';
const head='a'.repeat(40),sha256='b'.repeat(64);
describe('isolated tactical cloud measurement command',()=>{
 it('accepts only the two named rounds with no extra arguments or injected paths',()=>{
  expect(tacticalBaselineRound(['--round','initial'])).toBe('initial');expect(tacticalBaselineRound(['--round','validation'])).toBe('validation');
  for(const args of [[],['initial'],['--round','other'],['--round','initial','--force'],['--round','../initial'],['--round','initial; touch /tmp/x']])expect(()=>tacticalBaselineRound(args)).toThrow();
  expect(()=>tacticalBaselineCloudPlan({round:'initial',head:'a;exit',sha256})).toThrow();
  expect(()=>tacticalBaselineCloudPlan({round:'initial',head,sha256:'b\ncommand'})).toThrow();
 });
 it('archives only the committed rules, tactical content, contracts and CLI dependencies',()=>{
  expect(tacticalBaselineArchivePaths).toEqual([
   'open-world/packages/simulation/tactical','open-world/packages/contracts/tactical.ts',
   'open-world/packages/content/tactical-archetypes.json','open-world/packages/content/tactical-graybox.json',
   'open-world/packages/content/tactical-boards.json','open-world/packages/content/tactical-content.ts',
   'open-world/package.json','open-world/tsconfig.json','open-world/tools/tactical-baseline.mjs',
  ]);
 });
 it('uses one isolated source mount and resource limits, checks archive SHA, and never retries or clears markers',()=>{
  const plan=tacticalBaselineCloudPlan({round:'initial',head,sha256}),script=plan.remoteScript;
  expect(plan.work).toBe('/home/ubuntu/abyss/tactical-b1-20261024/initial/open-world');
  expect(script).toContain(`'${sha256}' '${plan.archive}' | sha256sum -c -`);
  expect(script).toContain('--rm --cpus=1 --memory=1024m --network=none --user=0 --entrypoint sh');
  expect(script.match(/--mount/g)).toHaveLength(1);expect(script).toContain(`--mount 'type=bind,src=${plan.work},dst=/work'`);
  expect(script).toContain(`TACTICAL_BASELINE_SOURCE=${head}`);expect(script).toContain('abyss-staging-api:latest');
  expect(script.indexOf(`mkdir '${plan.run}/started'`)).toBeLessThan(script.indexOf('docker run'));
  expect(script).toContain(`test ! -e '${plan.run}/started'`);
  expect(script).not.toMatch(/DATABASE_URL|--env-file|docker compose|(?:^|\n)\s*rm\s|\bwhile\b|\bfor\b/);
  expect(script).not.toContain('/deploy/');expect(script).not.toContain('/data');expect(script).not.toContain('credentials');
 });
 it('copies only the first round summary into validation and retrieves no raw rows',()=>{
  const plan=tacticalBaselineCloudPlan({round:'validation',head,sha256});
  expect(plan.remoteScript).toContain("test -s '/home/ubuntu/abyss/tactical-b1-20261024/initial/open-world/.qa/tactical-b1/baseline/initial-summary.json'");
  expect(plan.remoteScript).toContain(`'${plan.work}/.qa/tactical-b1/baseline/initial-summary.json'`);
  expect(plan.summary).toBe(`${plan.work}/.qa/tactical-b1/baseline/validation-summary.json`);
  const orchestrator=readFileSync(new URL('../tools/tactical-baseline-cloud.mjs',import.meta.url),'utf8');
  expect(orchestrator).not.toMatch(/import\(.*simulation|from .*simulation|chooseTacticalPlan|executeTacticalPlan/);
  expect(orchestrator).toContain('`abyss-staging:${plan.summary}`,summaryPath');expect(orchestrator).not.toContain('-raw.json');
 });
});
