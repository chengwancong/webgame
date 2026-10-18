import {stageBox} from '../stage.ts';
// Window rows only when the collection grows beyond the current 24-slot bag.
export function virtualizeInventory(host:HTMLElement,items:string[]){
 if(items.length<50)return;const grid=host.querySelector<HTMLElement>('.grid24'),scroller=host.querySelector<HTMLElement>('.inventory-grid');if(!grid||!scroller)return;
 grid.classList.add('gear-virtual-grid');let previous='',frame=0;
 const draw=()=>{
  if(!grid.isConnected){observer.disconnect();return;}
  const cols=Number(getComputedStyle(grid).getPropertyValue('--gear-grid-cols'))||6,gap=8,rowHeight=(grid.clientWidth-gap*(cols-1))/cols+gap,totalRows=Math.ceil(items.length/cols);
  const offset=stageBox(grid).top-stageBox(scroller).top+scroller.scrollTop;
  const first=Math.max(0,Math.floor((scroller.scrollTop-offset)/rowHeight)-2),last=Math.min(totalRows,Math.ceil((scroller.scrollTop-offset+scroller.clientHeight)/rowHeight)+2);
  const signature=[first,last,cols,grid.clientWidth].join(':');grid.style.height=`${Math.max(0,totalRows*rowHeight-gap)}px`;if(signature===previous)return;previous=signature;
  const active=document.activeElement instanceof HTMLElement?document.activeElement.dataset.id:undefined;
  grid.innerHTML=`<div class="gear-virtual-window" style="top:${first*rowHeight}px;grid-template-columns:repeat(${cols},minmax(0,1fr))">${items.slice(first*cols,last*cols).join('')}</div>`;
  if(active)Array.from(grid.querySelectorAll<HTMLElement>('[data-id]')).find(el=>el.dataset.id===active)?.focus({preventScroll:true});
 };
 const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);},observer=new ResizeObserver(update);observer.observe(grid);scroller.addEventListener('scroll',update,{passive:true});draw();
}
