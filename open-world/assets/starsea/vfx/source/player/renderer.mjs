/** Material-only renderer. Callers own events, collision geometry and the 30 Hz clock. */
export const ISO_PROJECTION=Object.freeze([32,18]);
export function isoPoint(p,origin={x:0,y:0}){return {x:origin.x+(p.x-p.y)*32,y:origin.y+(p.x+p.y)*18};}
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const positive=v=>Number.isFinite(v)&&v>0;
export function warningPolygon(shape){
 if(!shape||shape.kind==='none')return [];
 if(shape.kind==='circle'){
  if(!finitePoint(shape.center)||!positive(shape.radius))throw Error('Resolved circle center/radius required');
  return Array.from({length:96},(_,i)=>{const a=i*Math.PI*2/96;return {x:shape.center.x+Math.cos(a)*shape.radius,y:shape.center.y+Math.sin(a)*shape.radius};});
 }
 if(shape.kind==='beam'||shape.kind==='dash'){
  if(!finitePoint(shape.origin)||!finitePoint(shape.target)||!positive(shape.halfWidth)||!positive(shape.reach))throw Error('Resolved origin/direction/halfWidth/reach required');
  const d=Math.hypot(shape.target.x-shape.origin.x,shape.target.y-shape.origin.y);if(!(d>0))throw Error('Beam direction must be nonzero');
  const dx=(shape.target.x-shape.origin.x)/d,dy=(shape.target.y-shape.origin.y)/d,nx=-dy*shape.halfWidth,ny=dx*shape.halfWidth,o=shape.origin,e={x:o.x+dx*shape.reach,y:o.y+dy*shape.reach};
  return [{x:o.x+nx,y:o.y+ny},{x:e.x+nx,y:e.y+ny},{x:e.x-nx,y:e.y-ny},{x:o.x-nx,y:o.y-ny}];
 }
 throw Error('Unsupported resolved warning shape '+shape.kind);
}
export function projectedGeometry(shape,origin){return warningPolygon(shape).map(p=>isoPoint(p,origin));}
export function contains(shape,p){
 if(shape.kind==='circle')return Math.hypot(p.x-shape.center.x,p.y-shape.center.y)<=shape.radius;
 const d=Math.hypot(shape.target.x-shape.origin.x,shape.target.y-shape.origin.y),dx=(shape.target.x-shape.origin.x)/d,dy=(shape.target.y-shape.origin.y)/d,x=p.x-shape.origin.x,y=p.y-shape.origin.y;
 return x*dx+y*dy>=0&&x*dx+y*dy<=shape.reach&&Math.abs(x*dy-y*dx)<=shape.halfWidth;
}
export class StarSeaVfxRenderer{
 constructor(manifest,{project=p=>isoPoint(p),tokens=manifest.shared?.warningTokens??{},maxDecorations=96}={}){
  this.manifest=manifest;this.defs=new Map(manifest.assets.map(a=>[a.id,a]));this.project=project;this.tokens=tokens;this.maxDecorations=maxDecorations;this.images=new Map();this.atlases=new Map();this.instances=new Map();this.secondary=new Map();this.errors=[];this.tick=0;this.paused=false;this.commands=[];this.seenEvents=new Set();this.tintedFrames=new Map();
 }
 async load(ids=[...this.defs.keys()]){
  const clips=ids.flatMap(id=>{const a=this.defs.get(id);if(!a)throw Error('Unknown VFX '+id);return [...Object.values(a.runtime.clips),...Object.values(a.runtime.secondaryClips??{})].filter(c=>c.kind==='atlas');});
  const imageUrls=[...new Set(clips.flatMap(c=>[c.image,...(c.components??[]).map(p=>p.image)]))],atlasUrls=[...new Set(clips.map(c=>c.atlas))];
  await Promise.all(imageUrls.map(async url=>{if(this.images.has(url))return;const image=new Image();image.src=url;await image.decode();this.images.set(url,image);}));
  await Promise.all(atlasUrls.map(async url=>{if(!this.atlases.has(url)){const response=await fetch(url);if(!response.ok)throw Error('Missing atlas '+url);this.atlases.set(url,await response.json());}}));
  return this;
 }
 emit(event){
  if(!Number.isFinite(event.tick))throw Error('Combat tick required');
  const a=this.defs.get(event.effectId);if(!a)throw Error('Unknown effect ID '+event.effectId);
  if(event.type==='phase-active'){
   for(const[name,clip]of Object.entries(a.runtime.secondaryClips??{})){if((event.actorTemplateId??event.sourceId)!==clip.actorId)throw Error('Secondary actor template mismatch');this.secondary.set(event.sourceId+':'+name,{id:a.id,name,clip,sourceId:event.sourceId,startTick:event.tick});}return;
  }
  if(event.type==='phase-end'||event.type==='death'){
   for(const[key,s]of this.secondary)if(s.sourceId===event.sourceId&&s.clip.stops.includes(event.type))this.secondary.delete(key);
   if(event.type==='death')for(const[key,instance]of this.instances)if(instance.sourceId===event.sourceId){const released=instance.releaseTick!==undefined||instance.nodes.some(n=>n.name==='projectile'||n.name==='active'),awaitingActivation=released&&instance.resolved.delayTicks>0&&event.tick<instance.releaseTick+instance.resolved.delayTicks;if(!released)instance.warning=false;instance.cancelled=true;instance.nodes=instance.nodes.filter(n=>n.name!=='startup'&&(n.name==='projectile'||n.name==='impact'||n.clip.mount==='ground'||n.clip.mount==='last-stage'));if(!instance.nodes.length&&!awaitingActivation)this.instances.delete(key);}return;
  }
  const key=String(event.castId);if(!key||key==='undefined')throw Error('Actual castId required');
  const eventKey=key+':'+event.type+':'+event.tick+':'+(event.projectileId??event.targetId??'');if(this.seenEvents.has(eventKey))return;this.seenEvents.add(eventKey);
  let instance=this.instances.get(key);if(!instance){instance={id:a.id,castId:key,sourceId:event.sourceId,stage:'new',startTick:event.tick,nodes:[],resolved:structuredClone(event.resolved??{}),geometry:structuredClone(event.geometry??{kind:'none'})};this.instances.set(key,instance);}else if(instance.id!==a.id)throw Error('castId resource mismatch');
  if(event.resolved)Object.assign(instance.resolved,structuredClone(event.resolved));
  if(event.geometry){try{warningPolygon(event.geometry);instance.geometry=structuredClone(event.geometry);}catch(e){this.errors.push(String(e));instance.geometry={kind:'none'};}}
  if(event.position)instance.position=structuredClone(event.position);
  const add=(name,values={})=>{const clip=a.runtime.clips[name];if(clip?.kind==='atlas')instance.nodes.push({name,clip,startTick:event.tick,...values});};
  if(event.type==='cast_started'||event.type==='danger_started'){
   const n=instance.resolved.windupTicks;if(!Number.isFinite(n)||n<0)throw Error('Resolved windupTicks required; no reference defaults');
   instance.stage='startup';instance.warning=true;instance.warningStart=event.tick;instance.warningEnd=event.tick+n+(instance.resolved.delayTicks??0);add('startup');
  }else if(event.type==='cast_released'){
   instance.stage='released';instance.releaseTick=event.tick;instance.nodes=instance.nodes.filter(n=>n.name!=='startup');
   if(!instance.resolved.delayTicks)instance.warning=false;add('release');
  }else if(event.type==='projectile_spawned'){
   if(!finitePoint(event.position))throw Error('Real independent projectile position required');
   add('projectile',{projectileId:event.projectileId,position:structuredClone(event.position),screenPosition:event.screenPosition,direction:event.direction,rotation:event.rotation});
  }else if(event.type==='projectile_snapshot'){
   const node=instance.nodes.find(n=>n.name==='projectile'&&n.projectileId===event.projectileId);if(node){node.position=structuredClone(event.position);node.screenPosition=event.screenPosition;node.direction=event.direction;node.rotation=event.rotation;}
  }else if(event.type==='projectile_ended'){
   instance.nodes=instance.nodes.filter(n=>n.projectileId!==event.projectileId);
  }else if(event.type==='effect_armed'){
   if(!Number.isFinite(event.durationTicks)||event.durationTicks<0)throw Error('Resolved trap wait durationTicks required');instance.stage='armed';add('active',{position:structuredClone(event.position),endTick:event.tick+event.durationTicks,armed:true});
  }else if(event.type==='effect_activated'){
   if(!Number.isFinite(event.durationTicks)||event.durationTicks<0)throw Error('Resolved actual durationTicks required');
   instance.stage='active';instance.warning=false;instance.activateTick=event.tick;instance.activeEnd=event.tick+event.durationTicks;instance.nodes=instance.nodes.filter(n=>!n.armed);add('active',{position:structuredClone(event.position),endTick:instance.activeEnd});
  }else if(event.type==='summon_appeared'){
   if(!finitePoint(event.position))throw Error('Actual summoned entity position required');add('impact',{position:structuredClone(event.position),screenPosition:event.screenPosition});
  }else if(event.type==='hit_resolved'){
   if(!finitePoint(event.position))throw Error('Actual contact point required');add('impact',{position:structuredClone(event.position),screenPosition:event.screenPosition,targetId:event.targetId});
  }else if(event.type==='status_applied'){
   if(!Number.isFinite(event.durationTicks))throw Error('Resolved status duration required');add('status',{targetId:event.targetId,endTick:event.tick+event.durationTicks});
  }else if(event.type==='status_ended'){
   instance.nodes=instance.nodes.filter(n=>n.name!=='status'||n.targetId!==event.targetId);
  }else if(event.type==='effect_ended'){
   instance.stage='end';instance.warning=false;const prior=instance.nodes.find(n=>n.name==='active'),position=prior?.position??instance.position;instance.nodes=instance.nodes.filter(n=>!['active','projectile','startup'].includes(n.name));add('end',{position:structuredClone(position)});
  }else if(event.type==='cast_failed'||event.type==='interrupted'){
   instance.stage='interrupted';instance.warning=false;instance.nodes=[];add('interrupt',{position:structuredClone(event.position)});
  }else throw Error('Unsupported VFX event '+event.type);
 }
 clear({tick=0}={}){this.instances.clear();this.secondary.clear();this.seenEvents.clear();this.commands=[];this.errors=[];this.tick=tick;this.paused=false;}
 advance(tick,{paused=this.paused}={}){
  if(!Number.isFinite(tick)||tick<0)throw Error('Valid combat tick required');this.paused=paused;if(paused)return this.tick;
  if(tick<this.tick)throw Error('Clock reversal requires reset/replay');this.tick=tick;
  for(const[key,instance]of this.instances){
   instance.nodes=instance.nodes.filter(node=>{
    if(node.endTick!==undefined&&tick>=node.endTick)return false;
    if(node.clip.loop)return true;
    const duration=node.clip.retime?.durationTicks??node.clip.sourceDuration*30;return tick-node.startTick<=duration;
   });if(instance.warning&&tick>instance.warningEnd)instance.warning=false;if(!instance.nodes.length&&['end','interrupted'].includes(instance.stage))this.instances.delete(key);
  }return tick;
 }
 draw(ctx,{sockets=()=>undefined,facing=()=>1,layer='all'}={}){
  if(layer==='all'||layer==='ground')this.commands=[];
  for(const instance of this.instances.values()){
   if(instance.warning&&(layer==='all'||layer==='ground')&&instance.geometry.kind!=='none')this.drawWarning(ctx,instance);
   if(instance.stage==='active'&&instance.geometry.kind!=='none'&&(layer==='all'||layer==='ground')&&this.tick<instance.activeEnd){const ps=warningPolygon(instance.geometry).map(this.project);ctx.save();ctx.beginPath();ps.forEach((p,n)=>n?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.strokeStyle=this.tokens.WarningEdge??'#ff6b5b';ctx.globalAlpha=.8;ctx.lineWidth=1.5;ctx.stroke();ctx.restore();this.commands.push({type:'active-boundary',geometry:instance.geometry,points:ps,castId:instance.castId});}
   for(const node of instance.nodes){if(layer!=='all'&&node.clip.layer!==layer)continue;this.drawNode(ctx,instance,node,{sockets,facing});}
  }
  for(const secondary of this.secondary.values()){
   if(layer!=='all'&&secondary.clip.layer!==layer)continue;
   const point=sockets(secondary.sourceId,secondary.clip.mount);if(!finitePoint(point)){this.errors.push('Missing actual secondary bone '+secondary.clip.mount);continue;}
   for(const offset of secondary.clip.phaseOffsets??[0])this.drawClip(ctx,secondary.clip,(this.tick-secondary.startTick)/30+offset,point,{facing:facing(secondary.sourceId),name:secondary.name,id:secondary.id,sourceId:secondary.sourceId});
  }
 }
 drawWarning(ctx,i){
  const p=warningPolygon(i.geometry).map(this.project);if(!p.length)return;ctx.save();ctx.beginPath();p.forEach((v,n)=>n?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();
  for(const name of ['WarningFill','WarningOutline','WarningEdge','WarningTimer'])if(!this.tokens[name]||this.tokens[name].includes('{'))throw Error('Resolved battle token required: '+name);
  ctx.fillStyle=this.tokens.WarningFill;ctx.globalAlpha=.17;ctx.fill();ctx.globalAlpha=1;ctx.lineWidth=2.5;ctx.strokeStyle=this.tokens.WarningOutline;ctx.stroke();ctx.lineWidth=1.2;ctx.strokeStyle=this.tokens.WarningEdge;ctx.stroke();
  const span=Math.max(1,i.warningEnd-i.warningStart),progress=Math.max(0,Math.min(1,(this.tick-i.warningStart)/span)),last=Math.floor(progress*p.length);ctx.beginPath();p.slice(0,last+1).forEach((v,n)=>n?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.lineWidth=2;ctx.strokeStyle=this.tokens.WarningTimer;ctx.stroke();ctx.restore();
  this.commands.push({type:'warning',castId:i.castId,geometry:structuredClone(i.geometry),points:p,progress});
 }
 drawNode(ctx,i,node,{sockets,facing}){
  const clip=node.clip,mount=clip.mount;let point;
  if(mount==='projectile')point=node.screenPosition??(node.position?this.project(node.position):undefined);
  else if(mount==='hit')point=node.name==='status'?sockets(node.targetId,'chest'):node.screenPosition??(node.position?this.project(node.position):undefined);
  else if(mount==='ground'||mount==='last-stage')point=node.position?this.project(node.position):i.position?this.project(i.position):undefined;
  else point=sockets(i.sourceId,mount);
  if(!finitePoint(point)){this.errors.push('Missing actual mount '+i.id+'/'+node.name+'/'+mount);return;}
  let rotation=node.rotation??0;if(node.direction){const d=this.project(node.direction),zero=this.project({x:0,y:0});rotation=Math.atan2(d.y-zero.y,d.x-zero.x)+Math.PI/2;}
  const options={facing:facing(i.sourceId),rotation,name:node.name,id:i.id,castId:i.castId,mount,sourceId:i.sourceId,geometry:i.geometry};
  if(node.name==='active'&&['circle','beam','dash'].includes(i.geometry.kind)){
   ctx.save();const p=warningPolygon(i.geometry).map(this.project);ctx.beginPath();p.forEach((v,n)=>n?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();ctx.clip();
   if(i.geometry.kind==='beam'){
    const start=sockets(i.sourceId,'weapon'),end=this.project({x:i.geometry.origin.x+(i.geometry.target.x-i.geometry.origin.x)/Math.hypot(i.geometry.target.x-i.geometry.origin.x,i.geometry.target.y-i.geometry.origin.y)*i.geometry.reach,y:i.geometry.origin.y+(i.geometry.target.y-i.geometry.origin.y)/Math.hypot(i.geometry.target.x-i.geometry.origin.x,i.geometry.target.y-i.geometry.origin.y)*i.geometry.reach});
    const root=this.project(i.geometry.origin),direction={x:end.x-root.x,y:end.y-root.y},length=Math.hypot(direction.x,direction.y);options.rotation=Math.atan2(direction.y,direction.x)+Math.PI/2;options.length=length;point=root;
   }
   if(clip.distribution){const density=Math.min(clip.density,this.maxDecorations);for(let n=0;n<density;n++){
    const a=n*2.3999632,r=Math.sqrt((n+.5)/density)*i.geometry.radius,p=this.project({x:i.geometry.center.x+Math.cos(a)*r,y:i.geometry.center.y+Math.sin(a)*r});
    this.drawClip(ctx,clip,(this.tick-node.startTick+n*4)/30,p,{...options,size:clip.size*.55,copy:n});
   }}else this.drawClip(ctx,clip,(this.tick-node.startTick)/30,point,options);ctx.restore();
  }else this.drawClip(ctx,clip,(this.tick-node.startTick)/30,point,options);
 }
 drawClip(ctx,clip,elapsed,point,options={}){
  if(elapsed<0)return;
  const image=this.images.get(clip.image),atlas=this.atlases.get(clip.atlas);if(!image||!atlas){this.errors.push('Unloaded material '+clip.sourceClip);return;}
  const override=clip.retime,seconds=override?override.durationTicks/30:clip.sourceDuration,t=clip.loop?elapsed%seconds:Math.min(seconds,elapsed),normal=seconds>0?t/seconds:1,window=override?.sourceWindow??[0,1],sourceT=clip.sourceDuration*(window[0]+normal*(window[1]-window[0]));
  const index=Math.min(clip.frames.length-1,Math.floor(sourceT*clip.fps+1e-5)),key=clip.frames[index],f=atlas.frames[key];if(!f)throw Error('Missing exact clip frame '+key);
  const frame=f.frame,ss=f.spriteSourceSize,anchor=clip.anchor,originalW=f.sourceSize.w,originalH=f.sourceSize.h,size=options.size??clip.size,scale=size/Math.max(originalW,originalH),rotation=options.rotation??0;
  const sx=scale,sy=options.length?options.length/originalH:scale;
  ctx.save();ctx.translate(point.x,point.y);ctx.rotate(rotation);if(!rotation&&options.mount!=='projectile')ctx.scale(options.facing===-1?-1:1,1);ctx.globalCompositeOperation=clip.blend??'source-over';
  // Texture union registration is invariant across frames; no frame-by-frame centering.
  const dx=(ss.x-anchor[0]*originalW)*sx,dy=(ss.y-anchor[1]*originalH)*sy,dw=frame.w*sx,dh=frame.h*sy;
  let tinted;const tintKey=clip.image+':'+key+':'+clip.tint;
  if(clip.tint){tinted=this.tintedFrames.get(tintKey);if(!tinted){tinted=document.createElement('canvas');tinted.width=frame.w;tinted.height=frame.h;const c=tinted.getContext('2d');c.drawImage(image,frame.x,frame.y,frame.w,frame.h,0,0,frame.w,frame.h);c.globalCompositeOperation='multiply';c.fillStyle=clip.tint;c.fillRect(0,0,frame.w,frame.h);c.globalCompositeOperation='destination-in';c.drawImage(image,frame.x,frame.y,frame.w,frame.h,0,0,frame.w,frame.h);this.tintedFrames.set(tintKey,tinted);if(this.tintedFrames.size>96)this.tintedFrames.delete(this.tintedFrames.keys().next().value);}}
  if(!options.componentsOnly){if(tinted)ctx.drawImage(tinted,dx,dy,dw,dh);else ctx.drawImage(image,frame.x,frame.y,frame.w,frame.h,dx,dy,dw,dh);}
  for(const component of clip.components??[]){let im=this.images.get(component.image);if(im){ctx.globalCompositeOperation='source-over';const h=component.height??component.width*im.height/im.width,w=component.width??h*im.width/im.height;if(component.tint){const key=component.image+':component:'+component.tint;let tinted=this.tintedFrames.get(key);if(!tinted){tinted=document.createElement('canvas');tinted.width=im.width;tinted.height=im.height;const c=tinted.getContext('2d');c.drawImage(im,0,0);c.globalCompositeOperation='multiply';c.fillStyle=component.tint;c.fillRect(0,0,im.width,im.height);c.globalCompositeOperation='destination-in';c.drawImage(im,0,0);this.tintedFrames.set(key,tinted);}im=tinted;}ctx.drawImage(im,-w/2,-h/2,w,h);}}
  ctx.restore();this.commands.push({type:'clip',id:options.id,name:options.name,castId:options.castId,frame:key,sourceClip:clip.sourceClip,mount:options.mount??clip.mount,point:{...point},rotation,elapsed,copy:options.copy,size});
 }
 diagnostics(){return {tick:this.tick,paused:this.paused,instances:[...this.instances.values()].map(i=>({id:i.id,castId:i.castId,stage:i.stage,nodes:i.nodes.map(n=>n.name),geometry:i.geometry,position:i.position})),secondary:[...this.secondary.values()].map(s=>({id:s.id,name:s.name,sourceId:s.sourceId,mount:s.clip.mount})),commands:structuredClone(this.commands),errors:[...new Set(this.errors)]};}
}
export async function loadStarSeaVfx(url='/art/starsea/vfx/manifest.json',options){const response=await fetch(url);if(!response.ok)throw Error('Missing VFX manifest');const renderer=new StarSeaVfxRenderer(await response.json(),options);await renderer.load();return renderer;}
