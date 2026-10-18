import type {ProgressionPreview,ProgressionView,Snapshot,SalvageBatchPreview} from '../../../packages/contracts/index.ts';
import {api} from './network.ts';
import {initialBagDraft,type BagDraft,type TonicId,tonicDefinitions} from './bag-model.ts';

export type BagUI=BagDraft&{metadata?:ProgressionView;loading:boolean;warehouseOpen?:boolean;warehousePage?:number;quote?:ProgressionPreview;quoteTarget:string;quoteCharacter:string;quoteLoading:boolean;batch?:SalvageBatchPreview;batchOwner?:string;batchLoading?:boolean;busy:boolean;message:string;error:string;status:''|'success'|'pending'};
type Write=(path:string,body:object,changesBuild?:boolean)=>Promise<'success'|'rejected'|'pending'|'busy'|undefined>;
export class BagController{
 readonly ui:BagUI={...initialBagDraft(),loading:false,quoteTarget:'',quoteCharacter:'',quoteLoading:false,busy:false,message:'',error:'',status:''};
 private generation=0;
 constructor(private snapshot:()=>Snapshot|undefined,private refresh:()=>void,private write:Write,private blocked:()=>boolean){}
 async previewBatch(){
  if(this.ui.batchLoading||this.blocked())return;const owner=this.snapshot()?.id;this.ui.batchLoading=true;this.ui.batch=undefined;this.ui.error='';this.refresh();
  try{const quote=await api<SalvageBatchPreview>('gear/salvage-batch/preview');if(owner!==this.snapshot()?.id)return;if(quote.revision!==this.snapshot()?.revision)throw Error('库存已更新，请重新预览。');this.ui.batchOwner=owner;this.ui.batch=quote;}
  catch(e){this.ui.error=e instanceof Error?e.message:'分解清单读取失败。';}
  finally{this.ui.batchLoading=false;this.refresh();}
 }
 cancelBatch(){this.ui.batch=undefined;this.refresh();}
 async salvageBatch(){
  const quote=this.ui.batch,s=this.snapshot();if(!quote?.gear.length||!s||this.ui.busy||this.blocked())return;
  if(this.ui.batchOwner!==s.id||quote.revision!==s.revision){this.ui.batch=undefined;this.ui.error='库存已更新，请重新预览并确认。';this.refresh();return;}
  this.ui.busy=true;this.refresh();
  try{const result=await this.write('gear/salvage-batch',{gear_ids:quote.gear.map(g=>g.id)});this.ui.batch=undefined;this.ui.status=result==='pending'?'pending':result==='success'?'success':'';this.ui.message=result==='success'?`已分解 ${quote.gear.length} 件装备，获得 ${quote.material} 强化石。请主动重新开启全自动。`:result==='pending'?'分解结果待确认，请恢复连接核对库存。':'分解未提交，请重新预览。';}
  finally{this.ui.busy=false;this.refresh();}
 }
 async load(){
  if(this.ui.loading)return;const owner=this.snapshot()?.id;this.ui.loading=true;this.ui.error='';this.refresh();
  try{const metadata=await api<ProgressionView>('progression');if(owner===this.snapshot()?.id)this.ui.metadata=metadata;}
  catch(error){this.ui.error=error instanceof Error?error.message:'道具信息读取失败。';}
  finally{this.ui.loading=false;this.refresh();}
  await this.previewSelected();
 }
 async select(key:string){this.ui.selected=key;if(this.ui.status!=='pending'){this.ui.message='';this.ui.status='';}this.ui.error='';await this.previewSelected();}
 async previewSelected(){
  const generation=++this.generation,snapshot=this.snapshot(),target=this.ui.selected.startsWith('tonic:')?this.ui.selected.slice(6):'';
  this.ui.quote=undefined;this.ui.quoteTarget=target;this.ui.quoteCharacter=snapshot?.id??'';this.ui.quoteLoading=false;
  if(!snapshot||!tonicDefinitions.some(def=>def.id===target)||(snapshot.progression?.buffs[target]??0)>0||(snapshot.progression?.consumables[target]??0)<=0){this.refresh();return;}
  this.ui.quoteLoading=true;this.ui.error='';this.refresh();
  try{const quote=await api<ProgressionPreview>('progression/preview',{revision:snapshot.revision,action:{op:'consumable.use',target}});if(generation===this.generation&&snapshot.id===this.snapshot()?.id){this.ui.quote=quote;if(quote.revision!==this.snapshot()?.revision)this.ui.error='库存已更新，请重新读取使用条件。';}}
  catch(error){if(generation===this.generation)this.ui.error=error instanceof Error?error.message:'使用条件读取失败，请重试。';}
  finally{if(generation===this.generation){this.ui.quoteLoading=false;this.refresh();}}
 }
 async use(target:TonicId){
  const snapshot=this.snapshot(),quote=this.ui.quote;
  if(!snapshot||this.ui.busy||this.blocked()||this.ui.quoteLoading||this.ui.selected!=='tonic:'+target||this.ui.quoteTarget!==target||this.ui.quoteCharacter!==snapshot.id||!quote?.enabled||quote.action.op!=='consumable.use'||quote.action.target!==target)return;
  if(quote.revision!==snapshot.revision){this.ui.error='库存已更新，请核对最新使用条件。';await this.previewSelected();return;}
  if((snapshot.progression?.buffs[target]??0)>0||(snapshot.progression?.consumables[target]??0)<=0)return;
  this.ui.busy=true;this.ui.message='正在使用…';this.ui.error='';this.ui.status='';this.refresh();
  try{const result=await this.write('progression/action',{action:quote.action},true);this.ui.status=result==='pending'?'pending':result==='success'?'success':'';this.ui.message=result==='pending'?'使用结果待确认，请恢复连接核对库存。':result==='success'?'已生效，库存已更新。':'操作未提交，请核对最新状态。';}
  finally{this.ui.busy=false;this.ui.quote=undefined;if(this.ui.status!=='pending')await this.previewSelected();else this.refresh();}
 }
}
