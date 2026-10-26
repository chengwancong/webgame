import {describe,expect,it,vi} from 'vitest';
import {ModalFocusLayer} from '../apps/web/src/tactical/focus-layer.ts';

/** Minimal DOM contract for focus ownership; no browser or DOM package is involved. */
class FakeDocument{
 activeElement:FakeElement|null=null;
 defaultView={getComputedStyle:(element:FakeElement)=>({display:element.display,visibility:element.visibility})};
 body:FakeElement=new FakeElement(this,'body');
}
class FakeElement{
 readonly nodeType=1;
 parentElement:FakeElement|null=null;
 children:FakeElement[]=[];
 inert=false;disabled=false;display='block';visibility='visible';
 private attributes=new Map<string,string>();
 private events=new Map<string,Set<(event:Event)=>void>>();
 constructor(readonly ownerDocument:FakeDocument,readonly tag='div',attrs:Record<string,string>={}){
  for(const [name,value] of Object.entries(attrs))this.setAttribute(name,value);
 }
 get id(){return this.getAttribute('id')??'';}
 get tabIndex(){const custom=this.getAttribute('tabindex');return custom!==null?Number(custom):['button','input','select','textarea','summary'].includes(this.tag)||this.tag==='a'&&this.hasAttribute('href')?0:-1;}
 get isConnected():boolean{return this===this.ownerDocument.body||!!this.parentElement?.isConnected;}
 setAttribute(name:string,value:string){this.attributes.set(name,value);}
 getAttribute(name:string){return this.attributes.get(name)??null;}
 hasAttribute(name:string){return this.attributes.has(name);}
 removeAttribute(name:string){this.attributes.delete(name);}
 append(...nodes:FakeElement[]){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
 remove(){
  if(this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=this.ownerDocument.body;
  if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);
  this.parentElement=null;
 }
 contains(node:unknown):boolean{return node===this||this.children.some(child=>child.contains(node));}
 closest(_selector:string):FakeElement|null{
  for(let node:FakeElement|null=this;node;node=node.parentElement){
   if(node.inert||node.hasAttribute('hidden')||node.getAttribute('aria-hidden')==='true'||node.getAttribute('aria-disabled')==='true')return node;
  }
  return null;
 }
 matches(selector:string){return selector===':disabled'&&this.disabled;}
 querySelectorAll(_selector:string):FakeElement[]{
  const all:FakeElement[]=[];
  const walk=(node:FakeElement)=>{for(const child of node.children){if(['button','input','select','textarea','summary'].includes(child.tag)||child.tag==='a'&&child.hasAttribute('href')||child.hasAttribute('tabindex')||child.getAttribute('contenteditable')==='true')all.push(child);walk(child);}};
  walk(this);return all;
 }
 getClientRects(){
  for(let node:FakeElement|null=this;node;node=node.parentElement)if(node.display==='none')return [];
  return [{}];
 }
 focus(){
  if(this.closest('')||this.disabled)return;
  this.ownerDocument.activeElement=this;
  for(let node:FakeElement|null=this;node;node=node.parentElement){for(const listener of node.events.get('focusin')??[])listener({target:this} as unknown as Event);}
 }
 addEventListener(type:string,listener:(event:Event)=>void){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type)!.add(listener);}
 removeEventListener(type:string,listener:(event:Event)=>void){this.events.get(type)?.delete(listener);}
}
const element=(node:FakeElement)=>node as unknown as HTMLElement;
const key=(shiftKey=false,extra:Partial<KeyboardEvent>={})=>({key:'Tab',shiftKey,ctrlKey:false,metaKey:false,altKey:false,preventDefault:vi.fn(),stopPropagation:vi.fn(),...extra}) as unknown as KeyboardEvent;
function setup(){
 const doc=new FakeDocument(),root=new FakeElement(doc),top=new FakeElement(doc),main=new FakeElement(doc),bottom=new FakeElement(doc),overlays=new FakeElement(doc);
 doc.body.append(root);root.append(top,main,bottom,overlays);
 const opener=new FakeElement(doc,'button',{'data-focus':'cmd-end','data-action':'end'});bottom.append(opener);
 const manager=new ModalFocusLayer(element(root));opener.focus();
 const makeModal=(name:string)=>{
  const backdrop=new FakeElement(doc),modal=new FakeElement(doc,'section',{'data-focus-layer':name,role:'dialog','aria-label':name});backdrop.append(modal);overlays.append(backdrop);
  const cancel=new FakeElement(doc,'button',{'data-action':'cancel','data-focus':`${name}-cancel`}),confirm=new FakeElement(doc,'button',{'data-action':'confirm','data-focus':`${name}-confirm`});modal.append(cancel,confirm);
  return {backdrop,modal,cancel,confirm};
 };
 return {doc,root,top,main,bottom,overlays,opener,manager,makeModal};
}

