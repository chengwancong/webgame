import type {Snapshot,TaskView} from '../../../packages/contracts/index.ts';
import {api} from './network.ts';
import {initialTaskUI,selectedTask,taskRows,type TaskMode,type TaskUI} from './task-model.ts';
import {taskPanel} from './task-panel.ts';
import {syncMarkup} from './task-dom.ts';
import {stageBox} from './stage.ts';
type Write=(path:string,body:object)=>Promise<'success'|'rejected'|'pending'|'busy'|undefined>;
type Dependencies={snapshot:()=>Snapshot|undefined;blocked:()=>boolean;processing:()=>boolean;refresh:()=>void;write:Write;pending:()=>Promise<string[]>;recover:()=>Promise<void>;navigate:(region:string)=>void;quest?:(op:'track'|'abandon',task:string|null)=>Promise<unknown>};
export class TaskController{
 ui:TaskUI=initialTaskUI();data?:TaskView;private owner='';private generation=0;private requestedRevision=-1;
 constructor(private deps:Dependencies){}
 private ensureOwner(){const id=this.deps.snapshot()?.id??'';if(id!==this.owner){this.owner=id;this.generation++;this.ui=initialTaskUI();this.ui.loading=true;this.data=undefined;}return id;}
 sync(){const s=this.deps.snapshot();if(s&&(s.id!==this.owner||this.requestedRevision!==s.revision&&!this.ui.loading))void this.load();}
 async load(){const owner=this.ensureOwner();if(!owner)return;const generation=++this.generation;this.requestedRevision=this.deps.snapshot()!.revision;this.ui.loading=true;this.ui.error='';this.deps.refresh();
  try{let [data,pending]=await Promise.all([api<TaskView>('tasks'),this.deps.pending()]);if(data.revision<(this.deps.snapshot()?.revision??0))data=await api<TaskView>('tasks');
   if(generation!==this.generation||owner!==this.deps.snapshot()?.id)return;
   if(data.characterId!==owner||data.revision<(this.deps.snapshot()?.revision??0))throw Error('任务状态已更新，请重新读取。');
   const recovered=data.archive.find(row=>this.ui.states[row.taskId]==='pending');if(recovered){this.ui.lastTask=recovered.taskId;this.ui.notice=`「${recovered.title}」领奖已确认，已收入档案。`;}this.data=data;const states:TaskUI['states']={};for(const row of data.current){if(pending.includes(row.taskId))states[row.taskId]='pending';else if(this.ui.states[row.taskId]==='failed'&&row.state==='ready')states[row.taskId]='failed';}this.ui.states=states;
  }catch(error){if(generation===this.generation)this.ui.error=error instanceof Error?error.message:'任务信息读取失败。';}
  finally{if(generation===this.generation){this.ui.loading=false;this.deps.refresh();}}
 }
 captureDom(){const root=document.querySelector<HTMLElement>('.task-window');if(!root)return;
  const list=root.querySelector<HTMLElement>('.task-list');if(list){const view=this.ui.views[list.dataset.listView as TaskMode];if(view)view.listPositions[list.dataset.listKey!]=list.scrollTop;}
  const workspace=root.querySelector<HTMLElement>('.desk-workspace');if(workspace){const view=this.ui.views[workspace.dataset.view as TaskMode];if(view)workspace.querySelectorAll<HTMLElement>('[data-scroll]').forEach(node=>{view.positions[workspace.dataset.taskKey+':'+node.dataset.scroll]={top:node.scrollTop,left:node.scrollLeft};});}
  const picker=root.querySelector<HTMLElement>('.type-picker-list');if(picker)this.ui.pickerScroll=picker.scrollTop;
 }
 private restoreDom(host:HTMLElement){const list=host.querySelector<HTMLElement>('.task-list');if(list)list.scrollTop=this.ui.views[list.dataset.listView as TaskMode].listPositions[list.dataset.listKey!]??0;
  const workspace=host.querySelector<HTMLElement>('.desk-workspace');if(workspace){const view=this.ui.views[workspace.dataset.view as TaskMode];workspace.querySelectorAll<HTMLElement>('[data-scroll]').forEach(node=>{const p=view.positions[workspace.dataset.taskKey+':'+node.dataset.scroll];node.scrollTop=p?.top??0;node.scrollLeft=p?.left??0;});}
  const picker=host.querySelector<HTMLElement>('.type-picker-list');if(picker)picker.scrollTop=this.ui.pickerScroll;
 }
 render(host:HTMLElement){this.ensureOwner();this.captureDom();const active=host.contains(document.activeElement)?document.activeElement as HTMLElement:null,caret=active instanceof HTMLInputElement&&active.type==='search'?active.selectionStart:null;
  const focus=active?{id:active.id,action:active.dataset.action,value:active.dataset.id}:undefined;
  host.classList.add('open');syncMarkup(host,taskPanel({ui:this.ui,data:this.data,snapshot:this.deps.snapshot(),blocked:this.deps.blocked(),processing:this.deps.processing()}));this.restoreDom(host);
  const target=active?.isConnected?active:focus?.id?host.querySelector<HTMLElement>('#'+focus.id):focus?Array.from(host.querySelectorAll<HTMLElement>('[data-action]')).find(n=>n.dataset.action===focus.action&&n.dataset.id===focus.value):undefined;
  target?.focus({preventScroll:true});if(caret!==null&&target instanceof HTMLInputElement&&target.type==='search')target.setSelectionRange(caret,caret);
 }
 input(input:HTMLInputElement|HTMLSelectElement){if(!input.closest('.task-window'))return false;this.captureDom();const view=this.ui.views[this.ui.mode];
  if(input.id==='task-search'){view.query=input.value;view.selected='';}
  else if(input.id==='type-search'){this.ui.typeSearch=input.value;this.ui.pickerScroll=0;const list=document.querySelector<HTMLElement>('.type-picker-list');if(list)list.scrollTop=0;}
  else if(input.id==='archive-sort')view.sort=input.value;else return false;
  this.deps.refresh();return true;
 }
 outside(target:EventTarget|null){if(this.ui.picker&&target instanceof Element&&!target.closest('.type-picker,.type-trigger')){this.captureDom();this.ui.picker=false;document.querySelector('.task-window .type-picker')?.remove();document.querySelector('.task-window .type-trigger')?.setAttribute('aria-expanded','false');}}
 async handle(action:string,id:string){this.captureDom();const view=this.ui.views[this.ui.mode];
  if(action==='quest-select-task'){if(!taskRows(this.ui,this.data).some(row=>row.id===id))return;view.selected=id;this.ui.notice='';}
  else if(action==='quest-mode'){if(!['current','archive'].includes(id))return;this.ui.mode=id as TaskMode;this.ui.picker=false;this.ui.notice='';}
  else if(action==='quest-toggle-types'){this.ui.picker=!this.ui.picker;this.ui.typeSearch='';this.deps.refresh();document.querySelector<HTMLInputElement>('.task-window #type-search')?.focus({preventScroll:true});return;}
  else if(action==='quest-type'){view.type=id;view.selected='';this.ui.picker=false;}
  else if(action==='quest-status'){if(!['all','available','active','ready','pending'].includes(id))return;view.status=id;view.selected='';}
  else if(action==='quest-reset-filters'){view.type='all';view.query='';view.status='all';view.selected='';}
  else if(action==='quest-refresh'){await this.load();return;}
  else if(action==='quest-track'||action==='quest-untrack'||action==='quest-abandon'){if(this.deps.processing()||this.deps.blocked())return;await this.deps.quest?.(action==='quest-abandon'?'abandon':'track',action==='quest-untrack'?null:id);await this.load();return;}
  else if(action==='quest-claim'){await this.claim(id);return;}
  else if(action==='quest-recover'){await this.deps.recover();await this.load();return;}
  else if(action==='quest-navigate'){const item=selectedTask(this.ui,this.data);if(item?.regionId===id)this.deps.navigate(id);return;}
  else if(action==='quest-chain'||action==='quest-last-archive'){const taskId=action==='quest-last-archive'?this.ui.lastTask:id;const archived=this.data?.archive.find(r=>r.taskId===taskId),row=archived??this.data?.current.find(r=>r.taskId===taskId);if(!row)return;this.ui.mode=archived?'archive':'current';Object.assign(this.ui.views[this.ui.mode],{type:row.typeId,query:'',status:'all',selected:row.id});}
  else return;
  this.deps.refresh();if(action==='quest-type')document.querySelector<HTMLElement>('.task-window .type-trigger')?.focus({preventScroll:true});
 }
 private async claim(id:string){const selected=selectedTask(this.ui,this.data),record=this.data?.current.find(row=>row.taskId===id);
  if(this.ui.mode!=='current'||selected?.taskId!==id||record?.state!=='ready'||this.ui.busy||this.ui.loading||this.deps.blocked()||this.deps.processing())return;
  this.ui.busy=true;this.ui.busyTask=id;this.ui.error='';this.ui.notice='正在领取任务奖励…';this.deps.refresh();
  try{const outcome=await this.deps.write('task/claim',{task:id});if(outcome==='success'){delete this.ui.states[id];this.ui.lastTask=id;this.ui.notice=`「${record.title}」领奖成功，已收入档案。`;}
   else if(outcome==='pending'){this.ui.states[id]='pending';this.ui.notice='领取结果待确认，请核对后继续。';}
   else if(outcome!=='busy'){this.ui.states[id]='failed';this.ui.notice='领取未成功，正在核对最新任务状态。';}
   await this.load();
  }catch(error){this.ui.error=error instanceof Error?error.message:'任务领奖结果需要核对。';}
  finally{this.ui.busy=false;this.ui.busyTask='';this.deps.refresh();}
 }
 keydown(event:KeyboardEvent){if(!(event.target instanceof Element)||!event.target.closest('.task-window'))return false;
  if(event.key==='Escape'&&this.ui.picker){event.preventDefault();this.captureDom();this.ui.picker=false;this.deps.refresh();document.querySelector<HTMLElement>('.task-window .type-trigger')?.focus({preventScroll:true});return true;}
  if(event.target.closest('.desk-modes')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const mode=event.key==='Home'?'current':event.key==='End'?'archive':this.ui.mode==='current'?'archive':'current';void this.handle('quest-mode',mode);document.querySelector<HTMLElement>(`.task-window [data-mode="${mode}"]`)?.focus({preventScroll:true});return true;}
  if(!event.target.closest('.task-list')||!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return false;
  event.preventDefault();const rows=taskRows(this.ui,this.data),at=rows.findIndex(row=>row.id===this.ui.views[this.ui.mode].selected),index=event.key==='Home'?0:event.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,at+(event.key==='ArrowDown'?1:-1)));if(!rows[index])return true;
  void this.handle('quest-select-task',rows[index].id);const button=Array.from(document.querySelectorAll<HTMLElement>('.task-list-row')).find(n=>n.dataset.id===rows[index].id),list=document.querySelector<HTMLElement>('.task-list');button?.focus({preventScroll:true});
  if(button&&list){const r=stageBox(button),box=stageBox(list);if(r.top<box.top)list.scrollTop-=box.top-r.top;if(r.bottom>box.bottom)list.scrollTop+=r.bottom-box.bottom;this.captureDom();}return true;
 }
}
