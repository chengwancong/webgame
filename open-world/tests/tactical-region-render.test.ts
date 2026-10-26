import {describe,expect,it,vi} from 'vitest';
import {RegionRenderer} from '../apps/web/src/tactical/region-render.ts';

/** DOM replacement contract, deliberately without a browser or a new DOM dependency. */
class FakeDocument{
 activeElement:FakeElement|null=null;
 defaultView={getComputedStyle:(el:FakeElement)=>({display:el.display,visibility:el.visibility})};
 body:FakeElement=new FakeElement(this);
}
class FakeElement{
 parentElement:FakeElement|null=null;
 children:FakeElement[]=[];
 readonly attributes=new Map<string,string>();
 scrollTop=0;scrollLeft=0;disabled=false;inert=false;display='block';visibility='visible';
 focusCalls:FocusOptions[]=[];onFocus?:()=>void;
 queries:string[]=[];
 constructor(readonly ownerDocument:FakeDocument,attrs:Record<string,string>={}){
  for(const [key,value] of Object.entries(attrs))this.attributes.set(key,value);
 }
 get isConnected():boolean{return this===this.ownerDocument.body||!!this.parentElement?.isConnected;}
 hasAttribute(name:string){return this.attributes.has(name);}
 getAttribute(name:string){return this.attributes.get(name)??null;}
 setAttribute(name:string,value:string){this.attributes.set(name,value);}
 append(...items:FakeElement[]){for(const child of items){child.parentElement=this;this.children.push(child);}}
 contains(element:unknown):boolean{return this===element||this.children.some(child=>child.contains(element));}
 closest(_selector:string):FakeElement|null{
  for(let node:FakeElement|null=this;node;node=node.parentElement){
   if(node.inert||node.hasAttribute('hidden')||node.getAttribute('aria-hidden')==='true'||node.getAttribute('aria-disabled')==='true')return node;
  }
  return null;
 }
 matches(selector:string){return selector===':disabled'&&this.disabled;}
 getClientRects(){return this.display==='none'?[]:[{}];}
 querySelectorAll(selector:string):FakeElement[]{
  this.queries.push(selector);
  if(selector!=='[data-focus]'&&selector!=='[data-scroll-key]')throw Error(`Unexpected selector ${selector}`);
  const attribute=selector.slice(1,-1),found:FakeElement[]=[];
  const visit=(element:FakeElement)=>{for(const child of element.children){if(child.hasAttribute(attribute))found.push(child);visit(child);}};
  visit(this);return found;
 }
 focus(options:FocusOptions){this.focusCalls.push(options);this.ownerDocument.activeElement=this;this.onFocus?.();}
}
class FakeRegion extends FakeElement{
 private source='';writes=0;
 versions=new Map<string,FakeElement[]>();
 get innerHTML(){return this.source;}
 set innerHTML(html:string){
  this.writes++;this.source=html;
  if(this.ownerDocument.activeElement!==this&&this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=this.ownerDocument.body;
  for(const child of this.children)child.parentElement=null;
  this.children=[];this.scrollTop=0;this.scrollLeft=0;
  this.append(...(this.versions.get(html)??[]));
 }
}
const asElement=(element:FakeElement)=>element as unknown as HTMLElement;
function setup(){
 const document=new FakeDocument(),region=new FakeRegion(document),renderer=new RegionRenderer();document.body.append(region);
 return {document,region,renderer};
}

describe('rendered region continuity',()=>{
 it('does not replace identical markup or discard hydrated children and current scroll',()=>{
  const s=setup(),first=new FakeElement(s.document,{'data-focus':'skill'});s.region.versions.set('a',[first]);
  expect(s.renderer.render(asElement(s.region),'a')).toBe(true);
  const hydrated=new FakeElement(s.document);first.append(hydrated);first.focus({});s.region.scrollTop=33;
  expect(s.renderer.render(asElement(s.region),'a')).toBe(false);
  expect(s.region.writes).toBe(1);expect(first.children).toEqual([hydrated]);expect(s.document.activeElement).toBe(first);expect(s.region.scrollTop).toBe(33);
 });

 it('restores opaque focus and scroll keys without selector interpolation',()=>{
  const s=setup(),key='技能["一"] #范围 > .目标',before=new FakeElement(s.document,{'data-scroll-key':key}),oldButton=new FakeElement(s.document,{'data-focus':key});before.append(oldButton);s.region.versions.set('a',[before]);
  s.renderer.render(asElement(s.region),'a');before.scrollTop=125;before.scrollLeft=-19;oldButton.focus({});
  const after=new FakeElement(s.document,{'data-scroll-key':key}),newButton=new FakeElement(s.document,{'data-focus':key});after.append(newButton);s.region.versions.set('b',[after]);
  expect(s.renderer.render(asElement(s.region),'b')).toBe(true);
  expect(s.document.activeElement).toBe(newButton);expect(newButton.focusCalls).toEqual([{preventScroll:true}]);
  expect([after.scrollTop,after.scrollLeft]).toEqual([125,-19]);
  expect(s.region.queries.every(selector=>selector==='[data-focus]'||selector==='[data-scroll-key]')).toBe(true);
 });

 it('does not carry scroll into a different detail identity or focus an unrelated control',()=>{
  const s=setup(),old=new FakeElement(s.document,{'data-scroll-key':'ability:one','data-focus':'ability-one'});s.region.versions.set('a',[old]);
  s.renderer.render(asElement(s.region),'a');old.scrollTop=180;old.focus({});
  const next=new FakeElement(s.document,{'data-scroll-key':'ability:two','data-focus':'ability-two'});s.region.versions.set('b',[next]);
  s.renderer.render(asElement(s.region),'b');expect(next.scrollTop).toBe(0);expect(next.focusCalls).toEqual([]);
 });

 it.each(['disabled','inert','aria-disabled','hidden','css-hidden','guarded'] as const)('does not restore focus to a %s target, but restores its scroll',mode=>{
  const s=setup(),old=new FakeElement(s.document,{'data-focus':'details','data-scroll-key':'details'});s.region.versions.set('a',[old]);
  s.renderer.render(asElement(s.region),'a');old.scrollTop=45;old.focus({});
  const next=new FakeElement(s.document,{'data-focus':'details','data-scroll-key':'details'}),container=new FakeElement(s.document);container.append(next);s.region.versions.set('b',[container]);
  if(mode==='disabled')next.disabled=true;
  if(mode==='inert')container.inert=true;
  if(mode==='aria-disabled')next.setAttribute('aria-disabled','true');
  if(mode==='hidden')container.setAttribute('hidden','');
  if(mode==='css-hidden')next.visibility='hidden';
  const guard=vi.fn(()=>mode!=='guarded');s.renderer.render(asElement(s.region),'b',guard);
  expect(next.focusCalls).toEqual([]);expect(next.scrollTop).toBe(45);
  if(mode==='guarded')expect(guard).toHaveBeenCalledWith(next);
 });

 it('does not steal focus from outside the region',()=>{
  const s=setup(),external=new FakeElement(s.document,{'data-focus':'same'});s.document.body.append(external);external.focus({});
  const next=new FakeElement(s.document,{'data-focus':'same'});s.region.versions.set('a',[next]);
  s.renderer.render(asElement(s.region),'a');expect(s.document.activeElement).toBe(external);expect(next.focusCalls).toEqual([]);
 });

 it('supports a negative-tabindex detail panel and restores scroll after focus',()=>{
  const s=setup(),old=new FakeElement(s.document,{'data-focus':'panel',tabindex:'-1','data-scroll-key':'panel'});s.region.versions.set('a',[old]);
  s.renderer.render(asElement(s.region),'a');old.scrollTop=150;old.focus({});
  const next=new FakeElement(s.document,{'data-focus':'panel',tabindex:'-1','data-scroll-key':'panel'});next.onFocus=()=>{next.scrollTop=0;};s.region.versions.set('b',[next]);
  s.renderer.render(asElement(s.region),'b');expect(s.document.activeElement).toBe(next);expect(next.scrollTop).toBe(150);
 });

 it('also preserves a keyed region scrollbar and keeps caches independent per region',()=>{
  const s=setup();s.region.setAttribute('data-scroll-key','root-scroll');s.renderer.render(asElement(s.region),'a');s.region.scrollTop=70;s.region.scrollLeft=20;
  s.renderer.render(asElement(s.region),'b');expect([s.region.scrollTop,s.region.scrollLeft]).toEqual([70,20]);
  const other=new FakeRegion(s.document);s.document.body.append(other);
  expect(s.renderer.render(asElement(other),'b')).toBe(true);expect(other.writes).toBe(1);
 });
});
