import type {CraftAction,CraftingView,CraftPreview,Receipt,Snapshot,StageKeyPreview} from '../../../packages/contracts/index.ts';
import {api,ApiFailure} from './network.ts';
import {craftRecipes} from '../../../packages/content/crafting.ts';
import {craftAction,craftErrorHints,filterRecipes,materialName,normalizeOptions,sameAction,type CraftOptions,type CraftProfession,type CraftTab,type RecipeFilter} from './crafting-model.ts';

export type CraftingUI={tab:CraftTab;view?:CraftingView;filter:RecipeFilter;patternFilter:RecipeFilter;recipe:string;options:CraftOptions;masterworkGear:string;refineFrom:string;exchangeTo:string;times:number;preview?:CraftPreview;previewLoading:boolean;keyPreview?:StageKeyPreview;loading:boolean;busy:boolean;message:string;error:string;status:''|'success'|'pending'};
type Write=(path:string,body:object,changesBuild?:boolean)=>Promise<'success'|'rejected'|'pending'|'busy'|undefined>;
type Place={region:string;position:{x:number;y:number}};

/**
 * Workshop crafting tabs (docs/crafting-backend-handoff-20261014.md §3).
 * The page keeps only selections; quantities, prices, odds and results come from /api/crafting*.
 */
export class CraftingController{
 readonly ui:CraftingUI={tab:'upgrade',filter:{profession:'smithing',island:'',showUnknown:false,query:''},patternFilter:{profession:'smithing',island:'',showUnknown:false,query:''},recipe:'',options:{count:1},masterworkGear:'',refineFrom:'',exchangeTo:'',times:1,previewLoading:false,loading:false,busy:false,message:'',error:'',status:''};
 private generation=0;
 constructor(private deps:{snapshot:()=>Snapshot|undefined;place:()=>Place;write:Write;refresh:()=>void;blocked:()=>boolean;lastReceipt:()=>Receipt|undefined}){}

 async load(){
  if(this.ui.loading)return;const owner=this.deps.snapshot()?.id,{region,position}=this.deps.place();this.ui.loading=true;this.ui.error='';this.deps.refresh();
  try{const view=await api<CraftingView>(`crafting?region=${encodeURIComponent(region)}&x=${position.x}&y=${position.y}`);if(owner!==this.deps.snapshot()?.id)return;this.ui.view=view;this.reconcile();}
  catch(e){this.ui.error=errorText(e,'工坊信息读取失败。');}
  finally{this.ui.loading=false;this.deps.refresh();}
  await this.refreshPreview();
 }
 /** 追踪条点进来：直接选中钉选的配方与选项（docs/progression-goal-plan.md §5.1 第 3 条）。 */
 focusGoal(goal:{recipe:string;slot?:string;tendency?:string;element?:string}){
  const r=craftRecipes.find(r=>r.id===goal.recipe);if(!r)return;
  if(r.category==='pattern'){this.ui.tab='pattern';this.ui.patternFilter={...this.ui.patternFilter,island:'',query:''};}else{this.ui.tab='craft';this.ui.filter={...this.ui.filter,profession:r.profession as CraftProfession,island:'',query:''};}
  this.ui.recipe=r.id;this.ui.options={slot:goal.slot,tendency:goal.tendency,element:goal.element,count:1};
 }
 reset(){this.ui.view=undefined;this.ui.preview=undefined;this.ui.keyPreview=undefined;this.ui.message='';this.ui.error='';this.ui.status='';}

