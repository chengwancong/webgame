import {describe,it,expect,vi} from 'vitest';
import type {Region} from '../packages/content/index.ts';

// These are renderer contract tests with a small scene double, not browser or
// pixel-raster validation. The real draw() decides metadata and input ownership.
vi.mock('phaser',()=>({default:{}}));
vi.mock('../apps/web/src/hud-avoidance.ts',()=>({worldLabels:()=>({submit:vi.fn()})}));
vi.mock('../apps/web/src/ui/tokens.ts',()=>({resolvedToken:()=> '#ffffff'}));
vi.mock('../apps/web/src/ui/world-text.ts',()=>({worldTextResolution:()=>1}));
vi.mock('../apps/web/src/starsea-runtime-assets.ts',()=>({
 StarseaNativeActor:class {},
 starseaAtlasFrame:vi.fn(),
 starseaAsset:(id:string)=>({id,name:'',runtime:{kind:'prop',anchor:[.5,.9],displayHeight:267}}),
 starseaPropState:()=>({file:'/test-building.png',anchor:[.5,.9],displayHeight:267}),
 starseaTexture:(file:string)=>file,
}));
import {portBuildObjects,StarseaStoryRenderer} from '../apps/web/src/starsea-story-renderer.ts';

class SceneNode{
 width=584;height=534;scale=1;visible=true;originY=.9;x=0;y=0;depth=0;
 style={color:''};data=new Map<string,unknown>();interactive=false;inputConfig:unknown;
 get displayWidth(){return this.width*this.scale;}get displayHeight(){return this.height*this.scale;}
 setInteractive(config?:unknown){this.interactive=true;if(config)this.inputConfig=config;return this;}
 disableInteractive(){this.interactive=false;return this;}
 setData(key:string,value:unknown){this.data.set(key,value);return this;}getData(key:string){return this.data.get(key);}
 setOrigin(_x:number,y:number){this.originY=y;return this;}setScale(n:number){this.scale=n;return this;}
 setVisible(value:boolean){this.visible=value;return this;}setPosition(x:number,y:number){this.x=x;this.y=y;return this;}
 setDepth(value:number){this.depth=value;return this;}setColor(value:string){this.style.color=value;return this;}
 setTexture(){return this;}setAlpha(){return this;}setText(){return this;}clearTint(){return this;}clear(){return this;}
 getBounds(){return{x:this.x,y:this.y,width:this.displayWidth,height:this.displayHeight};}destroy(){}
}
function renderer(){
 const images:SceneNode[]=[];
 const scene={add:{image:()=>{const image=new SceneNode();images.push(image);return image;},sprite:()=>new SceneNode(),text:()=>new SceneNode(),graphics:()=>new SceneNode()},cameras:{main:{worldView:{x:-2000,y:-2000,right:2000,bottom:2000}}}};
 return{images,renderer:new StarseaStoryRenderer(scene as any,{} as any)};
}
const region={portal:{x:14,y:18},landmarks:[{name:'工坊服务点',kind:'forge',x:19,y:20}]} as Region;

describe('port workshop placement',()=>{
 it('keeps every upgrade tier at its existing position without overriding artwork dimensions',()=>{
  expect(portBuildObjects({forge:0}).find(o=>o.id==='prop:ss-scene-workshop-tier')).toBeUndefined();
  for(const level of [1,2,3,4]){
   const workshop=portBuildObjects({forge:level}).find(o=>o.id==='prop:ss-scene-workshop-tier')!;
   expect(workshop.artId).toBe('ss-scene-workshop-tier-'+Math.min(level,3));
   expect(workshop.position).toEqual({x:19,y:17});
   expect(workshop).not.toHaveProperty('displayWidth');
  }
 });
 it('preserves artwork scale and gives the passive prop a separate landmark action',()=>{
  const {images,renderer:draw}=renderer(),workshop=portBuildObjects({forge:2}).find(o=>o.id==='prop:ss-scene-workshop-tier')!;
  expect(workshop.enabled).toBe(false);
  draw.draw([workshop],0,{x:1,y:1},region);
  const image=images[0];
  expect(image.displayWidth).toBeCloseTo(292);
  expect(image.displayHeight).toBeCloseTo(267);
  expect(image.interactive).toBe(true);
  expect(image.inputConfig).toEqual({pixelPerfect:true,alphaTolerance:1});
  expect(image.getData('landmark-pointer')).toEqual({kind:'forge',position:{x:19,y:20}});
  expect(image.getData('starsea-object-id')).toBeUndefined();
  draw.draw([workshop],1,{x:1,y:1},region);
  expect(image.interactive).toBe(true);
 });
 it('binds the stargate base to the portal but leaves its glow layer passive',()=>{
  const {images,renderer:draw}=renderer();
  draw.draw([
   {id:'prop:ss-scene-stargate',artId:'ss-scene-stargate',position:{x:14,y:18},enabled:false,name:''},
   {id:'prop:ss-scene-stargate-glow',artId:'ss-scene-stargate',position:{x:14,y:18.01},enabled:false,name:''},
  ],0,{x:1,y:1},region);
  expect(images[0].getData('landmark-pointer')).toEqual({kind:'portal',position:{x:14,y:18}});
  expect(images[0].getData('starsea-object-id')).toBeUndefined();
  expect(images[0].interactive).toBe(true);
  expect(images[2].interactive).toBe(false);
  expect(images[2].getData('landmark-pointer')).toBeUndefined();
 });
 it('does not make a decorative building clickable when no service point exists',()=>{
  const {images,renderer:draw}=renderer(),workshop=portBuildObjects({forge:1}).find(o=>o.id==='prop:ss-scene-workshop-tier')!;
  draw.draw([workshop],0,{x:19,y:17},{...region,landmarks:[]});
  expect(images[0].interactive).toBe(false);
  expect(images[0].getData('landmark-pointer')).toBeUndefined();
 });
});
