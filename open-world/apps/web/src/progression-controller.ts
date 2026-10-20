import type {TalentBatchPreview,ProgressionView,ProgressionPreview} from '../../../packages/contracts/deep-progression.ts';
import {api} from './network.ts';

export type ProgressionUI={view?:ProgressionView;section:string;item:string;operation:string;query?:string;preview?:ProgressionPreview;maxPreview?:TalentBatchPreview;summaryOpen?:boolean;resetConfirm?:{id:string;revision:number};loading:boolean;previewLoading:boolean;busy:boolean;message:string;error:string;status:''|'success'|'pending';};
type Write=(path:string,body:object,changesBuild?:boolean)=>Promise<'success'|'rejected'|'pending'|'busy'|undefined>;

/** Page drafts contain only selection; prices and effective builds belong to the API. */
export class ProgressionController{
 readonly ui:ProgressionUI={section:'',item:'',operation:'',loading:false,previewLoading:false,busy:false,message:'',error:'',status:''};
 private generation=0;
 /** visible：当前分组里玩家看得到的分区；未开放的分区（如未解锁的武器盘）不能被默认选中，否则报价对不上面板显示的条目，费用块一直“读取中…”（Grok BUG-88）。 */
 constructor(private refresh:()=>void,private write:Write,private blocked:()=>boolean,private visible:()=>readonly string[]=()=>[]){}
 async load(){
  if(this.ui.loading)return;this.generation++;this.ui.preview=undefined;this.ui.previewLoading=false;this.ui.loading=true;this.ui.error='';this.refresh();
  try{this.ui.view=await api<ProgressionView>('progression');const allowed=this.visible(),pool=allowed.length?this.ui.view.sections.filter(s=>allowed.includes(s.id)):this.ui.view.sections,section=pool.find(s=>s.id===this.ui.section)??pool[0];this.ui.section=section?.id??'';this.ui.item=section?.items.find(i=>i.id===this.ui.item)?.id??section?.items[0]?.id??'';await this.preview();}
  catch(e){this.ui.error=e instanceof Error?e.message:'养成信息读取失败。';}
  finally{this.ui.loading=false;this.refresh();}
 }
 async handle(action:string,id:string):Promise<boolean>{
  if(!action.startsWith('progression-'))return false;
  if(action==='progression-max'){const q=this.ui.maxPreview;if(!q?.enabled||q.target!==this.ui.item||q.revision!==this.ui.view?.revision||this.ui.busy||this.ui.previewLoading||this.ui.status==='pending'||this.blocked())return true;this.ui.busy=true;this.ui.error='';this.ui.message='正在保存批量天赋…';this.refresh();try{const result=await this.write('progression/talents/max',{target:q.target,expected_count:q.count},true);this.ui.status=result==='pending'?'pending':result==='success'?'success':'';this.ui.message=result==='success'?'已投入 '+q.count+' 点天赋。':result==='pending'?'请恢复连接后核对这次批量投入。':'操作未提交，请重新预览。';if(result!=='pending')await this.load();}catch(error){this.ui.error=error instanceof Error?error.message:'批量投入未能确认。';}finally{this.ui.busy=false;this.refresh();}return true;}
  if(action==='progression-summary'){this.ui.summaryOpen=true;this.refresh();return true;}
  if(action==='progression-summary-close'){this.ui.summaryOpen=false;this.refresh();return true;}
  if(action==='progression-reset-cancel'){this.ui.resetConfirm=undefined;this.refresh();return true;}
  if(action==='progression-refresh'){const [section,item]=id.split(':');if(section&&this.ui.view?.sections.some(s=>s.id===section)){this.ui.section=section;this.ui.item=item??'';this.ui.operation='';}await this.load();return true;}
  if(action==='progression-section'){
   const section=this.ui.view?.sections.find(s=>s.id===id);if(!section)return true;
   this.ui.section=id;this.ui.query='';this.ui.item=section.items[0]?.id??'';this.ui.operation='';this.ui.message='';await this.preview();return true;
  }
  if(action==='progression-item'){const section=this.ui.view?.sections.find(s=>s.id===this.ui.section),spec=section?.items.every(i=>i.tier!==undefined&&i.state!==undefined&&(i.tier===0||i.rank!==undefined&&i.max!==undefined&&i.effects!==undefined))?section.items.find(i=>i.tier===0):undefined;this.ui.item=spec&&spec.state!=='learned'?spec.id:id;this.ui.operation='';this.ui.message='';await this.preview();return true;}
  if(action==='progression-operation'){this.ui.operation=id;await this.preview();return true;}
  if(action==='progression-run'){
   if(this.ui.busy||this.ui.loading||this.ui.status==='pending'||this.blocked())return true;
   const previous=this.ui.operation;this.ui.operation=id;
   if(this.selectedOperation()?.id!==id)return true;
   if(previous!==id||!this.ui.preview){const pending=this.preview(),generation=this.generation;await pending;if(generation!==this.generation||this.ui.operation!==id)return true;}
   const operation=this.selectedOperation();
   if(operation?.action.op==='talent.reset'&&this.ui.preview?.enabled){this.ui.resetConfirm={id,revision:this.ui.view!.revision};this.refresh();return true;}
   return this.handle('progression-confirm',id);
  }
  if(action==='progression-reset-confirm'){
   const confirmation=this.ui.resetConfirm;
   if(!confirmation||confirmation.id!==id||confirmation.revision!==this.ui.view?.revision||this.ui.operation!==id)return true;
   this.ui.resetConfirm=undefined;return this.handle('progression-confirm',id);
  }
  if(action==='progression-confirm'){
   const operation=this.selectedOperation(),quote=this.ui.preview;
   if(!operation||!operation.enabled||id&&operation.id!==id||!quote?.enabled||this.ui.busy||this.ui.status==='pending'||this.blocked()||this.ui.previewLoading||quote.revision!==this.ui.view?.revision||JSON.stringify(quote.action)!==JSON.stringify(operation.action))return true;
   this.ui.busy=true;this.ui.message='正在保存成长…';this.ui.error='';this.ui.status='';this.refresh();
   try{const result=await this.write('progression/action',{action:quote.action},true);this.ui.status=result==='pending'?'pending':result==='success'?'success':'';this.ui.message=result==='pending'?'请恢复连接后查看这次操作的结果。':result==='success'?(this.blocked()?'成长已保存，请恢复连接后继续战斗。':'成长已保存。'):'操作未提交，请核对最新条件。';if(result!=='pending')await this.load();}
   catch(e){this.ui.error=e instanceof Error?e.message:'操作未能确认，请刷新后核对。';this.ui.preview=undefined;}
   finally{this.ui.busy=false;this.refresh();}return true;
  }
  return true;
 }
 selectedOperation(){const item=this.ui.view?.sections.find(s=>s.id===this.ui.section)?.items.find(i=>i.id===this.ui.item);return item?.operations.find(o=>o.id===this.ui.operation)??item?.operations.find(o=>o.enabled&&o.action.op!=='talent.reset')??item?.operations[0];}
 private async preview(){
  const generation=++this.generation,operation=this.selectedOperation();this.ui.preview=undefined;this.ui.maxPreview=undefined;this.ui.error='';this.ui.operation=operation?.id??'';this.ui.previewLoading=Boolean(operation?.enabled);this.refresh();
  if(!operation?.enabled)return;
  try{const quote=await api<ProgressionPreview>('progression/preview',{revision:this.ui.view?.revision,action:operation.action});const max=operation.action.op==='talent.learn'?await api<TalentBatchPreview>('progression/talents/max-preview',{revision:this.ui.view?.revision,target:operation.action.target}).catch(()=>undefined):undefined;if(generation===this.generation){this.ui.maxPreview=max;this.ui.preview=quote;if(quote.revision!==this.ui.view?.revision)this.ui.error='角色状态已更新，请刷新养成信息后继续。';}}
  catch(e){if(generation===this.generation)this.ui.error=e instanceof Error?e.message:'所需材料未能读取，请重试。';}
  finally{if(generation===this.generation){this.ui.previewLoading=false;this.refresh();}}
 }
}
