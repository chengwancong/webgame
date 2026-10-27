import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import type {ResolvedAppearance} from '../packages/contracts/appearance.ts';
const fixture=vi.hoisted(()=>({requests:[] as Array<{mode:string;resolve:(value:boolean)=>void;key:string;destroyed:boolean;ready:boolean;revision:number;renderFailed:boolean;validationRevision:number;diagnosticCalls:number;renderThrows:boolean}>}));
vi.mock('../apps/web/src/wardrobe-renderer.ts',async importOriginal=>{
 const source=await importOriginal<typeof import('../apps/web/src/wardrobe-renderer.ts')>();
 class Painter {
  row?:typeof fixture.requests[number];
  private frameKey='';
  async setAppearance(appearance:ResolvedAppearance){
   const key=source.appearanceRenderKey(appearance);
   if(this.row?.ready&&this.row.key===key){this.row.revision=appearance.revision;return true;}
   return new Promise<boolean>(resolve=>{const row={mode:'legacy',resolve:(value:boolean)=>{row.ready=value;resolve(value);},key,destroyed:false,ready:false,revision:appearance.revision,renderFailed:false,validationRevision:0,diagnosticCalls:0,renderThrows:false};this.row=row;fixture.requests.push(row);});
  }
  get ready(){return Boolean(this.row?.ready);}get mirrored(){return false;}get frameName(){return 'idle_0';}
  get validationFrameKey(){return this.frameKey;}get validationRevision(){return this.row?.validationRevision??0;}get renderValid(){return !this.row?.renderFailed;}
  render(state:{action:string;clock:number;facing:number;skill?:string}){if(this.row?.renderThrows)throw Error('test render error');this.frameKey=[state.action,Math.floor(state.clock*24)%4,state.facing,state.skill??''].join(':');return !this.row?.renderFailed;}socket(){return {x:1,y:2};}drawPortrait(){return true;}
  diagnostics(){if(this.row)this.row.diagnosticCalls++;return {key:this.row?.key,errors:[],revision:this.row?.revision};}
  destroy(){if(this.row)this.row.destroyed=true;}
 }
 return {...source,WardrobePreview:Painter};
});
vi.mock('../apps/web/src/mini-native-renderer.ts',async()=>{
 const {WardrobePreview}=await import('../apps/web/src/wardrobe-renderer.ts');
 class Mini extends WardrobePreview {
  override setAppearance(a:ResolvedAppearance){const result=super.setAppearance(a);if(fixture.requests.length)fixture.requests.at(-1)!.mode='native';return result;}
 }
 return {MiniNativePreview:Mini,miniSupportsAppearance:(a:ResolvedAppearance)=>a.family==='sword'};
});
import {HeroPreview} from '../apps/web/src/hero-appearance.ts';
const appearance=(family:ResolvedAppearance['family'],revision=1):ResolvedAppearance=>({rig:'modular-hero',family,revision,styleProfile:'v2-soft',parts:Object.fromEntries(['head','body','hands','legs','feet','back','weapon'].map(slot=>[slot,{setId:slot==='weapon'&&family==='bow'?'400104':'100011'}])) as ResolvedAppearance['parts']});
const canvas=()=>({width:64,height:64,getContext:()=>({drawImage(){},clearRect(){},getImageData:()=>({data:new Uint8ClampedArray([0,0,0,255])})})}) as unknown as HTMLCanvasElement;
describe('hero appearance renderer switching',()=>{
 beforeEach(()=>{fixture.requests.splice(0);vi.stubGlobal('document',{createElement:()=>canvas()});});
 afterEach(()=>vi.unstubAllGlobals());
 it('retains the complete native outfit until the legacy outfit is ready, including failed loads',async()=>{
  const hero=new HeroPreview(canvas()),first=hero.setAppearance(appearance('sword'));
  fixture.requests[0].resolve(true);expect(await first).toBe(true);const key=hero.diagnostics().key;
  const failed=hero.setAppearance(appearance('bow'));expect(hero.diagnostics().key).toBe(key);expect(hero.diagnostics().pending).toBe(true);
  fixture.requests[1].resolve(false);expect(await failed).toBe(false);expect(hero.ready).toBe(true);expect(hero.diagnostics().key).toBe(key);expect(fixture.requests[0].destroyed).toBe(false);
  // A different requested outfit starts immediately; the failed retry backoff is per requested key.
  const next=hero.setAppearance({...appearance('bow'),styleProfile:'v2-soft',parts:{...appearance('bow').parts,head:{setId:'100041'}}});fixture.requests[2].resolve(true);expect(await next).toBe(true);expect(fixture.requests[0].destroyed).toBe(true);expect(hero.diagnostics().key).not.toBe(key);hero.destroy();
 });
 it('a late legacy load cannot replace a newer native request',async()=>{
  const hero=new HeroPreview(canvas()),slow=hero.setAppearance(appearance('bow'));
  const recent=hero.setAppearance(appearance('sword'));expect(fixture.requests[0].destroyed).toBe(true);
  fixture.requests[1].resolve(true);expect(await recent).toBe(true);const key=hero.diagnostics().key;
  fixture.requests[0].resolve(true);expect(await slow).toBe(false);expect(hero.diagnostics().key).toBe(key);expect(fixture.requests[1].destroyed).toBe(false);hero.destroy();
 });
 it('a successfully decoded outfit with a broken first render does not replace the visible outfit',async()=>{
  const hero=new HeroPreview(canvas()),first=hero.setAppearance(appearance('sword'));fixture.requests[0].resolve(true);await first;const key=hero.diagnostics().key;
  const failed=hero.setAppearance(appearance('bow'));fixture.requests[1].renderFailed=true;fixture.requests[1].resolve(true);
  expect(await failed).toBe(false);expect(hero.diagnostics().key).toBe(key);expect(hero.ready).toBe(true);expect(fixture.requests[0].destroyed).toBe(false);expect(fixture.requests[1].destroyed).toBe(true);hero.destroy();
 });
 it('destroy invalidates an in-flight outfit, and revision changes reuse the active renderer',async()=>{
  const hero=new HeroPreview(canvas()),first=hero.setAppearance(appearance('sword'));fixture.requests[0].resolve(true);await first;
  expect(await hero.setAppearance(appearance('sword',5))).toBe(true);expect(fixture.requests).toHaveLength(1);expect(hero.diagnostics().revision).toBe(5);
  const pending=hero.setAppearance(appearance('bow'));hero.destroy();fixture.requests[1].resolve(true);expect(await pending).toBe(false);expect(hero.ready).toBe(false);expect(fixture.requests.every(r=>r.destroyed)).toBe(true);
 });
 it('a blank combat frame never replaces the last visible outfit pixels',async()=>{
  let alpha=255;vi.stubGlobal('document',{createElement:()=>({width:64,height:64,getContext:()=>({drawImage(){},clearRect(){},getImageData:()=>({data:new Uint8ClampedArray([0,0,0,alpha])})})})});
  const draw=vi.fn(),output={width:64,height:64,getContext:()=>({drawImage:draw,clearRect(){},getImageData:()=>({data:new Uint8ClampedArray([0,0,0,255])})})} as unknown as HTMLCanvasElement;
  const hero=new HeroPreview(output),first=hero.setAppearance(appearance('sword'));fixture.requests[0].resolve(true);await first;const count=draw.mock.calls.length;
  alpha=0;expect(hero.render({action:'attack',clock:.2,facing:1})).toBe(false);expect(draw).toHaveBeenCalledTimes(count);expect(hero.ready).toBe(true);hero.destroy();
 });
 it('does not build diagnostics while repeatedly confirming an unchanged outfit',async()=>{
  const hero=new HeroPreview(canvas()),first=hero.setAppearance(appearance('sword'));fixture.requests[0].resolve(true);await first;
  const calls=fixture.requests[0].diagnosticCalls;
  for(let frame=0;frame<120;frame++)expect(await hero.setAppearance(appearance('sword',frame+2))).toBe(true);
  expect(fixture.requests[0].diagnosticCalls).toBe(calls);expect(fixture.requests[0].revision).toBe(121);hero.destroy();
 });
 it('validates each new animation frame once, then reuses its result across loops',async()=>{
  const read=vi.fn(()=>({data:new Uint8ClampedArray([0,0,0,255])}));
  vi.stubGlobal('document',{createElement:()=>({width:64,height:64,getContext:()=>({drawImage(){},clearRect(){},getImageData:read})})});
  const hero=new HeroPreview(canvas()),first=hero.setAppearance(appearance('sword'));fixture.requests[0].resolve(true);await first;read.mockClear();
  for(let frame=0;frame<120;frame++)expect(hero.render({action:'move',clock:frame/24,facing:1})).toBe(true);
  expect(read).toHaveBeenCalledTimes(4);
  hero.render({action:'move',clock:0,facing:-1});expect(read).toHaveBeenCalledTimes(5);hero.destroy();
 });
 it('invalidates frame validation after renderer/context generation changes and retains old pixels on a blank retry',async()=>{
  let alpha=255;const read=vi.fn(()=>({data:new Uint8ClampedArray([0,0,0,alpha])}));
  vi.stubGlobal('document',{createElement:()=>({width:64,height:64,getContext:()=>({drawImage(){},clearRect(){},getImageData:read})})});
  const draw=vi.fn(),output={width:64,height:64,getContext:()=>({drawImage:draw,clearRect(){}})} as unknown as HTMLCanvasElement;
  const hero=new HeroPreview(output),first=hero.setAppearance(appearance('sword'));fixture.requests[0].resolve(true);await first;
  hero.render({action:'move',clock:0,facing:1});const count=draw.mock.calls.length;read.mockClear();
  fixture.requests[0].validationRevision++;alpha=0;
  expect(hero.render({action:'move',clock:0,facing:1})).toBe(false);expect(draw).toHaveBeenCalledTimes(count);expect(read).toHaveBeenCalledTimes(1);
  alpha=255;expect(hero.render({action:'move',clock:0,facing:1})).toBe(true);expect(read).toHaveBeenCalledTimes(2);
  hero.render({action:'move',clock:0,facing:1});expect(read).toHaveBeenCalledTimes(2);hero.destroy();
 });
 it('a thrown render invalidates prior frame validation without replacing the visible frame',async()=>{
  const read=vi.fn(()=>({data:new Uint8ClampedArray([0,0,0,255])}));
  vi.stubGlobal('document',{createElement:()=>({width:64,height:64,getContext:()=>({drawImage(){},clearRect(){},getImageData:read})})});
  const hero=new HeroPreview(canvas()),first=hero.setAppearance(appearance('sword'));fixture.requests[0].resolve(true);await first;
  hero.render({action:'move',clock:0,facing:1});read.mockClear();fixture.requests[0].renderThrows=true;
  expect(hero.render({action:'move',clock:0,facing:1})).toBe(false);expect(read).not.toHaveBeenCalled();
  fixture.requests[0].renderThrows=false;expect(hero.render({action:'move',clock:0,facing:1})).toBe(true);expect(read).toHaveBeenCalledTimes(1);hero.destroy();
 });
});
