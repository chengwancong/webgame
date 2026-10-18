import {StarseaActorPreview} from './starsea-actor-preview.ts';
import {loadJSON,type Asset,type Point,type StarseaPackage} from './starsea-assets.ts';
import {actorBounds,referenceLayout} from './starsea-vfx-layout.ts';
/** The artwork owner provides the fixture values; this page never defines a combat rule. */
export class StarseaVfxPreview{
 private source?:StarseaActorPreview;private phaseEndSource?:StarseaActorPreview;private target?:StarseaActorPreview;private player:any;private fixtureAPI:any;private asset?:Asset;private latest:any={};private lastCalibration='';private launch?:Point;private contact?:Point;
 private origin={x:340,y:300};private sourceAsset?:Asset;private phase='default';private mode='normal';
 private base={x:340,y:300};private layouts:Record<number,ReturnType<typeof referenceLayout>>={};private placedFacing=0;
 constructor(readonly canvas:HTMLCanvasElement,readonly pack:StarseaPackage){}
 private project=(p:Point)=>({x:this.origin.x+(p.x-p.y)*32,y:this.origin.y+(p.x+p.y)*18});
 async load(asset:Asset,state='normal'){
  this.asset=asset;this.mode=state;this.phase=state==='phase-active'||Boolean(asset.runtime.secondaryClips?.phase_exhaust)&&['phase-end','death'].includes(state)?'phase-active':'default';const rendererURL=new URL('/art/starsea/vfx/renderer.mjs',location.origin).href,fixtureURL=new URL('/art/starsea/vfx/reference-fixtures.mjs',location.origin).href;
  const [runtime,fixture,tokens,manifest]=await Promise.all([import(/* @vite-ignore */ rendererURL),import(/* @vite-ignore */ fixtureURL),loadJSON<any>('/art/starsea/vfx/tokens.json'),loadJSON<any>('/art/starsea/vfx/manifest.json')]);this.fixtureAPI=fixture;
  this.player=new runtime.StarSeaVfxRenderer(manifest,{project:this.project,tokens:manifest.shared.warningTokens});await this.player.load([asset.id]);
  this.sourceAsset=this.pack.assets.find(a=>a.id===asset.runtime.fixture?.actorId);if(!this.sourceAsset)throw Error('VFX real source actor missing '+asset.id);
  const target=this.pack.assets.find(a=>a.id==='ss-mon-dusk-blade')!,[sourceBox,targetBox]=await Promise.all([actorBounds(this.sourceAsset),actorBounds(target)]);
  for(const facing of [-1,1])this.layouts[facing]=referenceLayout(this.fixtureAPI.buildReferenceFixture(asset,{facing}),sourceBox,targetBox,facing);
  this.source=new StarseaActorPreview(720,480,this.base);await this.source.load(this.sourceAsset,asset.id,this.phase);
  if(state==='phase-end'&&this.sourceAsset.group==='bosses'){this.phaseEndSource=new StarseaActorPreview(720,480,this.base);await this.phaseEndSource.load(this.sourceAsset,'idle','phase-end');}
  this.target=new StarseaActorPreview(720,480,this.base);await this.target.load(target,'idle');
 }
 reset(){this.player?.clear();this.lastCalibration='';}
 render(clock:number,facing:number,paused:boolean){
  const a=this.asset,p=this.player,s=this.source,t=this.target;if(!a||!p||!s||!t)return;const layout=this.layouts[facing];this.origin=layout.origin;if(this.canvas.width!==layout.width||this.canvas.height!==layout.height){this.canvas.width=layout.width;this.canvas.height=layout.height;}
  const f=this.fixtureAPI.buildReferenceFixture(a,{facing}),tick=Math.floor(clock*30)%f.total,ctx=this.canvas.getContext('2d')!,sourceShift={x:this.origin.x-this.base.x,y:this.origin.y-this.base.y},targetFoot=this.project(f.targetPosition),targetShift={x:targetFoot.x-this.base.x,y:targetFoot.y-this.base.y};
  if(this.placedFacing!==facing){this.placedFacing=facing;const pane=this.canvas.parentElement;if(pane){pane.scrollLeft=Math.max(0,this.origin.x-pane.clientWidth/2);pane.scrollTop=Math.max(0,this.origin.y-pane.clientHeight*.7);}}
  const shifted=(point:Point|undefined,shift:Point)=>point?{x:point.x+shift.x,y:point.y+shift.y}:undefined;
  const phaseActive=this.phase==='phase-active',calibration=facing+':'+this.phase+':'+a.id;
  const sourceAction=this.sourceAsset!.group==='bosses'?a.id:'skill',windup=f.windupTicks/30;
  if(calibration!==this.lastCalibration){s.render(sourceAction,windup,facing,this.phase,{elapsed:windup,windup,recovery:1});this.launch=shifted(s.socket(a.runtime.mount?.release??'hand'),sourceShift);t.render('idle',f.hit/30,-facing);this.contact=shifted(t.socket('chest'),targetShift);this.lastCalibration=calibration;}
  const cancelled=['death','interrupt','phase-end'].includes(this.mode)&&tick>=f.cancel,action=this.mode==='death'&&cancelled?'death':this.mode==='interrupt'&&cancelled?'idle':sourceAction;
  const shown=cancelled&&this.mode==='phase-end'&&this.phaseEndSource?this.phaseEndSource:s;
  if(shown===this.phaseEndSource)shown.render('idle',(tick-f.cancel)/30,facing,'phase-end');else s.render(action,action==='death'?(tick-f.cancel)/30:tick/30,facing,this.phase,action===sourceAction?{elapsed:tick/30,windup,recovery:1}:undefined);
  t.render(tick>=f.hit&&tick<f.hit+15&&!cancelled?'hurt':'idle',tick>=f.hit?(tick-f.hit)/30:tick/30,-facing);
  const sample=this.fixtureAPI.referenceEventsAt(a,tick,{facing,launchScreen:this.launch,contactScreen:this.contact,phaseActive,mode:this.mode,targetId:'ss-mon-dusk-blade'});
  p.clear();for(const event of sample.events)p.emit(event);p.advance(tick,{paused:false});if(paused)p.advance(tick,{paused:true});
  const sockets=(id:string,mount:string)=>id===this.sourceAsset!.id?shifted(shown.socket(mount),sourceShift):id==='ss-mon-dusk-blade'?shifted(t.socket(mount),targetShift):undefined;
  p.draw(ctx,{sockets,facing:()=>facing,layer:'ground'});ctx.drawImage(shown.canvas,sourceShift.x,sourceShift.y);ctx.drawImage(t.canvas,targetShift.x,targetShift.y);p.draw(ctx,{sockets,facing:()=>facing,layer:'front'});
  this.latest={id:a.id,tick,phase:this.phase,mode:this.mode,referenceOnly:true,fixture:sample.fixture,layout,source:shown.diagnostics(),target:t.diagnostics(),launch:this.launch,contact:this.contact,sourceShift,targetShift,renderer:p.diagnostics()};
 }
 diagnostics(){return this.latest;}
 destroy(){this.source?.destroy();this.phaseEndSource?.destroy();this.target?.destroy();this.player?.clear();}
}
