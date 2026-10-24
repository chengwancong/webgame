import {it,expect} from 'vitest';
import {removalScale,removalTarget,assertDungeonOnlyChanges,parseRemovalArgs,removalModelBasis,removalModelTarget,repairRemovalModelPlan} from '../tools/spine/roguelike-removal.ts';
import type {DungeonDefinition} from '../packages/contracts/dungeons.ts';
import {standardLevels,standardState,resolvePlayer} from '../tools/spine/player.ts';
import spineTargets from '../config/json/spine-targets.json';
import frozenEfficiency from '../tools/spine/roguelike-removal-basis.json';
import {sha} from '../tools/spine/io.ts';

const canonicalBasis=()=>removalModelBasis(spineTargets.targets,frozenEfficiency.boss.map(row=>row.eta),{});
const calibration={targetSeconds:{normal:70,trial:60,high:90,nightmare:60,raid:180},raidSupportWeight:.3,bossEfficiency:.75};
const modelPoints=[{level:1,D1:50,EHP:1000,hp:100,failures:[]},{level:5,D1:100,EHP:2000,hp:200,failures:[]}];
it('uses canonical stage1 level 2.626432512970688 and retained six-boss eta with original integer target rounding',()=>{
 const basis=canonicalBasis();expect(basis.stageLevels['1']).toBe(2.626432512970688);expect(basis.eta).toBe(0.7335055971815823);
 const definition={kind:'normal',numericStage:1,policy:{party:{roles:{}}}} as DungeonDefinition;
 const target=removalModelTarget(definition,4,modelPoints,calibration,basis);
 expect(target).toMatchObject({modelLevel:2.626432512970688,actualLevel:3,desiredHp:3403,desiredDps:44});
 expect(target.efficiency.status).toBe('retained historical S5 efficiency; not freshly measured');
});
it('leaves the legacy player level, .75 efficiency and nonrounded targets unchanged',()=>{
 const definition={kind:'high',policy:{party:{roles:{}}}} as DungeonDefinition;
 const target=removalModelTarget(definition,4,modelPoints,calibration,canonicalBasis());
 expect(target).toMatchObject({modelLevel:4,actualLevel:4,target:{bossSeconds:90,ttdSeconds:30,party:1},efficiency:{value:.75}});
 expect(target.desiredHp).toBeCloseTo(5676.050802962573,8);expect(target.desiredDps).toBeCloseTo(56.0597610169143,8);
});
it('repairs only canonical stage arithmetic from stored observations, preserving the original inputs and every legacy row',()=>{
 const before={definitions:[{id:'stage',kind:'normal',numericStage:1,policy:{enemyScale:{hp:2,attack:3}}},{id:'legacy',kind:'high',policy:{enemyScale:{hp:2,attack:3}}}]};
 const points=standardLevels.map(level=>({level,D1:level*50,EHP:level*1000,hp:100,failures:[]}));
 const rows=[{dungeon:'stage',hard:false,level:4,before:{hp:2,attack:3},after:{hp:4,attack:6},bossHp:1000,basis:{rawDps:100,hits:20},desiredHp:2000,desiredDps:200},{dungeon:'legacy',hard:false,level:4,before:{hp:2,attack:3},after:{hp:4,attack:6},bossHp:1000,basis:{rawDps:100,hits:20},desiredHp:2000,desiredDps:200}];
 const original={kind:'roguelike-removal-v1' as const,protectedHashes:{},beforeHash:sha(JSON.stringify(before)),afterHash:'old-invalid-plan',changes:[],points,rows,failures:[]},snapshot=structuredClone(original);
 const corrected=repairRemovalModelPlan(original,before,canonicalBasis(),calibration,{});
 expect(original).toEqual(snapshot);expect(corrected.points).toEqual(original.points);expect(corrected.rows[0].basis).toEqual(rows[0].basis);expect(corrected.rows[1]).toEqual(rows[1]);
 expect(corrected.rows[0].modelLevel).toBe(2.626432512970688);expect(()=>assertDungeonOnlyChanges(corrected.changes)).not.toThrow();
 expect(()=>repairRemovalModelPlan(corrected,before,canonicalBasis(),calibration,{})).toThrow('Already canonical');
});

