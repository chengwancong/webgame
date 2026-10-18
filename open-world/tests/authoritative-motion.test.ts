import {it,expect} from 'vitest';
import {AuthoritativeMotion} from '../apps/web/src/authoritative-motion.ts';

it('smooths server positions at render frequency without mutating authoritative positions',()=>{
 const motion=new AuthoritativeMotion(),start={x:10,y:20},end={x:10.6,y:20};
 motion.accept(0,[['hero',start]],0);motion.accept(3,[['hero',end]],100);
 const frames=Array.from({length:7},(_,i)=>motion.position('hero',end,100+i*100/6).x);
 expect(frames[0]).toBe(10);expect(frames[3]).toBeCloseTo(10.3);expect(frames[6]).toBeCloseTo(10.6);
 expect(new Set(frames).size).toBe(7);expect(end).toEqual({x:10.6,y:20});
 expect(motion.fraction(150)).toBeCloseTo(1.5);expect(motion.fraction(10000)).toBe(3);
});
it('continues from the visible pose when updates arrive early and ignores duplicate ticks',()=>{
 const motion=new AuthoritativeMotion();motion.accept(0,[['hero',{x:0,y:0}]],0);motion.accept(3,[['hero',{x:1,y:0}]],100);
 motion.accept(6,[['hero',{x:2,y:0}]],150);expect(motion.position('hero',{x:2,y:0},150).x).toBe(.5);
 motion.accept(6,[['hero',{x:2,y:0}]],175);expect(motion.position('hero',{x:2,y:0},200).x).toBeCloseTo(1.25);
});
it('snaps teleports, newly spawned actors, new runs and resumed local combat to actual positions',()=>{
 const motion=new AuthoritativeMotion();motion.accept(90,[['hero',{x:0,y:0}]],0);
 motion.accept(93,[['hero',{x:30,y:30}],['new',{x:4,y:5}]],100);
 expect(motion.position('hero',{x:30,y:30},100)).toEqual({x:30,y:30});
 expect(motion.position('new',{x:4,y:5},100)).toEqual({x:4,y:5});
 motion.accept(0,[['hero',{x:2,y:3}]],200);expect(motion.position('hero',{x:2,y:3},200)).toEqual({x:2,y:3});
 motion.reset();expect(motion.position('hero',{x:7,y:8},300)).toEqual({x:7,y:8});
});
