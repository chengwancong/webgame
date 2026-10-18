import wind from './open-world.v1.json';
import five from './open-world-five.v1.json';
import planeGreybox from './open-world-planes-greybox.v1.json';
import planeArt from './open-world-planes.v1.json';
type RawArt={id:string;name:string;kind:string;category:string;group?:string;runtime:Record<string,any>;actions?:Record<string,any>;states?:unknown;[key:string]:unknown};
// 正式资源逐件替换；地形、摆放与碰撞仍由灰盒契约负责。
const planes={assets:planeGreybox.assets.map(g=>{
 const a=planeArt.assets.find(a=>a.id===g.id);
 if(!a||a.status!=='imported'||a.runtime.registration!=='greybox-contract-exact')return g;
 const r=a.runtime,c=g.contract;
 if(r.width!==c.canvas[0]||r.height!==c.canvas[1]||r.displayWidth!==c.displayWidth||JSON.stringify(r.anchor)!==JSON.stringify(c.anchor))throw new Error(`位面美术契约不一致：${g.id}`);
 return {...g,name:a.name,status:a.status,files:a.files,runtime:{...g.runtime,file:r.file}};
})};
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
