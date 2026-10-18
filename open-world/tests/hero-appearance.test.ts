import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import type {ResolvedAppearance} from '../packages/contracts/appearance.ts';
const fixture=vi.hoisted(()=>({requests:[] as Array<{mode:string;resolve:(value:boolean)=>void;key:string;destroyed:boolean;ready:boolean;revision:number;renderFailed:boolean}>}));
vi.mock('../apps/web/src/wardrobe-renderer.ts',async importOriginal=>{
 const source=await importOriginal<typeof import('../apps/web/src/wardrobe-renderer.ts')>();
 class Painter {
  row?:typeof fixture.requests[number];
  async setAppearance(appearance:ResolvedAppearance){
   const key=source.appearanceRenderKey(appearance);
   if(this.row?.ready&&this.row.key===key){this.row.revision=appearance.revision;return true;}
   return new Promise<boolean>(resolve=>{const row={mode:'legacy',resolve:(value:boolean)=>{row.ready=value;resolve(value);},key,destroyed:false,ready:false,revision:appearance.revision,renderFailed:false};this.row=row;fixture.requests.push(row);});
  }
  get ready(){return Boolean(this.row?.ready);}get mirrored(){return false;}get frameName(){return 'idle_0';}
  render(){return !this.row?.renderFailed;}socket(){return {x:1,y:2};}drawPortrait(){return true;}
  diagnostics(){return {key:this.row?.key,errors:[],revision:this.row?.revision};}
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
});
