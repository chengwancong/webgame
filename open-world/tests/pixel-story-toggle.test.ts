import {it,expect,vi,beforeEach,afterEach} from 'vitest';
const fixture=vi.hoisted(()=>({nativeRenders:0}));
vi.mock('../apps/web/src/mini-native-renderer.ts',()=>({MiniNativePreview:class{
 ready=true;errors=[];constructor(private canvas:any){}setAppearance(){return Promise.resolve(true);}
 render(){fixture.nativeRenders++;if(this.canvas.mark)return false;this.canvas.mark='native';return true;}bonePose(){return;}diagnostics(){return{};}destroy(){}
}}));
vi.mock('../apps/web/src/pixel-actor.ts',()=>({PixelActorPainter:class{
 ready=true;constructor(private canvas:any){}request(){}supports(){return true;}reset(){}render(){this.canvas.mark='pixel';return true;}destroy(){}
}}));
vi.mock('../apps/web/src/pixel-texture.ts',()=>({pixelRuntime:{cellStage:0}}));
import {pixelRuntime} from '../apps/web/src/pixel-texture.ts';
import {StoryNpcPreview} from '../apps/web/src/story-npc-preview.ts';
function canvas(){const c:any={width:512,height:512,mark:undefined};c.getContext=()=>({clearRect(){c.mark=undefined;},drawImage(source:any){c.mark=source.mark;}});return c;}
beforeEach(()=>{fixture.nativeRenders=0;pixelRuntime.cellStage=0;vi.stubGlobal('document',{createElement:()=>canvas()});});
afterEach(()=>vi.unstubAllGlobals());
it('uses authored frames without playing the native rig and restores the cached original frame on disable',()=>{
 const target=canvas(),painter=new StoryNpcPreview(target,'keeper'),state={action:'idle',clock:0,facing:1} as const;
 expect(painter.render(state)).toBe(true);expect(target.mark).toBe('native');
 pixelRuntime.cellStage=2;expect(painter.render(state)).toBe(true);expect(target.mark).toBe('pixel');expect(fixture.nativeRenders).toBe(1);
 pixelRuntime.cellStage=0;expect(painter.render(state)).toBe(true);expect(target.mark).toBe('native');expect(painter.authoredPixelArt).toBe(false);
 painter.destroy();
});
