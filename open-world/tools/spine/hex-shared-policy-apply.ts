import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {applySpinePlan} from './apply.ts';
import {hexPolicyContentSchema} from '../../packages/content/hex-policy.ts';
const file='packages/content/hex-policy.json',before=JSON.parse(await readFile(file,'utf8')).policy;
assert.equal(before.version,1,'D10 shared protection policy is applied once');
const after={...before,version:2,lethalSaveMinimumTicks:120*30};
console.log(await applySpinePlan('.',[{file,path:['policy'],before,after,basis:'Claude D10 §5.1: lethal-save minimum120s; preserve all existing budgets, invuln600/240 ticks, D13 scale and frozen targets.'}],{[file]:hexPolicyContentSchema},{apply:process.argv.includes('--apply'),output:'docs/reviews/numeric-spine-20261013/HEX-shared-20261021'}));
