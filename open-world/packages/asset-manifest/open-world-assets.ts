import wind from './open-world.v1.json';
import five from './open-world-five.v1.json';
import planes from './open-world-planes-greybox.v1.json';
type RawArt={id:string;name:string;kind:string;category:string;group?:string;runtime:Record<string,any>;actions?:Record<string,any>;states?:unknown;[key:string]:unknown};
/** One adapter for the accepted manifests; no asset IDs or actor appearances
 * are selected in runtime code. Source animation/material metadata is retained. */
export const openWorldRuntimeAssets=([...(wind.assets as unknown as RawArt[]),...(five.assets as unknown as RawArt[]),...(planes.assets as unknown as RawArt[])]).map(asset=>{
 const runtime={...asset.runtime},group=asset.kind==='actor'&&['monster','elite','rare','dungeon-boss','regional-npc'].includes(asset.category)?asset.category==='regional-npc'?'npc':asset.category==='dungeon-boss'?'bosses':'monsters':asset.kind==='effect'?'vfx':asset.kind==='ground'?'scenes':'props';
 if(['sprite','ground','mask','symbol'].includes(asset.kind)){
  const states=Array.isArray(runtime.states)?runtime.states:['default'];runtime.kind='prop';runtime.states=Object.fromEntries(states.map(name=>[name,{kind:'image',file:runtime.file,anchor:runtime.anchor,displayHeight:runtime.displayHeight,visible:true}]));
 }
 if(asset.kind==='effect')runtime.kind='effect';
 runtime.tint??=runtime.material?.tint;runtime.wash??=runtime.material?.wash;
 return {...asset,group,type:asset.category,chapters:[],status:asset.status??'registered',dependencies:asset.files??[],notes:[],actions:asset.actions??{},states:asset.states??{},runtime};
});
