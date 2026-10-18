import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {StarseaController} from '../apps/web/src/starsea-controller.ts';
import {TaskController,taskRefreshMs} from '../apps/web/src/task-controller.ts';
import {StoryController,storyRefreshMs} from '../apps/web/src/story-controller.ts';
import {api} from '../apps/web/src/network.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById,starterSkills} from '../packages/content/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {starseaMap} from '../packages/content/starsea/index.ts';
import {newStarseaState,starseaView} from '../packages/rules/starsea.ts';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import type {CharacterState,Snapshot} from '../packages/contracts/index.ts';
import type {DungeonController} from '../apps/web/src/dungeon-controller.ts';
vi.mock('../apps/web/src/network.ts',()=>({api:vi.fn()}));
const mockedApi=vi.mocked(api);
let clock=100000;
beforeEach(()=>{clock=100000;vi.spyOn(Date,'now').mockImplementation(()=>clock);vi.spyOn(performance,'now').mockImplementation(()=>clock);mockedApi.mockReset();});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
const character=():CharacterState=>{const gear=makeGear(0,crypto.randomUUID());return {id:crypto.randomUUID(),name:'请求频率样本',revision:0,build:1,level:3,xp:0,gold:0,material:0,gear:[gear],equipment:{weapon:gear.id},skills:[...starterSkills],skillRanks:Object.fromEntries(starterSkills.map(id=>[id,1])),progress:{kills:0,regions:['ss-map-wind','ss-map-port'],bosses:[],safe:'ss-map-wind',tasks:[]},starsea:newStarseaState()};};

it('星潮海到达：同一分区内换格子限频，进新分区立即上报',async()=>{
 const region='ss-map-wind',landmarks=starseaMap(region).landmarks,clear=(p:{x:number;y:number})=>landmarks.every(l=>Math.hypot(l.x-p.x,l.y-p.y)>3);
 const zones=worldTables.zones.filter(z=>z.region===region&&z.rect.w>=20);expect(zones.length).toBeGreaterThan(1);
 const inside=(z:typeof zones[number])=>{for(let y=z.rect.y+1;y<z.rect.y+z.rect.h-1;y++)for(let x=z.rect.x+1;x+9<z.rect.x+z.rect.w;x++){const a={x,y},b={x:x+9,y};if(clear(a)&&clear(b))return [a,b];}};
 const [a,b]=inside(zones[0])!,other=inside(zones.find(z=>z.id!==zones[0].id&&inside(z))!)![0];
 const s=character(),snapshot={...s,starseaView:starseaView(s)} as unknown as Snapshot,w=new World(regionById(region),resolveBuild(s).stats,[],[]);
 const storage=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)});
 const arrivals:object[]=[];
 const controller=new StarseaController({snapshot:()=>snapshot,world:()=>w,settle:async()=>{},write:async(path:string,body:{op?:string})=>{if(path==='quest'&&body.op==='arrive')arrivals.push(body);return 'success';},travel:async()=>false,open:()=>{},refresh:()=>{},notice:()=>{},lastError:()=>'',ensurePermit:async()=>{},service:()=>{},panel:()=>''});
 const at=async(p:{x:number;y:number},ms=0)=>{clock+=ms;w.hero.position={...p};controller.step();await flush();};
 await at(a);expect(arrivals).toHaveLength(1);
 await at(b,1000);await at(a,1000);expect(arrivals).toHaveLength(1);
 await at(b,15000);expect(arrivals).toHaveLength(2);
 await at(other,100);expect(arrivals).toHaveLength(3);
});

it('任务与主线跟随版本刷新：每轮上报换版本号时至多每 2 秒读一次，同轮不连读两次',async()=>{
 let revision=1,lag=0;const id=crypto.randomUUID(),snapshot=()=>({id,revision} as unknown as Snapshot);
 mockedApi.mockImplementation(async path=>(String(path).startsWith('story')?{revision:revision-lag}:{characterId:id,revision:revision-lag,current:[],archive:[]}) as never);
 const tasks=new TaskController({snapshot,blocked:()=>false,processing:()=>false,refresh:()=>{},write:async()=>'success',pending:async()=>[],recover:async()=>{},navigate:()=>{}});
 const story=new StoryController({snapshot,world:()=>({}) as World,dungeons:{} as DungeonController,write:async()=>undefined,open:()=>{},refresh:()=>{},notice:()=>{},service:()=>{},skill:()=>{}});
 const calls=(p:string)=>mockedApi.mock.calls.filter(c=>c[0]===p).length;
 // 首次（换角色）立即读取。
 tasks.sync();story.sync();await flush();expect(calls('tasks')).toBe(1);expect(calls('story')).toBe(1);expect(tasks.data).toBeDefined();expect(story.data).toBeDefined();
 // 6 秒内每 180ms 刷一次界面、每 1.1 秒一轮上报换版本号；读回的结果总比快照旧一档，也不在同一轮里补读第二次。
 lag=1;const start=clock;let next=start+1100;while(clock<start+6000){clock+=180;if(clock>=next){revision++;next+=1100;}tasks.sync();story.sync();await flush();}
 expect(calls('tasks')).toBeLessThanOrEqual(1+Math.ceil(6000/taskRefreshMs));expect(calls('story')).toBeLessThanOrEqual(1+Math.ceil(6000/storyRefreshMs));
 expect(calls('tasks')).toBeGreaterThan(1);expect(calls('story')).toBeGreaterThan(1);
});
