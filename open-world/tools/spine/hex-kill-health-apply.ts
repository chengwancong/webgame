import {applySpinePlan} from './apply.ts';
import {hexPolicyContentSchema} from '../../packages/content/hex-policy.ts';
// Semantic version boundary only. No tuning values or frozen v1/v2 snapshots change.
console.log(await applySpinePlan('.',[{file:'packages/content/hex-policy.json',path:['policy','version'],before:2,after:3,basis:'D10 section3.1: HEX kill conditions use pre-lethal health; confirmed full-health one-shot false-positive. Preserve frozen v1/v2 execution.'}],{'packages/content/hex-policy.json':hexPolicyContentSchema},{apply:process.argv.includes('--apply'),output:'docs/reviews/numeric-spine-20261013/HEX-KILL-HEALTH-20261021'}));
