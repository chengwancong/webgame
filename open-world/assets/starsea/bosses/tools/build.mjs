import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {AtlasAttachmentLoader,FakeTexture,Skeleton,SkeletonJson,Skin,TextureAtlas,Vector2,Physics,MixBlend,MixDirection} from '@esotericsoftware/spine-webgl';
import {root} from './preview-server.mjs';

const base=join(root,'assets/starsea/bosses'),pub=join(root,'apps/web/public/art/starsea/bosses');
const cfg=JSON.parse(await readFile(join(base,'selection.json'),'utf8'));
const requirements=JSON.parse(await readFile(join(root,'docs/starsea/requirements.json'),'utf8'));
let previous;try{previous=JSON.parse(await readFile(join(base,'manifest.json'),'utf8'));}catch{}
const priorDiagnostics=new Map();for(const a of previous?.assets??[]){try{priorDiagnostics.set(a.id,JSON.parse(await readFile(join(root,a.preview.diagnostics),'utf8')));}catch{}}
const originalBytes=await readFile(join(root,cfg.nativeSource,'Character.json'));
const original=JSON.parse(originalBytes),originalAtlas=await readFile(join(root,cfg.nativeSource,'Character.atlas'),'utf8');
const sha=b=>createHash('sha256').update(b).digest('hex');
const rel=p=>relative(root,p).replaceAll('\\','/');
const write=async(p,b)=>{await mkdir(resolve(p,'..'),{recursive:true});await writeFile(p,b);};
const json=async(p,o)=>write(p,JSON.stringify(o,null,2)+'\n');
const getSkin=name=>{const s=original.skins.find(s=>s.name===name);if(!s)throw Error('Missing native skin '+name);return structuredClone(s);};
const allowedIds=new Set(requirements.bosses.map(b=>b.id));
const sourceImpacts={Attack_OneHand1:.35,Attack_OneHand2:.4,Attack_TwoHand1:25/60,Attack_TwoHand2:26/60,Spell1:20/60,Spell2:28/60,Cast1:40/60,Cast2:40/60};

