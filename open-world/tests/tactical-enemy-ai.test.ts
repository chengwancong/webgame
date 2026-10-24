import {expect,it} from 'vitest';
import {tacticalGraybox} from '../packages/content/tactical-content.ts';
import {applyTacticalAction} from '../packages/simulation/tactical/encounter.ts';
import {executeEnemyIntent,planEnemyIntent,revealEnemyIntents} from '../packages/simulation/tactical/enemy-ai.ts';
import {damage,heroOf,movePower,roundEnd} from '../packages/simulation/tactical/runtime.ts';
import {battle,enemy,resolution} from './tactical-fixtures.ts';

it.each(['melee','swarm'] as const)('%s chases when reachable and loses its attack when the hero escapes',kind=>{
 const s=battle([enemy('m',kind,7,4)]),intent=s.intents[0];expect(intent.type).toBe('chase');expect(intent.damage).toBe(tacticalGraybox.enemies[kind].damage);
 heroOf(s).cell={x:0,y:0};const r=resolution(s);executeEnemyIntent(r,intent);expect(intent.fizzled).toBe(true);expect(heroOf(s).hp).toBe(100);expect(r.events.some(e=>e.type==='intent-fizzled')).toBe(true);
});
it.each(['melee','swarm'] as const)('%s goes around a wall using an actual shortest path',kind=>{
 const s=battle([enemy('m',kind,2,4)]);heroOf(s).cell={x:6,y:4};
 s.board.blocked=[{x:3,y:2},{x:3,y:3},{x:3,y:4},{x:3,y:5},{x:3,y:6},{x:2,y:2},{x:1,y:2},{x:2,y:6},{x:1,y:6}];
 const intent=planEnemyIntent(s,s.units[1],0);expect(intent.destination).not.toEqual(s.units[1].cell);
 expect(intent.destination!.x).toBeLessThanOrEqual(2);expect(intent.type).toBe('move-only');
});
it('ranged locks a visible target and intervening enemies intercept the shot',()=>{
 const s=battle([enemy('r','ranged',8,4),enemy('shield','melee',6,4)]),intent=s.intents.find(i=>i.sourceId==='r')!;
 expect(intent.type).toBe('lock');const r=resolution(s);executeEnemyIntent(r,intent);expect(s.units.find(u=>u.id==='shield')!.hp).toBe(93);expect(heroOf(s).hp).toBe(100);
});
it('ranged retreats instead of firing when adjacent and a wall makes an already revealed lock fizzle',()=>{
 let s=battle([enemy('r','ranged',5,4)]);expect(s.intents[0]).toMatchObject({type:'move-only',reason:'retreat-adjacent'});
 s=battle([enemy('r','ranged',8,4)]);const intent=s.intents[0];s.board.blocked.push({x:6,y:4});executeEnemyIntent(resolution(s),intent);expect(intent.fizzled).toBe(true);
});
it('charger announces a fixed line first and damages the first unit next round',()=>{
 const s=battle([enemy('c','charger',4,1)]);expect(s.intents[0].type).toBe('charge-windup');executeEnemyIntent(resolution(s),s.intents[0]);s.round=2;
 const next=planEnemyIntent(s,s.units[1],0);expect(next.effect).toBe('charge');executeEnemyIntent(resolution(s),next);expect(heroOf(s).hp).toBe(82);expect(s.units[1].cell).toEqual({x:4,y:3});
});
it('charger misses a side-stepping hero, hits the edge and loses next activation to stun',()=>{
 const s=battle([enemy('c','charger',4,1)]);executeEnemyIntent(resolution(s),s.intents[0]);s.round=2;heroOf(s).cell={x:5,y:4};
 executeEnemyIntent(resolution(s),planEnemyIntent(s,s.units[1],0));expect(heroOf(s).hp).toBe(100);s.round=3;
 const stun=planEnemyIntent(s,s.units[1],0);expect(stun).toMatchObject({type:'move-only',move:0,effect:'stun'});const cell={...s.units[1].cell};executeEnemyIntent(resolution(s),stun);expect(s.units[1].cell).toEqual(cell);
});
it('shaman prioritizes the lowest-health ally and heals without exceeding maximum',()=>{
 const s=battle([enemy('s','shaman',8,8),enemy('a','melee',7,7,{hp:5,maxHp:20}),enemy('b','melee',6,7,{hp:8,maxHp:20})]);
 const intent=s.intents.find(i=>i.sourceId==='s')!;expect(intent).toMatchObject({type:'buff',effect:'heal',targetId:'a'});executeEnemyIntent(resolution(s),intent);expect(s.units.find(u=>u.id==='a')!.hp).toBe(15);
});
it('shaman shields a threatened ally, and does not retarget if that ally dies after reveal',()=>{
 const s=battle([enemy('s','shaman',8,8),enemy('a','melee',5,4)]),intent=s.intents.find(i=>i.sourceId==='s')!;
 expect(intent.effect).toBe('shield');s.units.find(u=>u.id==='a')!.hp=0;executeEnemyIntent(resolution(s),intent);expect(intent.fizzled).toBe(true);expect(s.units[1].shield).toBe(0);
});
it('guard protects an exposed ally and front single hits are reduced while areas bypass the formation',()=>{
 const s=battle([enemy('g','guard',6,4),enemy('a','melee',5,4)]);expect(s.intents.find(i=>i.sourceId==='g')!.effect).toBe('protect');
 const ally=s.units.find(u=>u.id==='a')!,r=resolution(s);damage(r,ally,10,'cut',heroOf(s));expect(ally.hp).toBe(95);damage(r,ally,10,'whirl',heroOf(s));expect(ally.hp).toBe(85);
});
it('guard makes only one opportunity attack per round when the hero leaves adjacency',()=>{
 let s=battle([enemy('g','guard',5,4)]);const result=applyTacticalAction(s,{type:'move',to:{x:3,y:4}});s=result.state;
 expect(heroOf(s).hp).toBe(94);expect(result.events.filter(e=>e.cause==='opportunity'&&e.type==='damage')).toHaveLength(1);expect(s.units[1].flags).toContain('opportunity:1');
});
it('artillery marks the announced cells then damages all occupants there including allies',()=>{
 const s=battle([enemy('a','artillery',8,4)]),mark=s.intents[0];expect(mark.effect).toBe('artillery-mark');expect(mark.executeRound).toBe(2);executeEnemyIntent(resolution(s),mark);s.round=2;
 const shot=planEnemyIntent(s,s.units[1],0),landing=shot.cells.find(c=>c.x!==heroOf(s).cell.x||c.y!==heroOf(s).cell.y)!;
 s.units.push(enemy('victim','melee',landing.x,landing.y));executeEnemyIntent(resolution(s),shot);
 expect(heroOf(s).hp).toBe(88);expect(s.units.find(u=>u.id==='victim')!.hp).toBe(88);
});
it('artillery never follows the hero after marking and its empty grid fizzles',()=>{
 const s=battle([enemy('a','artillery',8,4)]);executeEnemyIntent(resolution(s),s.intents[0]);s.round=2;const intent=planEnemyIntent(s,s.units[1],0),cells=structuredClone(intent.cells);
 heroOf(s).cell={x:0,y:0};executeEnemyIntent(resolution(s),intent);expect(intent.cells).toEqual(cells);expect(intent.fizzled).toBe(true);expect(heroOf(s).hp).toBe(100);
});
it('assassin has a hidden movement-only first round and can jump units to the hero rear',()=>{
 const s=battle([enemy('a','assassin',4,8),enemy('block','melee',4,7)]);expect(s.intents.find(i=>i.sourceId==='a')).toMatchObject({type:'move-only',hidden:true});
 s.round=2;const intent=planEnemyIntent(s,s.units[1],0);expect(intent).toMatchObject({type:'chase',damage:15,destination:{x:4,y:5}});executeEnemyIntent(resolution(s),intent);expect(heroOf(s).hp).toBe(85);
});
it('assassin chase fizzles after the hero moves outside its jump reach',()=>{
 const s=battle([enemy('a','assassin',4,8)],{round:2});const intent=s.intents[0];heroOf(s).cell={x:0,y:0};executeEnemyIntent(resolution(s),intent);expect(intent.fizzled).toBe(true);
});
it('summoner summons now but its units only receive intents next round',()=>{
 const s=battle([enemy('s','summoner',8,8)]),intent=s.intents[0];expect(intent.type).toBe('summon');executeEnemyIntent(resolution(s),intent);
 const summoned=s.units.find(u=>u.summonedBy==='s')!;expect(summoned.activeFromRound).toBe(2);revealEnemyIntents(s);expect(s.intents.some(i=>i.sourceId===summoned.id)).toBe(false);
 s.round=2;revealEnemyIntents(s);expect(s.intents.some(i=>i.sourceId===summoned.id)).toBe(true);
});
it('summoner uses a lock curse during cooldown, but cannot curse through a new wall',()=>{
 const s=battle([enemy('s','summoner',7,4,{cooldowns:{summon:3}})]);expect(s.intents[0]).toMatchObject({type:'lock',effect:'curse'});
 s.board.blocked.push({x:6,y:4});executeEnemyIntent(resolution(s),s.intents[0]);expect(s.intents[0].fizzled).toBe(true);expect(heroOf(s).statuses).toEqual([]);
});
it('ordinary encounters downgrade the final damaging intents until forecast is strictly nonfatal',()=>{
 const incoming=tacticalGraybox.enemies.melee.damage;
 const s=battle([enemy('a','melee',5,4),enemy('z','melee',3,4)],{difficulty:'normal'});heroOf(s).hp=2*incoming;const r=resolution(s);revealEnemyIntents(s,r);
 expect(s.intents.find(i=>i.sourceId==='z')).toMatchObject({type:'move-only',damage:0,reason:'lethal-guard'});expect(s.intents[0].damage).toBe(incoming);expect(r.events[0].cause).toBe('lethal-guard');
 s.difficulty='elite';revealEnemyIntents(s);expect(s.intents.every(i=>i.damage===incoming)).toBe(true);
});
it('swift adds two movement and executes before alphabetically earlier ordinary enemies',()=>{
 const s=battle([enemy('a','melee',6,4),enemy('z','melee',8,4,{eliteAffixes:['swift']})]);expect(movePower(s.units[2])).toBe(5);expect(s.intents[0].sourceId).toBe('z');
});
it('frost death telegraphs the surrounding ring and only freezes at the following round end',()=>{
 const s=battle([enemy('f','melee',5,4,{hp:1,maxHp:1,eliteAffixes:['frost_nova']}),enemy('other','melee',9,9)]),r=resolution(s);damage(r,s.units[1],10,'cut',heroOf(s));
 expect(s.zones[0]).toMatchObject({kind:'frost',activeFromRound:2});roundEnd(r);expect(heroOf(s).hp).toBe(100);s.round=2;roundEnd(r);expect(heroOf(s).hp).toBe(96);expect(heroOf(s).statuses.some(t=>t.id==='frozen')).toBe(true);
});
it('fire trail persists for two round ends and damages entry only once per source and movement',()=>{
 let s=battle([enemy('f','melee',7,4,{eliteAffixes:['fire_trail']})]);executeEnemyIntent(resolution(s),s.intents[0]);expect(s.zones.length).toBeGreaterThan(0);expect(s.zones[0].remaining).toBe(2);
 s.units[1].cell={x:9,y:9};s.intents=[];
 const beforeEntry=heroOf(s).hp,entry=applyTacticalAction(s,{type:'move',to:{x:7,y:4}});s=entry.state;
 expect(heroOf(s).hp).toBe(beforeEntry-tacticalGraybox.affixes.fire_trail.damage);
 expect(entry.events.filter(e=>e.type==='damage'&&e.cause==='fire-trail')).toHaveLength(1);
 const r=resolution(s);roundEnd(r);expect(s.zones[0].remaining).toBe(1);roundEnd(r);expect(s.zones).toHaveLength(0);
});
it('summon-minions triggers once at half health, caps at two, and unique identities survive repeat summon calls',()=>{
 const s=battle([enemy('s','melee',6,4,{hp:40,maxHp:40,eliteAffixes:['summon_minions']})]),r=resolution(s);damage(r,s.units[1],20,'whirl',heroOf(s));
 expect(s.units.filter(u=>u.summonedBy==='s')).toHaveLength(2);damage(r,s.units[1],1,'whirl',heroOf(s));expect(s.units.filter(u=>u.summonedBy==='s')).toHaveLength(2);
});
it('teleport affix announces its destination and does not substitute a new one if occupied',()=>{
 const s=battle([enemy('t','melee',5,4,{eliteAffixes:['teleport']})]),intent=s.intents[0];expect(intent.effect).toBe('teleport');const target=intent.destination!;
 s.units.push(enemy('block','melee',target.x,target.y));executeEnemyIntent(resolution(s),intent);expect(intent.fizzled).toBe(true);expect(s.units[1].cell).toEqual({x:5,y:4});
});
it('boss shows a two-round large attack, then a full exhaustion window, phase two and limited summons',()=>{
 let s=battle([enemy('boss','boss',7,4,{hp:130,maxHp:130,phase:1})],{difficulty:'boss'});expect(s.intents[0]).toMatchObject({effect:'boss-mark',tier:'lethal',executeRound:2});
 s=applyTacticalAction(s,{type:'end'}).state;expect(s.round).toBe(2);expect(s.intents[0]).toMatchObject({effect:'boss-blast',damage:45});
 s=applyTacticalAction(s,{type:'end'}).state;expect(heroOf(s).hp).toBe(55);expect(s.round).toBe(3);expect(s.intents[0]).toMatchObject({type:'move-only',reason:'exhausted'});
 const boss=s.units[1],r=resolution(s);damage(r,boss,10,'whirl',heroOf(s));expect(boss.hp).toBe(115);damage(r,boss,40,'whirl',heroOf(s));expect(boss.phase).toBe(2);
 s=applyTacticalAction(s,{type:'end'}).state;expect(s.units.filter(u=>u.summonedBy==='boss')).toHaveLength(1);expect(s.units[1].statuses.some(t=>t.id==='exhausted')).toBe(false);
});
it('enemy planning is independent of RNG and hidden cursor changes',()=>{
 const s=battle([enemy('s','shaman',8,8),enemy('a','melee',5,4)]),a=planEnemyIntent(s,s.units[1],0);s.rngState=0xffffffff;expect(planEnemyIntent(s,s.units[1],0)).toEqual(a);
});
