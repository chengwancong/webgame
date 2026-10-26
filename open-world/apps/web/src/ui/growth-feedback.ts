import {escapeHtml} from './primitives.ts';

/** Presentation-only numbers. The server snapshot remains the sole value owner. */
export function growthNumberHtml(key:string,value:number,confirmed=false,label='等级',pending=false){
 return `<span class="ui-growth-number" data-growth-key="${escapeHtml(key)}" data-growth-value="${value}" data-growth-confirmed="${confirmed}" data-growth-pending="${pending}" aria-label="${escapeHtml(label+' '+value)}"><span class="ui-growth-rays" aria-hidden="true"></span><b class="ui-number" aria-hidden="true">${value}</b></span>`;
}
export function growthFrameValue(from:number,to:number,elapsed:number,duration:number){
 const progress=Math.min(1,Math.max(0,elapsed/Math.max(1,duration)));
 return Math.round(from+(to-from)*(1-(1-progress)**3));
}
export class GrowthFeedbackTracker{
 private previous=new Map<string,number>();
 observe(key:string,value:number,confirmed:boolean,pending=false){
  if(!Number.isFinite(value)||pending)return undefined;
  const before=this.previous.get(key);this.previous.set(key,value);
  if(this.previous.size>512)this.previous.delete(this.previous.keys().next().value!);
  return confirmed&&before!==undefined&&value>before?before:undefined;
 }
}
const tracker=new GrowthFeedbackTracker();
/** First display establishes a baseline; only confirmed increases receive a small ceremony. */
export function hydrateGrowthFeedback(root:HTMLElement){
 const reduced=()=>root.closest('[data-motion-reduced=true]')!==null||root.ownerDocument.documentElement.dataset.motionReduced==='true'||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 for(const node of root.querySelectorAll<HTMLElement>('[data-growth-key]')){
  const value=Number(node.dataset.growthValue),before=tracker.observe(node.dataset.growthKey!,value,node.dataset.growthConfirmed==='true',node.dataset.growthPending==='true');
  if(before===undefined)continue;
  node.classList.add('is-growth');
  if(reduced())continue;
  const number=node.querySelector<HTMLElement>('.ui-number');if(!number)continue;
  const duration=Math.min(600,Math.max(1,parseFloat(getComputedStyle(node).getPropertyValue('--motion-growth-count'))||560));
  number.textContent=String(before);const start=performance.now();
  const tick=(now:number)=>{if(!node.isConnected)return;if(reduced()){number.textContent=String(value);return;}number.textContent=String(growthFrameValue(before,value,now-start,duration));if(now-start<duration)requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
 }
}
