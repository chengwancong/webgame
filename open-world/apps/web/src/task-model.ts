import type {TaskEntry,TaskType,TaskView} from '../../../packages/contracts/tasks.ts';
export type TaskMode='current'|'archive';
export type TaskDisplay=Omit<TaskEntry,'state'>&{state:TaskEntry['state']|'pending'|'failed'};
export type TaskFilter={type:string;query:string;status:string;sort:string;selected:string;positions:Record<string,{top:number;left:number}>;listPositions:Record<string,number>};
export type TaskUI={mode:TaskMode;picker:boolean;pickerScroll:number;typeSearch:string;loading:boolean;busy:boolean;busyTask:string;notice:string;error:string;lastTask:string;states:Record<string,'pending'|'failed'>;views:Record<TaskMode,TaskFilter>};
export function initialTaskUI():TaskUI{const filter=():TaskFilter=>({type:'all',query:'',status:'all',sort:'recent',selected:'',positions:{},listPositions:{}});return {mode:'current',picker:false,pickerScroll:0,typeSearch:'',loading:false,busy:false,busyTask:'',notice:'',error:'',lastTask:'',states:{},views:{current:filter(),archive:filter()}};}
export function currentTasks(ui:TaskUI,data?:TaskView):TaskDisplay[]{return (data?.current??[]).map(row=>({...row,state:ui.states[row.taskId]??row.state}));}
export function taskRows(ui:TaskUI,data?:TaskView):TaskDisplay[]{
 const view=ui.views[ui.mode];let rows:TaskDisplay[]=ui.mode==='archive'?[...data?.archive??[]]:currentTasks(ui,data);
 if(view.type!=='all')rows=rows.filter(row=>row.typeId===view.type);
 const search=view.query.trim().toLocaleLowerCase();if(search)rows=rows.filter(row=>[row.title,row.goal,row.story,row.area,row.place,...row.tags].filter(Boolean).join(' ').toLocaleLowerCase().includes(search));
 if(ui.mode==='current'&&view.status!=='all')rows=rows.filter(row=>view.status==='ready'?['ready','failed'].includes(row.state):row.state===view.status);
 if(ui.mode==='archive')rows.sort((a,b)=>view.sort==='title'?a.title.localeCompare(b.title,'zh'):view.sort==='oldest'?(a.claimedAt??'').localeCompare(b.claimedAt??''):(b.claimedAt??'').localeCompare(a.claimedAt??''));
 if(ui.mode==='current')rows.sort((a,b)=>(a.series??'zz').localeCompare(b.series??'zz')||Number(a.state==='available')-Number(b.state==='available'));
 return rows;
}
export function selectedTask(ui:TaskUI,data?:TaskView){const rows=taskRows(ui,data);return rows.find(row=>row.id===ui.views[ui.mode].selected)??rows[0];}
export function visibleTaskTypes(ui:TaskUI,data?:TaskView):TaskType[]{const rows=ui.mode==='archive'?data?.archive??[]:data?.current??[],types=[...data?.types??[]];for(const row of rows)if(!types.some(t=>t.id===row.typeId))types.push({id:row.typeId,name:row.typeName,enabled:false,order:999,tone:'neutral',icon:'diamond'});return types.filter(type=>type.enabled||rows.some(row=>row.typeId===type.id)).sort((a,b)=>a.order-b.order);}
export function taskListKey(ui:TaskUI){const v=ui.views[ui.mode];return JSON.stringify([v.type,v.query,v.status,v.sort]);}
