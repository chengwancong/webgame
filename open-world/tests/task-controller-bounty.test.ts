import {beforeEach,it,expect,vi} from 'vitest';
const {request}=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('../apps/web/src/network.ts',()=>({api:request}));
import {TaskController} from '../apps/web/src/task-controller.ts';
import {rowKey} from '../apps/web/src/task-model.ts';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',CH='33333333-3333-4333-8333-333333333333';
const entry=(o:Record<string,unknown>)=>({id:'bounty-x',taskId:'bounty-x',typeId:'bounty',typeName:'悬赏',title:'悬赏',state:'active',abandonable:true,goal:'g',current:0,total:1,summary:null,story:null,area:null,place:null,regionId:null,tags:[],reward:null,goalAt:null,claimedAt:null,chain:null,note:'',source:'current',...o});
function setup(current:unknown[]){
 const view={characterId:CH,revision:1,ruleset_version:'r',types:[],current,archive:[]};request.mockResolvedValue(view);
 const write=vi.fn().mockResolvedValue('success'),quest=vi.fn().mockResolvedValue(undefined);
 const c=new TaskController({snapshot:()=>({id:CH,revision:1}) as never,blocked:()=>false,processing:()=>false,refresh:()=>{},write,pending:async()=>[],recover:async()=>{},navigate:()=>{},quest});
 return {c,write,quest};
}
beforeEach(()=>{request.mockReset();vi.stubGlobal('document',{querySelector:()=>null,activeElement:null});});
it('abandons a bounty instance through bounty/abandon with its instance, never the quest command',async()=>{
 const {c,write,quest}=setup([entry({bountyInstance:A})]);await c.load();
 await c.handle('quest-abandon',A);
 expect(write).toHaveBeenCalledWith('bounty/abandon',{instance:A});expect(quest).not.toHaveBeenCalled();
});
it('claims a ready bounty through bounty/claim and archives with the usual notice',async()=>{
 const {c,write}=setup([entry({bountyInstance:A,state:'ready',title:'清剿'})]);await c.load();
 await c.handle('quest-select-task',rowKey(c.data!.current[0]));await c.handle('quest-claim',A);
 expect(write).toHaveBeenCalledTimes(1);expect(write).toHaveBeenCalledWith('bounty/claim',{instance:A});
 expect(c.ui.notice).toBe('「清剿」领奖成功，已收入档案。');
});
it('keeps ordinary task claim and abandon paths unchanged',async()=>{
 const {c,write,quest}=setup([entry({id:'t1',taskId:'t1',state:'ready',title:'普通'}),entry({id:'ss-1',taskId:'ss-1',typeId:'story'})]);await c.load();
 await c.handle('quest-select-task','t1');await c.handle('quest-claim','t1');
 expect(write).toHaveBeenCalledWith('task/claim',{task:'t1'});
 await c.handle('quest-abandon','ss-1');expect(quest).toHaveBeenCalledWith('abandon','ss-1');
 expect(write).not.toHaveBeenCalledWith('bounty/abandon',expect.anything());
});
it('keeps two bounty instances of the same task independent',async()=>{
 const {c,write}=setup([entry({bountyInstance:A,state:'active',title:'甲'}),entry({bountyInstance:B,state:'ready',title:'乙'})]);await c.load();
 const [a,b]=c.data!.current;expect(rowKey(a)).not.toBe(rowKey(b));
 await c.handle('quest-select-task',rowKey(b));
 await c.handle('quest-claim',A);expect(write).not.toHaveBeenCalled();
 await c.handle('quest-claim',B);expect(write).toHaveBeenCalledWith('bounty/claim',{instance:B});
 c.ui.states[A]='failed';c.ui.states[B]='pending';
 await c.handle('quest-abandon',A);expect(write).toHaveBeenLastCalledWith('bounty/abandon',{instance:A});
});