// Import only: connected-alpha cropping preserves each generated part, avoiding
// accidental quadrant cuts when the generator places a part across a cell edge.
async function componentRects(file,expected){
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h,channels:c}=info,visited=new Uint8Array(w*h),queue=new Int32Array(w*h),parts=[];
 for(let n=0;n<w*h;n++){
  if(visited[n]||data[n*c+3]<3)continue;
  let start=0,end=1,count=0,minX=w,minY=h,maxX=0,maxY=0;queue[0]=n;visited[n]=1;
  while(start<end){const p=queue[start++],x=p%w,y=Math.floor(p/w);count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   for(const d of [-w-1,-w,-w+1,-1,1,w-1,w,w+1]){const q=p+d;if(q<0||q>=w*h||visited[q]||Math.abs(q%w-x)>1||data[q*c+3]<3)continue;visited[q]=1;queue[end++]=q;}
  }
  if(count>1000)parts.push({left:Math.max(0,minX-3),top:Math.max(0,minY-3),width:Math.min(w-1,maxX+3)-Math.max(0,minX-3)+1,height:Math.min(h-1,maxY+3)-Math.max(0,minY-3)+1,count});
 }
 parts.sort((a,b)=>a.top-b.top);
 if(parts.length!==expected)throw Error('Expected '+expected+' isolated generated parts in '+file+', got '+parts.length);
 const ordered=[];while(parts.length){const row=parts.splice(0,2).sort((a,b)=>a.left-b.left);ordered.push(...row);}
 return {width:w,height:h,parts:ordered};
}
async function importParts(boss){
 const file=join(base,boss.sourceImage),rects=await componentRects(file,boss.grid?6:4);
 const names=boss.grid?['head','core','panel-left','panel-right','hammer','exhaust']:['head','core','panel-left','panel-right'];
 const fragments=[],metadata=[];
 for(let i=0;i<names.length;i++){
  const name=names[i],size=name==='head'?256:name==='hammer'?220:name==='core'?128:name==='exhaust'?100:96;
  const imported=await sharp(file).extract(rects.parts[i]).resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).png().toBuffer();
  const inf=await sharp(imported).metadata(),path=join(base,'parts',boss.id,name+'.png');await write(path,imported);
  const x=(i%2)*264+4,y=Math.floor(i/2)*264+4;fragments.push({input:imported,left:x,top:y});
  metadata.push({name,sourceRect:rects.parts[i],path:rel(path),sha256:sha(imported),width:inf.width,height:inf.height,atlas:{x,y}});
 }
 const width=528,height=Math.ceil(names.length/2)*264;
 const packed=await sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(fragments).ensureAlpha().raw().toBuffer();
 // Match the original Spine PMA atlas. This is export preprocessing, not a
 // visual edit: imported source pixels and transparent contour remain intact.
 for(let i=0;i<packed.length;i+=4){const a=packed[i+3]/255;packed[i]=Math.round(packed[i]*a);packed[i+1]=Math.round(packed[i+1]*a);packed[i+2]=Math.round(packed[i+2]*a);}
 const output=await sharp(packed,{raw:{width,height,channels:4}}).png().toBuffer();
 let atlas=`\nparts.png\nsize:${width},${height}\nfilter:Linear,Linear\npma:true\n`;
 for(const m of metadata)atlas+=`starsea/${boss.id}/${m.name}\nbounds:${m.atlas.x},${m.atlas.y},${m.width},${m.height}\n`;
 await json(join(base,'parts',boss.id,'import.json'),{tool:'built-in image_gen; transparent parts',source:rel(file),sourceSha256:sha(await readFile(file)),preprocessing:['connected-alpha crop','proportional resize','3px transparent gutter','PMA atlas encoding'],...rects,parts:metadata});
 return {metadata,output,atlas};
}
function region(id,name,width,height,opts={}){return {name:`starsea/${id}/${name}`,width,height,...opts};}
function phaseMotion(raw,phase){
 const a=structuredClone(raw);a.bones??={};a.slots??={};
 const panels=['ss_panel_left','ss_panel_right'];
 for(const [i,name] of panels.entries()){
  const sign=i===0?-1:1;
  if(phase==='enter')a.bones[name]={rotate:[{value:sign*38},{time:.6,value:0}],scale:[{x:.55,y:.55},{time:.6,x:1,y:1}]};
  else if(phase==='end')a.bones[name]={rotate:[{value:0},{time:.6,value:sign*38}],scale:[{x:1,y:1},{time:.6,x:.55,y:.55}]};
  else if(phase==='active')a.bones[name]={rotate:[{value:0}],scale:[{x:1,y:1},{time:.5,x:1.025,y:1.025},{time:1,x:1,y:1}]};
  else a.bones[name]={rotate:[{value:sign*38}],scale:[{x:.55,y:.55}]};
 }
 if(phase==='enter')a.slots.ss_core={rgba:[{color:'b7b7b799'},{time:.6,color:'ffffffff'}]};
 else if(phase==='end')a.slots.ss_core={rgba:[{color:'ffffffff'},{time:.6,color:'8d8d8d80'}]};
 else if(phase==='active')a.slots.ss_core={rgba:[{color:'eeeeeeff'},{time:.5,color:'ffffffff'},{time:1,color:'eeeeeeff'}]};
 else a.slots.ss_core={rgba:[{color:'b7b7b7bb'}]};
 if(phase==='active')a.bones.ss_exhaust={rotate:[{value:0},{time:.5,value:5},{time:1,value:0}]};
 else if(phase==='enter')a.bones.ss_exhaust={rotate:[{value:0},{time:.6,value:5}]};
 else if(phase==='end')a.bones.ss_exhaust={rotate:[{value:5},{time:.6,value:0}]};
 return a;
}
function copyMotion(j,name,source,phase='default'){
 if(!original.animations[source])throw Error('Missing source animation '+source);
 j.animations[name]=phaseMotion(original.animations[source],phase);
 if(!j.bones.some(b=>b.name==='ss_exhaust'))delete j.animations[name].bones.ss_exhaust;
 if(source==='Die'){
  j.animations[name].slots??={};
  for(const slot of ['RIGHTHAND','ss_core','ss_panel_left','ss_panel_right','ss_badge','ss_exhaust']){
   if(!j.slots.some(s=>s.name===slot))continue;
   j.animations[name].slots[slot]={rgba:[{color:'ffffffff'},{time:.25,color:'ffffffff'},{time:.65,color:'ffffff00'}]};
  }
 }
}
function merged(data,names){const skin=new Skin('boss-combination');for(const name of names){const s=data.findSkin(name);if(!s)throw Error('Missing exported skin '+name);skin.addSkin(s);}return skin;}
function makeData(j,atlasText){const atlas=new TextureAtlas(atlasText);for(const page of atlas.pages)page.setTexture(new FakeTexture({width:page.width,height:page.height}));return new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(j);}
function sample(data,skinNames,motionNames){
 const skin=merged(data,skinNames),s=new Skeleton(data),o=new Vector2(),size=new Vector2();s.setSkin(skin);
 const bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity},actions={};
 for(const name of [...new Set(motionNames)]){
  const a=data.findAnimation(name);if(!a)throw Error('Missing export motion '+name);
  s.setToSetupPose();s.time=0;s.physicsConstraints.forEach(c=>c.reset());a.apply(s,-1,0,false,[],1,MixBlend.replace,MixDirection.mixIn);s.updateWorldTransform(Physics.reset);
  const frames=Math.ceil(a.duration*60)+1;let last=0,previous,changes=0,hashes=new Set(),fixedGround=0;
  const actionBounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};
  for(let frame=0;frame<frames;frame++){
   const t=Math.min(a.duration,frame/60);if(frame){s.update(t-last);a.apply(s,last,t,false,[],1,MixBlend.replace,MixDirection.mixIn);s.updateWorldTransform(Physics.update);}last=t;
   s.getBounds(o,size,[]);const b={minX:o.x,maxX:o.x+size.x,minY:o.y,maxY:o.y+size.y};
   for(const k of ['minX','minY']){bounds[k]=Math.min(bounds[k],b[k]);actionBounds[k]=Math.min(actionBounds[k],b[k]);}for(const k of ['maxX','maxY']){bounds[k]=Math.max(bounds[k],b[k]);actionBounds[k]=Math.max(actionBounds[k],b[k]);}
   const signature=s.bones.map(b=>[b.worldX,b.worldY,b.a,b.b,b.c,b.d].map(n=>n.toFixed(3)).join(',')).join('|');hashes.add(sha(signature));if(previous&&signature!==previous)changes++;previous=signature;
   const r=s.findBone('root');fixedGround=Math.max(fixedGround,Math.hypot(r.worldX+.25,r.worldY));
  }
  if(!Object.values(actionBounds).every(Number.isFinite)||changes<2)throw Error('Nonmoving/invalid exported motion '+name);
  actions[name]={duration:a.duration,fps:60,frames,distinctBoneFrames:hashes.size,changes,rootTranslationMax:fixedGround,bounds:actionBounds};
 }
 return {bounds,actions};
}
async function fileInfo(file){const bytes=await readFile(file);const entry={path:rel(file),sha256:sha(bytes),bytes:bytes.length};if(file.endsWith('.png')){const m=await sharp(bytes).metadata();Object.assign(entry,{width:m.width,height:m.height,alpha:m.hasAlpha});}return entry;}

