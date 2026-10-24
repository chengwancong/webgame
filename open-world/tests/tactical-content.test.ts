import {describe,expect,it} from 'vitest';
import archetypes from '../packages/content/tactical-archetypes.json';
import graybox from '../packages/content/tactical-graybox.json';
import boards from '../packages/content/tactical-boards.json';
import monsters from '../packages/content/monsters.json';
import eliteAffixes from '../packages/content/elite-affixes.json';
import {parseTacticalContent,tacticalArchetypes,tacticalBoardById,tacticalBoards,tacticalBoardThreat,tacticalContent,tacticalEnemyKinds,tacticalGraybox} from '../packages/content/tactical-content.ts';
import {tacticalPath} from '../packages/simulation/tactical/board.ts';
import {applyTacticalAction,createTacticalEncounter} from '../packages/simulation/tactical/encounter.ts';

const fixture=()=>structuredClone({archetypes,graybox,boards});
describe('tactical authored content boundaries',()=>{
 it('has five wind boards and resolves every existing monster kind and elite affix',()=>{
  expect(parseTacticalContent(fixture())).toEqual(tacticalContent);
  expect(tacticalBoards.map(board=>board.difficulty)).toEqual(['normal','normal','normal','elite','boss']);
  for(const kind of new Set(monsters.templates.map(monster=>monster.kind)))expect(tacticalEnemyKinds).toContain(kind);
  for(const affix of Object.keys(eliteAffixes))expect(tacticalGraybox.affixes).toHaveProperty(affix);
  expect(tacticalEnemyKinds).toContain('swarm');
  expect(tacticalBoardById.size).toBe(5);
 });
 it('provides two four-skill graybox heroes without formal skill coefficients',()=>{
  for(const hero of tacticalGraybox.heroes){
   expect(hero.skillIds).toHaveLength(4);
   expect(hero.skillIds).toContain(hero.basicSkillId);
   expect(tacticalGraybox.skills[hero.basicSkillId].cooldown).toBe(0);
  }
  expect(tacticalGraybox.skills.cut.damage).toBe(tacticalGraybox.skills.throwing_knife.damage);
  const malformed=fixture();
  Object.assign(malformed.graybox.skills.cut,{coefficient:9});
  expect(()=>parseTacticalContent(malformed)).toThrow();
 });
 it('keeps threat budgets and the explicit swarm-majority exception bounded',()=>{
  for(const board of tacticalBoards){
   const threat=tacticalBoardThreat(board,tacticalArchetypes);
   if(board.difficulty==='normal'){expect(threat).toBeGreaterThanOrEqual(6);expect(threat).toBeLessThanOrEqual(9);}
   if(board.difficulty==='elite'){expect(threat).toBeGreaterThanOrEqual(10);expect(threat).toBeLessThanOrEqual(14);}
  }
  const swarm=tacticalBoardById.get('wind-swarm')!;
  expect(swarm.enemies).toHaveLength(6);
  expect(swarm.enemies.filter(enemy=>enemy.kind==='swarm')).toHaveLength(4);
  expect(new Set(swarm.enemies.map(enemy=>enemy.kind)).size).toBe(2);
  const malformed=fixture();
  delete (malformed.boards.boards[2] as {countException?:string}).countException;
  expect(()=>parseTacticalContent(malformed)).toThrow('enemy count');
 });
 it('puts authored burst origins within the hero first move under shared movement rules',()=>{
  for(const board of tacticalBoards.filter(board=>board.difficulty==='normal')){
   expect(tacticalPath({...board,occupied:board.enemies.map(enemy=>enemy.cell)},board.heroSpawn,board.burstOrigin!,tacticalGraybox.hero.move)).not.toBeNull();
   expect(board.burstGroup!.every(id=>board.enemies.some(enemy=>enemy.id===id))).toBe(true);
  }
 });
 it('hits every authored burst member with one real opening whirlwind after moving',()=>{
  for(const board of tacticalBoards.filter(board=>board.difficulty==='normal')){
   const initial=createTacticalEncounter({battleId:'content-'+board.id,boardId:board.id,heroId:'sword',seed:1});
   const moved=applyTacticalAction(initial,{type:'move',to:board.burstOrigin!});
   const result=applyTacticalAction(moved.state,{type:'skill',skillId:board.burstSkill!});
   const hits=new Set(result.events.filter(event=>event.type==='damage'&&event.sourceId==='hero').map(event=>event.targetId));
   for(const id of board.burstGroup!)expect(hits.has(id)).toBe(true);
  }
 });
 it('rejects enemy spawns inside obstacles, duplicate spawns and disconnected islands',()=>{
  const blocked=fixture();blocked.boards.boards[0].blocked.push({...blocked.boards.boards[0].enemies[0].cell});
  expect(()=>parseTacticalContent(blocked)).toThrow('Blocked tactical spawn');
  const duplicate=fixture();duplicate.boards.boards[0].enemies[1].cell={...duplicate.boards.boards[0].enemies[0].cell};
  expect(()=>parseTacticalContent(duplicate)).toThrow('Duplicate tactical');
  const disconnected=fixture();
  disconnected.boards.boards[0].enemies[0].cell={x:0,y:0};
  disconnected.boards.boards[0].blocked.push({x:0,y:1},{x:1,y:0});
  expect(()=>parseTacticalContent(disconnected)).toThrow('Unreachable tactical spawn');
 });
 it('rejects unknown kinds, invalid threat budgets and missing burst references',()=>{
  const unknown=fixture();unknown.boards.boards[0].enemies[0].kind='unregistered';
  expect(()=>parseTacticalContent(unknown)).toThrow();
  const threat=fixture();threat.archetypes.archetypes.melee.threat=20;
  expect(()=>parseTacticalContent(threat)).toThrow('threat outside');
  const member=fixture();member.boards.boards[0].burstGroup=['blade-a','missing'];
  expect(()=>parseTacticalContent(member)).toThrow('Unknown tactical burst member');
 });
 it('rejects duplicate board identity, duplicate skills and unsupported affixes',()=>{
  const ids=fixture();ids.boards.boards[1].id=ids.boards.boards[0].id;
  expect(()=>parseTacticalContent(ids)).toThrow('Duplicate tactical board ID');
  const skills=fixture();skills.graybox.heroes[0].skillIds[1]=skills.graybox.heroes[0].skillIds[0];
  expect(()=>parseTacticalContent(skills)).toThrow('Duplicate tactical sword skill');
  const affix=fixture();affix.boards.boards[3].enemies[0].eliteAffixes=['unknown-affix'];
  expect(()=>parseTacticalContent(affix)).toThrow();
 });
 it('requires a single affix carrier on elite and a single boss on boss boards',()=>{
  const elite=fixture();elite.boards.boards[3].enemies[1].eliteAffixes=['swift'];
  expect(()=>parseTacticalContent(elite)).toThrow('one tactical elite affix carrier');
  const boss=fixture();delete (boss.boards.boards[4].enemies[0] as {boss?:boolean}).boss;
  expect(()=>parseTacticalContent(boss)).toThrow('one tactical boss');
 });
 it('requires complete DOT and poison-zone data',()=>{
  const poison=fixture();delete (poison.graybox.skills.venom_needle as {dotTicks?:number}).dotTicks;
  expect(()=>parseTacticalContent(poison)).toThrow('Incomplete tactical DOT');
  const zone=fixture();delete (zone.graybox.skills.toxic_bomb as {duration?:number}).duration;
  expect(()=>parseTacticalContent(zone)).toThrow('Incomplete tactical zone');
 });
});
