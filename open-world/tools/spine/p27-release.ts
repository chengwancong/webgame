import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {applySpinePlan,type SpineChange} from './apply.ts';
import {challengeContentSchema} from '../../packages/content/progression-challenges.ts';
import {dungeonContentSchema} from '../../packages/content/dungeons.ts';
const file='packages/content/progression-challenges.json',dungeonFile='packages/content/dungeons.json',source=JSON.parse(await readFile(file,'utf8')),dungeons=JSON.parse(await readFile(dungeonFile,'utf8'));
const evidence=JSON.parse(await readFile('C:/Users/ccc/Documents/Codex/2026-10-19/new-chat/outputs/p27-r02-verification.json','utf8'));
assert.equal(evidence.design,'P27 R02 b9b7750d');assert(evidence.curves.every((c:any)=>c.rates[0].rate>=.5),'Tier1 remains a required gate');assert.equal(evidence.monotone,true);
const glass=JSON.parse(await readFile('C:/Users/ccc/Documents/Codex/2026-10-19/new-chat/outputs/p27-r02-glass.json','utf8'));assert(glass.rows.length===3&&glass.rows.every((r:any)=>r.rate>=.3),'Apply the authorized glass attack adjustment before publication');
assert.equal(source.affixes.length,4,'P27 applies once');assert(!source.entries.some((e:any)=>e.id.startsWith('nightmare-')));
const descriptions:Record<string,string>={
 'nightmare-tundra':'1–100 层，冰原守卫在每层吸取你的热量：层数越高，倒下得越快。',
 'nightmare-abyss':'1–100 层，深渊学会重演你的每个招式：层数越高，回击越狠。',
 'nightmare-dragonbone':'1–100 层，龙骨之巅的余烬不熄：层数越高，战场越窄。',
};
const entries=evidence.selected.map((e:any)=>({...e,description:descriptions[e.id]}));assert.equal(entries.length,3);assert(entries.every((e:any)=>e.description));
assert.deepEqual(evidence.affixes.slice(0,4),source.affixes);assert.equal(evidence.affixes.length,8);assert.equal(evidence.nightmare.rewardPerTier,source.nightmare.rewardPerTier);
const entryIds=new Set([...source.entries,...entries].map((e:any)=>e.id));assert.equal(entryIds.size,source.entries.length+3);
const dungeonSchema={parse:(value:unknown)=>{const parsed=dungeonContentSchema.parse(value);assert.equal(new Set(parsed.definitions.map(d=>d.id)).size,parsed.definitions.length,'Duplicate dungeon identity');assert(parsed.definitions.every(d=>!d.challenge||entryIds.has(d.challenge)),'Missing challenge reference');return parsed;}};
const basis='Claude P27 R02 b9b7750d: formal model; permitted maxima after R01 insufficient, residual goal recorded separately; preserve IDs, quota5 and rewardPerTier.';
const changes:SpineChange[]=[{file,path:['nightmare'],before:source.nightmare,after:evidence.nightmare,basis},{file,path:['entries'],before:source.entries,after:[...source.entries,...entries],basis},{file,path:['affixes'],before:source.affixes,after:evidence.affixes,basis}];
for(const [i,e] of entries.entries())changes.push({file:dungeonFile,path:['definitions',dungeons.definitions.length+i],before:null,op:'append',after:{id:e.id,name:e.name,kind:'nightmare',profiles:['simulation','nightmare'],challenge:e.id,policy:{monsterLevel:50,enemyScale:{hp:e.hp,attack:e.attack}}},basis});
console.log(await applySpinePlan('.',changes,{[file]:challengeContentSchema,[dungeonFile]:dungeonSchema},{apply:process.argv.includes('--apply'),output:'docs/reviews/numeric-spine-20261013/P27-R02-20261021'}));
