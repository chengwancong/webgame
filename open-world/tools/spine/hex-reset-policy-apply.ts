import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {applySpinePlan} from './apply.ts';
import {hexPolicyContentSchema} from '../../packages/content/hex-policy.ts';
const file='packages/content/hex-policy.json',before=JSON.parse(await readFile(file,'utf8')).policy;
assert.equal(before.version,2);assert.equal(before.resetSecondaryScale,undefined,'Apply reset policy once');
console.log(await applySpinePlan('.',[{file,path:['policy'],before,after:{...before,resetSecondaryScale:.5},basis:'Claude D10 §5.1 and D13 §9 clarified 2026-10-21: subsequent different cooldown-reset item in the same tick grants half, floored; keep all other targets.'}],{[file]:hexPolicyContentSchema},{apply:process.argv.includes('--apply'),output:'docs/reviews/numeric-spine-20261013/HEX-reset-20261021'}));
