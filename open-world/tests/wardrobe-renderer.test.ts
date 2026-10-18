import {describe,it,expect} from 'vitest';
import {wardrobeFrameIndex,appearanceRenderKey,wardrobePartSocket,type WardrobeMotion} from '../apps/web/src/wardrobe-renderer.ts';
import {effectAttachment} from '../apps/web/src/effect-attachments.ts';
const motion={duration:1,count:31,fps:30,impactTime:.4,frames:Array.from({length:31},()=>({parts:[],drawOrder:[],sockets:{}}))} satisfies WardrobeMotion;
describe('modular character presentation clock',()=>{
 it('maps preparation and recovery to the actual simulation release, including a long cast',()=>{
  const base={action:'attack' as const,clock:0,facing:1};
  expect(wardrobeFrameIndex(motion,{...base,cast:{elapsed:.2,windup:.2,recovery:.3}})).toBe(12);
  expect(wardrobeFrameIndex(motion,{...base,cast:{elapsed:2,windup:2,recovery:.3}})).toBe(12);
  expect(wardrobeFrameIndex(motion,{...base,cast:{elapsed:.5,windup:.2,recovery:.3}})).toBe(30);
 });
 it('holds death final pose and loops locomotion on the same battle clock',()=>{
  expect(wardrobeFrameIndex(motion,{action:'death',clock:5,facing:1})).toBe(30);
  expect(wardrobeFrameIndex(motion,{action:'move',clock:2.3,facing:1})).toBe(9);
 });
 it('prefers transformed modular sockets over native atlas anchoring',()=>{
  const pose={art:'hero',frame:'wardrobe-projectile_12',position:{x:20,y:30},scale:1,flip:true,socket:()=>({x:9,y:21})};
  expect(effectAttachment(pose,'weapon')).toEqual({x:9,y:21});
  expect(effectAttachment(pose,'feet')).toEqual({x:9,y:21});
 });
 it('deduplicates cosmetic loads across persistent character revision updates',()=>{
  const parts=Object.fromEntries(['head','body','hands','legs','feet','back','weapon'].map(slot=>[slot,{setId:'100011'}]));
  const appearance={rig:'modular-hero' as const,family:'sword' as const,styleProfile:'v2-soft' as const,revision:1,parts:parts as any};
  expect(appearanceRenderKey(appearance)).toBe(appearanceRenderKey({...appearance,revision:2}));
  expect(appearanceRenderKey(appearance)).not.toBe(appearanceRenderKey({...appearance,family:'bow'}));
 });
 it('maps true source tip pixels through resized rotated and sheared attachment geometry',()=>{
  const part={name:'weapon',slot:'weapon',width:120,height:60,matrix:[0,2,-3,1,10,20],color:[1,1,1,1]};
  // Pixel (75,10) on a 100x40 original is local (+30,-15), then affine -> (55,65).
  expect(wardrobePartSocket(part,[75,10],{width:100,height:40})).toEqual({x:55,y:65});
  expect(wardrobePartSocket(part,[50,20],{width:100,height:40})).toEqual({x:10,y:20});
 });
 it('rejects malformed attachment metadata so the caller can retain an explicit grip fallback',()=>{
  const part={name:'weapon',slot:'weapon',width:96,height:96,matrix:[1,0,0,-1,12,30],color:[1,1,1,1]};
  expect(wardrobePartSocket(part,[Infinity,0],{width:96,height:96})).toBeUndefined();
  expect(wardrobePartSocket(part,[0,0],{width:0,height:96})).toBeUndefined();
 });
});
