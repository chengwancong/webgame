import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {AtlasAttachmentLoader,FakeTexture,SkeletonJson,Skin,Vector2} from '@esotericsoftware/spine-webgl';
import {MiniNativePlayback,miniSupportsAppearance,type MiniNativeProfile} from '../apps/web/src/mini-native-renderer.ts';
import {TextureAtlas} from '@esotericsoftware/spine-webgl';
import {storyNpcAppearance} from '../apps/web/src/story-appearance.ts';
import {storyNpcs} from '../packages/content/story-campaign.ts';
import registry from '../packages/asset-manifest/story-npcs.json';
const atlas=new TextureAtlas(readFileSync(new URL('../assets/mini-hero/navy/runtime/Character.atlas',import.meta.url),'utf8'));
for(const page of atlas.pages)page.setTexture(new FakeTexture({width:page.width,height:page.height} as HTMLImageElement));
const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(readFileSync(new URL('../assets/mini-hero/navy/runtime/Character.json',import.meta.url),'utf8')));
describe('accepted NPCs use complete native animation with fixed ground',()=>{
 for(const npc of storyNpcs)it(npc.id+' has distinct native skin and stable pause/rewind',()=>{
  const registration=registry.npcs[npc.id as keyof typeof registry.npcs],profile=JSON.parse(readFileSync(new URL('../apps/web/public'+registration.profile,import.meta.url),'utf8')) as MiniNativeProfile;
  expect(miniSupportsAppearance(storyNpcAppearance(npc.id),profile)).toBe(true);
  const combined=new Skin(npc.id);for(const name of registration.skins)combined.addSkin(data.findSkin(name)!);
  for(const name of profile.activeBones??[])combined.bones.push(data.findBone(name)!);
  const playback=new MiniNativePlayback(data,combined),motion=data.findAnimation(registration.actions.move)!;
  playback.seek(motion,.3,60);const steps=playback.physicsSteps,point=playback.skeleton.findBone('head')!,initial=[point.worldX,point.worldY];
  playback.seek(motion,.3,60);expect(playback.physicsSteps).toBe(steps);expect([point.worldX,point.worldY]).toEqual(initial);
  playback.seek(motion,.5,60);expect([point.worldX,point.worldY]).not.toEqual(initial);
  playback.seek(motion,.3,60);expect([point.worldX,point.worldY]).toEqual(initial);
  const offset=new Vector2(),size=new Vector2();playback.skeleton.getBounds(offset,size,[]);expect(size.x).toBeGreaterThan(20);expect(size.y).toBeGreaterThan(100);
  expect(profile.ground).toEqual([-.25,0]);
  if(registration.tool){const hand=playback.skeleton.findBone('RIGHTHAND')!;expect(hand.active).toBe(true);expect([hand.worldX,hand.worldY,hand.a,hand.b].every(Number.isFinite)).toBe(true);}
 });
});