it('all thirteen authored standard players have the exact requested legal skill set before measurement',()=>{
 expect(standardLevels).toHaveLength(13);
 for(const level of standardLevels){
  const state=standardState(level),player=resolvePlayer('input-check-'+level,state);
  expect(player.build.skills.map(skill=>skill.id)).toEqual(state.skills);
  expect(player.build.skills.length).toBeGreaterThan(0);expect(player.build.stats.hp).toBeGreaterThan(0);
  expect(player).not.toHaveProperty('augments');
 }
});

it('derives dungeon HP and attack once from measured bases without an in-run power multiplier',()=>{
 expect(removalScale({hp:10,attack:10},100,100,80,100/1.1)).toEqual({hp:8,attack:9.1});
 expect(()=>removalScale({hp:10,attack:10},100,0,80,90)).toThrow();
 expect(()=>removalScale({hp:10,attack:10},100,100,NaN,90)).toThrow();
});
it('keeps authored legacy durations and the numeric-stage 70-second / 30-second threat targets',()=>{
 const calibration={targetSeconds:{normal:70,trial:60,high:90,nightmare:60,raid:180},raidSupportWeight:.3};
 const high={kind:'high',policy:{party:{roles:{}}}} as DungeonDefinition;
 expect(removalTarget(high,calibration)).toEqual({bossSeconds:90,ttdSeconds:30,party:1});
 expect(removalTarget({...high,numericStage:1},calibration)).toEqual({bossSeconds:70,ttdSeconds:30,party:1});
 const raid={kind:'raid',policy:{party:{roles:{damage:2,support:1}}}} as unknown as DungeonDefinition;
 expect(removalTarget(raid,calibration)).toEqual({bossSeconds:180,ttdSeconds:30,party:2.3});
});
it('permits only the two dungeon multiplier leaves even when the plan writes a whole definition',()=>{
 const before={id:'owned',reward:{gold:5},policy:{enemyScale:{hp:10,attack:5,hpPerStage:.1,attackPerStage:.2}},hardmode:{monsterLevel:40,enemyScale:{hp:2,attack:3}}};
 const after=structuredClone(before);after.policy.enemyScale.hp=8;after.hardmode.enemyScale.attack=2;
 const change={file:'packages/content/dungeons.json',path:['definitions',0],before,after,basis:'unit derivation'};
 expect(()=>assertDungeonOnlyChanges([change])).not.toThrow();
 for(const mutate of [(d:typeof before)=>{d.reward.gold=6;},(d:typeof before)=>{d.policy.enemyScale.hpPerStage=.2;},(d:typeof before)=>{d.hardmode.monsterLevel=41;}]){
  const altered=structuredClone(after);mutate(altered);expect(()=>assertDungeonOnlyChanges([{...change,after:altered}])).toThrow();
 }
 expect(()=>assertDungeonOnlyChanges([{...change,file:'packages/content/monsters.json'}])).toThrow();
 expect(()=>assertDungeonOnlyChanges([{...change,path:['definitions',0,'policy']}])).toThrow();
});
it('rejects extra measurement rounds, arbitrary tuning switches and historical output directories',()=>{
 expect(parseRemovalArgs(['--roguelike-removal=derive','--out=.qa/roguelike-removal-20261024']).phase).toBe('derive');
 expect(parseRemovalArgs(['--roguelike-removal=verify','--out=docs/reviews/roguelike-removal-20261024/run']).phase).toBe('verify');
 for(const args of [
  ['--roguelike-removal=derive','--out=docs/reviews/numeric-spine-20261013/S5'],
  ['--roguelike-removal=third','--out=.qa/roguelike-removal-20261024'],
  ['--roguelike-removal=verify','--out=.qa/roguelike-removal-20261024','--apply'],
  ['--roguelike-removal=derive','--out=.qa/roguelike-removal-20261024','--out=.qa/roguelike-removal-other'],
 ])expect(()=>parseRemovalArgs(args)).toThrow();
});
