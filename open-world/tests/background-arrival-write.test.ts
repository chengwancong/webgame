import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {World} from '../packages/simulation/index.ts';
import type {Region} from '../packages/content/index.ts';
import {backgroundArrivalWrite} from '../apps/web/src/write-pause-policy.ts';

// Exercise the actual GameApp methods without importing its browser startup.
// Only network, storage and presentation dependencies are fakes; movement uses
// the real World. This is a client contract test, not live server verification.
const source=ts.createSourceFile('main.ts',readFileSync(new URL('../apps/web/src/main.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
const app=source.statements.find((node):node is ts.ClassDeclaration=>ts.isClassDeclaration(node)&&node.name?.text==='GameApp');
if(!app)throw Error('GameApp class not found');
const methods=['write','syncPause'].map(name=>{
 const method=app.members.find((member):member is ts.MethodDeclaration=>ts.isMethodDeclaration(member)&&member.name.getText(source)===name);
 if(!method)throw Error('GameApp method not found: '+name);
 return method.getText(source);
});
const compiled=ts.transpileModule(`class WriteHarness {${methods.join('\n')}}\nreturn WriteHarness;`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
class ApiFailure extends Error{constructor(public code:string,message:string,public status:number){super(message);}}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
type Host={world:World;processing:boolean;backgroundArrival:boolean;blocked:boolean;panel:string;hidden:boolean;userPaused:boolean;activationPending:boolean;loggedIn:boolean;[key:string]:any;write(path:string,body:object,changesBuild?:boolean):Promise<string|undefined>;syncPause():void};

function harness(options:{id?:string;rest?:boolean;permit?:boolean}={}){
 const reply=deferred<any>(),sent=deferred<void>(),api=vi.fn(()=>{sent.resolve();return reply.promise;});
 const makeClass=new Function('backgroundArrivalWrite','api','ApiFailure','forgeWorkingSound','receiptSound','inscriptionSound','forgeFailureSound','resolveTactics',compiled);
 const Harness=makeClass(backgroundArrivalWrite,api,ApiFailure,()=>undefined,()=>undefined,()=>undefined,()=>undefined,()=>undefined) as new()=>Host;
 const host=new Harness();
 const region:Region={id:options.id??'ss-map-port',name:'测试安全场景',subtitle:'',theme:'meadow',boss:false,auto:false,width:40,height:40,safe:{x:10,y:10},portal:{x:15,y:15},landmarks:[],obstacles:[],spawns:[],rest:options.rest};
 const world=new World(region,{hp:100,attack:10,armor:0,speed:6,mana:100,regen:0,effects:[]},[],[]);
 Object.assign(host,{world,processing:false,backgroundArrival:false,blocked:false,panel:'',hidden:false,userPaused:false,activationPending:false,loggedIn:true,authoritativeWorld:false,
  activities:{running:false},dungeons:{locked:false},starsea:{defending:false},result:{context:undefined},pressed:new Set(),permit:options.permit?{id:'test-permit'}:undefined,
  snapshot:{id:'test-character',revision:1,build:1,gear:[],stats:world.stats,resolvedSkills:[]},build:1,lease:'test-lease',panelBusy:false,
  flush:vi.fn(async()=>{}),outbox:{put:vi.fn(async()=>{}),remove:vi.fn(async()=>{})},notice:vi.fn(),noticeError:vi.fn(),refreshGearPanel:vi.fn(),
  syncOverlays:vi.fn(),overlays:{pausesWorld:()=>host.blocked||Boolean(host.panel)},soundGate:{allow:()=>true},productionAudio:{play:vi.fn()},
  applyReceipt:(receipt:any)=>{host.snapshot=receipt.snapshot;},
 });
 world.setMode('semi');world.control(1,0);host.syncPause();
 return{host,api,reply,sent,receipt:()=>({revision:2,snapshot:{...host.snapshot,revision:2},delta:{gold:0,material:0}})};
}
function advance(host:Host){const before={tick:host.world.tick,x:host.world.hero.position.x};for(let i=0;i<6;i++){host.syncPause();host.world.step();}return before;}

describe('safe arrival write keeps walking while preserving the command lock',()=>{
 it('moves during the unresolved request, rejects a second write as busy, and resets after success',async()=>{
  const {host,api,reply,sent,receipt}=harness(),pending=host.write('quest',{op:'arrive'});
  await sent.promise;
  expect(host.processing).toBe(true);expect(host.backgroundArrival).toBe(true);expect(host.world.paused).toBe(false);
  const before=advance(host);expect(host.world.tick).toBe(before.tick+6);expect(host.world.hero.position.x).toBeGreaterThan(before.x);
  expect(await host.write('reward/claim-many',{reward_ids:[]})).toBe('busy');expect(api).toHaveBeenCalledTimes(1);
  expect(host.outbox.put).toHaveBeenCalledTimes(1);expect(host.flush).toHaveBeenCalledTimes(1);
  reply.resolve(receipt());expect(await pending).toBe('success');
  expect(host.processing).toBe(false);expect(host.backgroundArrival).toBe(false);expect(host.world.paused).toBe(false);expect(host.outbox.remove).toHaveBeenCalledTimes(1);
 });
 it('clears the background flag on a rejected command and retains ordinary pause behavior afterward',async()=>{
  const {host,reply,sent}=harness(),pending=host.write('quest',{op:'arrive'});await sent.promise;
  reply.reject(new ApiFailure('QUEST','测试拒绝',409));expect(await pending).toBe('rejected');
  expect(host.processing).toBe(false);expect(host.backgroundArrival).toBe(false);expect(host.blocked).toBe(false);
  host.processing=true;host.syncPause();expect(host.world.paused).toBe(true);
 });
 it('preserves pending-command failure protection when the network fails',async()=>{
  const {host,reply,sent}=harness(),pending=host.write('quest',{op:'arrive'});await sent.promise;
  reply.reject(new ApiFailure('NETWORK','测试断线',0));expect(await pending).toBe('pending');
  expect(host.processing).toBe(false);expect(host.backgroundArrival).toBe(false);expect(host.blocked).toBe(true);expect(host.world.paused).toBe(true);
  expect(host.outbox.remove).not.toHaveBeenCalled();
 });
 it.each([
  {path:'quest',body:{op:'arrive'},options:{id:'ss-map-wind',permit:true}},
  {path:'quest',body:{op:'arrive'},options:{id:'ss-map-port',permit:true}},
  {path:'reward/claim-many',body:{reward_ids:[]},options:{}},
  {path:'quest',body:{op:'start'},options:{}},
 ])('keeps $path / $body paused for a regular write',async({path,body,options})=>{
  const {host,reply,sent,receipt}=harness(options),pending=host.write(path,body);await sent.promise;
  expect(host.processing).toBe(true);expect(host.backgroundArrival).toBe(false);expect(host.world.paused).toBe(true);
  const before=advance(host);expect(host.world.tick).toBe(before.tick);expect(host.world.hero.position.x).toBe(before.x);
  reply.resolve(receipt());await pending;expect(host.processing).toBe(false);expect(host.backgroundArrival).toBe(false);
 });
 it('still honors user pause, hidden page, open panels and activation during a background observation',async()=>{
  const {host,reply,sent,receipt}=harness(),pending=host.write('quest',{op:'arrive'});await sent.promise;
  for(const key of ['userPaused','hidden','activationPending'] as const){host[key]=true;host.syncPause();expect(host.world.paused,key).toBe(true);host[key]=false;}
  host.panel='bag';host.syncPause();expect(host.world.paused).toBe(true);host.panel='';host.syncPause();expect(host.world.paused).toBe(false);
  reply.resolve(receipt());await pending;
 });
});
