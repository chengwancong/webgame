import {it,expect} from 'vitest';
import hero from '../packages/asset-manifest/hero-sockets.json';
import native from '../packages/asset-manifest/native-actor-sockets.json';
import {actorCatalog} from '../packages/asset-manifest/actors.ts';
import {effectAttachment,heroAnimationFrame} from '../apps/web/src/effect-attachments.ts';
it('exports finite source sockets for every frame of each original actor animation',()=>{
 for(const [id,data] of Object.entries({hero,...native}))for(const [action,count] of Object.entries(actorCatalog[id].actions)){
  const frames=(data.actions as Record<string,Record<string,number[]>[]>)[action];expect(frames).toHaveLength(count);
  for(const frame of frames)for(const point of Object.values(frame))expect(point.length===2&&point.every(Number.isFinite)).toBe(true);
 }
});
it('weapon and muzzle follow the source animation instead of a fixed height',()=>{
 const pose={art:'hero',frame:'attack_0',position:{x:320,y:180},scale:actorCatalog.hero.scale,flip:false};
 const start=effectAttachment(pose,'weapon'),strike=effectAttachment({...pose,frame:'attack_9'},'weapon');
 expect(Math.hypot(strike.x-start.x,strike.y-start.y)).toBeGreaterThan(10);
 expect(effectAttachment(pose,'muzzle')).not.toEqual(effectAttachment(pose,'chest'));
 expect(effectAttachment({...pose,frame:'skill_13'},'feet')).toEqual(pose.position);
});
it('flips sockets about the ground anchor without moving feet or changing elevation',()=>{
 for(const art of ['hero','archer','raider']){const pose={art,frame:'attack_9',position:{x:320,y:180},scale:actorCatalog[art].scale,flip:false};
  const right=effectAttachment(pose,'muzzle'),left=effectAttachment({...pose,flip:true},'muzzle');expect(left.x+right.x).toBeCloseTo(640);expect(left.y).toBeCloseTo(right.y);expect(effectAttachment({...pose,flip:true},'feet')).toEqual(pose.position);
 }
});
it('places the source impact frame at release for short and long windups',()=>{
 for(const windup of [1,3,7,18]){expect(heroAnimationFrame('attack',windup,windup,8)).toBe(9);expect(heroAnimationFrame('skill',windup,windup,8)).toBe(13);expect(heroAnimationFrame('skill',windup-1,windup,8)).toBeLessThan(13);expect(heroAnimationFrame('skill',windup+8,windup,8)).toBe(28);}
});
