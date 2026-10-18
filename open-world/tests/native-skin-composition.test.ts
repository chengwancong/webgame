import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {SkeletonJson,TextureAtlas,AtlasAttachmentLoader,FakeTexture,Skeleton} from '@esotericsoftware/spine-webgl';
import {composeNativeSkin} from '../apps/web/src/native-skin-composition.ts';
const atlas=new TextureAtlas(readFileSync(new URL('../assets/mini-hero/navy/runtime/Character.atlas',import.meta.url),'utf8'));
for(const page of atlas.pages)page.setTexture(new FakeTexture({width:page.width,height:page.height} as HTMLImageElement));
const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(readFileSync(new URL('../assets/mini-hero/navy/runtime/Character.json',import.meta.url),'utf8')));
describe('native clothing role composition',()=>{
 it('changes upper clothing without changing face, hair or independently chosen legs',()=>{
  const roles={face:'HEAD/headA2',hair:'HAIR/hairA_a2',top:'BODY/knight_rare1',legs:'BODY/rogue_common1'};
  const a=composeNativeSkin(data,roles),b=composeNativeSkin(data,{...roles,top:'BODY/wizard_rare1'});
  for(const name of ['head','hair','leg_L','leg_R']){const index=data.findSlot(name)!.index;expect(b.getAttachments().filter(x=>x.slotIndex===index)).toEqual(a.getAttachments().filter(x=>x.slotIndex===index));}
  expect(b.getAttachments().filter(x=>data.slots[x.slotIndex].name==='top')).not.toEqual(a.getAttachments().filter(x=>data.slots[x.slotIndex].name==='top'));
 });
 it('does not keep an earlier cloak or hair-back attachment when the next skin lacks them',()=>{
  const withCape=data.skins.find(s=>s.name.startsWith('BODY/')&&s.getAttachments().some(x=>data.slots[x.slotIndex].name==='cloak'))!;
  const noCape=data.skins.find(s=>s.name.startsWith('BODY/')&&!s.getAttachments().some(x=>data.slots[x.slotIndex].name==='cloak'))!;
  const skeleton=new Skeleton(data);skeleton.setSkin(composeNativeSkin(data,{top:withCape.name}));skeleton.setSlotsToSetupPose();expect(skeleton.findSlot('cloak')!.getAttachment()).toBeTruthy();
  skeleton.setSkin(composeNativeSkin(data,{top:noCape.name}));skeleton.setSlotsToSetupPose();expect(skeleton.findSlot('cloak')!.getAttachment()).toBeNull();
 });
 it('rejects missing source skins instead of silently substituting another outfit',()=>{expect(()=>composeNativeSkin(data,{top:'BODY/absent'})).toThrow('Native skin missing');});
});
