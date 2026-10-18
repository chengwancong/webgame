/* Original 3.6 JSON/atlas rendering. No image synthesis or pose interpolation. */
window.petLoad=async function(name,options){
 const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl',{alpha:true,preserveDrawingBuffer:true,premultipliedAlpha:true});
 if(!gl)throw Error('WebGL unavailable');const debug=gl.getExtension('WEBGL_debug_renderer_info');
 const gpu=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
 if(/swiftshader|llvmpipe|software|basic render/i.test(gpu))throw Error('Hardware GL required: '+gpu);
 const prefix='/library/'+name+'/',atlasText=await(await fetch(prefix+name+'.atlas')).text();
 const pages=atlasText.split(/\r?\n/).filter((v,i,a)=>v.trim()&&!v.includes(':')&&(i===0||!a[i-1].trim()));
 const textures={};for(const p of pages){const im=new Image();im.src=prefix+p.trim();await im.decode();textures[p.trim()]=new spine.webgl.GLTexture(gl,im);}
 const atlas=new spine.TextureAtlas(atlasText,p=>{if(!textures[p])throw Error('Missing page '+p);return textures[p];});
 const raw=await(await fetch(prefix+name+'.json')).json(),data=new spine.SkeletonJson(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(raw);
 for(const s of data.slots)if(options.darkTints?.[s.name]||options.darkTint){s.darkColor=new spine.Color();s.darkColor.set(0,0,0,1);}
 const skeleton=new spine.Skeleton(data),renderer=new spine.webgl.SceneRenderer(canvas,gl,true);
 const map={idle:'std',idle2:'std2',move:'walk',attack:'atk',knock:'jifei',skill:'skill'};
 const actions=Object.fromEntries(Object.entries(map).flatMap(([key,source])=>{const a=data.findAnimation(source);return a?[[key,{source,duration:a.duration,count:Math.max(1,Math.ceil(a.duration*30))}]]:[];}));
 function pose(action,time){skeleton.setToSetupPose();const a=data.findAnimation(map[action]);if(!a)throw Error('Missing '+action);a.apply(skeleton,0,time,false,[],1,spine.MixPose.setup,spine.MixDirection.mixIn);
  for(const s of skeleton.slots){const tint=options.tints?.[s.data.name]??options.tint;if(tint){s.color.r*=tint[0];s.color.g*=tint[1];s.color.b*=tint[2];}
   const dark=options.darkTints?.[s.data.name]??options.darkTint;if(dark){if(!s.darkColor)s.darkColor=new spine.Color();s.darkColor.set(dark[0],dark[1],dark[2],1);}}
  skeleton.updateWorldTransform();
 }
 pose('idle',0);
 window.petRender=function(action,time,camera){pose(action,time);
  const offset=new spine.Vector2(),size=new spine.Vector2();skeleton.getBounds(offset,size,[]);
  const bones=Object.fromEntries(skeleton.bones.map(b=>[b.data.name,{x:b.worldX,y:b.worldY,a:b.a,b:b.b,c:b.c,d:b.d}]));
  if(camera){canvas.width=canvas.height=camera.cell;gl.viewport(0,0,camera.cell,camera.cell);renderer.camera.position.x=camera.cx;renderer.camera.position.y=camera.cy;renderer.camera.viewportWidth=renderer.camera.viewportHeight=camera.span;gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);renderer.begin();renderer.drawSkeleton(skeleton,false);renderer.end();}
  return {png:camera?canvas.toDataURL():undefined,bounds:{minX:offset.x,minY:offset.y,maxX:offset.x+size.x,maxY:offset.y+size.y},bones};
 };
 return {gpu,version:data.version,actions,bones:data.bones.map(b=>({name:b.name,parent:b.parent?.name})),slots:data.slots.map(s=>({name:s.name,bone:s.boneData.name,blend:s.blendMode})),pages};
};
