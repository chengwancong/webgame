import {afterEach,describe,expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{}}));
vi.mock('../apps/web/src/open-world-five-runtime.ts',()=>({fiveIslandMaterialTexture:vi.fn()}));
vi.mock('../apps/web/src/starsea-runtime-assets.ts',()=>({
 starseaAsset:(id:string)=>({runtime:{file:'/mock/'+id+'.png',tileSize:8,anchor:[.5,1],displayWidth:180}}),
 starseaJSON:vi.fn(),starseaTexture:(file:string)=>file,
}));
vi.mock('../apps/web/src/island-edge.ts',()=>({coastStone:()=> 'rock',islandEdges:()=>[],islandPath:()=>({}),paintCoastSkirt:vi.fn()}));
vi.mock('../apps/web/src/world-dressing.ts',()=>({mapScatter:()=>[],groundDressingSteps:function*(){return true;}}));
import {StarseaWorldRenderer,type StarseaMap} from '../apps/web/src/starsea-world-renderer.ts';

/** A canvas/scene double exercises the real streaming scheduler and static-node
 * ownership; it is not a GPU, raster-performance or browser test. */
class ImageNode{
 x=0;y=0;depth=0;width=16;visible=true;alpha=1;
 bounds={contains:vi.fn(()=>true)};
 getBounds=vi.fn(()=>this.bounds);
 setOrigin(){return this;}setScrollFactor(){return this;}setDisplaySize(){return this;}
 setPosition(x:number,y:number){this.x=x;this.y=y;return this;}
 setDepth(n:number){this.depth=n;return this;}setVisible(v:boolean){this.visible=v;return this;}
 setAlpha(v:number){this.alpha=v;return this;}setScale(){return this;}setFlipX(){return this;}
 setData(){return this;}setInteractive(){return this;}setTint(){return this;}destroy(){}
}
const map:StarseaMap={id:'test-stream',name:'test',width:32,height:32,groundResource:'ground',backdropResource:'sky',landmarks:[],roads:[],decorations:[{id:'tree',resourceId:'tree',x:10,y:10,displayWidth:180,depthMode:'footpoint',occlusion:'foreground'}],boundary:{resourceId:'edge',stepCells:4,thicknessCells:2}};
function setup(source=map){
 const noop=()=>{},ctx={translate:noop,beginPath:noop,moveTo:noop,lineTo:noop,closePath:noop,clip:noop,fillRect:noop,save:noop,restore:noop,scale:noop,drawImage:noop,setTransform:noop,createPattern:()=>({})};
 vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>ctx})});
 const images:ImageNode[]=[];
 const scene={add:{image:(x:number,y:number)=>{const image=new ImageNode();image.setPosition(x,y);images.push(image);return image;}},textures:{exists:()=>true,get:()=>({getSourceImage:()=>({width:16,height:16})}),create:()=>({add:noop}),remove:noop},cameras:{main:{scrollX:-640,scrollY:0,width:1280,height:720,zoom:1}}};
 return{images,scene,renderer:new StarseaWorldRenderer(scene as any,source.id,source)};
}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('starsea streaming wiring',()=>{
 it('caches static foreground bounds once and skips occlusion work while hidden',async()=>{
  const {renderer,images}=setup();await Promise.resolve();
  renderer.draw({x:8,y:8});
  const tree=images.find(image=>image.depth===361)!;
  expect(tree).toBeDefined();expect(tree.getBounds).toHaveBeenCalledTimes(1);
  expect(tree.alpha).toBe(.42);
  for(let i=0;i<5;i++)renderer.draw({x:8+i*.1,y:8});
  expect(tree.getBounds).toHaveBeenCalledTimes(1);
  const tests=tree.bounds.contains.mock.calls.length;
  renderer.hiddenDecorations=new Set(['tree']);renderer.draw({x:8,y:8});
  expect(tree.visible).toBe(false);expect(tree.bounds.contains).toHaveBeenCalledTimes(tests);
  renderer.hiddenDecorations=new Set();renderer.draw({x:8,y:8});
  expect(tree.visible).toBe(true);expect(tree.bounds.contains.mock.calls.length).toBe(tests+1);
  renderer.destroy();
 });
 it('uses the stateful budget when ordinary walking reaches a missing hero chunk',async()=>{
  const {renderer,scene}=setup({...map,width:64});await Promise.resolve();
  renderer.draw({x:31.8,y:16});expect(renderer.diagnostics().buildBudgetMs).toBe(40);
  for(let i=0;i<5;i++)renderer.draw({x:31.9,y:16});expect(renderer.diagnostics().buildBudgetMs).toBe(4);
  // Retain the current ground but hold its neighbor pending. A gradual crossing
  // must use urgent loading, not restore the startup budget.
  const state=renderer as unknown as {chunks:Map<string,unknown>;chunk:()=>Generator<void,void>};
  state.chunks.delete('1,0');state.chunk=function*(){while(true)yield;};
  let clock=0;vi.spyOn(performance,'now').mockImplementation(()=>clock++);
  scene.cameras.main.scrollX=-124.8;scene.cameras.main.scrollY=505.8;
  renderer.draw({x:32.1,y:16});expect(renderer.diagnostics().buildBudgetMs).toBe(12);
  renderer.draw({x:50,y:16});expect(renderer.diagnostics().buildBudgetMs).toBe(40);
  renderer.destroy();
 });
});
