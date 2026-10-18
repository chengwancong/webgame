import {loadJSON,type Asset,type Point} from './starsea-assets.ts';
import {project as iso} from './iso.ts';
export type Bounds={minX:number;maxX:number;minY:number;maxY:number};
export async function actorBounds(asset:Asset):Promise<Bounds>{
 if(asset.runtime.kind==='native'){const p=await loadJSON<any>(asset.runtime.profile!);if(!p.previewBounds)throw Error('Native union bounds missing '+asset.id);const b=p.previewBounds,s=asset.runtime.displayHeight!/p.referenceHeight;return {minX:(b.minX-p.ground[0])*s,maxX:(b.maxX-p.ground[0])*s,minY:-(b.maxY-p.ground[1])*s,maxY:-(b.minY-p.ground[1])*s};}
 const atlas=await loadJSON<any>(asset.runtime.atlas!),r=asset.runtime,s=r.scale!,size=r.frameSize!,anchor=r.anchor!,result={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};
 for(const f of Object.values(atlas.frames) as any[]){const p=f.spriteSourceSize;result.minX=Math.min(result.minX,(p.x-anchor[0]*size)*s);result.maxX=Math.max(result.maxX,(p.x+p.w-anchor[0]*size)*s);result.minY=Math.min(result.minY,(p.y-anchor[1]*size)*s);result.maxY=Math.max(result.maxY,(p.y+p.h-anchor[1]*size)*s);}return result;
}
export function referenceLayout(f:any,source:Bounds,target:Bounds,facing:number){
 const points:Point[]=[],sourceFoot=iso(f.sourcePosition),targetFoot=iso(f.targetPosition),g=f.geometry;
 const actor=(foot:Point,b:Bounds,mirror:boolean)=>{const minX=mirror?-b.maxX:b.minX,maxX=mirror?-b.minX:b.maxX;points.push({x:foot.x+minX-48,y:foot.y+b.minY-48},{x:foot.x+maxX+48,y:foot.y+b.maxY+48});};
 actor(sourceFoot,source,facing!==-1);actor(targetFoot,target,-facing!==-1);
 if(g.kind==='circle'){const c=iso(g.center),rx=g.radius*32*Math.SQRT2,ry=g.radius*18*Math.SQRT2;points.push({x:c.x-rx,y:c.y-ry},{x:c.x+rx,y:c.y+ry});}
 if(g.kind==='beam'||g.kind==='dash'){const d=Math.hypot(g.target.x-g.origin.x,g.target.y-g.origin.y),dx=(g.target.x-g.origin.x)/d,dy=(g.target.y-g.origin.y)/d,nx=-dy*g.halfWidth,ny=dx*g.halfWidth;for(const distance of [0,g.reach])for(const sign of [-1,1])points.push(iso({x:g.origin.x+distance*dx+sign*nx,y:g.origin.y+distance*dy+sign*ny}));}
 const b={minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
 const width=Math.max(720,Math.ceil(b.maxX-b.minX+32)),height=Math.max(420,Math.ceil(b.maxY-b.minY+32)),origin={x:width/2-(b.minX+b.maxX)/2,y:height/2-(b.minY+b.maxY)/2};
 return {width,height,origin,bounds:{minX:b.minX+origin.x,maxX:b.maxX+origin.x,minY:b.minY+origin.y,maxY:b.maxY+origin.y},rawBounds:b,extended:width>720||height>420,projection:[32,18],scale:1};
}
