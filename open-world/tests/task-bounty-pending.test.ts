import {beforeEach,it,expect,vi} from 'vitest';
const {request}=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('../apps/web/src/network.ts',()=>({api:request}));
import {TaskController} from '../apps/web/src/task-controller.ts';
import {rowKey} from '../apps/web/src/task-model.ts';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',CH='33333333-3333-4333-8333-333333333333';
const entry=(o:Record<string,unknown>)=>({id:'bounty-x',taskId:'bounty-x',typeId:'bounty',typeName:'悬赏',title:'悬赏',state:'ready',abandonable:true,goal:'g',current:0,total:1,summary:null,story:null,area:null,place:null,regionId:null,tags:[],reward:null,goalAt:null,claimedAt:null,chain:null,note:'',source:'current',...o});
function setup(current:unknown[],archive:unknown[],write:(p:string)=>unknown){
 request.mockResolvedValue({characterId:CH,revision:1,ruleset_version:'r',types:[],current,archive});
 const outbox:string[]=[];
 const c=new TaskController({snapshot:()=>({id:CH,revision:1}) as never,blocked:()=>false,processing:()=>false,refresh:()=>{},write:(async(p:string,b:Record<string,string>)=>{const r=await write(p);if(r==='pending')outbox.push(b.instance??b.task);return r;}) as never,pending:async()=>outbox,recover:async()=>{},navigate:()=>{}});
 return c;
}
beforeEach(()=>{request.mockReset();vi.stubGlobal('document',{querySelector:()=>null,activeElement:null});});
it('keeps a pending bounty claim pending after load, without touching a sibling instance',async()=>{
 const c=setup([entry({bountyInstance:A,title:'甲'}),entry({bountyInstance:B,title:'乙'})],[],()=>'pending');await c.load();
 await c.handle('quest-select-task',rowKey(c.data!.current[0]));await c.handle('quest-claim',A);
 expect(c.ui.states[A]).toBe('pending');expect(c.ui.states[B]).toBeUndefined();
 await c.load();expect(c.ui.states[A]).toBe('pending');expect(c.ui.states[B]).toBeUndefined();
});
it('recovers a pending bounty only from the archive row of the same instance',async()=>{
 const old={...entry({bountyInstance:B,state:'archived',title:'旧档'}),source:'archive'};
 const c=setup([entry({bountyInstance:A,title:'甲'})],[old],()=>'pending');await c.load();
 await c.handle('quest-select-task',rowKey(c.data!.current[0]));await c.handle('quest-claim',A);
 expect(c.ui.notice).not.toContain('旧档');
});
it('keeps ordinary task pending behaviour',async()=>{
 const c=setup([entry({id:'t1',taskId:'t1',typeId:'story',title:'普通'})],[],()=>'pending');await c.load();
 await c.handle('quest-select-task','t1');await c.handle('quest-claim','t1');
 expect(c.ui.states.t1).toBe('pending');await c.load();expect(c.ui.states.t1).toBe('pending');
});
