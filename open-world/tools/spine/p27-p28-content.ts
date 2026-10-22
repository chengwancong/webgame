import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {applySpinePlan} from './apply.ts';
import {challengeContentSchema} from '../../packages/content/progression-challenges.ts';
const file='packages/content/progression-challenges.json',source=JSON.parse(await readFile(file,'utf8'));
assert.equal(source.season.id,'abyss-2026-q4');assert.equal(source.season.killXp,1,'P28 Q4 content applied once');assert.equal(source.season.bossXp,25);assert.equal(source.season.rewards.length,3);
const season={...source.season,killXp:2,bossXp:40,rewards:[...source.season.rewards,
 {id:'veteran',name:'老练行者',xp:4000,gold:12000,material:800},
 {id:'bounty',name:'悬赏常客',xp:7000,gold:20000,material:1400},
 {id:'legend',name:'深渊传说',xp:12000,gold:36000,material:2400},
]};
assert.deepEqual(season.rewards.slice(0,3),source.season.rewards);
console.log(await applySpinePlan('.',[{file,path:['season'],before:source.season,after:season,basis:'Claude season-expansion-20261021 P28: six thresholds, kill2/boss40/challenge100; approved gold/material fallback; retain Q4 ID/dates and historical claims.'}],{[file]:challengeContentSchema},{apply:process.argv.includes('--apply'),output:'docs/reviews/numeric-spine-20261013/P28-q4-20261021'}));
