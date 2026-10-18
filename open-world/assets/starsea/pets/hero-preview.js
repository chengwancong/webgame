import {AssetManager,AtlasAttachmentLoader,SkeletonJson,Skin,Skeleton,AnimationState,AnimationStateData,SceneRenderer,Physics} from '@esotericsoftware/spine-webgl';
export async function createHero(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const gl=canvas.getContext('webgl',{alpha:true,preserveDrawingBuffer:true,premultipliedAlpha:true});
 const renderer=new SceneRenderer(canvas,gl,true),manager=new AssetManager(renderer.context);
 const profile=await(await fetch('/art/mini-hero/navy/profile.json')).json();
 manager.loadText(profile.runtime.json);manager.loadTextureAtlas(profile.runtime.atlas);await manager.loadAll();
 const data=new SkeletonJson(new AtlasAttachmentLoader(manager.get(profile.runtime.atlas))).readSkeletonData(JSON.parse(manager.get(profile.runtime.json)));
 const skin=new Skin('PA1 existing player');for(const name of [...profile.skinNames,...profile.weapons['100011'].skinNames])skin.addSkin(data.findSkin(name));
 const skeleton=new Skeleton(data);skeleton.setSkin(skin);skeleton.setSlotsToSetupPose();
 const state=new AnimationState(new AnimationStateData(data));state.setAnimation(0,'Wait1',true);
 const span=profile.referenceHeight*256/100;
 return {canvas,profile,render(dt){state.update(dt);skeleton.update(dt);state.apply(skeleton);skeleton.updateWorldTransform(Physics.update);renderer.camera.position.x=profile.ground[0];renderer.camera.position.y=span*.3;renderer.camera.viewportWidth=renderer.camera.viewportHeight=span;gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);renderer.begin();renderer.drawSkeleton(skeleton,true);renderer.end();return canvas;}};
}