 /** Keep selections valid against the latest server view. */
 private reconcile(){
  const view=this.ui.view;if(!view)return;
  const tab=this.ui.tab==='pattern'?'pattern':'craft',filter=tab==='pattern'?this.ui.patternFilter:this.ui.filter,list=filterRecipes(view,tab,filter);
  if((this.ui.tab==='craft'||this.ui.tab==='pattern')&&!list.some(r=>r.id===this.ui.recipe))this.ui.recipe=list[0]?.id??'';
  this.ui.options=normalizeOptions(view.recipes.find(r=>r.id===this.ui.recipe),this.ui.options);
  if(!view.refine.some(r=>r.from===this.ui.refineFrom))this.ui.refineFrom=view.refine.find(r=>r.to==='stardust')?.from??'';
  const exchange=view.refine.filter(r=>r.from==='stardust');if(!exchange.some(r=>r.to===this.ui.exchangeTo))this.ui.exchangeTo=exchange[0]?.to??'';
 }
 /** The action the preview and the commit button both refer to. */
 currentAction():CraftAction|undefined{
  const view=this.ui.view;if(!view)return;
  if(this.ui.tab==='craft'||this.ui.tab==='pattern'){const recipe=view.recipes.find(r=>r.id===this.ui.recipe);return recipe?.known?craftAction(recipe,this.ui.options):undefined;}
  if(this.ui.tab==='masterwork'&&this.ui.masterworkGear&&view.masterwork.unlocked)return {op:'masterwork.apply',gear:this.ui.masterworkGear};
  return;
 }
 private async refreshPreview(){
  const generation=++this.generation,action=this.currentAction(),s=this.deps.snapshot();this.ui.preview=undefined;
  if(!action||!s||!this.ui.view){this.ui.previewLoading=false;this.deps.refresh();return;}
  this.ui.previewLoading=true;this.deps.refresh();
  try{const preview=await api<CraftPreview>('crafting/preview',{revision:s.revision,action,...this.deps.place()});if(generation===this.generation)this.ui.preview=preview;}
  catch(e){if(generation===this.generation){if(e instanceof ApiFailure&&e.code==='REVISION'){this.ui.previewLoading=false;await this.load();return;}this.ui.error=errorText(e,'预览读取失败，请重试。');}}
  finally{if(generation===this.generation){this.ui.previewLoading=false;this.deps.refresh();}}
 }
 private async preview(action:CraftAction){
  const generation=++this.generation,s=this.deps.snapshot();if(!s)return;this.ui.preview=undefined;this.ui.previewLoading=true;this.deps.refresh();
  try{const p=await api<CraftPreview>('crafting/preview',{revision:s.revision,action,...this.deps.place()});if(generation===this.generation)this.ui.preview=p;}
  catch(e){if(generation===this.generation)this.ui.error=errorText(e,'预览读取失败，请重试。');}
  finally{if(generation===this.generation){this.ui.previewLoading=false;this.deps.refresh();}}
 }

