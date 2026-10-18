export class SceneRenderer {
  constructor(canvas, manifest) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    this.assets=new Map((Array.isArray(manifest)?manifest:manifest.assets).map(a=>[a.id,a]));
    this.images=new Map(); this.data=new Map(); this.patterns=new Map(); this.errors=[];
    this.zoom=1; this.center=null; this.debug=false; this.actors=[]; this.probe=null;
  }
  async image(url) {
    if(this.images.has(url))return this.images.get(url);
    const img=new Image(); const p=new Promise((res,rej)=>{img.onload=()=>res(img);img.onerror=()=>rej(Error('Missing image '+url));});
    this.images.set(url,p); img.src=url; const done=await p; this.images.set(url,done); return done;
  }
  async json(url) { if(!this.data.has(url)){const r=await fetch(url);if(!r.ok)throw Error('Missing JSON '+url);this.data.set(url,await r.json());}return this.data.get(url); }
  project(x,y) {return [(x-y)*32,(x+y)*18];}
  fit() {
    const m=this.map;this.zoom=Math.min((this.canvas.width-150)/((m.width+m.height)*32),(this.canvas.height-130)/((m.width+m.height)*18+150));
    this.center=[0,(m.width+m.height)*9+15];
  }
  focus(x,y,zoom=1) {this.center=this.project(x,y);this.zoom=zoom;}
  async loadMap(map) {
    this.map=map; const ids=new Set([map.groundResource,map.backdropResource,map.boundary.resourceId,'ss-scene-road',...map.decorations.map(d=>d.resourceId),...map.ambient.map(d=>d.resourceId)]);
    await Promise.all([...ids].map(async id=>{const a=this.assets.get(id);if(!a)throw Error('Missing scene resource '+id);if(a.runtime.kind==='prop')await Promise.all([...new Set([a.runtime.file,...(a.runtime.variants??[]).map(v=>v.file)])].map(file=>this.image(file)));else if(a.runtime.kind==='effect'){const c=await this.json(a.runtime.file);await Promise.all(c.clips.flatMap(x=>[this.image(x.image),this.json(x.atlas)]));await Promise.all(c.fragments.map(x=>this.image(x.file)));}}));
    if(!this.monsters){const response=await fetch('/art/starsea/monsters/manifest.json');if(response.ok)this.monsters=new Map((await response.json()).assets.map(a=>[a.id,a]));else this.monsters=new Map();}
    this.actors=map.spawns.filter(a=>this.monsters.has(a.artId)).map(a=>({...a,asset:this.monsters.get(a.artId)}));
    const sample=this.monsters.get('ss-mon-dusk-blade');this.probe=sample?{asset:sample,position:{x:map.landmarks[0].x,y:map.landmarks[0].y},facing:1}:null;
    await Promise.all([...this.actors,...(this.probe?[this.probe]:[])].flatMap(a=>[this.image(a.asset.runtime.image),this.json(a.asset.runtime.atlas)]));
    this.fit();return this;
  }
  worldPath(points,ctx=this.ctx) {ctx.beginPath();points.forEach(([x,y],i)=>{const p=this.project(x,y);i?ctx.lineTo(...p):ctx.moveTo(...p);});ctx.closePath();}
  shapeRect(x,y,w,h,ctx=this.ctx) {this.worldPath([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],ctx);}
  sampler(a,tint,washOverride) {
    const r=a.runtime,image=this.images.get(r.file),size=r.tileSize??512,wash=washOverride??r.wash,key=r.file+'|'+(tint??r.tint??'')+'|'+JSON.stringify(wash)+'|'+size;if(this.patterns.has(key))return this.patterns.get(key);
    const tile=document.createElement('canvas');tile.width=size*2;tile.height=size*2;const c=tile.getContext('2d');
    for(let x=0;x<2;x++)for(let y=0;y<2;y++){c.save();c.translate(x?size*2:0,y?size*2:0);c.scale(x?-1:1,y?-1:1);c.drawImage(image,0,0,size,size);c.restore();}
    const color=tint??r.tint;if(color){c.globalCompositeOperation='multiply';c.fillStyle=color;c.fillRect(0,0,tile.width,tile.height);c.globalCompositeOperation='source-over';}
    if(wash){c.globalAlpha=wash.alpha;c.fillStyle=wash.color;c.fillRect(0,0,tile.width,tile.height);c.globalAlpha=1;}
    const pattern=this.ctx.createPattern(tile,'repeat');this.patterns.set(key,pattern);return pattern;
  }
  sprite(d) {
    const a=this.assets.get(d.resourceId),r=a.runtime,v=r.variants?.find(v=>v.id===d.variant)??{},image=this.images.get(v.file??r.file);
    const w=d.displayWidth??v.displayWidth??r.displayWidth,h=w*image.height/image.width,anchor=v.anchor??r.anchor??[.5,1],p=this.project(d.x,d.y),c=this.ctx;
    c.save();c.translate(...p);if(d.mirrorX??v.mirrorX)c.scale(-1,1);c.globalAlpha=d.alpha??1;
    // Runtime tint uses an offscreen material; source pixels remain intact.
    let drawn=image;
    if(d.tint){const key=(v.file??r.file)+'|prop|'+d.tint;let material=this.patterns.get(key);if(!material){material=document.createElement('canvas');material.width=image.width;material.height=image.height;const t=material.getContext('2d');t.drawImage(image,0,0);t.globalCompositeOperation='multiply';t.fillStyle=d.tint;t.fillRect(0,0,image.width,image.height);t.globalCompositeOperation='destination-in';t.drawImage(image,0,0);this.patterns.set(key,material);}drawn=material;}
    c.drawImage(drawn,-anchor[0]*w,-anchor[1]*h,w,h);c.restore();
  }
  actor(a,time) {
    const r=a.asset.runtime,at=this.data.get(r.atlas),action=r.actions.move??r.actions.idle,keys=action.frames,key=keys[Math.floor(time*(r.fps??30))%keys.length],f=at.frames[key],p=this.project(a.position.x,a.position.y),c=this.ctx;
    const scale=r.scale??r.displayHeight/f.sourceSize.h,anchor=r.anchor??[.5,1],src=f.spriteSourceSize;
    c.save();c.translate(...p);c.scale(a.facing??1,1);c.drawImage(this.images.get(r.image),f.frame.x,f.frame.y,f.frame.w,f.frame.h,(src.x-anchor[0]*f.sourceSize.w)*scale,(src.y-anchor[1]*f.sourceSize.h)*scale,f.frame.w*scale,f.frame.h*scale);c.restore();
  }
  material(image,file,color) {
    if(!color)return image;const key=file+'|ambient|'+color;if(this.patterns.has(key))return this.patterns.get(key);const material=document.createElement('canvas');material.width=image.width;material.height=image.height;const t=material.getContext('2d');t.drawImage(image,0,0);t.globalCompositeOperation='source-atop';t.globalAlpha=.82;t.fillStyle=color;t.fillRect(0,0,image.width,image.height);this.patterns.set(key,material);return material;
  }
  clipFrame(clip,time,p,width,alpha,stretch=[1,1],tint=null) {
    const c=this.ctx,image=this.material(this.images.get(clip.image),clip.image,tint),atlas=this.data.get(clip.atlas),idx=Math.floor(time*clip.fps)%clip.frames.length,f=atlas.frames[clip.frames[idx]],ss=f.spriteSourceSize;
    const scale=width/f.sourceSize.w,anchor=clip.anchor??[.5,.5];c.save();c.translate(...p);c.scale(stretch[0],stretch[1]);c.globalAlpha=alpha;
    c.drawImage(image,f.frame.x,f.frame.y,f.frame.w,f.frame.h,(ss.x-anchor[0]*f.sourceSize.w)*scale,(ss.y-anchor[1]*f.sourceSize.h)*scale,f.frame.w*scale,f.frame.h*scale);c.restore();
  }
  ambient(item,time) {
    const a=this.assets.get(item.resourceId),d=this.data.get(a.runtime.file),c=this.ctx;
    if(d.clips.length){const clip=d.clips[0];for(let i=0;i<d.count;i++){const phase=(time/Math.max(d.duration,clip.duration)+i/d.count)%1,base=this.project(item.position.x+(i-(d.count-1)/2)*2,item.position.y);const p=[base[0]+phase*d.velocity[0]*d.duration,base[1]+phase*d.velocity[1]*d.duration];const alpha=d.alpha*(.7+.3*Math.sin(Math.PI*phase));this.clipFrame(clip,(time+i*clip.duration/d.count)%clip.duration,p,d.size[0]+(d.size[1]-d.size[0])*i/Math.max(d.count-1,1),alpha,d.stretch,d.tint);}}
    if(d.fragment)this.particles(d,item,time,d.fragment,d.count,d.size,d.velocity,d.alpha);
    if(d.sparks)this.particles(d,item,time,d.sparks.fragment,d.sparks.count,d.sparks.size,d.sparks.velocity,.55);
  }
  particles(d,item,time,name,count,size,velocity,alpha) {
    const c=this.ctx,fragment=d.fragments.find(f=>f.id===name),image=this.material(this.images.get(fragment.file),fragment.file,d.sparks?.fragment===name?d.sparks.tint:d.tint),origin=this.project(item.position.x,item.position.y);
    for(let i=0;i<count;i++){const seed=((i*1433+d.seed*337)%997)/997,age=(time/d.duration+i/count)%1,spread=d.mount==='sky'?640:50,x=origin[0]+(seed-.5)*spread+velocity[0]*age*d.duration,y=origin[1]+(((i*71)%293)/293-.5)*(d.mount==='sky'?550:30)+velocity[1]*age*d.duration,w=size[0]+seed*(size[1]-size[0]);
      c.save();c.globalAlpha=alpha*Math.sin(Math.PI*age);c.translate(x,y);c.rotate(d.mount==='sky'?seed*4+time*.1:0);c.drawImage(image,-w/2,-w/2,w,w);c.restore();}
  }
  render(time=0) {
    if(!this.map)return;const c=this.ctx,m=this.map,W=this.canvas.width,H=this.canvas.height;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);
    const sky=this.images.get(this.assets.get(m.backdropResource).runtime.file);c.drawImage(sky,0,0,W,H);
    c.fillStyle='rgba(241,244,236,.2)';c.fillRect(0,0,W,H);
    c.translate(W/2-this.center[0]*this.zoom,H/2-this.center[1]*this.zoom);c.scale(this.zoom,this.zoom);
    // Boundary modules are below the walkable top, followed by the independent ground surface.
    for(let n=0;n<m.width;n+=m.boundary.stepCells){this.sprite({resourceId:m.boundary.resourceId,x:n+2,y:m.height-.1,displayWidth:260,variant:'edge-west'});this.sprite({resourceId:m.boundary.resourceId,x:m.width-.1,y:n+2,displayWidth:260,variant:'edge-east'});}
    this.shapeRect(0,0,m.width,m.height);c.fillStyle=this.sampler(this.assets.get(m.groundResource));c.fill();
    // A single union of road cells ensures road crossings are sampled once.
    const roadCells=new Map();for(const r of m.roads)for(const [x,y] of r.points)for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)roadCells.set((x+dx)+','+(y+dy),[x+dx,y+dy]);
    c.save();c.beginPath();for(const [x,y] of roadCells.values()){const ps=[[x-.5,y-.5],[x+.5,y-.5],[x+.5,y+.5],[x-.5,y+.5]].map(p=>this.project(...p));ps.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();}c.clip();c.fillStyle=this.sampler(this.assets.get('ss-scene-road'),m.roads[0]?.tint,m.roads[0]?.wash);c.fillRect(-m.height*32,0,(m.width+m.height)*32,(m.width+m.height)*18);c.restore();
    for(const d of m.decorations.filter(d=>d.depthMode==='ground'))this.sprite(d);
    const depths=[...m.decorations.filter(d=>d.depthMode!=='ground').map(d=>({depth:d.x+d.y,prop:d})),...this.actors.map(a=>({depth:a.position.x+a.position.y,actor:a})),...(this.probe?[{depth:this.probe.position.x+this.probe.position.y,actor:this.probe}]:[])].sort((a,b)=>a.depth-b.depth);
    for(const row of depths)row.prop?this.sprite(row.prop):this.actor(row.actor,time);
    for(const item of m.ambient)this.ambient(item,time);
    if(this.debug){c.lineWidth=1/this.zoom;for(const o of m.obstacles){this.shapeRect(o.x,o.y,o.w,o.h);c.fillStyle='rgba(179,67,46,.22)';c.fill();c.strokeStyle='#a33e2b';c.stroke();}for(const s of m.safe){this.shapeRect(s.x,s.y,s.w,s.h);c.strokeStyle='#286b96';c.setLineDash([6/this.zoom,4/this.zoom]);c.stroke();c.setLineDash([]);}for(const l of m.landmarks){const p=this.project(l.x,l.y);c.fillStyle='#293940';c.beginPath();c.arc(...p,5/this.zoom,0,Math.PI*2);c.fill();c.font=12/this.zoom+'px sans-serif';c.fillStyle='#fcfaf5';c.strokeStyle='#293940';c.lineWidth=3/this.zoom;c.strokeText(l.id,p[0]+8/this.zoom,p[1]);c.fillText(l.id,p[0]+8/this.zoom,p[1]);}}
    c.setTransform(1,0,0,1,0,0);return {map:m.id,time,zoom:this.zoom,decorations:m.decorations.length,roadCells:roadCells.size,spawns:this.actors.length};
  }
  seamView(id) {const c=this.ctx,a=this.assets.get(id);c.setTransform(1,0,0,1,0,0);c.fillStyle=this.sampler(a);c.fillRect(0,0,this.canvas.width,this.canvas.height);return{id,sampling:a.runtime.sampling};}
}
