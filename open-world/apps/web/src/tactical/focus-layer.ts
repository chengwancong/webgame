/** Input/focus ownership for the top modal. No combat state or commands live here. */
export type FocusFallback=HTMLElement|null|(()=>HTMLElement|null);
type Bookmark={element:HTMLElement;focusKey:string|null;action:string|null;id:string|null;index:number};
type Layer={key:string;element:HTMLElement;bookmark:Bookmark|null};
const candidates='button,a[href],input,select,textarea,summary,[tabindex],[contenteditable="true"]';

function visible(element:HTMLElement):boolean{
 if(!element.isConnected||element.closest('[hidden],[inert],[aria-hidden="true"],[aria-disabled="true"]'))return false;
 if(element.matches(':disabled')||element.getAttribute('type')==='hidden')return false;
 const style=element.ownerDocument.defaultView?.getComputedStyle(element);
 return style?.display!=='none'&&style?.visibility!=='hidden'&&style?.visibility!=='collapse'&&element.getClientRects().length>0;
}
function tabbable(element:HTMLElement):boolean{return visible(element)&&element.tabIndex>=0;}
function controls(scope:HTMLElement):HTMLElement[]{
 return [...scope.querySelectorAll<HTMLElement>(candidates)].filter(tabbable)
  .map((element,index)=>({element,index,rank:element.tabIndex>0?element.tabIndex:Infinity}))
  .sort((a,b)=>a.rank-b.rank||a.index-b.index).map(row=>row.element);
}
function remember(element:HTMLElement|null,scope:HTMLElement):Bookmark|null{
 if(!element||!scope.contains(element))return null;
 return {element,focusKey:element.getAttribute('data-focus'),action:element.getAttribute('data-action'),
  id:element.getAttribute('data-id'),index:controls(scope).indexOf(element)};
}
function recover(bookmark:Bookmark|null,scope:HTMLElement):HTMLElement|null{
 if(!bookmark)return null;
 if(scope.contains(bookmark.element)&&tabbable(bookmark.element))return bookmark.element;
 const list=controls(scope);
 if(bookmark.focusKey){const found=list.find(el=>el.getAttribute('data-focus')===bookmark.focusKey);if(found)return found;}
 if(bookmark.action){const found=list.find(el=>el.getAttribute('data-action')===bookmark.action&&el.getAttribute('data-id')===bookmark.id);if(found)return found;}
 return null;
}
const keyOf=(modal:HTMLElement)=>modal.getAttribute('data-focus-layer')||modal.id||`${modal.getAttribute('role')??'dialog'}:${modal.getAttribute('aria-label')??''}`;

export class ModalFocusLayer{
 private layers:Layer[]=[];
 private returnTo:Bookmark|null=null;
 private lastRootFocus:Bookmark|null=null;
 private inertBefore=new Map<HTMLElement,boolean>();
 private tabIndexBefore=new Map<HTMLElement,string|null>();
 private dead=false;
 constructor(private readonly root:HTMLElement){root.addEventListener('focusin',this.onFocus);}
 get activeModal():HTMLElement|null{return this.layers.at(-1)?.element??null;}
 private onFocus=(event:Event)=>{
  const top=this.layers.at(-1),target=event.target as HTMLElement|null;
  if(top&&target&&top.element.contains(target))top.bookmark=remember(target,top.element);
  else if(!top&&target&&this.root.contains(target))this.lastRootFocus=remember(target,this.root);
 };

