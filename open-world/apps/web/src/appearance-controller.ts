import type {AppearanceView,AppearancePreview,AppearanceSelection,AppearanceSlot} from '../../../packages/contracts/appearance.ts';
import {api} from './network.ts';
export type AppearanceUI={view?:AppearanceView;draft:AppearanceSelection;preview?:AppearancePreview;slot:AppearanceSlot;loading:boolean;previewLoading:boolean;busy:boolean;error:string;message:string;status:''|'success'|'pending';action:'idle'|'move'|'attack'|'skill'|'hurt'|'death';facing:1|-1;playing:boolean;loadoutOpen?:boolean};
type Write=(path:string,body:object,build?:boolean)=>Promise<'success'|'rejected'|'pending'|'busy'|undefined>;
const signature=(selection:AppearanceSelection)=>JSON.stringify(Object.entries(selection).sort(([a],[b])=>a.localeCompare(b)));
export class AppearanceController{
 readonly ui:AppearanceUI={draft:{},slot:'head',loading:false,previewLoading:false,busy:false,error:'',message:'',status:'',action:'idle',facing:-1,playing:true};
 private generation=0;
 constructor(private refresh:()=>void,private write:Write,private blocked:()=>boolean){}
 get dirty(){return Boolean(this.ui.view&&signature(this.ui.draft)!==signature(this.sanitize(this.ui.view.selection)));}
 private sanitize(selection:AppearanceSelection){const result={...selection},v=this.ui.view;if(result.weapon&&v){const item=v.catalog.find(item=>item.id===result.weapon);if(!item?.weaponFamilies.includes(v.resolvedAppearance.family))delete result.weapon;}return result;}
 async load(retainDraft=false){
  if(this.ui.loading)return;this.generation++;this.ui.preview=undefined;this.ui.previewLoading=false;this.ui.loading=true;this.ui.error='';this.refresh();
  try{this.ui.view=await api<AppearanceView>('appearance');if(!retainDraft)this.ui.draft=this.sanitize(this.ui.view.selection);await this.preview();}
  catch(error){this.ui.error=error instanceof Error?error.message:'外观信息读取失败。';}
  finally{this.ui.loading=false;this.refresh();}
 }
 async handle(action:string,id:string){
  if(!action.startsWith('appearance-'))return false;
  if(action==='appearance-refresh'){await this.load(this.dirty);return true;}
  if(action==='appearance-loadout'){this.ui.loadoutOpen=!this.ui.loadoutOpen;this.refresh();return true;}
  if(action==='appearance-slot'){if(this.ui.view?.slots.includes(id as AppearanceSlot))this.ui.slot=id as AppearanceSlot;this.refresh();return true;}
  if(action==='appearance-motion'){if(['idle','move','attack','skill','hurt','death'].includes(id))this.ui.action=id as AppearanceUI['action'];this.refresh();return true;}
  if(action==='appearance-facing'){this.ui.facing=this.ui.facing===1?-1:1;this.refresh();return true;}
  if(action==='appearance-play'){this.ui.playing=!this.ui.playing;this.refresh();return true;}
  if(this.ui.busy||this.ui.loading||this.ui.status==='pending'||this.blocked()||!this.ui.view)return true;
  if(action==='appearance-select'){
   const item=this.ui.view.catalog.find(item=>item.id===id);if(!item?.owned||!item.slots.includes(this.ui.slot)||this.ui.slot==='weapon'&&!item.weaponFamilies.includes(this.ui.view.resolvedAppearance.family))return true;
   this.ui.draft={...this.ui.draft,[this.ui.slot]:id};this.ui.status='';this.ui.message='预览尚未保存。';await this.preview();return true;
  }
  if(action==='appearance-auto'){const next={...this.ui.draft};delete next[this.ui.slot];this.ui.draft=next;this.ui.status='';this.ui.message='此部位将随装备自动匹配。';await this.preview();return true;}
  if(action==='appearance-cancel'){this.ui.draft=this.sanitize(this.ui.view.selection);this.ui.status='';this.ui.message='已恢复保存的外观。';await this.preview();return true;}
  if(action==='appearance-save'||action==='appearance-reset'){
   if(this.ui.previewLoading||!this.ui.preview||this.ui.preview.revision!==this.ui.view.revision)return true;
   if(action==='appearance-save'&&!this.dirty)return true;
   this.ui.busy=true;this.ui.error='';this.ui.message='正在保存外观…';this.refresh();
   try{const result=await this.write(action==='appearance-reset'?'appearance/reset':'appearance/apply',action==='appearance-reset'?{}:{selection:this.ui.draft},false);this.ui.status=result==='pending'?'pending':result==='success'?'success':'';this.ui.message=result==='pending'?'保存结果待确认，请恢复连接。':result==='success'?'外观已保存。':'操作未提交，请核对最新外观权限。';if(result!=='pending')await this.load(result!=='success');}
   catch(error){this.ui.error=error instanceof Error?error.message:'外观保存未能确认，请刷新核对。';this.ui.preview=undefined;}
   finally{this.ui.busy=false;this.refresh();}return true;
  }
  return true;
 }
 private async preview(){const generation=++this.generation;this.ui.previewLoading=true;this.ui.error='';this.refresh();try{const preview=await api<AppearancePreview>('appearance/preview',{revision:this.ui.view!.revision,selection:this.ui.draft});if(generation===this.generation){if(preview.revision!==this.ui.view!.revision)throw Error('外观数据已更新，请重新打开外观界面。');this.ui.preview=preview;}}catch(error){if(generation===this.generation){this.ui.preview=undefined;this.ui.error=error instanceof Error?error.message:'外观预览读取失败。';}}finally{if(generation===this.generation){this.ui.previewLoading=false;this.refresh();}}}
}
