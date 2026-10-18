import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {AtlasAttachmentLoader,FakeTexture,Skeleton,SkeletonJson,Skin,TextureAtlas,Vector2,Physics,MixBlend,MixDirection} from '@esotericsoftware/spine-webgl';
const root=resolve(import.meta.dirname,'..'),read=p=>readFile(join(root,p),'utf8'),selection=JSON.parse(await read('assets/story-npcs/selection.json'));
const atlas=new TextureAtlas(await read(selection.source+'/Character.atlas'));
for(const page of atlas.pages)page.setTexture(new FakeTexture({width:page.width,height:page.height}));
const skeletonBytes=await read(selection.source+'/Character.json'),data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(skeletonBytes));
const ui=JSON.parse(await read('packages/asset-manifest/ui.v2.json'));
const manifest={version:selection.version,direction:selection.direction,source:selection.source,nativeVersion:data.version,sourceSha256:createHash('sha256').update(skeletonBytes).digest('hex'),npcs:{}};
for(const npc of selection.npcs){
 const skin=new Skin(npc.id),names=[...npc.skins,...(npc.weapon?[npc.weapon]:[])];
 for(const name of names){const item=data.findSkin(name);if(!item)throw Error('Missing native NPC skin '+name);skin.addSkin(item);}
 if(npc.tool&&!ui.assets[npc.tool])throw Error('Missing approved tool '+npc.tool);
 const actions={idle:{name:npc.idle,loop:true},move:{name:npc.move,loop:true},attack:{name:'Attack_OneHand1'},skill:{name:'Cast1'},projectile:{name:'Shoot1'},hurt:{name:'Damage1'},death:{name:'Die'}};
 const skeleton=new Skeleton(data);skeleton.setSkin(skin);skeleton.setToSetupPose();
 const offset=new Vector2(),size=new Vector2();let referenceHeight;const bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};
 for(const [id,motion] of Object.entries(actions)){const animation=data.findAnimation(motion.name);if(!animation)throw Error('Missing native NPC animation '+motion.name);
  for(let frame=0;frame<=Math.ceil(animation.duration*60);frame++){
   const time=Math.min(animation.duration,frame/60);skeleton.setToSetupPose();animation.apply(skeleton,-1,time,false,[],1,MixBlend.replace,MixDirection.mixIn);skeleton.updateWorldTransform(Physics.reset);skeleton.getBounds(offset,size,[]);
   if(id==='idle'&&frame===0)referenceHeight=offset.y+size.y;
   bounds.minX=Math.min(bounds.minX,offset.x);bounds.maxX=Math.max(bounds.maxX,offset.x+size.x);bounds.minY=Math.min(bounds.minY,offset.y);bounds.maxY=Math.max(bounds.maxY,offset.y+size.y);
  }
 }
 if(!(referenceHeight>100)||!Object.values(bounds).every(Number.isFinite))throw Error('Invalid NPC bounds '+npc.id);
 const profile={runtime:{json:'/art/mini-hero/navy/Character.json',atlas:'/art/mini-hero/navy/Character.atlas',pma:true},skinNames:npc.skins,acceptedBodySets:[npc.setId,...(npc.id==='scholar'?['100011']:[])],nativeFacing:'left',referenceHeight,ground:[-.25,0],fps:60,previewBounds:bounds,activeBones:npc.tool?['RIGHTHAND']:[],weapons:{[npc.setId]:{family:npc.family,skinNames:npc.weapon?[npc.weapon]:[],actions,sockets:{}}}};
 const url='/art/story-npcs/'+npc.id+'/profile.json',out=join(root,'apps/web/public',url);await mkdir(join(out,'..'),{recursive:true});await writeFile(out,JSON.stringify(profile,null,2)+'\n');
 manifest.npcs[npc.id]={profile:url,skins:names,tool:npc.tool??null,toolPath:npc.tool?ui.assets[npc.tool].path:null,actions:{idle:npc.idle,move:npc.move},referenceHeight,status:'native-skins-and-actions',adjustments:npc.tool?['approved handdrawn tool follows original hand bone']:[]};
}
await writeFile(join(root,'packages/asset-manifest/story-npcs.json'),JSON.stringify(manifest,null,2)+'\n');console.log('Published '+selection.npcs.length+' native NPC profiles with measured fixed ground, validated skins/actions and shared original atlas.');