const manifest={schemaVersion:1,group:'bosses',version:cfg.version,designVersion:cfg.designVersion,producer:'boss_art',nativeRuntimeVersion:'4.2.120',assets:[],limitations:['资源与动态表现包；六章剧情/敌人规则尚未接入。','原生动作完整复用并逐技能映射，非逐技能全新动作。','真实游戏登录、服务版本与存档保留由公共集成验收执行。']};
for(const boss of cfg.bosses){
 if(!allowedIds.has(boss.id))throw Error('Undeclared boss '+boss.id);
 if(process.argv.includes('--samples')&&!['ss-boss-port-vanguard','ss-boss-vilo'].includes(boss.id))continue;
 const output=join(base,'runtime',boss.id),published=join(pub,boss.id);await mkdir(output,{recursive:true});await mkdir(published,{recursive:true});
 const parts=await importParts(boss),part=Object.fromEntries(parts.metadata.map(m=>[m.name,m]));
 const j=structuredClone(original),body=getSkin(boss.body),head=getSkin('HEAD/headA2');
 body.name='BODY/'+boss.id;for(const [slot,attachments] of Object.entries(body.attachments))for(const a of Object.values(attachments))a.color=['cloak','lining','neck'].includes(slot)?boss.clothTint:boss.bodyTint;
 head.name='HEAD/'+boss.id;head.attachments.head.head={...region(boss.id,'head',90,90*part.head.height/part.head.width),x:27.67,y:-6.3,rotation:-90};
 j.skins.push(body,head);
 const m=boss.module;j.bones.push({name:'ss_module',parent:m.bone,x:m.x,y:m.y,rotation:m.rotation},{name:'ss_panel_left',parent:'ss_module',x:-m.offset},{name:'ss_panel_right',parent:'ss_module',x:m.offset});
 const slots=[{name:'ss_core',bone:'ss_module',attachment:'core'},{name:'ss_panel_left',bone:'ss_panel_left',attachment:'panel-left'},{name:'ss_panel_right',bone:'ss_panel_right',attachment:'panel-right'}];
 if(m.behind)j.slots.unshift(...slots);else j.slots.push(...slots);
 const attachment={ss_core:{core:region(boss.id,'core',m.size,m.size*part.core.height/part.core.width)},ss_panel_left:{'panel-left':region(boss.id,'panel-left',m.panelWidth,m.panelWidth*part['panel-left'].height/part['panel-left'].width)},ss_panel_right:{'panel-right':region(boss.id,'panel-right',m.panelWidth,m.panelWidth*part['panel-right'].height/part['panel-right'].width)}};
 if(boss.badge){const b=boss.badge;j.bones.push({name:'ss_badge',parent:b.bone,x:b.x,y:b.y,rotation:b.rotation});j.slots.push({name:'ss_badge',bone:'ss_badge',attachment:'badge'});attachment.ss_badge={badge:region(boss.id,'core',b.size,b.size*part.core.height/part.core.width)};}
 if(part.exhaust){j.bones.push({name:'ss_exhaust',parent:'ss_module',x:25,y:-2});j.slots.push({name:'ss_exhaust',bone:'ss_exhaust',attachment:'exhaust'});attachment.ss_exhaust={exhaust:region(boss.id,'exhaust',21,21*part.exhaust.height/part.exhaust.width)};}
 j.skins.push({name:'SS/'+boss.id,attachments:attachment});
 let weaponSkin,weaponAttachment,calibration,family=boss.family==='hammer'?'axe':boss.family;
 if(boss.weapon==='custom-hammer'){
  const w=part.hammer.width,h=part.hammer.height,height=154,width=154*w/h;
  weaponAttachment=region(boss.id,'hammer',width,height,{x:0,y:42});
  weaponSkin={name:'RIGHTHAND/'+boss.id,attachments:{RIGHTHAND:{RIGHTHAND:weaponAttachment}}};
  calibration={slot:'RIGHTHAND',pixel:[w*.5,h*.14],imageSize:[w,h]};
 }else{
  weaponSkin=getSkin(boss.weapon);weaponSkin.name='RIGHTHAND/'+boss.id;weaponAttachment=weaponSkin.attachments.RIGHTHAND.RIGHTHAND;
  for(const p of ['x','y','width','height'])if(weaponAttachment[p]!==undefined)weaponAttachment[p]*=boss.weaponScale;
  const atlas=new TextureAtlas(originalAtlas),region=atlas.findRegion(weaponAttachment.path??weaponAttachment.name);
  if(!region)throw Error('Missing source weapon region '+weaponAttachment.name);
  calibration={slot:'RIGHTHAND',pixel:boss.weaponSocketFraction?[region.originalWidth*boss.weaponSocketFraction[0],region.originalHeight*boss.weaponSocketFraction[1]]:[region.originalWidth*.5,Math.min(region.originalHeight*.08,12)],imageSize:[region.originalWidth,region.originalHeight]};
 }
 j.skins.push(weaponSkin);
 const baseActions={},skillActions={},motionSource={};
 for(const [key,name] of Object.entries(boss.actions)){const motion='SS_'+key;copyMotion(j,motion,name);baseActions[key]={name:motion,loop:key==='idle'||key==='move',sourceAnimation:name,...(key==='attack'?{impactTime:sourceImpacts[name]}:{})};motionSource[motion]=name;}
 for(let i=0;i<boss.skills.length;i++){
  const s=boss.skills[i],motion='SS_skill'+(i+1);copyMotion(j,motion,s.motion);motionSource[motion]=s.motion;
  skillActions[s.id]={name:motion,sourceAnimation:s.motion,impactTime:s.impactTime,loop:s.loop??false,mount:s.mount,mechanism:requirements.vfx.find(v=>v.id===s.id),limitations:s.limit??'合法共用原生动作；战斗时序由实际前摇/恢复映射。'};
 }
 baseActions.skill={...skillActions[boss.skills[0].id]};baseActions.projectile={...skillActions[boss.skills[0].id]};
 const allNames=[...Object.values(baseActions).map(a=>a.name),...Object.values(skillActions).map(a=>a.name)];
 for(const name of allNames){const active=name+'_active';copyMotion(j,active,motionSource[name],'active');motionSource[active]=motionSource[name];}
 copyMotion(j,'SS_phaseEnter',boss.actions.idle,'enter');copyMotion(j,'SS_phaseEnd',boss.actions.idle,'end');motionSource.SS_phaseEnter=boss.actions.idle;motionSource.SS_phaseEnd=boss.actions.idle;
 const atlasText=originalAtlas.replace(/^Character\.png$/m,'../../../mini-hero/navy/Character.png').replace(/^Character_2\.png$/m,'../../../mini-hero/navy/Character_2.png')+parts.atlas;
 const data=makeData(j,atlasText),skinNames=[body.name,head.name,'SS/'+boss.id];
 const defaultSample=sample(data,[...skinNames,weaponSkin.name],[...allNames,'SS_phaseEnter','SS_phaseEnd']),activeSample=sample(data,[...skinNames,weaponSkin.name],allNames.map(n=>n+'_active'));
 const bounds={minX:Math.min(defaultSample.bounds.minX,activeSample.bounds.minX),maxX:Math.max(defaultSample.bounds.maxX,activeSample.bounds.maxX),minY:Math.min(defaultSample.bounds.minY,activeSample.bounds.minY),maxY:Math.max(defaultSample.bounds.maxY,activeSample.bounds.maxY)};
 const s=new Skeleton(data);s.setSkin(merged(data,skinNames));s.setToSetupPose();data.findAnimation('SS_idle').apply(s,-1,0,false,[],1,MixBlend.replace,MixDirection.mixIn);s.updateWorldTransform(Physics.reset);const o=new Vector2(),size=new Vector2();s.getBounds(o,size,[]);const referenceHeight=o.y+size.y;
 if(!(referenceHeight>100)||!Object.values(bounds).every(Number.isFinite))throw Error('Invalid boss body bounds '+boss.id);
 const url='/art/starsea/bosses/'+boss.id;
 const appearance={rig:'modular-hero',family,styleProfile:'v2-soft',revision:1,parts:Object.fromEntries(['head','body','hands','legs','feet','back','weapon'].map(n=>[n,{setId:boss.id}]))};
 const actionSelection={priority:['death','living-phase-transition','selected-living-action'],deathAction:'SS_death',deathCancelsPhaseTransition:true,phaseActive:'modifier for living actions only',deathCleanupTime:.65};
 const profile={schemaVersion:1,id:boss.id,runtime:{json:url+'/Character.json',atlas:url+'/Character.atlas',pma:true},skinNames,acceptedBodySets:[boss.id],nativeFacing:'left',referenceHeight,ground:[-.25,0],fps:60,previewBounds:bounds,weapons:{[boss.id]:{family,skinNames:[weaponSkin.name],actions:baseActions,sockets:{weapon:calibration,muzzle:calibration},muzzlePolicy:'weapon-tip'}},renderAppearance:appearance,sourceNativeVersion:data.version,actionSelection};
 const profiles={'profile.json':profile};
 for(let i=0;i<boss.skills.length;i++){const p=structuredClone(profile),a=skillActions[boss.skills[i].id];p.weapons[boss.id].actions.skill={...a};p.weapons[boss.id].actions.projectile={...a};profiles['profile-skill'+(i+1)+'.json']=p;skillActions[boss.skills[i].id].profile=url+'/profile-skill'+(i+1)+'.json';}
 const active=structuredClone(profile);active.id+='-phase-active';for(const [key,action] of Object.entries(active.weapons[boss.id].actions))if(key!=='death')action.name+='_active';profiles['profile-phase-active.json']=active;
 for(let i=0;i<boss.skills.length;i++){const p=structuredClone(active),a=skillActions[boss.skills[i].id];p.weapons[boss.id].actions.skill={...a,name:a.name+'_active'};p.weapons[boss.id].actions.projectile={...a,name:a.name+'_active'};profiles['profile-phase-active-skill'+(i+1)+'.json']=p;skillActions[boss.skills[i].id].profiles={default:url+'/profile-skill'+(i+1)+'.json','phase-active':url+'/profile-phase-active-skill'+(i+1)+'.json'};}
 for(const [phase,motion] of [['enter','SS_phaseEnter'],['end','SS_phaseEnd']]){const p=structuredClone(profile);p.id+='-phase-'+phase;for(const a of ['idle','skill'])p.weapons[boss.id].actions[a]={name:motion,loop:false};profiles['profile-phase-'+phase+'.json']=p;}
 const states={default:{profile:url+'/profile.json',description:'核心低亮、铰链闭合'},'phase-enter':{profile:url+'/profile-phase-enter.json',name:'SS_phaseEnter',transitionWindow:.6,description:'独立组件骨骼旋转/缩放与核心颜色过渡'},'phase-active':{profile:url+'/profile-phase-active.json',description:'部件展开，核心与组件独立原生连续脉动'},'phase-end':{profile:url+'/profile-phase-end.json',name:'SS_phaseEnd',transitionWindow:.6,description:'航网断开/部件折回与失能'},death:{name:'SS_death',cleanupTime:.65,description:'身体完整原生倒地；武器和全部阶段部件在0.65s清理'}};
 await write(join(output,'Character.json'),JSON.stringify(j));await write(join(output,'Character.atlas'),atlasText);await write(join(output,'parts.png'),parts.output);
 for(const [file,p] of Object.entries(profiles))await json(join(output,file),p);
 const provenance={id:boss.id,native:{path:cfg.nativeSource,version:original.skeleton.spine,sha256:sha(originalBytes),skins:[boss.body,boss.weapon],animations:motionSource},imagegen:{source:rel(join(base,boss.sourceImage)),sha256:sha(await readFile(join(base,boss.sourceImage))),cacheOrigin:boss.generatedPath,prompts:'assets/starsea/bosses/source/generation-prompts.md',tool:'built-in image_gen',transparent:true,parts:parts.metadata},adjustments:['选取已验证native骨架和分件；完整原始动作逐帧保留','原生附件材质tint适配暮界/章节配色','ImageGen头部与阶段装置绑定原生head/胸部/肩部骨骼','阶段骨骼动画独立编制；不替代原生身体动作','共享基础图集通过相对URL引用正式mini-hero目录',boss.adaptation??'人形首领衣装适配'],weaponScale:boss.weaponScale,weaponCategory:boss.family,renderFamily:family,calibration,stage:boss.stage};
 await json(join(output,'provenance.json'),provenance);await json(join(output,'diagnostics.json'),{referenceHeight,ground:[-.25,0],unionBounds:bounds,default:defaultSample,active:activeSample,sourceNativeVersion:data.version,status:'offline-native-validated; browser-dynamic-review-pending'});
 for(const f of ['Character.json','Character.atlas','parts.png','provenance.json','diagnostics.json',...Object.keys(profiles)])await copyFile(join(output,f),join(published,f));
 const files=[];for(const f of ['Character.json','Character.atlas','parts.png','provenance.json','diagnostics.json',...Object.keys(profiles)])files.push(await fileInfo(join(output,f)));
 files.push(await fileInfo(join(base,boss.sourceImage)));files.push(await fileInfo(join(base,'selection.json')));files.push(await fileInfo(join(base,'source/generation-prompts.md')));for(const p of parts.metadata)files.push(await fileInfo(join(root,p.path)));
 const deps=[];for(const file of ['Character.json','Character.atlas','Character.png','Character_2.png'])deps.push({id:'mini-hero-navy-'+file,path:cfg.nativeSource+'/'+file,runtime:'/art/mini-hero/navy/'+file,sha256:sha(await readFile(join(root,cfg.nativeSource,file))),nativeVersion:'4.2.43',purpose:'shared native bones/texture source'});
 const phaseComponents={core:{bone:'ss_module',slot:'ss_core',sourceBone:boss.module.bone,layer:boss.module.behind?'behind-body':'in-front-of-body'},panels:[{bone:'ss_panel_left',slot:'ss_panel_left'},{bone:'ss_panel_right',slot:'ss_panel_right'}],...(part.exhaust?{exhaust:{bone:'ss_exhaust',slot:'ss_exhaust',vfxMount:'ss_exhaust',vfxDependency:{resourceId:'ss-fx-b03-flame',clip:'phase_exhaust',owner:'monster_vfx',mount:'ss_exhaust',during:'phase-active',cleanup:['phase-end','death']}}}:{})};
 const asset={id:boss.id,name:boss.name,type:'boss',chapters:[boss.chapter],source:{mode:'adaptation',path:cfg.nativeSource+'/Character.json',sha256:sha(originalBytes),nativeVersion:'4.2.43',adjustments:provenance.adjustments},files,runtime:{kind:'native',profile:url+'/profile.json',displayHeight:150,bodySetId:boss.id,family,weaponCategory:boss.family,renderAppearance:appearance,actionSelection,atlasPages:['/art/mini-hero/navy/Character.png','/art/mini-hero/navy/Character_2.png',url+'/parts.png']},actions:{...baseActions,skills:skillActions},states,phaseComponents,dependencies:deps,status:'producer-dynamic-review-pending',notes:[boss.stage,boss.adaptation??'原生人形完整动作适配',boss.narrativeShared?'同一个ss-boss-vilo主体同时用于剧情对话与战斗':'无独立剧情替身','战斗机制引用已存在但新首领绑定尚未实施'],preview:{url:'/art/starsea/bosses/preview.html?boss='+boss.id,command:'node assets/starsea/bosses/tools/preview-server.mjs 8634',diagnostics:rel(join(output,'diagnostics.json'))},narrativeShared:boss.narrativeShared??false};
 // A deterministic rebuild of already reviewed bytes may preserve producer
 // evidence. Any changed source/profile/rig/texture invalidates that evidence.
 const prior=previous?.assets?.find(a=>a.id===boss.id),visualFiles=asset.files.filter(f=>!f.path.endsWith('/diagnostics.json'));
 if(prior?.status==='producer-reviewed'&&prior.producerReview?.deathPhaseCombinations===4&&prior.producerReview?.actualProductionProfiles===10&&visualFiles.length===prior.files.filter(f=>!f.path.endsWith('/diagnostics.json')).length&&visualFiles.every(f=>prior.files.some(p=>p.path===f.path&&p.sha256===f.sha256))){
  const before=priorDiagnostics.get(boss.id);if(before?.status==='producer-reviewed'){
   await json(join(output,'diagnostics.json'),before);await copyFile(join(output,'diagnostics.json'),join(published,'diagnostics.json'));
   const d=asset.files.find(f=>f.path.endsWith('/diagnostics.json'));Object.assign(d,await fileInfo(join(output,'diagnostics.json')));
   asset.status='producer-reviewed';asset.producerReview=prior.producerReview;Object.assign(asset.preview,{dynamicEvidence:prior.preview.dynamicEvidence,review:prior.preview.review,productionNative:prior.preview.productionNative});
  }
 }
 manifest.assets.push(asset);console.log(boss.id+': native '+data.version+', reference '+referenceHeight.toFixed(2)+', '+Object.keys(defaultSample.actions).length+' + '+Object.keys(activeSample.actions).length+' moving timelines');
}
await mkdir(join(pub,'vendor'),{recursive:true});await copyFile(join(root,'node_modules/@esotericsoftware/spine-webgl/dist/iife/spine-webgl.js'),join(pub,'vendor/spine-webgl.js'));await copyFile(join(root,'node_modules/@esotericsoftware/spine-webgl/LICENSE'),join(pub,'vendor/LICENSE.txt'));
await json(join(base,'manifest.json'),manifest);await json(join(pub,'manifest.json'),manifest);console.log('Local boss package: '+manifest.assets.length+' IDs. No shared registry/service files changed.');