 /** Pass the currently rendered top dialog. Ordinary tooltips are not modal layers. */
 sync(modal:HTMLElement|null,backgrounds:readonly HTMLElement[]=[],fallback?:FocusFallback):void{
  if(this.dead)return;
  const previous=this.layers.at(-1),active=this.root.ownerDocument.activeElement as HTMLElement|null;
  if(modal&&(!this.root.contains(modal)||!modal.isConnected))modal=null;
  if(!modal){
   const hadModal=this.layers.length>0;
   this.layers=[];this.applyInert(new Set());this.restoreTabIndexes();
   if(hadModal){
    const supplied=typeof fallback==='function'?fallback():fallback;
    const target=recover(this.returnTo,this.root)||(supplied&&tabbable(supplied)?supplied:null)||controls(this.root)[0];
    target?.focus({preventScroll:true});
   }
   this.returnTo=null;return;
  }
  if(!previous)this.returnTo=remember(active,this.root)??this.lastRootFocus;
  else previous.bookmark=remember(active,previous.element)??previous.bookmark;
  const key=keyOf(modal),known=this.layers.findIndex(layer=>layer.key===key);
  if(known>=0){this.layers=this.layers.slice(0,known+1);this.layers[known].element=modal;}
  else this.layers.push({key,element:modal,bookmark:null});

  // Inert every sibling branch on the route to the modal, including lower overlays.
  const blocked=new Set<HTMLElement>();
  for(const element of backgrounds)if(this.root.contains(element)&&element!==this.root&&!element.contains(modal))blocked.add(element);
  for(let branch:HTMLElement=modal;branch!==this.root&&branch.parentElement;branch=branch.parentElement){
   for(const sibling of branch.parentElement.children)if(sibling!==branch)blocked.add(sibling as HTMLElement);
  }
  this.applyInert(blocked);
  if(active&&modal.contains(active)&&(active===modal||tabbable(active)))return;
  const top=this.layers.at(-1)!,list=controls(modal);
  const initial=recover(top.bookmark,modal)||list.find(el=>el.hasAttribute('autofocus'))
   ||(top.bookmark&&top.bookmark.index>=0?list[Math.min(top.bookmark.index,list.length-1)]:null)||list[0];
  if(initial)initial.focus({preventScroll:true});else this.focusModal(modal);
 }

 /** True only when the active modal owns this event target. Parent guards click/hotkeys with it. */
 allowsTarget(target:EventTarget|null):boolean{
  const modal=this.activeModal;
  return !modal||!!target&&typeof target==='object'&&'nodeType' in target&&modal.contains(target as Node);
 }
 /** Trap Tab only; Escape and application navigation belong to the controller. */
 handleKey(event:KeyboardEvent):boolean{
  const modal=this.activeModal;
  if(!modal||event.key!=='Tab'||event.ctrlKey||event.metaKey||event.altKey)return false;
  const list=controls(modal),active=this.root.ownerDocument.activeElement,index=list.indexOf(active as HTMLElement);
  event.preventDefault();event.stopPropagation();
  if(!list.length){this.focusModal(modal);return true;}
  const next=index<0?(event.shiftKey?list.length-1:0):(index+(event.shiftKey?-1:1)+list.length)%list.length;
  list[next].focus({preventScroll:true});return true;
 }
 private focusModal(modal:HTMLElement){
  if(!this.tabIndexBefore.has(modal))this.tabIndexBefore.set(modal,modal.getAttribute('tabindex'));
  modal.setAttribute('tabindex','-1');modal.focus({preventScroll:true});
 }
 private applyInert(next:Set<HTMLElement>){
  for(const [element,value] of this.inertBefore)if(!next.has(element)){element.inert=value;this.inertBefore.delete(element);}
  for(const element of next){if(!this.inertBefore.has(element))this.inertBefore.set(element,element.inert);element.inert=true;}
 }
 private restoreTabIndexes(){
  for(const [element,value] of this.tabIndexBefore){if(value===null)element.removeAttribute('tabindex');else element.setAttribute('tabindex',value);}
  this.tabIndexBefore.clear();
 }
 destroy(){
  if(this.dead)return;this.dead=true;this.root.removeEventListener('focusin',this.onFocus);
  this.applyInert(new Set());this.restoreTabIndexes();this.layers=[];this.returnTo=null;this.lastRootFocus=null;
 }
}
