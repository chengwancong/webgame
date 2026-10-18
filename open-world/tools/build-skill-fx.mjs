import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

// Production build consumes only tracked PNGs and source metadata in this project.
const root=resolve(import.meta.dirname,'..');
const spec=JSON.parse(await readFile(resolve(root,'assets/skill-fx/source.json'),'utf8'));
const manifest={schemaVersion:1,texture:{key:'skill-source-fx',image:'/art/effects/skill-source.png',atlas:'/art/effects/skill-source.json'},clips:{}};
const pending=[];
function bounds(data,width,height){let left=width,top=height,right=-1,bottom=-1;for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>0){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}return right<0?null:{left,top,width:right-left+1,height:bottom-top+1};}

for(const [id,clip] of Object.entries(spec.clips)){
 const images=[];
 for(const frame of clip.raw){
  const original=await readFile(resolve(root,frame.file));
  if(createHash('sha256').update(original).digest('hex')!==frame.sha256)throw Error('Source hash mismatch: '+frame.file);
  const {data,info}=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(info.width!==frame.width||info.height!==frame.height)throw Error('Source dimensions changed: '+frame.file);
  const a=frame.attachment;
  // Register changing source canvases by the original attachment center offset.
  // Do not bake old character-bone rotation or stretch art to old skeleton units.
  const offsetX=a?.width? a.x*info.width/a.width:0;
  const offsetY=a?.height? -a.y*info.height/a.height:0;
  images.push({frame,data,width:info.width,height:info.height,left:Math.round(offsetX-info.width/2),top:Math.round(offsetY-info.height/2)});
 }
 const minLeft=Math.min(...images.map(i=>i.left)),minTop=Math.min(...images.map(i=>i.top));
 const width=Math.max(...images.map(i=>i.left+i.width))-minLeft,height=Math.max(...images.map(i=>i.top+i.height))-minTop;
 const keys=[];let visibleLeft=width,visibleTop=height,visibleRight=-1,visibleBottom=-1;
 for(let index=0;index<images.length;index++){
  const input=images[index],canvas=Buffer.alloc(width*height*4),x=input.left-minLeft,y=input.top-minTop;
  for(let row=0;row<input.height;row++)input.data.copy(canvas,((y+row)*width+x)*4,row*input.width*4,(row+1)*input.width*4);
  const trim=bounds(canvas,width,height);if(!trim)throw Error('Empty effect source: '+input.frame.file);
  visibleLeft=Math.min(visibleLeft,trim.left);visibleTop=Math.min(visibleTop,trim.top);visibleRight=Math.max(visibleRight,trim.left+trim.width);visibleBottom=Math.max(visibleBottom,trim.top+trim.height);
  const key=id+'/'+String(index).padStart(3,'0');keys.push(key);
  const png=await sharp(canvas,{raw:{width,height,channels:4}}).extract(trim).png().toBuffer();
  pending.push({key,png,trim,sourceSize:{w:width,h:height}});
 }
 const ground=clip.kind==='ground'||clip.kind==='aura';
 const origin=clip.visualAnchor??(ground?[(visibleLeft+visibleRight)/2/width,visibleBottom/height]:[-minLeft/width,-minTop/height]);
 let timeline=clip.timeline,duration=clip.duration,timelineBasis=clip.source.timelineBasis??(timeline?'Original attachment timeline, retained verbatim.':'Independent source-sequence playback; original timeline is preserved as provenance.');
 if(id==='orange-fire'&&timeline){const start=timeline.findIndex(key=>key.frame!==null);const end=timeline.findIndex((key,index)=>index>start&&key.frame===null);if(start>=0&&end>start){const offset=timeline[start].time;timeline=timeline.slice(start,end+1).map(key=>({...key,time:key.time-offset}));duration=timeline.at(-1).time;timelineBasis='Effect-only visible interval. Remove old actor windup/idle delay and rebase by '+offset+' seconds; original Attack2 timestamps remain in originalAttachmentTimelines.';}}
 manifest.clips[id]={frames:keys,fps:clip.fps,duration,blend:clip.blend,origin,nativeFacing:'right',canvas:[width,height],kind:clip.kind,...(clip.role?{role:clip.role}:{}),...(clip.rotationOffset!==undefined?{rotationOffset:clip.rotationOffset}:{}),timeline,source:{...clip.source,timelineBasis,files:clip.raw.map(f=>({file:f.file,originalPath:f.originalPath,sha256:f.sha256})),originBasis:clip.visualAnchor?'Calibrated visible projectile tip in the unchanged common source canvas.':ground?'Bottom center of union of nonzero-alpha source artwork, registered across all frames, for the new logical ground/feet anchor.':'Original attachment-local bone origin after source center offsets are converted into PNG pixels and all frames registered on a common canvas.',registration:{canvas:[width,height],originalBoneOrigin:[-minLeft,-minTop],originalAttachmentRotationBaked:false,artisticEdits:false}}};
}

const atlasWidth=2048,padding=2;let x=padding,y=padding,rowHeight=0;
for(const frame of pending){const {width:w,height:h}=frame.trim;if(w+padding*2>atlasWidth)throw Error('Effect frame too wide: '+frame.key);if(x+w+padding>atlasWidth){x=padding;y+=rowHeight+padding*2;rowHeight=0;}frame.x=x;frame.y=y;x+=w+padding*2;rowHeight=Math.max(rowHeight,h);}
const usedHeight=y+rowHeight+padding,atlasHeight=2**Math.ceil(Math.log2(usedHeight));
if(atlasHeight>8192)throw Error('Effect atlas exceeds 8192px height');
const atlas={frames:{},meta:{app:'build-skill-fx.mjs',version:'1',image:'skill-source.png',format:'RGBA8888',size:{w:atlasWidth,h:atlasHeight},scale:'1'}};
for(const frame of pending)atlas.frames[frame.key]={frame:{x:frame.x,y:frame.y,w:frame.trim.width,h:frame.trim.height},rotated:false,trimmed:frame.trim.left!==0||frame.trim.top!==0||frame.trim.width!==frame.sourceSize.w||frame.trim.height!==frame.sourceSize.h,spriteSourceSize:{x:frame.trim.left,y:frame.trim.top,w:frame.trim.width,h:frame.trim.height},sourceSize:frame.sourceSize};
const publicRoot=resolve(root,'apps/web/public/art/effects');await mkdir(publicRoot,{recursive:true});
// Copy texels directly: compositing would premultiply/unpremultiply partial alpha
// and introduce rounding differences in existing painted edge colors.
const packedPixels=Buffer.alloc(atlasWidth*atlasHeight*4);
for(const frame of pending){const {data}=await sharp(frame.png).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let row=0;row<frame.trim.height;row++)data.copy(packedPixels,((frame.y+row)*atlasWidth+frame.x)*4,row*frame.trim.width*4,(row+1)*frame.trim.width*4);}
await sharp(packedPixels,{raw:{width:atlasWidth,height:atlasHeight,channels:4}}).png().toFile(resolve(publicRoot,'skill-source.png'));
await writeFile(resolve(publicRoot,'skill-source.json'),JSON.stringify(atlas)+'\n');
const output=resolve(root,'packages/asset-manifest/skill-fx.json');await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({clips:Object.keys(manifest.clips),frames:pending.length,atlas:[atlasWidth,atlasHeight],sourceOnly:true}));