 async handle(action:string,id:string):Promise<boolean>{
  if(!action.startsWith('craft-'))return false;
  if(this.ui.status!=='pending'&&!['craft-make','craft-refine','craft-exchange','craft-facility','craft-masterwork-reroll','craft-codex','craft-key-make'].includes(action)){this.ui.message='';this.ui.status='';}
  this.ui.error='';
  switch(action){
   case 'craft-tab':{this.ui.tab=id as CraftTab;this.ui.keyPreview=undefined;this.reconcile();if(this.ui.tab!=='upgrade'&&!this.ui.view)await this.load();else await this.refreshPreview();return true;}
   case 'craft-refresh':await this.load();return true;
   case 'craft-profession':this.ui.filter.profession=id as CraftProfession;this.reconcile();await this.refreshPreview();return true;
   case 'craft-island':this.activeFilter().island=id;this.reconcile();await this.refreshPreview();return true;
   case 'craft-unknown':{const f=this.activeFilter();f.showUnknown=!f.showUnknown;this.reconcile();await this.refreshPreview();return true;}
   case 'craft-select':this.ui.recipe=id;this.ui.options=normalizeOptions(this.ui.view?.recipes.find(r=>r.id===id),this.ui.options);await this.refreshPreview();return true;
   case 'craft-option':{const [kind,value]=id.split(':') as ['slot'|'tendency'|'element',string];if(kind==='element'&&this.ui.options.element===value)this.ui.options.element=undefined;else this.ui.options[kind]=value;this.ui.options=normalizeOptions(this.ui.view?.recipes.find(r=>r.id===this.ui.recipe),this.ui.options);await this.refreshPreview();return true;}
   case 'craft-pin':{
    const goal=this.deps.snapshot()?.craftGoal,o=this.ui.options,same=goal?.recipe===this.ui.recipe&&goal.slot===o.slot&&goal.tendency===o.tendency&&goal.element===o.element;
    if(!this.ui.recipe||this.ui.busy||this.deps.blocked())return true;this.ui.busy=true;this.deps.refresh();
    try{const r=await this.deps.write('crafting/pin',{pin:same?null:{recipe:this.ui.recipe,...(o.slot?{slot:o.slot}:{}),...(o.tendency?{tendency:o.tendency}:{}),...(o.element?{element:o.element}:{})}});this.setResult(r,same?'已取消目标。':'已设为目标：追踪条会显示还差的材料。');}
    finally{this.ui.busy=false;this.deps.refresh();}
    return true;
   }
   case 'craft-count':this.ui.options.count=Math.max(1,Math.min(20,this.ui.options.count+Number(id)));await this.refreshPreview();return true;
   case 'craft-make':{const p=this.ui.preview,act=this.currentAction();if(!p?.enabled||!sameAction(p.action,act)||p.revision!==this.deps.snapshot()?.revision)return true;const goal=act?.op==='craft'&&this.deps.snapshot()?.craftGoal?.recipe===act.recipe;await this.commit(act!,`已制作 ${p.output.name}${p.output.count>1?' ×'+p.output.count:''}${goal?'。目标完成，可以再设一个。':''}`);return true;}
   case 'craft-refine-from':this.ui.refineFrom=id;this.ui.times=1;this.deps.refresh();return true;
   case 'craft-exchange-to':this.ui.exchangeTo=id;this.ui.times=1;this.deps.refresh();return true;
   case 'craft-times':this.ui.times=Math.max(1,Math.min(100,id==='max'?100:this.ui.times+Number(id)));this.deps.refresh();return true;
   case 'craft-refine':{const rule=this.ui.view?.refine.find(r=>r.from===this.ui.refineFrom&&r.to==='stardust');if(rule)await this.commit({op:'refine',from:rule.from,times:this.ui.times},`已提纯 ${materialName(rule.from)} ×${rule.inputCount*this.ui.times}，获得星尘 ×${rule.outputCount*this.ui.times}`);return true;}
   case 'craft-exchange':{const rule=this.ui.view?.refine.find(r=>r.from==='stardust'&&r.to===this.ui.exchangeTo);if(rule)await this.commit({op:'exchange',to:rule.to,times:this.ui.times},`已兑换 ${materialName(rule.to)}`);return true;}
   case 'craft-facility-preview':await this.preview({op:'facility.upgrade',facility:id});return true;
   case 'craft-facility':{const p=this.ui.preview;if(!p?.enabled||p.action.op!=='facility.upgrade'||p.action.facility!==id)return true;await this.commit(p.action,`${p.output.name} 已升级`);return true;}
   case 'craft-masterwork-select':this.ui.masterworkGear=id;await this.refreshPreview();return true;
   case 'craft-masterwork':{const p=this.ui.preview,act=this.currentAction();if(!p?.enabled||!sameAction(p.action,act))return true;await this.commit(act!,'精工完成');return true;}
   case 'craft-masterwork-reroll':{if(!this.ui.masterworkGear)return true;await this.commit({op:'masterwork.reroll',gear:this.ui.masterworkGear,lockAffix:Number(id)},'已锁定该词缀并重铸其余词缀');return true;}
   case 'craft-codex':await this.commit({op:'codex.claim',target:id},'图鉴奖励已领取');return true;
   case 'craft-key-preview':{const key=this.ui.view?.stageKey;if(!key)return true;try{this.ui.keyPreview=await api<StageKeyPreview>('stage-keys/preview',{revision:this.deps.snapshot()?.revision,stage:key.stage,key:id});this.ui.message='预览不消耗材料；制作时重新校验角色状态。';}catch(e){this.ui.error=errorText(e,'钥匙预览读取失败。');}this.deps.refresh();return true;}
   case 'craft-key-make':{const key=this.ui.view?.stageKey;if(!key||this.ui.busy||this.deps.blocked())return true;this.ui.busy=true;this.deps.refresh();try{const r=await this.deps.write('stage-keys/craft',{stage:key.stage,key:id},true);this.setResult(r,'钥匙已制作');}finally{this.ui.busy=false;this.ui.keyPreview=undefined;await this.load();}return true;}
  }
  return false;
 }
 private activeFilter(){return this.ui.tab==='pattern'?this.ui.patternFilter:this.ui.filter;}
 setQuery(value:string){this.activeFilter().query=value;this.reconcile();void this.refreshPreview();}

 private async commit(action:CraftAction,success:string){
  if(this.ui.busy||this.deps.blocked())return;this.ui.busy=true;this.ui.message='正在提交…';this.ui.status='';this.deps.refresh();
  try{
   const result=await this.deps.write('crafting/action',{action,...this.deps.place()});
   const delta=result==='success'?this.deps.lastReceipt()?.delta:undefined;
   this.setResult(result,success+(delta?.fine?'（精良！）':''));
  }finally{this.ui.busy=false;this.ui.preview=undefined;if((this.ui.status as CraftingUI['status'])!=='pending')await this.load();else this.deps.refresh();}
 }
 private setResult(result:Awaited<ReturnType<Write>>,success:string){
  this.ui.status=result==='pending'?'pending':result==='success'?'success':'';
  this.ui.message=result==='success'?success:result==='pending'?'结果待确认，请恢复连接后核对材料。':result==='busy'?'上一项操作仍在处理。':'操作未提交，请核对最新状态。';
 }
}
export function errorText(e:unknown,fallback:string){if(e instanceof ApiFailure){const hint=craftErrorHints[e.code];return hint&&!e.message.includes(hint)?`${e.message} ${hint}`:e.message;}return e instanceof Error?e.message:fallback;}
