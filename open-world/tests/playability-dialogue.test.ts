import {afterEach,it,expect,vi} from 'vitest';
import {StarseaController} from '../apps/web/src/starsea-controller.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById,starterSkills} from '../packages/content/index.ts';
import {newStarseaState,applyStarseaOp,recordStarseaKill,starseaView} from '../packages/rules/starsea.ts';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import type {CharacterState,Snapshot} from '../packages/contracts/index.ts';
import {taskById,dialogueLines} from '../packages/content/task-tables.ts';
afterEach(()=>vi.unstubAllGlobals());
it('arrival opening is not repeated at the actual registration NPC; progress still exposes the normal completion action',()=>{
 const gear=makeGear(0,crypto.randomUUID()),s:CharacterState={id:crypto.randomUUID(),name:'对白演出样本',revision:0,build:1,level:3,xp:0,gold:0,material:0,gear:[gear],equipment:{weapon:gear.id},skills:[...starterSkills],skillRanks:Object.fromEntries(starterSkills.map(id=>[id,1])),progress:{kills:0,regions:['ss-map-wind','ss-map-port'],bosses:[],safe:'ss-map-wind',tasks:[]},starsea:newStarseaState()};
 for(const spawn of applyStarseaOp(s,'start',{region:'ss-map-wind'}).spawns)recordStarseaKill(s,'ss-map-wind',spawn.id,false);
 applyStarseaOp(s,'waypoint',{region:'ss-map-wind',target:'ow-wind-wp2'});applyStarseaOp(s,'talk',{region:'ss-map-wind',task:'ss-c01-n01'});
 const storage=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)});
 const snapshot={...s,starseaView:starseaView(s)} as unknown as Snapshot,w=new World(regionById('ss-map-port'),resolveBuild(s).stats,[],[]);
 const controller=new StarseaController({snapshot:()=>snapshot,world:()=>w,settle:async()=>{},write:async()=>undefined,travel:async()=>false,open:()=>{},refresh:()=>{},notice:()=>{},lastError:()=>'',ensurePermit:async()=>{},service:()=>{},panel:()=>''});controller.talkNpc='ss-npc-cheng';
 const host={innerHTML:'',classList:{add:()=>{}}} as unknown as HTMLElement;
 controller.renderTalk(host);expect(host.innerHTML).toContain('1 / 3');expect(host.innerHTML).toContain('从光里掉下来的');
 storage.set('aw-starsea-seen:'+s.id,JSON.stringify(['accept:ss-c01-t02']));
 // A new session reload consumes the same per-character presentation state.
 const resumed=new StarseaController({snapshot:()=>snapshot,world:()=>w,settle:async()=>{},write:async()=>undefined,travel:async()=>false,open:()=>{},refresh:()=>{},notice:()=>{},lastError:()=>'',ensurePermit:async()=>{},service:()=>{},panel:()=>''});resumed.talkNpc='ss-npc-cheng';resumed.renderTalk(host);
 expect(host.innerHTML).toContain('把刻片放上登记台');expect(host.innerHTML).not.toContain('从光里掉下来的');expect(host.innerHTML).not.toContain('1 / 3');expect(host.innerHTML).toContain('完成对话');expect(s.starsea!.done).not.toContain('ss-c01-t02');
 for(const id of ['ss-c01-t02','ss-c01-n01'])expect(dialogueLines(taskById.get(id)!.dialog_progress!)).toHaveLength(1);
});