describe('top modal focus ownership',()=>{
 it('inerts every background branch, enters the modal and traps forward/backward Tab',()=>{
  const s=setup(),m=s.makeModal('end');s.manager.sync(element(m.modal),[element(s.top),element(s.main),element(s.bottom)]);
  expect(s.doc.activeElement).toBe(m.cancel);
  expect([s.top.inert,s.main.inert,s.bottom.inert]).toEqual([true,true,true]);
  const tab=key();expect(s.manager.handleKey(tab)).toBe(true);expect(tab.preventDefault).toHaveBeenCalled();expect(s.doc.activeElement).toBe(m.confirm);
  s.manager.handleKey(key());expect(s.doc.activeElement).toBe(m.cancel);
  s.manager.handleKey(key(true));expect(s.doc.activeElement).toBe(m.confirm);
  expect(s.manager.allowsTarget(s.opener as unknown as EventTarget)).toBe(false);
  expect(s.manager.allowsTarget(m.confirm as unknown as EventTarget)).toBe(true);
  s.manager.destroy();
 });
 it('skips disabled, aria-disabled, hidden, CSS-hidden and negative-tabindex controls',()=>{
  const s=setup(),m=s.makeModal('end');m.confirm.disabled=true;
  const hidden=new FakeElement(s.doc,'button',{hidden:''}),aria=new FakeElement(s.doc,'button',{'aria-disabled':'true'}),negative=new FakeElement(s.doc,'button',{tabindex:'-1'}),css=new FakeElement(s.doc,'button');css.display='none';
  const valid=new FakeElement(s.doc,'input');m.modal.append(hidden,aria,negative,css,valid);
  s.manager.sync(element(m.modal));s.manager.handleKey(key());expect(s.doc.activeElement).toBe(valid);
  s.manager.handleKey(key());expect(s.doc.activeElement).toBe(m.cancel);
  s.manager.destroy();
 });
 it('restores the opener by stable key after a background redraw and preserves prior inert state',()=>{
  const s=setup(),m=s.makeModal('end');s.top.inert=true;
  s.manager.sync(element(m.modal));s.opener.remove();
  const replacement=new FakeElement(s.doc,'button',{'data-focus':'cmd-end'});s.bottom.append(replacement);
  m.backdrop.remove();s.manager.sync(null);
  expect(s.doc.activeElement).toBe(replacement);expect(s.top.inert).toBe(true);expect(s.main.inert).toBe(false);expect(s.bottom.inert).toBe(false);
  s.manager.destroy();
 });
 it('uses the supplied available fallback when the opener is now disabled',()=>{
  const s=setup(),m=s.makeModal('end'),fallback=new FakeElement(s.doc,'button',{'data-focus':'hero-cell'});s.main.append(fallback);
  s.manager.sync(element(m.modal));s.opener.disabled=true;m.backdrop.remove();s.manager.sync(null,[],()=>element(fallback));
  expect(s.doc.activeElement).toBe(fallback);s.manager.destroy();
 });
 it('preserves a focused action across same-modal DOM replacement',()=>{
  const s=setup(),first=s.makeModal('end');s.manager.sync(element(first.modal));first.confirm.focus();first.backdrop.remove();
  const replacement=s.makeModal('end');s.manager.sync(element(replacement.modal));
  expect(s.doc.activeElement).toBe(replacement.confirm);s.manager.destroy();
 });
 it('returns to the previous modal control when a nested layer is popped',()=>{
  const s=setup(),first=s.makeModal('end');s.manager.sync(element(first.modal));first.confirm.focus();
  const second=s.makeModal('retreat');s.manager.sync(element(second.modal));expect(first.backdrop.inert).toBe(true);
  second.backdrop.remove();s.manager.sync(element(first.modal));expect(first.backdrop.inert).toBe(false);expect(s.doc.activeElement).toBe(first.confirm);
  first.backdrop.remove();s.manager.sync(null);expect(s.doc.activeElement).toBe(s.opener);s.manager.destroy();
 });
 it('focuses the dialog itself while every action is unavailable, without trapping browser shortcuts',()=>{
  const s=setup(),m=s.makeModal('busy');m.cancel.disabled=true;m.confirm.disabled=true;s.manager.sync(element(m.modal));
  expect(s.doc.activeElement).toBe(m.modal);expect(m.modal.getAttribute('tabindex')).toBe('-1');
  s.manager.handleKey(key());expect(s.doc.activeElement).toBe(m.modal);
  expect(s.manager.handleKey(key(false,{ctrlKey:true}))).toBe(false);
  expect(s.manager.handleKey(key(false,{key:'Escape'}))).toBe(false);
  s.manager.sync(null);expect(m.modal.hasAttribute('tabindex')).toBe(false);s.manager.destroy();
 });
 it('retains the last root focus when render removed the opener before the modal was synchronized',()=>{
  const s=setup();s.opener.remove();const replacement=new FakeElement(s.doc,'button',{'data-focus':'cmd-end'});s.bottom.append(replacement);
  const m=s.makeModal('end');s.manager.sync(element(m.modal));m.backdrop.remove();s.manager.sync(null);
  expect(s.doc.activeElement).toBe(replacement);s.manager.destroy();
 });
 it('does not move focus when no modal exists and releases inert ownership on destroy',()=>{
  const s=setup();s.manager.sync(null);expect(s.doc.activeElement).toBe(s.opener);expect(s.manager.handleKey(key())).toBe(false);
  const m=s.makeModal('end');s.manager.sync(element(m.modal));s.manager.destroy();
  expect(s.main.inert).toBe(false);expect(s.bottom.inert).toBe(false);expect(s.manager.activeModal).toBeNull();
 });
});
