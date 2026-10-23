import {it,expect} from 'vitest';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {regionById} from '../packages/content/index.ts';
import {World,walkable,findPath} from '../packages/simulation/index.ts';
import {newHubRun,prepareHubRegion,startHubStage,stepHubRuntime,hubPublicState} from '../apps/api/src/hub-dungeon-runtime.ts';
import {hubDungeonPublicSchema} from '../packages/contracts/hub-dungeons.ts';
import {batchSalvageProtected} from '../packages/rules/salvage-batch.ts';
import type {CharacterState,Gear} from '../packages/contracts/index.ts';
it('all wind node monster exits have lightning weakness, frozen story snapshots stay plain',()=>{
 for(const d of dungeonContent.definitions.filter(d=>d.hub?.node.startsWith('wind-'))){const h=newHubRun(d);for(let stage=0;stage<d.stages.length;stage++){
  const r=prepareHubRegion(regionById(d.stages[stage]),d,stage,'z-test',h);for(const e of r.spawns)if(e.monster)expect(e.monster.weakness?.type).toBe('lightning');
  if(d.hub!.kind==='story'){const stats={hp:10000,attack:100,armor:10,speed:6,mana:100,regen:0,effects:[]},w=new World(r,stats,[],[],[],11);w.addPlayer('p',stats,[]);startHubStage(w,d,h);h.choice=h.storyRoutes?.find(route=>route.task===h.storySegments[stage]?.steps[0]?.task)?.id??null;stepHubRuntime(w,d,h,stage,'z-test');for(const e of w.enemies)expect(e.monster?.weakness?.type).toBe('lightning');}
 }for(const e of Object.values(h.storySpawns??{}).flat())expect(e.monster?.weakness).toBeUndefined();}
});
it('cache placement is deterministic/reachable, glints nearby and restores opened state',()=>{
 const d=dungeonContent.definitions.find(d=>d.hub?.node==='wind-nest-1')!,h=newHubRun(d),r=prepareHubRegion(regionById(d.stages[0]),d,0,'one',h),p=h.explore!.stages[0].find(p=>p.kind==='cache')!;expect(p).toBeDefined();expect(walkable(r,p)).toBe(true);expect(findPath(r,r.safe,p).length).toBeGreaterThan(0);
 const again=newHubRun(d);prepareHubRegion(regionById(d.stages[0]),d,0,'two',again);expect(again.explore!.stages[0]).toEqual(h.explore!.stages[0]);const stats={hp:100,attack:12,armor:0,speed:6,mana:100,regen:0,effects:[]},w=new World(r,stats,[],[],[],11);w.addPlayer('p',stats,[]);w.players.get('p')!.hero.position={x:p.x,y:p.y};expect(hubPublicState(w,d,h,0,0,30,'p').explore!.props[0].state).toBe('glint');h.explore!.players.p={caches:['cache:wind-nest-1'],doors:[],keys:[]};expect(hubPublicState(w,d,h,0,0,30,'p').explore!.props[0].state).toBe('opened');expect(()=>hubDungeonPublicSchema.parse(hubPublicState(w,d,h,0,0,30,'p'))).not.toThrow();
});
it('batch salvage protects actual affix nodes, not ranks without nodes',()=>{const s={equipment:{},progression:{weaponGrid:[]}} as unknown as CharacterState,g={id:'x',slot:'helmet',quality:'common',rank:2,locked:false} as Gear;expect(batchSalvageProtected(s,g)).toBe(false);g.affixNode={rank:3,kind:'max'};expect(batchSalvageProtected(s,g)).toBe(true);});
