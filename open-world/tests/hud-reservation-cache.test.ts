import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {screenReservations} from '../apps/web/src/hud-avoidance.ts';
import type Phaser from 'phaser';

class Signals{
 listeners=new Map<string,Set<(event:any)=>void>>();
 addEventListener(name:string,fn:(event:any)=>void){let list=this.listeners.get(name);if(!list)this.listeners.set(name,list=new Set());list.add(fn);}
 removeEventListener(name:string,fn:(event:any)=>void){this.listeners.get(name)?.delete(fn);}
 fire(name:string,target:unknown=this,extra:object={}){for(const fn of [...this.listeners.get(name)??[]])fn({type:name,target,...extra});}
}
class ElementDouble extends Signals{
 children:ElementDouble[]=[];hidden=false;textContent='HUD';childElementCount=0;selected=false;
 style={display:'block',visibility:'visible',opacity:'1',animationIterationCount:'1'};
 box={left:100,top:40,width:200,height:80};
 getBoundingClientRect=vi.fn(()=>({...this.box}));
 contains(other:unknown):boolean{return other===this||this.children.some(child=>child.contains(other));}
 matches(){return this.selected;}
 querySelector():ElementDouble|undefined{return this.children.find(child=>child.selected)??this.children.map(child=>child.querySelector()).find(Boolean);}
}
let mutation:MutationDouble,resize:ResizeDouble,scene:Phaser.Scene,events:Map<string,()=>void>,doc:Signals&Record<string,any>,win:Signals,hud:ElementDouble,bar:ElementDouble,canvas:ElementDouble,roots:ElementDouble[],style:ReturnType<typeof vi.fn>;
class MutationDouble{
 records:MutationRecord[]=[];observe=vi.fn();disconnect=vi.fn();
 constructor(public callback:(records:MutationRecord[])=>void){mutation=this;}
 takeRecords(){return this.records.splice(0);}
}
class ResizeDouble{
 observe=vi.fn();unobserve=vi.fn();disconnect=vi.fn();
 constructor(public callback:()=>void){resize=this;}
}
const change=(type:string,target:ElementDouble,attributeName?:string)=>({type,target,attributeName,addedNodes:[],removedNodes:[]}) as unknown as MutationRecord;

beforeEach(()=>{
 hud=new ElementDouble();hud.selected=true;bar=new ElementDouble();hud.children.push(bar);roots=[hud];canvas=new ElementDouble();canvas.box={left:0,top:0,width:1280,height:720};
 const body=new ElementDouble(),html=new ElementDouble();body.children.push(hud,canvas);html.children.push(body);
 doc=Object.assign(new Signals(),{body,documentElement:html,fonts:new Signals(),querySelectorAll:vi.fn(()=>roots)});win=new Signals();events=new Map();
 scene={game:{canvas},scale:{width:1280,height:720},events:{once:(name:string,fn:()=>void)=>events.set(name,fn),off:(name:string,fn:()=>void)=>{if(events.get(name)===fn)events.delete(name);}}} as unknown as Phaser.Scene;
 style=vi.fn((element:ElementDouble)=>element.style);
 vi.stubGlobal('document',doc);vi.stubGlobal('window',win);vi.stubGlobal('Element',ElementDouble);vi.stubGlobal('getComputedStyle',style);vi.stubGlobal('MutationObserver',MutationDouble);vi.stubGlobal('ResizeObserver',ResizeDouble);
});
afterEach(()=>{events.get('shutdown')?.();vi.unstubAllGlobals();});

describe('event-driven HUD reservation geometry',()=>{
 it('reuses measured rectangles across stationary frames without a time-based refresh',()=>{
  const first=screenReservations(scene);for(let frame=0;frame<600;frame++)expect(screenReservations(scene)).toBe(first);
  expect(first).toEqual([{x:100,y:40,width:200,height:80}]);expect(hud.getBoundingClientRect).toHaveBeenCalledTimes(1);expect(canvas.getBoundingClientRect).toHaveBeenCalledTimes(1);expect(style).toHaveBeenCalledTimes(1);
 });
 it('ignores descendant progress styles but remeasures an actual outer resize',()=>{
  const first=screenReservations(scene);mutation.callback([change('attributes',bar,'style')]);expect(screenReservations(scene)).toBe(first);
  hud.box.width=260;resize.callback();expect(screenReservations(scene)[0].width).toBe(260);expect(hud.getBoundingClientRect).toHaveBeenCalledTimes(2);
 });
 it('consumes same-frame content mutations before using the cache and discovers replacement HUD nodes',()=>{
  screenReservations(scene);hud.box.height=120;mutation.records.push(change('characterData',bar));expect(screenReservations(scene)[0].height).toBe(120);
  const replacement=new ElementDouble();replacement.selected=true;replacement.box.left=700;roots=[replacement];
  mutation.callback([{...change('childList',doc.body),addedNodes:[replacement],removedNodes:[hud]} as unknown as MutationRecord]);
  expect(screenReservations(scene)[0].x).toBe(700);expect(resize.unobserve).toHaveBeenCalledWith(hud);expect(resize.observe).toHaveBeenCalledWith(replacement);
 });
 it('reacts to root visibility, fonts, window scroll and backing scale changes',()=>{
  screenReservations(scene);hud.hidden=true;mutation.callback([change('attributes',hud,'hidden')]);expect(screenReservations(scene)).toEqual([]);
  hud.hidden=false;doc.fonts.fire('loadingdone');expect(screenReservations(scene)).toHaveLength(1);
  hud.box.left=120;win.fire('scroll');expect(screenReservations(scene)[0].x).toBe(120);
  (scene.scale as any).width=2560;expect(screenReservations(scene)[0].x).toBe(240);
 });
 it('tracks finite position transitions only while running, without polling for opacity or infinite decorative animation',()=>{
  const initial=screenReservations(scene);doc.fire('transitionrun',hud,{propertyName:'transform'});screenReservations(scene);hud.box.left=150;expect(screenReservations(scene)[0].x).toBe(150);
  doc.fire('transitionend',hud,{propertyName:'transform'});const stopped=screenReservations(scene);expect(screenReservations(scene)).toBe(stopped);
  doc.fire('transitionrun',hud,{propertyName:'opacity'});const opacity=screenReservations(scene);expect(screenReservations(scene)).toBe(opacity);
  hud.style.animationIterationCount='infinite';doc.fire('animationstart',hud);const animated=screenReservations(scene);expect(screenReservations(scene)).toBe(animated);expect(initial).not.toBe(animated);
 });
 it('disconnects observers and event handlers when the scene shuts down',()=>{
  screenReservations(scene);events.get('shutdown')!();expect(mutation.disconnect).toHaveBeenCalledTimes(1);expect(resize.disconnect).toHaveBeenCalledTimes(1);
  expect([...win.listeners.values()].every(list=>!list.size)).toBe(true);expect([...doc.listeners.values()].every(list=>!list.size)).toBe(true);expect([...doc.fonts.listeners.values()].every((list:any)=>!list.size)).toBe(true);expect(events.size).toBe(0);
 });
});
