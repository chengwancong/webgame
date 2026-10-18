import hero from '../../../packages/asset-manifest/hero-sockets.json';
import native from '../../../packages/asset-manifest/native-actor-sockets.json';
import {actorCatalog} from '../../../packages/asset-manifest/actors.ts';
export type SocketName='feet'|'chest'|'hand'|'muzzle'|'weapon';
export type RenderPose={art:string;frame:string;releaseFrame?:string;position:{x:number;y:number};scale:number;flip:boolean;image?:{texture:string;frame:string|number;originX:number;originY:number;scaleX:number;scaleY:number;flipX:boolean;flipY:boolean};socket?:(name:SocketName,frame:string)=>{x:number;y:number}|undefined};
type SocketFrame=Record<SocketName,number[]>;
type SocketData={frameSize:number;actions:Record<string,SocketFrame[]>};
const data:Record<string,SocketData>={hero,...native};
export function effectAttachment(pose:RenderPose,name:SocketName):{x:number;y:number}{
 const modular=pose.socket?.(name,pose.frame);if(modular)return modular;
 if(name==='feet')return {...pose.position};
 const profile=actorCatalog[pose.art],key=profile.texture??pose.art,source=data[key],match=/^(.+)_(\d+)$/.exec(pose.frame);
 const frame=source&&match?source.actions[match[1]]?.[Number(match[2])]:undefined;
 if(frame){const [x,y]=frame[name];return {x:pose.position.x+(x-profile.anchor[0]*source.frameSize)*pose.scale*(pose.flip?-1:1),y:pose.position.y+(y-profile.anchor[1]*source.frameSize)*pose.scale};}
 // Generated chapter actors have no original Spine sockets; use their actual scaled
 // sprite height, while retaining per-frame source sockets for every native actor.
 const height=(profile.displayHeight??100)*(pose.scale/profile.scale);return {x:pose.position.x,y:pose.position.y-height*.55};
}
export function heroAnimationFrame(action:'attack'|'skill',elapsed:number,windup:number,recovery:number){
 const total=hero.actions[action].length,impact=action==='attack'?9:13;
 return Math.max(0,Math.min(total-1,elapsed<=windup?Math.floor(impact*elapsed/Math.max(1,windup)):impact+Math.floor((total-1-impact)*(elapsed-windup)/Math.max(1,recovery))));
}
