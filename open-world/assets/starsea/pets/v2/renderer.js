/* Original 3.6 JSON/atlas rendering. No image synthesis or pose interpolation. */
window.petLoad=async function(name,options){
 const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl',{alpha:true,preserveDrawingBuffer:true,premultipliedAlpha:true});
 // Spine 3.6 uses blendFunc for both RGB and alpha; use straight-alpha RGB plus correct coverage alpha.
 // Otherwise overlapping antialiased parts reduce an opaque body's alpha and create pale halos in PNG.
 gl.blendFunc=(src,dst)=>gl.blendFuncSeparate(src,dst,gl.ONE,dst);
 gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
 if(!gl)throw Error('WebGL unavailable');const debug=gl.getExtension('WEBGL_debug_renderer_info');
 const gpu=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
 if(/swiftshader|llvmpipe|software|basic render/i.test(gpu))throw Error('Hardware GL required: '+gpu);
 const prefix=options.prefix??('/library/'+name+'/'),atlasText=await(await fetch(prefix+name+'.atlas')).text();
 const pages=atlasText.split(/\r?\n/).filter((v,i,a)=>v.trim()&&!v.includes(':')&&(i===0||!a[i-1].trim()));
 const textures={};for(const p of pages){const im=new Image();im.src=prefix+p.trim();await im.decode();textures[p.trim()]=new spine.webgl.GLTexture(gl,im);}
 const atlas=new spine.TextureAtlas(atlasText,p=>{if(!textures[p])throw Error('Missing page '+p);return textures[p];});
 const raw=await(await fetch(prefix+name+'.json')).json(),data=new spine.SkeletonJson(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(raw);
 if(options.tints||options.tint||options.darkTints||options.darkTint)throw Error('PA2 forbids slot tint overrides');
 const skeleton=new spine.Skeleton(data),renderer=new spine.webgl.SceneRenderer(canvas,gl,true);
 const map={idle:'std',idle2:'std2',move:'walk',attack:'atk',knock:'jifei',skill:'skill'};
 const actions=Object.fromEntries(Object.entries(map).flatMap(([key,source])=>{const a=data.findAnimation(source);return a?[[key,{source,duration:a.duration,count:Math.max(1,Math.ceil(a.duration*30))}]]:[];}));
 function pose(action,time){skeleton.setToSetupPose();const a=data.findAnimation(map[action]);if(!a)throw Error('Missing '+action);a.apply(skeleton,0,time,false,[],1,spine.MixPose.setup,spine.MixDirection.mixIn);
  skeleton.updateWorldTransform();
 }
 pose('idle',0);
 window.partsAt=function(action,time){pose(action,time);const parts=[];for(const slot of skeleton.slots){const entry=raw.skins.default?.[slot.data.name],a=slot.getAttachment()??(entry?data.defaultSkin.getAttachment(slot.data.index,Object.keys(entry)[0]):null);if(!a)continue;let vertices,uvs,triangles;if(a instanceof spine.MeshAttachment){vertices=new Float32Array(a.worldVerticesLength);a.computeWorldVertices(slot,0,a.worldVerticesLength,vertices,0,2);uvs=[...a.regionUVs];triangles=[...a.triangles];}else if(a instanceof spine.RegionAttachment){const b=slot.bone,r=a.rotation*Math.PI/180;uvs=[0,0,1,0,1,1,0,1];vertices=[];for(let i=0;i<8;i+=2){const x=(uvs[i]-.5)*a.width*a.scaleX,y=(.5-uvs[i+1])*a.height*a.scaleY,lx=a.x+x*Math.cos(r)-y*Math.sin(r),ly=a.y+x*Math.sin(r)+y*Math.cos(r);vertices.push(b.a*lx+b.b*ly+b.worldX,b.c*lx+b.d*ly+b.worldY);}triangles=[0,1,2,0,2,3];}else continue;parts.push({slot:slot.data.name,path:a.path??a.name,vertices:[...vertices],uvs,triangles,visible:!!slot.getAttachment(),alpha:slot.color.a});}return parts;};
 const eyeSlot=skeleton.slots.find(s=>/\/yan$/.test(s.data.name)),eyeAttachment=eyeSlot?.getAttachment();
 window.petGeometry=function(action,time){pose(action,time);const body=skeleton.findSlot('body'),mesh=body.getAttachment(),vertices=new Float32Array(mesh.worldVerticesLength);mesh.computeWorldVertices(body,0,mesh.worldVerticesLength,vertices,0,2);
  const eyePoint=(u,v)=>{const a=eyeAttachment,b=eyeSlot.bone,r=a.rotation*Math.PI/180,x=(u-.5)*a.width*a.scaleX,y=(.5-v)*a.height*a.scaleY,lx=a.x+x*Math.cos(r)-y*Math.sin(r),ly=a.y+x*Math.sin(r)+y*Math.cos(r);return [b.a*lx+b.b*ly+b.worldX,b.c*lx+b.d*ly+b.worldY];};
  return {vertices:[...vertices],uvs:[...mesh.regionUVs],triangles:[...mesh.triangles],eyePoints:[eyePoint(.25,.5),eyePoint(.82,.5)],eyeVisible:!!eyeSlot.getAttachment(),eyeBone:eyeSlot.bone.data.name};
 };
 window.petRender=function(action,time,camera){pose(action,time);
  const offset=new spine.Vector2(),size=new spine.Vector2();skeleton.getBounds(offset,size,[]);
  const bones=Object.fromEntries(skeleton.bones.map(b=>[b.data.name,{x:b.worldX,y:b.worldY,a:b.a,b:b.b,c:b.c,d:b.d}]));
  if(camera){canvas.width=canvas.height=camera.cell;gl.viewport(0,0,camera.cell,camera.cell);renderer.camera.position.x=camera.cx;renderer.camera.position.y=camera.cy;renderer.camera.viewportWidth=renderer.camera.viewportHeight=camera.span;gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);renderer.begin();renderer.drawSkeleton(skeleton,true);renderer.end();}
  return {png:camera?canvas.toDataURL():undefined,bounds:{minX:offset.x,minY:offset.y,maxX:offset.x+size.x,maxY:offset.y+size.y},bones};
 };
 return {gpu,version:data.version,actions,bones:data.bones.map(b=>({name:b.name,parent:b.parent?.name})),slots:data.slots.map(s=>({name:s.name,bone:s.boneData.name,blend:s.blendMode})),pages};
};
