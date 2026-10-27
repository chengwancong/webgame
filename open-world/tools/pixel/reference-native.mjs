/** CPU-only source inspection. Never produces runtime pixel art and never starts a browser. */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {AtlasAttachmentLoader,FakeTexture,SkeletonJson,Skin,TextureAtlas,RegionAttachment,MeshAttachment} from '@esotericsoftware/spine-webgl';
import {MiniNativePlayback} from '../../apps/web/src/mini-native-renderer.ts';
import {root,publicRoot} from './px0-art.mjs';
const safe=(url)=>{const file=path.resolve(publicRoot,'.'+url);if(!file.startsWith(path.resolve(publicRoot)+path.sep))throw Error('Source resource leaves public root');return file;};
export async function referenceNative(url,appearance,size=192){
 const profile=JSON.parse(fs.readFileSync(safe(url),'utf8')),atlas=new TextureAtlas(fs.readFileSync(safe(profile.runtime.atlas),'utf8'));
 for(const page of atlas.pages)page.setTexture(new FakeTexture({width:page.width,height:page.height}));
 const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(fs.readFileSync(safe(profile.runtime.json),'utf8')));
 const weapon=profile.weapons[appearance?.parts?.weapon?.setId]??Object.values(profile.weapons)[0],skin=new Skin('pixel-reference-only');
 for(const name of [...profile.skinNames,...(weapon.skinNames??[])]){const found=data.findSkin(name);if(found)skin.addSkin(found);}
 for(const name of profile.activeBones??[]){const bone=data.findBone(name);if(bone&&!skin.bones.includes(bone))skin.bones.push(bone);}
 const playback=new MiniNativePlayback(data,skin),animation=data.findAnimation(weapon.actions.idle.name);playback.seek(animation,Math.min(.2,animation.duration),profile.fps??60);
 const triangles=[];let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const slot of playback.skeleton.drawOrder){
  const attachment=slot.getAttachment();if(!(attachment instanceof RegionAttachment)&&!(attachment instanceof MeshAttachment))continue;
  const alpha=slot.color.a*attachment.color.a;if(alpha<=0)continue;
  const count=attachment.worldVerticesLength??8,vertices=new Float32Array(count);
  if(attachment instanceof RegionAttachment)attachment.computeWorldVertices(slot,vertices,0,2);else attachment.computeWorldVertices(slot,0,count,vertices,0,2);
  const indices=attachment.triangles??[0,1,2,2,3,0],uv=attachment.uvs,page=attachment.region?.page;if(!page)continue;
  for(let i=0;i<indices.length;i+=3){const points=[];for(let n=0;n<3;n++){const index=indices[i+n],x=vertices[index*2],y=vertices[index*2+1];minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);points.push({x,y,u:uv[index*2]*page.width,v:uv[index*2+1]*page.height});}triangles.push({points,page,alpha});}
 }
 if(!triangles.length)throw Error('No visible source geometry');
 const scale=(size-12)/Math.max(maxX-minX,maxY-minY),ox=(size-(maxX-minX)*scale)/2,oy=(size-(maxY-minY)*scale)/2,defs=[],draws=[],pages=new Map();
 for(const page of atlas.pages){const file=safe(path.posix.join(path.posix.dirname(profile.runtime.atlas),page.name));if(!/\.(png|webp)$/i.test(file))throw Error('Unexpected atlas page format');const id='page'+pages.size;pages.set(page,id);defs.push(`<image id="${id}" width="${page.width}" height="${page.height}" href="data:image/png;base64,${fs.readFileSync(file).toString('base64')}"/>`);}
 for(const triangle of triangles){
  const p=triangle.points.map(v=>({...v,x:ox+(v.x-minX)*scale,y:oy+(maxY-v.y)*scale})),[a,b,c]=p,du=b.u-a.u,dv=b.v-a.v,eu=c.u-a.u,ev=c.v-a.v,det=du*ev-eu*dv;if(Math.abs(det)<1e-8)continue;
  const ax=((b.x-a.x)*ev-(c.x-a.x)*dv)/det,cx=((c.x-a.x)*du-(b.x-a.x)*eu)/det,ay=((b.y-a.y)*ev-(c.y-a.y)*dv)/det,cy=((c.y-a.y)*du-(b.y-a.y)*eu)/det,tx=a.x-ax*a.u-cx*a.v,ty=a.y-ay*a.u-cy*a.v,id='clip'+draws.length;
  defs.push(`<clipPath id="${id}"><polygon points="${p.map(v=>v.x+','+v.y).join(' ')}"/></clipPath>`);draws.push(`<g clip-path="url(#${id})" opacity="${triangle.alpha}"><use href="#${pages.get(triangle.page)}" transform="matrix(${ax} ${ay} ${cx} ${cy} ${tx} ${ty})"/></g>`);
 }
 return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${defs.join('')}</defs>${draws.join('')}</svg>`)).png().toBuffer();
}
