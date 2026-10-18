import type {GearTip} from '../../../packages/contracts/index.ts';
import {equipmentTipShell,renderEquipmentTip} from './equipment-tip.ts';
import {STAGE,stageBox} from './stage.ts';

type Loader=(id:string)=>Promise<GearTip>;
const selector='[data-equipment-tip],[data-tip]';
const owner=(node:EventTarget|null)=>node instanceof Element?node.closest<HTMLElement>(selector):null;
const key=(node:HTMLElement)=>[node.dataset.action,node.dataset.id,node.dataset.equipmentTip,node.dataset.tip].join('|');
type GenericRenderer=(target:HTMLElement,tip:HTMLElement)=>void;

export class TooltipController{
 private hover:HTMLElement|null=null;private focus:HTMLElement|null=null;private active:HTMLElement|null=null;private inside=false;private preferred:'hover'|'focus'='hover';private suppressed='';private suppressedPointerLeft=false;private sequence=0;private timer?:ReturnType<typeof setTimeout>;private bound=false;private loader?:Loader;
 private cache=new Map<string,{value:GearTip;expires:number}>();private requests=new Map<string,Promise<GearTip>>();
 constructor(private renderGeneric:GenericRenderer){}
 configure(loader:Loader){this.loader=loader;}
 private get tip(){return document.getElementById('tooltip')!;}
 private valid(target:HTMLElement|null){return !!target?.isConnected&&!(document.querySelector('#modal .panel,#modal .battle-result')&&!target.closest('#modal'))&&!(document.querySelector('#modal .confirm-box')&&!target.closest('.confirm-box'));}
 private choose(){if(this.preferred==='focus'&&this.valid(this.focus))return this.focus;if(this.inside&&this.valid(this.active))return this.active;return this.valid(this.hover)?this.hover:this.valid(this.focus)?this.focus:null;}
 private link(target:HTMLElement|null,enabled:boolean){
  if(!target)return;const tokens=new Set((target.getAttribute('aria-describedby')??'').split(/\s+/).filter(Boolean));enabled?tokens.add('tooltip'):tokens.delete('tooltip');if(tokens.size)target.setAttribute('aria-describedby',[...tokens].join(' '));else target.removeAttribute('aria-describedby');
 }
 hide(){clearTimeout(this.timer);this.hover=this.focus=null;this.inside=false;this.suppressed='';this.suppressedPointerLeft=false;this.hideVisual();}
 private hideVisual(){this.sequence++;this.link(this.active,false);this.active=null;if(this.tip){this.tip.style.display='none';this.tip.setAttribute('aria-hidden','true');}}
 dismiss(target?:HTMLElement){
  if(target){clearTimeout(this.timer);this.suppressed=key(target);this.suppressedPointerLeft=false;this.hover=this.focus=null;this.inside=false;this.hideVisual();return true;}
  if(!this.tip||this.tip.style.display==='none')return false;this.suppressed=this.active?key(this.active):'';this.suppressedPointerLeft=Boolean(this.active&&!this.active.matches(':hover'));this.inside=false;this.hideVisual();return true;
 }
 show(target:HTMLElement){this.hover=target;this.preferred='hover';this.update();}
 private schedule(ms=100){clearTimeout(this.timer);this.timer=setTimeout(()=>this.update(),ms);}
 private update(force=false){
  clearTimeout(this.timer);const target=this.choose();if(!target||key(target)===this.suppressed){this.hideVisual();return;}
  if(target===this.active&&!force&&this.tip.style.display!=='none'){this.position();return;}
  const scroll=this.active&&key(target)===key(this.active)?this.tip.scrollTop:0;
  this.link(this.active,false);this.active=target;this.link(target,true);const sequence=++this.sequence,tip=this.tip;
  tip.style.display='block';tip.setAttribute('aria-hidden','false');
  if(!target.dataset.equipmentTip){tip.className='';tip.removeAttribute('aria-busy');this.renderGeneric(target,tip);this.position();tip.scrollTop=scroll;return;}
  tip.className='equipment-tip';tip.setAttribute('aria-busy','true');tip.innerHTML=equipmentTipShell(target);this.position();
  const id=target.dataset.equipmentTip,revision=Number(target.dataset.equipmentRevision),cacheKey=id+':'+revision,cached=this.cache.get(cacheKey);
  const apply=(data:GearTip)=>{if(sequence!==this.sequence||this.active!==target||!this.valid(target))return;tip.innerHTML=renderEquipmentTip(data);tip.setAttribute('aria-busy','false');this.position();tip.scrollTop=scroll;};
  if(cached&&cached.expires>Date.now()){apply(cached.value);return;}
  if(!this.loader){tip.innerHTML=equipmentTipShell(target,'装备信息暂时不可用。');tip.setAttribute('aria-busy','false');this.position();return;}
  let request=this.requests.get(cacheKey);if(!request){request=this.loader(id);this.requests.set(cacheKey,request);}
  void request.then(data=>{
   if(data.gear.id!==id||data.revision!==revision)throw Error('装备已更新，请重新打开行囊。');
   this.cache.set(cacheKey,{value:data,expires:Date.now()+30000});if(this.cache.size>128)this.cache.delete(this.cache.keys().next().value!);apply(data);
  }).catch(error=>{if(sequence!==this.sequence||this.active!==target||!this.valid(target))return;tip.innerHTML=equipmentTipShell(target,error instanceof Error?error.message:'装备信息读取失败，请重试。');tip.setAttribute('aria-busy','false');this.position();}).finally(()=>{if(this.requests.get(cacheKey)===request)this.requests.delete(cacheKey);});
 }
 private visible(target:HTMLElement){
  const rect=stageBox(target);if(rect.right<=0||rect.left>=STAGE.width||rect.bottom<=0||rect.top>=STAGE.height)return false;
  for(let parent=target.parentElement;parent&&parent!==document.body;parent=parent.parentElement){const style=getComputedStyle(parent),box=stageBox(parent);if(/auto|scroll|hidden|clip/.test(style.overflowY)&&(rect.bottom<=box.top||rect.top>=box.bottom))return false;if(/auto|scroll|hidden|clip/.test(style.overflowX)&&(rect.right<=box.left||rect.left>=box.right))return false;}
  return true;
 }
 private position(){
  const target=this.active,tip=this.tip;if(!target||!this.valid(target)||!this.visible(target)){this.hideVisual();return;}
  const scroll=tip.scrollTop;
  tip.style.maxHeight=`${Math.max(80,STAGE.height-20)}px`;tip.style.left='0px';tip.style.top='0px';const rect=stageBox(target),box=stageBox(tip),margin=10,gap=12;
  let x=rect.left+rect.width/2-box.width/2,y=rect.top-box.height-gap;
  const inventory=stageBox(target.closest('.inventory-grid'));
  if(tip.classList.contains('equipment-tip')&&inventory&&inventory.left-gap-box.width>=margin){x=inventory.left-gap-box.width;y=rect.top-24;}
  else if(tip.classList.contains('equipment-tip')&&inventory&&inventory.right+gap+box.width<=STAGE.width-margin){x=inventory.right+gap;y=rect.top-24;}
  else if(tip.classList.contains('equipment-tip')&&rect.right+gap+box.width<=STAGE.width-margin){x=rect.right+gap;y=rect.top-24;}
  else if(tip.classList.contains('equipment-tip')&&rect.left-gap-box.width>=margin){x=rect.left-gap-box.width;y=rect.top-24;}
  else if(y<margin)y=rect.bottom+gap;
  const bag=stageBox(target.closest('.bag-grid'));
  // Keep inventory tips over the item area, leaving the permanent action column usable.
  if(bag&&tip.classList.contains('equipment-tip')){
   const left=rect.left-box.width-gap,right=rect.right+gap;
   if(left>=bag.left)x=left;
   else if(right+box.width<=bag.right)x=right;
   else{
    x=Math.max(bag.left,Math.min(bag.right-box.width,x));
    const above=rect.top-margin-gap,below=STAGE.height-rect.bottom-margin-gap,useAbove=above>=below;
    const height=Math.min(box.height,Math.max(80,useAbove?above:below));
    tip.style.maxHeight=`${height}px`;y=useAbove?rect.top-gap-height:rect.bottom+gap;
   }
  }
  const fitted=stageBox(tip);
  x=Math.max(margin,Math.min(STAGE.width-fitted.width-margin,x));y=Math.max(margin,Math.min(STAGE.height-fitted.height-margin,y));tip.style.left=`${x}px`;tip.style.top=`${y}px`;tip.scrollTop=scroll;
 }
 refresh(){
  const replace=(old:HTMLElement|null)=>old?.isConnected?old:old?Array.from(document.querySelectorAll<HTMLElement>(selector)).find(node=>node.dataset.action===old.dataset.action&&node.dataset.id===old.dataset.id&&node.dataset.equipmentTip===old.dataset.equipmentTip)??null:null;
  this.hover=replace(this.hover);const focus=replace(this.focus);if(focus&&document.activeElement===document.body)focus.focus({preventScroll:true});this.focus=owner(document.activeElement)??focus;this.inside=false;this.update(true);
 }
 bind(){
  if(this.bound)return;this.bound=true;
  document.body.addEventListener('pointerover',event=>{const target=owner(event.target);if(!target||target.contains(event.relatedTarget as Node|null)||target===this.hover)return;this.hover=target;this.preferred='hover';if(this.suppressed&&(key(target)!==this.suppressed||this.suppressedPointerLeft)){this.suppressed='';this.suppressedPointerLeft=false;}this.schedule(110);});
  // Leaving a selected item must not re-open it through the retained keyboard focus.
  // A subsequent physical re-entry is a fresh hover intent; DOM replacement is not.
  document.body.addEventListener('pointerout',event=>{const target=owner(event.target);if(!target||target.contains(event.relatedTarget as Node|null))return;if(this.suppressed===key(target)&&target.isConnected)this.suppressedPointerLeft=true;if(target===this.hover){this.hover=null;this.schedule(120);}});
  document.body.addEventListener('pointermove',event=>{if(!this.suppressed)return;const target=owner(event.target);if(!target||key(target)!==this.suppressed)this.suppressedPointerLeft=true;},{passive:true});
  document.body.addEventListener('focusin',event=>{const target=owner(event.target);if(!target)return;this.focus=target;this.preferred='focus';if(this.suppressed&&key(target)!==this.suppressed){this.suppressed='';this.suppressedPointerLeft=false;}this.update();});
  document.body.addEventListener('focusout',event=>{const target=owner(event.target);if(!target||target.contains(event.relatedTarget as Node|null))return;const next=owner(event.relatedTarget);if(this.suppressed===key(target)&&event.relatedTarget instanceof Element&&event.relatedTarget!==document.body&&(!next||key(next)!==this.suppressed)){this.suppressed='';this.suppressedPointerLeft=false;}if(target===this.focus){this.focus=null;this.schedule();}});
  this.tip.addEventListener('pointerenter',()=>{this.inside=true;clearTimeout(this.timer);});this.tip.addEventListener('pointerleave',()=>{this.inside=false;this.schedule();});
  let frame=0;const reposition=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(this.tip.style.display!=='none')this.position();else if(this.choose())this.update();});};window.addEventListener('resize',reposition);document.addEventListener('scroll',event=>{if(event.target!==this.tip)reposition();},true);window.addEventListener('blur',()=>this.hide());
 }
}
