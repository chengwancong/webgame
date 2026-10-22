import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {applySpinePlan} from './apply.ts';
import {challengeContentSchema} from '../../packages/content/progression-challenges.ts';
const file='packages/content/progression-challenges.json',source=JSON.parse(await readFile(file,'utf8'));
assert.equal(source.seasons,undefined,'P28 Q1 schedule applied once');assert.equal(source.season.rewards.length,6);
const next={...source.season,id:'abyss-2027-q1',start:'2027-01-01T00:00:00+08:00',end:'2027-04-01T00:00:00+08:00',rewards:source.season.rewards.map((r:any)=>({...r,id:r.id+'-2027-q1'}))};
console.log(await applySpinePlan('.',[{file,path:['seasons'],before:null,after:[next],op:'add',basis:'Claude P28 next-season default: select by now, 2027Q1 with same names/values and season-suffixed reward IDs; preserve original single-season object and all claim history.'}],{[file]:challengeContentSchema},{apply:process.argv.includes('--apply'),output:'docs/reviews/numeric-spine-20261013/P28-q1-20261021'}));
