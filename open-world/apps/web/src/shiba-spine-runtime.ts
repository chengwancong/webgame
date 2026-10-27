import {AnimationState,AnimationStateData,AtlasAttachmentLoader,Physics,RegionAttachment,Skeleton,SkeletonJson,TextureAtlas} from '@esotericsoftware/spine-webgl';
export type ShibaRaster={width:number;height:number;data:Uint8Array|Uint8ClampedArray};
export type ShibaAction='idle'|'run'|'attack';
/** Same official Spine parser/evaluator drives the offline sample and the visible reviewer. */
export class ShibaSpineSample{
 readonly skeleton:Skeleton;readonly state:AnimationState;readonly atlas:TextureAtlas;
 readonly actionNames:Record<ShibaAction,string>;
 constructor(json:object,atlas:string,readonly images:Record<string,ShibaRaster>){
  const config=(json as {shibaSample?:{runtimeScale:number;facing:number;actions:Record<ShibaAction,string>}}).shibaSample;
  this.actionNames=config?.actions??{idle:'idle',run:'run',attack:'attack'};
  this.atlas=new TextureAtlas(atlas);const reader=new SkeletonJson(new AtlasAttachmentLoader(this.atlas));reader.scale=config?.runtimeScale??1;const data=reader.readSkeletonData(json);
  this.skeleton=new Skeleton(data);this.skeleton.scaleX=config?.facing??1;this.state=new AnimationState(new AnimationStateData(data));
 }
 pose(action:ShibaAction,time:number,loop=true){
  return this.poseAnimation(this.actionNames[action],time,loop);
 }
 poseAnimation(name:string,time:number,loop=true){
  const duration=this.skeleton.data.findAnimation(name)?.duration;if(!duration)throw Error('Missing Spine action '+name);
  this.skeleton.setToSetupPose();this.state.clearTracks();const entry=this.state.setAnimation(0,name,loop);entry.trackTime=loop?Math.max(0,time)%duration:Math.max(0,Math.min(time,duration));this.state.apply(this.skeleton);this.skeleton.updateWorldTransform(Physics.none);return this.skeleton;
 }
 /** Inverse-map actual Spine world quads at native pixel centres. No antialiased canvas rotations. */
 frame(width=64,height=64,anchor:[number,number]=[32,60],mirror=false){
  const out=new Uint8ClampedArray(width*height*4),v=new Float32Array(8);
  for(const slot of this.skeleton.drawOrder){const a=slot.getAttachment();if(!(a instanceof RegionAttachment)||slot.color.a===0)continue;const src=this.images[a.path];if(!src)throw Error('Missing cutout '+a.path);a.computeWorldVertices(slot,v,0,2);
   const x0=anchor[0]+v[2],y0=anchor[1]-v[3],ux=(v[4]-v[2])/src.width,uy=-(v[5]-v[3])/src.width,vx=(v[0]-v[2])/src.height,vy=-(v[1]-v[3])/src.height,det=ux*vy-vx*uy;
   if(Math.abs(det)<1e-8)continue;const xs=[v[0],v[2],v[4],v[6]].map(x=>anchor[0]+x),ys=[v[1],v[3],v[5],v[7]].map(y=>anchor[1]-y);
   for(let y=Math.max(0,Math.floor(Math.min(...ys)));y<Math.min(height,Math.ceil(Math.max(...ys)));y++)for(let x=Math.max(0,Math.floor(Math.min(...xs)));x<Math.min(width,Math.ceil(Math.max(...xs)));x++){
    const dx=x+.5-x0,dy=y+.5-y0,sx=Math.floor((dx*vy-dy*vx)/det),sy=Math.floor((ux*dy-uy*dx)/det);if(sx<0||sy<0||sx>=src.width||sy>=src.height)continue;const i=(sy*src.width+sx)*4;if(src.data[i+3]<128)continue;const mx=mirror?Math.round(anchor[0]*2-x-1):x;if(mx<0||mx>=width)continue;const o=(y*width+mx)*4;out[o]=src.data[i];out[o+1]=src.data[i+1];out[o+2]=src.data[i+2];out[o+3]=255;
   }
  }return out;
 }
 bones(anchor:[number,number]=[32,60],mirror=false){return this.skeleton.bones.map(b=>({name:b.data.name,x:anchor[0]+b.worldX*(mirror?-1:1),y:anchor[1]-b.worldY,parent:b.parent?.data.name}));}
}
