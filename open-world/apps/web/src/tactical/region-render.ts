/** Preserve UI continuity when an event changes a rendered region. */
type ScrollPosition={top:number;left:number};
const keyed=(region:HTMLElement,attribute:'data-focus'|'data-scroll-key'):HTMLElement[]=>[
 ...(region.hasAttribute(attribute)?[region]:[]),...region.querySelectorAll<HTMLElement>(`[${attribute}]`),
];
function canRestoreFocus(element:HTMLElement):boolean{
 if(!element.isConnected||element.closest('[inert],[hidden],[aria-hidden="true"],[aria-disabled="true"]')||element.matches(':disabled'))return false;
 const style=element.ownerDocument.defaultView?.getComputedStyle(element);
 return style?.display!=='none'&&style?.visibility!=='hidden'&&style?.visibility!=='collapse'&&element.getClientRects().length>0;
}

export class RegionRenderer{
 private readonly markup=new WeakMap<HTMLElement,string>();

 /** Keys are opaque strings. They are compared as attributes, never interpolated into selectors. */
 render(region:HTMLElement,html:string,canFocus?:(element:HTMLElement)=>boolean):boolean{
  if(this.markup.get(region)===html)return false;
  const active=region.ownerDocument.activeElement;
  const focusKey=active&&region.contains(active)?active.getAttribute('data-focus'):null;
  const scroll=new Map<string,ScrollPosition>();
  for(const element of keyed(region,'data-scroll-key')){
   const key=element.getAttribute('data-scroll-key')!;
   if(!scroll.has(key))scroll.set(key,{top:element.scrollTop,left:element.scrollLeft});
  }

  region.innerHTML=html;
  this.markup.set(region,html);
  try{
   const target=focusKey===null?null:keyed(region,'data-focus').find(element=>element.getAttribute('data-focus')===focusKey);
   // Negative tabindex is intentionally allowed for programmatically focused detail panels.
   if(target&&target!==region.ownerDocument.activeElement&&canRestoreFocus(target)&&(canFocus?.(target)??true))target.focus({preventScroll:true});
  }finally{
   // Restore after focus as well: even a host's focus implementation must not jump a reader.
   const restored=new Set<string>();
   for(const element of keyed(region,'data-scroll-key')){
    const key=element.getAttribute('data-scroll-key')!,position=scroll.get(key);
    if(!position||restored.has(key))continue;
    element.scrollTop=position.top;element.scrollLeft=position.left;restored.add(key);
   }
  }
  return true;
 }
}
