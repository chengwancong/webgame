import {describe,expect,it,vi} from 'vitest';
import {TaskController} from '../apps/web/src/task-controller.ts';
import {taskPanel} from '../apps/web/src/task-panel.ts';
import {rowKey,selectedTask} from '../apps/web/src/task-model.ts';

const base={typeId:'bounty',title:'t',goal:'g',story:'',area:'',place:'',tags:[],chain:[],rewards:[],steps:[]};
const plain={...base,id:'q-plain',taskId:'q-plain',state:'ready',typeId:'main'};
const bounty={...base,id:'b-1',taskId:'b-1',bountyInstance:'inst-9',state:'ready',abandonable:false};

function setup(){
 const write=vi.fn(async()=>'success' as const);
 vi.stubGlobal('document',{querySelector:()=>null,querySelectorAll:()=>[],activeElement:null});
 const c=new TaskController({snapshot:()=>({id:'c1',revision:1}) as never,blocked:()=>false,processing:()=>false,refresh:()=>{},write:write as never,pending:async()=>[],recover:async()=>{},navigate:()=>{}});
 (c as unknown as {owner:string}).owner='c1';
 c.data={characterId:'c1',revision:1,current:[plain,bounty],archive:[],types:[]} as never;
 c.ui.loading=false;
 (c as unknown as {load:()=>Promise<void>}).load=async()=>{};
 return {c,write};
}
const render=(c:TaskController)=>taskPanel({ui:c.ui,data:c.data,snapshot:{id:'c1',revision:1} as never,blocked:false,processing:false});

describe('task selection key',()=>{
 it('render 之后再 claim：选中键保持 rowKey，发出 bounty/claim 且带 instance',async()=>{
  const {c,write}=setup();
  await c.handle('quest-select-task',rowKey(bounty as never));
  let html='';html=render(c);
  expect(c.ui.views.current.selected).toBe('b-1#inst-9');
  expect(selectedTask(c.ui,c.data)).toMatchObject({bountyInstance:'inst-9'});
  expect(html).toContain('aria-selected="true"');
  await c.handle('quest-claim','inst-9');
  expect(write).toHaveBeenCalledWith('bounty/claim',{instance:'inst-9'});
 });
});
