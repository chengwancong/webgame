import wind from './open-world.v1.json';
import five from './open-world-five.v1.json';
import planeGreybox from './open-world-planes-greybox.v1.json';
import planeArt from './open-world-planes.v1.json';
type RawArt={id:string;name:string;kind:string;category:string;group?:string;runtime:Record<string,any>;actions?:Record<string,any>;states?:unknown;[key:string]:unknown};
// 正式资源逐件替换；地形、摆放与碰撞仍由灰盒契约负责。
type PlaneEntry=(typeof planeGreybox.assets)[number]&{aliasOf?:string;island?:string;runtime:Record<string,any>};
const painted=(g:PlaneEntry)=>{
 const a=planeArt.assets.find(a=>a.id===g.id);
 if(!a||a.status!=='imported'||a.runtime.registration!=='greybox-contract-exact')return;
 const r=a.runtime,c=g.contract;
 if(r.width!==c.canvas[0]||r.height!==c.canvas[1]||r.displayWidth!==c.displayWidth||JSON.stringify(r.anchor)!==JSON.stringify(c.anchor))throw new Error(`位面美术契约不一致：${g.id}`);
 // Painted art already carries its island look; only a material it declares itself is kept.
 const {material:_,...base}=g.runtime;return {...g,name:a.name,status:a.status,files:a.files,runtime:{...base,file:r.file,...((r as {material?:unknown}).material?{material:(r as {material?:unknown}).material}:{})}};
};
const kitParts=new Map((planeGreybox.assets as PlaneEntry[]).filter(g=>!g.aliasOf).map(g=>[g.id,painted(g)??g]));
// An unpainted island part shows the kit part's current art (greybox or painted) under the island material.
const planes={assets:(planeGreybox.assets as PlaneEntry[]).map(g=>{
 if(!g.aliasOf)return kitParts.get(g.id)!;
 const own=painted(g);if(own)return own;
 const kit=kitParts.get(g.aliasOf);if(!kit)throw new Error(`位面岛屿件缺少套件件：${g.id}`);
 return {...g,status:kit.status,files:kit.files,runtime:{...g.runtime,file:kit.runtime.file}};
})};
/** One adapter for the accepted manifests; no asset IDs or actor appearances
 * are selected in runtime code. Source animation/material metadata is retained. */
export const openWorldRuntimeAssets=([...(wind.assets as unknown as RawArt[]),...(five.assets as unknown as RawArt[]),...(planes.assets as unknown as RawArt[])]).map(asset=>{
 const runtime={...asset.runtime},group=asset.kind==='actor'&&['monster','elite','rare','dungeon-boss','regional-npc'].includes(asset.category)?asset.category==='regional-npc'?'npc':asset.category==='dungeon-boss'?'bosses':'monsters':asset.kind==='effect'?'vfx':asset.kind==='ground'?'scenes':'props';
 if(['sprite','ground','mask','symbol'].includes(asset.kind)){
  const states=Array.isArray(runtime.states)?runtime.states:['default'];runtime.kind='prop';
  // frameAnchors / frameDisplaySizes（逐帧覆盖，用于 beacon-aura 等宽高比与主体不同的帧）
  const fAnchors=runtime.frameAnchors as Record<string,number[]>|undefined,fSizes=runtime.frameDisplaySizes as Record<string,number[]>|undefined;
  runtime.states=Object.fromEntries(states.map(name=>{const f0=(runtime.stateFrames as Record<string,string[]>|undefined)?.[name]?.[0];const anchor=(f0&&fAnchors?.[f0])??runtime.anchor,displayHeight=(f0&&fSizes?.[f0]?.[1])??runtime.displayHeight;return[name,{kind:'image',file:runtime.stateFiles?.[name]??runtime.file,anchor,displayHeight,visible:true,...(runtime.atlas&&(runtime.stateFrames as Record<string,string[]>|undefined)?.[name]?.length?{atlasKey:asset.id,frames:(runtime.stateFrames as Record<string,string[]>)[name],fps:(runtime.stateFps as Record<string,number>|undefined)?.[name]??runtime.fps??10}:{})}];}));
 }
 if(asset.kind==='effect')runtime.kind='effect';
 runtime.tint??=runtime.material?.tint;runtime.wash??=runtime.material?.wash;
 return {...asset,group,type:asset.category,chapters:[],status:asset.status??'registered',dependencies:asset.files??[],notes:[],actions:asset.actions??{},states:asset.states??{},runtime};
});
