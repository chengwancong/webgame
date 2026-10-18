import {readFile,writeFile,mkdir,copyFile,access} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {AtlasAttachmentLoader,FakeTexture,Skeleton,SkeletonJson,Skin,TextureAtlas,Vector2,Physics,MixBlend,MixDirection} from '@esotericsoftware/spine-webgl';
const root=resolve(import.meta.dirname,'../../../..'),group=join(root,'assets/starsea/npc'),pub=join(root,'apps/web/public/art/starsea/npc');
const selection=JSON.parse(await readFile(join(group,'source/selection.json'),'utf8'));
const req=JSON.parse(await readFile(join(root,'docs/starsea/requirements.json'),'utf8'));
const source=join(root,selection.nativeSource),originalAtlas=await readFile(join(source,'Character.atlas'),'utf8'),nativeText=await readFile(join(source,'Character.json'),'utf8');
const original=JSON.parse(nativeText),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(join(pub,'shared'),{recursive:true});
for(const name of ['Character.png','Character_2.png'])await copyFile(join(source,name),join(pub,'shared',name));
const accessoryConfig=JSON.parse(await readFile(join(group,'source/accessories.json'),'utf8')),parts={},composites=[];
const partRoot=join(group,'source/parts');await mkdir(partRoot,{recursive:true});
let extraAtlas='\nNpcParts.png\nsize:512,896\nfilter:Linear,Linear\npma:true\n',index=0;
for(const [short,list] of Object.entries(accessoryConfig)){
 const input=join(group,'source',short+'-kit.png'),meta=await sharp(input).metadata(),halfW=Math.floor(meta.width/2),halfH=Math.floor(meta.height/2);
 for(const item of list){
  const q={left:(item.cell%2)*halfW,top:Math.floor(item.cell/2)*halfH,width:halfW,height:halfH};
  const {data,info}=await sharp(input).extract(q).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let x0=info.width,y0=info.height,x1=-1,y1=-1;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>1){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  if(x1<0)throw Error('Empty kit quadrant '+short+'/'+item.name);
  const rect={left:q.left+Math.max(0,x0-2),top:q.top+Math.max(0,y0-2),width:Math.min(info.width,x1+3)-Math.max(0,x0-2),height:Math.min(info.height,y1+3)-Math.max(0,y0-2)};
  const name=short+'-'+item.name,png=await sharp(input).extract(rect).resize({width:124,height:124,fit:'inside',withoutEnlargement:true}).png().toBuffer();await writeFile(join(partRoot,name+'.png'),png);
  const raw=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // Runtime page uses premultiplied alpha, matching the original native atlas.
  for(let p=0;p<raw.data.length;p+=4){const alpha=raw.data[p+3]/255;for(let c=0;c<3;c++)raw.data[p+c]=Math.round(raw.data[p+c]*alpha);}
  const packed=await sharp(raw.data,{raw:raw.info}).png().toBuffer(),left=(index%4)*128+2,top=Math.floor(index/4)*128+2;
  composites.push({input:packed,left,top});extraAtlas+=`npc/${name}\nbounds:${left},${top},${raw.info.width},${raw.info.height}\n`;
  parts[name]={...item,region:'npc/'+name,crop:rect,widthPixels:raw.info.width,heightPixels:raw.info.height,path:`assets/starsea/npc/source/parts/${name}.png`,sha256:sha(png)};index++;
 }
}
await sharp({create:{width:512,height:896,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composites.map(c=>({...c,premultiplied:false}))).png().toFile(join(pub,'shared/NpcParts.png'));
const atlasText=originalAtlas+extraAtlas;await writeFile(join(pub,'shared/Character.atlas'),atlasText);await writeFile(join(group,'source/accessory-regions.json'),JSON.stringify(parts,null,2)+'\n');
const atlas=new TextureAtlas(atlasText);for(const page of atlas.pages)page.setTexture(new FakeTexture({width:page.width,height:page.height}));
const manifest={schemaVersion:1,group:'npc',version:selection.version,designVersion:req.version,delivery:{preview:'/art/starsea/npc/preview/index.html',review:'assets/starsea/npc/evidence/self-review.json',video:'assets/starsea/npc/evidence/npc-native-dynamic-1280x720.webm',runtimeLibrary:'@esotericsoftware/spine-webgl@4.2.120',nativeExportVersion:original.skeleton.spine,nativeReleaseRecord:'assets/mini-hero/navy/release.json',nativeRawProvenance:resolve(root,'../experiments/sequence-reskin/skins/navy-traveler/final/runtime').replaceAll('\\','/'),integrationOwner:'props_integration',readme:'assets/starsea/npc/README.md',rootAcceptance:'pending'},assets:[]};
for(const character of selection.characters){
 const spec=req.npcs.find(n=>n.id===character.id);if(!spec)throw Error('Unknown NPC '+character.id);
 const json=structuredClone(original),short=character.id.replace('ss-npc-',''),accessories=accessoryConfig[short];
 for(const slot of json.slots)if(character.tints?.[slot.name])slot.color=character.tints[slot.name];
 const custom={name:'STARSEA/'+short,bones:['RIGHTHAND','LEFTHAND'],attachments:{}};
 for(const item of accessories){
  const slotName='starsea-'+item.name,after=json.slots.findIndex(s=>s.name===item.after),part=parts[short+'-'+item.name];
  if(after<0)throw Error('Invalid draw order anchor '+item.after);json.slots.splice(after+1,0,{name:slotName,bone:item.bone,attachment:slotName});
  custom.attachments[slotName]={[slotName]:{name:part.region,x:item.x,y:item.y,rotation:item.rotation,width:item.width,height:item.height}};
 }
 json.skins.push(custom);
 const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(json),skinNames=[character.body,character.head,character.hair,custom.name],skin=new Skin(character.id);
 for(const name of skinNames){const nativeSkin=data.findSkin(name);if(!nativeSkin)throw Error('Missing native skin '+name);skin.addSkin(nativeSkin);}
 for(const name of ['RIGHTHAND','LEFTHAND']){const bone=data.findBone(name);if(bone&&!skin.bones.includes(bone))skin.bones.push(bone);}
 const actions={idle:{name:character.idle,loop:true},move:{name:character.move,loop:true},talk:{name:'Cast2',loop:true},read:{name:'Life_Crafting',loop:true},point:{name:'Spell1',loop:false},repair:{name:'Life_Crafting',loop:true},hurt:{name:'Damage1',loop:false},death:{name:'Die',loop:false}};
 const skeleton=new Skeleton(data);skeleton.setSkin(skin);skeleton.setToSetupPose();
 let referenceHeight;const off=new Vector2(),size=new Vector2(),bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};
 for(const [action,motion] of Object.entries(actions)){
  const anim=data.findAnimation(motion.name);if(!anim)throw Error('Missing animation '+motion.name);motion.duration=anim.duration;motion.fps=60;motion.source='native-clip';
  for(let f=0;f<=Math.ceil(anim.duration*60);f++){skeleton.setToSetupPose();anim.apply(skeleton,-1,Math.min(anim.duration,f/60),false,[],1,MixBlend.replace,MixDirection.mixIn);skeleton.updateWorldTransform(Physics.reset);skeleton.getBounds(off,size,[]);
   if(action==='idle'&&f===0)referenceHeight=off.y+size.y;
   bounds.minX=Math.min(bounds.minX,off.x);bounds.maxX=Math.max(bounds.maxX,off.x+size.x);bounds.minY=Math.min(bounds.minY,off.y);bounds.maxY=Math.max(bounds.maxY,off.y+size.y);
  }
 }
 const compatibility={idle:actions.idle,move:actions.move,attack:actions.talk,skill:actions.repair,projectile:actions.point,hurt:{name:'Damage1'},death:{name:'Die'}};
 const profile={schemaVersion:1,id:character.id,runtime:{json:`/art/starsea/npc/${character.id}/Character.json`,atlas:'/art/starsea/npc/shared/Character.atlas',pma:true},skinNames,acceptedBodySets:[character.bodySetId],nativeFacing:'left',referenceHeight,ground:[-.25,0],fps:60,previewBounds:bounds,activeBones:['RIGHTHAND','LEFTHAND'],weapons:{[character.bodySetId]:{family:character.family,skinNames:[],actions:compatibility,sockets:{}}},storyActions:actions,storyAdapter:{idle:'idle',move:'move',talk:'attack',repair:'skill',read:'skill',point:'projectile',hurt:'hurt',death:'death'},accessorySockets:accessories.map(item=>{const part=parts[short+'-'+item.name];return{slot:'starsea-'+item.name,bone:item.bone,region:part.region,localTransform:{x:item.x,y:item.y,rotation:item.rotation,width:item.width,height:item.height},...(/HAND/.test(item.bone)?{gripPixel:[Math.floor((.5-item.x/item.width)*part.widthPixels),Math.floor((.5+item.y/item.height)*part.heightPixels)],imageSize:[part.widthPixels,part.heightPixels]}:{})};})};
 const renderAppearance={rig:'modular-hero',family:character.family,styleProfile:'v2-soft',revision:0,parts:Object.fromEntries(['head','body','hands','legs','feet','back','weapon'].map(part=>[part,{setId:character.bodySetId}]))};
 await mkdir(join(pub,character.id),{recursive:true});
 await writeFile(join(pub,character.id,'Character.json'),JSON.stringify(json)+'\n');await writeFile(join(pub,character.id,'profile.json'),JSON.stringify(profile,null,2)+'\n');
 const filePaths=[`apps/web/public/art/starsea/npc/${character.id}/profile.json`,`apps/web/public/art/starsea/npc/${character.id}/Character.json`];
 const files=[];for(const path of filePaths){const bytes=await readFile(join(root,path));files.push({path,sha256:sha(bytes),bytes:bytes.length});}
 const kitPath=`assets/starsea/npc/source/${short}-kit.png`,kitBytes=await readFile(join(root,kitPath)),kitMeta=await sharp(kitBytes).metadata();files.push({path:kitPath,sha256:sha(kitBytes),width:kitMeta.width,height:kitMeta.height,alpha:kitMeta.hasAlpha});for(const item of accessories){const part=parts[short+'-'+item.name];files.push({path:part.path,sha256:part.sha256,width:part.widthPixels,height:part.heightPixels,alpha:true});}
 const promptPath=`assets/starsea/npc/source/${short}-kit.json`,promptBytes=await readFile(join(root,promptPath));files.push({path:promptPath,sha256:sha(promptBytes),bytes:promptBytes.length});
 const portraitSource=`assets/starsea/npc/source/portraits/${character.id}.png`;let portrait;
 try{await access(join(root,portraitSource));const bytes=await readFile(join(root,portraitSource));portrait=`/art/starsea/npc/${character.id}/portrait.png`;await copyFile(join(root,portraitSource),join(pub,character.id,'portrait.png'));files.push({path:portraitSource,sha256:sha(bytes),width:256,height:256,alpha:true});files.push({path:`apps/web/public/art/starsea/npc/${character.id}/portrait.png`,sha256:sha(bytes),width:256,height:256,alpha:true});}catch{}
 manifest.assets.push({id:spec.id,name:spec.name,type:'npc',chapters:spec.chapter,uses:req.chapters.flatMap(c=>c.tasks.filter(t=>t.resources.includes(spec.id)||t.speaker===spec.id).map(t=>t.id)),source:{mode:'adaptation',path:source.replaceAll('\\','/'),sha256:sha(Buffer.from(nativeText)),nativeVersion:original.skeleton.spine,selectedSkins:[character.body,character.head,character.hair],adjustments:['Native clothes/head/hair combined, original weighted geometry and all original clips preserved.','Four separate new profession accessories added as native RegionAttachment slots on original bones.',...(character.tints?['Per-slot native color multiplication: '+JSON.stringify(character.tints)]:[])],accessoryKit:{mode:'new',path:kitPath,sha256:sha(kitBytes),prompt:promptPath,tool:'image_gen.imagegen',import:'quadrant crop, alpha-edge bounds, proportional resize and PMA atlas packing only'}},files,runtime:{kind:'native',profile:`/art/starsea/npc/${character.id}/profile.json`,displayHeight:spec.height,bodySetId:character.bodySetId,family:character.family,renderAppearance,storyAdapter:profile.storyAdapter,accessorySockets:profile.accessorySockets,...(portrait?{portrait}:{})},actions,states:Object.keys(actions),dependencies:['mini-hero-navy-spine-4.2.43','starsea-npc-shared-atlas-v1'],status:'producer-in-progress',notes:['Native Cast2 is a whole-body conversation gesture; native Life_Crafting carries inspection/repair. No invented mouth-animation or page-turning system.','Native clothing silhouettes remain unchanged; character-specific hat/cape/apron/scarf/horns/tools are independent parts.','Story integration is not included.']});
}
manifest.nativeSourceFiles=[];for(const name of ['Character.json','Character.atlas','Character.png','Character_2.png']){const bytes=await readFile(join(source,name));manifest.nativeSourceFiles.push({path:join(source,name).replaceAll('\\','/'),sha256:sha(bytes),bytes:bytes.length});}
manifest.sharedFiles=[];for(const name of ['Character.atlas','Character.png','Character_2.png','NpcParts.png']){const path=`apps/web/public/art/starsea/npc/shared/${name}`,bytes=await readFile(join(root,path)),meta=name.endsWith('.png')?await sharp(bytes).metadata():null;manifest.sharedFiles.push({path,sha256:sha(bytes),bytes:bytes.length,...(meta?{width:meta.width,height:meta.height,alpha:meta.hasAlpha,pma:true}:{})});}
manifest.productionFiles=[];for(const path of ['assets/starsea/npc/source/selection.json','assets/starsea/npc/source/accessories.json','assets/starsea/npc/source/accessory-regions.json','assets/starsea/npc/source/preview.js','assets/starsea/npc/scripts/build-npcs.mjs','assets/starsea/npc/scripts/build-preview.mjs','assets/starsea/npc/scripts/verify-npcs.mjs','assets/starsea/npc/scripts/export-portraits.mjs']){const bytes=await readFile(join(root,path));manifest.productionFiles.push({path,sha256:sha(bytes),bytes:bytes.length});}
await writeFile(join(group,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(join(pub,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({profiles:manifest.assets.length,nativeVersion:original.skeleton.spine,output:pub}));
