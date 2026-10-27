import type {Region} from '../../../packages/content/index.ts';
import {interactionReach} from '../../../packages/rules/world-interactions.ts';

type Point={x:number;y:number};
export type LandmarkPointerTarget={kind:'portal'|'boss'|'forge'|'safe';position:Point};
type LandmarkRegion=Pick<Region,'portal'|'bossPortal'|'landmarks'>;
const priority:Record<LandmarkPointerTarget['kind'],number>={portal:0,boss:1,safe:2,forge:3};

/** Bind the actual rendered texture. Phaser accounts for frame, origin, scale
 * and camera before sampling alpha; transparent padding is not a hit. */
export function bindLandmarkPointer(image:{setData(key:string,value:unknown):unknown;setInteractive(config:{pixelPerfect:boolean;alphaTolerance:number}):unknown},target:LandmarkPointerTarget){
 image.setData('landmark-pointer',target);
 image.setInteractive({pixelPerfect:true,alphaTolerance:1});
}

export function forgePointerTarget(position:Point,region:Pick<Region,'landmarks'>):LandmarkPointerTarget|undefined{
 const forge=region.landmarks.filter(l=>l.kind==='forge').sort((a,b)=>Math.hypot(a.x-position.x,a.y-position.y)-Math.hypot(b.x-position.x,b.y-position.y))[0];
 return forge?{kind:'forge',position:{x:forge.x,y:forge.y}}:undefined;
}

/** Only ground entrance markers get a one-tile fallback. A forge service point
 * is open ground in front of the building, so it must never capture a ground tap. */
export function landmarkPointerFallback(point:Point,region:LandmarkRegion):LandmarkPointerTarget|undefined{
 const targets:LandmarkPointerTarget[]=[{kind:'portal',position:region.portal}];
 if(region.bossPortal)targets.push({kind:'boss',position:region.bossPortal});
 for(const landmark of region.landmarks){
  if(landmark.kind==='safe')targets.push({kind:landmark.kind,position:{x:landmark.x,y:landmark.y}});
 }
 const distanceSquared=(target:LandmarkPointerTarget)=>(target.position.x-point.x)**2+(target.position.y-point.y)**2;
 return targets.filter(({position})=>Math.abs(position.x-point.x)<=.5&&Math.abs(position.y-point.y)<=.5)
  .sort((a,b)=>distanceSquared(a)-distanceSquared(b)||priority[a.kind]-priority[b.kind]||a.position.x-b.position.x||a.position.y-b.position.y)[0];
}

/** Preserve the existing execution distance after a deliberate target hit. */
export function landmarkInteractionRange(kind:LandmarkPointerTarget['kind']):number{
 return kind==='forge'?interactionReach.forge:kind==='safe'?3:4;
}
