import {sourceVersion} from './source-version.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import {challengeContent} from '../packages/content/progression-challenges.ts';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {measureDungeon} from './dungeon-model.ts';
import {dirname} from 'node:path';
import {campaignCharacter} from './campaign-model.ts';
import {makeGear,resolveBuild,ensureProgression,gearBases} from '../packages/rules/index.ts';
import {versions,type CharacterState,type GearAffix} from '../packages/contracts/index.ts';
function build(level:number,progressed:boolean):CharacterState{
 const s=campaignCharacter('melee');s.level=level;s.skills=['cut','whirl','ward','mend'];s.skillRanks=Object.fromEntries(s.skills.map(id=>[id,progressed?5:3]));s.progress.regions=['town','meadow','forest','rift','tundra','abyss','dragonbone'];
 for(const g of s.gear)g.rank=progressed?5:3;
 if(progressed){
  const charm=makeGear(3,'charm'),shield=makeGear(5,'shield');s.gear.push(charm,shield);s.equipment.accessory=charm.id;s.equipment.core=shield.id;
  const affix=(stat:string,value:number):GearAffix=>({id:stat,name:stat,stat,value,tier:2,description:stat});
  s.gear[0].affixes=[affix('attack',8),affix('critChance',.05)];s.gear[1].affixes=[affix('armor',7),affix('hp',40)];charm.affixes=[affix('attack',8),affix('mana',20)];shield.affixes=[affix('hp',40),affix('lifesteal',.04)];
  for(const g of s.gear)g.quality='rare';
  const grid=Array.from({length:8},(_,i)=>makeGear(i%2,'grid-'+i));s.gear.push(...grid);const p=ensureProgression(s);p.weaponGrid=[s.gear[0].id,...grid.map(g=>g.id)];for(const g of s.gear.filter(g=>g.slot==='weapon'))p.weapons[g.id]={level:20,uncap:0};
 }
 return s;
}
function developed(){const s=build(50,true),p=ensureProgression(s);for(const [i,id] of p.weaponGrid.entries()){const g=s.gear.find(g=>g.id===id)!;const base=i%2?'omega-bow':'omega-blade',template=gearBases.find(b=>b.base===base)!;Object.assign(g,{base,attack:template.attack,armor:0,effect:template.effect,quality:'rare'});p.weapons[g.id]={level:75,uncap:2};}return s;}
const quick=process.argv.includes('--quick'),seeds=quick?[11]:[11,41,97],sourceBefore=await sourceVersion();
const rows=[];for(const seed of seeds)for(const d of challengeContent.entries.filter(d=>!quick||d.kind!=='raid')){
 for(const progressed of [false,true]){
  const s=build(d.level,progressed),tiers=d.kind==='nightmare'?(quick?[1,50,100]:[1,10,25,50,100]):[1];
  for(const tier of tiers){const party=d.kind==='raid'?Array.from({length:20},(_,i)=>({state:build(d.level,progressed),role:(i<2?'tank':i<6?'healer':'damage') as 'tank'|'healer'|'damage'})):undefined;
   const definition=dungeonContent.definitions.find(x=>x.challenge===d.id&&x.mode==='simulation')!;const result=measureDungeon(definition,party?.map(p=>p.state)??[s],tier,seed);rows.push({seed,id:d.id,tier,progressed,won:result.success,seconds:result.seconds,hp:result.actors.reduce((n,a)=>n+a.hp,0),stages:result.stages,reason:result.reason,actors:result.actors});
  }
 }
}
const nightmare=challengeContent.entries.find(d=>d.id==='nightmare')!;
const developedTiers=process.argv.includes('--all-tiers')?Array.from({length:100},(_,i)=>i+1):[1,10,25,50,100];
for(const seed of seeds)for(const tier of developedTiers){const result=measureDungeon(dungeonContent.definitions.find(x=>x.id==='nightmare')!,[developed()],tier,seed);rows.push({seed,id:nightmare.id,tier,progressed:true,developed:true,won:result.success,seconds:result.seconds,hp:result.actors[0].hp,stages:result.stages,reason:result.reason,actors:result.actors});}
const report={versions,source:sourceBefore,sourceAfter:await sourceVersion(),seeds,fixtures:{base:'Entry level, starter weapon/coat reinforced +3, four rank-3 skills; no RNG bonuses.',progressed:'Entry level, weapon/coat +5, four rank-5 skills, charm and shield, 2 moderate tier-2 affixes per slot, nine ordinary grid weapons Lv20 with zero uncaps. No omega/primal, talents or awakening.',developed:'Lv50; same moderate rare equipment, nine omega grid weapons Lv75/two uncaps. No primal, talents or awakening. Nightmare only.',stats:resolveBuild(build(50,true)).stats,developedStats:resolveBuild(developed()).stats},limits:'Controlled legal build fixtures, not a claim about acquisition time, human difficulty or twenty-person coordinated play. Independent actors, frozen builds, shared targets, carry-over HP/mana/cooldowns, API goal semantics and rescue rules; definition time limits, not the legacy aggregate model. Nightmare samples 1/10/25/50/100.',rows};
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'../docs/reviews/open-world/balance-audit-20261003/endgame.json';await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify({samples:rows.length,developedNightmareWins:rows.filter(r=>'developed' in r&&r.developed&&r.won).length,developedNightmareSamples:developedTiers.length*seeds.length,challengeProgressed:rows.filter(r=>r.progressed&&!('developed' in r)&&r.id!=='nightmare').map(r=>({id:r.id,seed:r.seed,win:r.won,seconds:r.seconds,stages:r.stages}))},null,2));
