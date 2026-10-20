// UX-A01：#modal 的进出场、tab 下划线滑动与卡片错峰。只改呈现，不碰面板状态；渲染器照旧整块重绘 #modal。
const STAGGER_TARGETS='.ui-card,.bag-card,.challenge-card,.starsea-island-card,.task-row,.ui-reward-item,.warehouse-item';
const STAGGER_MAX=10;
export const motionReduced=()=>document.documentElement.dataset.motionReduced==='true'||(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
const cssMs=(name:string,fallback:number)=>{const v=getComputedStyle(document.documentElement).getPropertyValue(name).trim();const n=parseFloat(v);return Number.isFinite(n)?(v.endsWith('ms')?n:v.endsWith('s')?n*1000:n):fallback;};
const signature=(el:Element|null)=>el?(el.getAttribute('data-panel')??el.getAttribute('aria-label')??el.classList[0]??el.tagName):'';

export function installPanelMotion(host:HTMLElement){
 let wasOpen=host.classList.contains('open'),lastSig=signature(host.firstElementChild),enterStart=0,enterTimer:ReturnType<typeof setTimeout>|undefined,exitTimer:ReturnType<typeof setTimeout>|undefined,own=false;
 const endEnter=()=>{clearTimeout(enterTimer);delete host.dataset.enter;enterStart=0;};
 const endExit=()=>{clearTimeout(exitTimer);exitTimer=undefined;if(host.classList.contains('is-closing')){own=true;host.classList.remove('is-closing');host.removeAttribute('inert');host.replaceChildren();}};
 const startEnter=(kind:'open'|'swap')=>{
  clearTimeout(enterTimer);delete host.dataset.enter;void host.offsetWidth;
  if(kind==='open'){let i=0;host.querySelectorAll<HTMLElement>(STAGGER_TARGETS).forEach(el=>{if(i>=STAGGER_MAX)return;el.dataset.stagger='';el.style.setProperty('--stagger-index',String(i++));});}
  host.dataset.enter=kind;enterStart=performance.now();enterTimer=setTimeout(endEnter,cssMs('--motion-normal',200)+STAGGER_MAX*cssMs('--motion-stagger',30)+cssMs('--motion-fast',120)+40);
 };
 /** 进场期间整块重绘会让动画从头再来：给新节点补负延迟，接着上一帧的进度播。 */
 const resume=()=>{if(!enterStart||host.dataset.enter!=='open'&&host.dataset.enter!=='swap')return;const elapsed=performance.now()-enterStart;for(const child of Array.from(host.children) as HTMLElement[])if(!child.style.animationDelay)child.style.animationDelay=`-${Math.round(elapsed)}ms`;};
 const observer=new MutationObserver(records=>{
  if(own){own=false;return;}
  const open=host.classList.contains('open'),sig=signature(host.firstElementChild),reduced=motionReduced();
  if(open&&host.classList.contains('is-closing')){clearTimeout(exitTimer);host.classList.remove('is-closing');host.removeAttribute('inert');}
  if(!wasOpen&&open){if(!reduced)startEnter('open');}
  else if(wasOpen&&!open){
   endEnter();
   if(!reduced){
    let removed:Node[]=[];for(const r of records)if(r.removedNodes.length)removed=Array.from(r.removedNodes).filter(n=>n.nodeType===1);
    if(removed.length&&!host.firstChild){own=true;host.append(...removed);host.setAttribute('inert','');host.classList.add('is-closing');exitTimer=setTimeout(endExit,cssMs('--motion-exit',90)+30);}
   }
  }else if(wasOpen&&open){
   if(sig!==lastSig&&lastSig&&sig&&!reduced&&!enterStart)startEnter('swap');
   else resume();
  }
  wasOpen=open;lastSig=sig;
 });
 observer.observe(host,{childList:true,attributes:true,attributeFilter:['class']});
 return ()=>{observer.disconnect();endEnter();clearTimeout(exitTimer);};
}

/** tab 下划线：记住上次选中位置，重绘后从旧位置滑到新位置。 */
export function installTabSlide(root:HTMLElement){
 const memory=new Map<string,{x:number;w:number}>();let scheduled=false;
 const sync=()=>{
  scheduled=false;const reduced=motionReduced();
  root.querySelectorAll<HTMLElement>('.ui-tabs[aria-orientation=horizontal]').forEach((list,index)=>{
   const selected=list.querySelector<HTMLElement>('button[aria-selected=true]');if(!selected||!list.offsetWidth){list.removeAttribute('data-tab-slide');return;}
   const key=(list.getAttribute('aria-label')??'')+'#'+index,x=selected.offsetLeft,w=selected.offsetWidth,prev=memory.get(key);
   if(list.dataset.tabSlide&&list.style.getPropertyValue('--tab-x')===x+'px'&&list.style.getPropertyValue('--tab-w')===w+'px')return;
   if(!list.dataset.tabSlide){list.style.setProperty('--tab-x',(!reduced&&prev?prev.x:x)+'px');list.style.setProperty('--tab-w',(!reduced&&prev?prev.w:w)+'px');list.dataset.tabSlide='';void list.offsetWidth;}
   list.style.setProperty('--tab-x',x+'px');list.style.setProperty('--tab-w',w+'px');memory.set(key,{x,w});
  });
 };
 const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(sync);};
 /* 重绘后在绘制前同步摆好起点，避免新 tab 栏先闪一帧静态下划线。 */
 const observer=new MutationObserver(sync);observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-selected']});window.addEventListener('resize',schedule);schedule();
 return ()=>{observer.disconnect();window.removeEventListener('resize',schedule);};
}
