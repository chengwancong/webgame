import {it,expect} from 'vitest';
import {AuthoritativeMotion} from '../apps/web/src/authoritative-motion.ts';

// One cell per 3-tick snapshot, i.e. 0.1 cells per 10 ms of server time.
const stream=(motion:AuthoritativeMotion,arrivals:number[])=>arrivals.forEach((at,i)=>motion.accept(i*3,[['hero',{x:i,y:0}]],at));

it('keeps an even pace when snapshots arrive unevenly and never mutates authoritative positions',()=>{
 const motion=new AuthoritativeMotion(),arrivals=[0,100,165,330,400,470,600,700,800,900],end={x:9,y:0};
 const frames:number[]=[];let next=0;
 for(let now=0;now<=1000;now+=1000/60){
  while(next<arrivals.length&&arrivals[next]<=now){motion.accept(next*3,[['hero',next===9?end:{x:next,y:0}]],arrivals[next]);next++;}
  const x=motion.position('hero',{x:next-1,y:0},now).x;frames.push(x);
  expect(x).toBeLessThanOrEqual(next-1);
 }
 const steps=frames.slice(1).map((x,i)=>x-frames[i]);
 expect(Math.min(...steps)).toBeGreaterThanOrEqual(0);
 // Nominal pace is 1/6 cell per frame; the old blend jumped to ~0.3 after the 165 ms
 // early arrival and stood still after the 330 ms late one.
 const moving=steps.slice(12,50);expect(Math.max(...moving)).toBeLessThan(.25);expect(moving.filter(s=>s===0)).toHaveLength(0);
 expect(end).toEqual({x:9,y:0});
});
it('holds the newest snapshot without extrapolating and stops the animation clock shortly after',()=>{
 const motion=new AuthoritativeMotion();stream(motion,[0,100,200,300]);
 expect(motion.position('hero',{x:3,y:0},2000)).toEqual({x:3,y:0});
 const fraction=motion.fraction(2000);expect(fraction).toBeGreaterThan(0);expect(fraction).toBeLessThanOrEqual(6);
 expect(motion.fraction(1000)).toBe(fraction);
});
it('never runs the animation clock backwards across early and late arrivals',()=>{
 const motion=new AuthoritativeMotion(),arrivals=[0,100,165,330,400,470];let next=0,last=-Infinity;
 for(let now=0;now<=600;now+=1000/60){
  while(next<arrivals.length&&arrivals[next]<=now){motion.accept(next*3,[['hero',{x:next,y:0}]],arrivals[next]);next++;}
  const clock=(next-1)*3+motion.fraction(now);expect(clock).toBeGreaterThanOrEqual(last);expect(clock).toBeLessThanOrEqual((next-1)*3+6);last=clock;
 }
});
it('ignores duplicate ticks',()=>{
 const motion=new AuthoritativeMotion();stream(motion,[0,100,200]);const x=motion.position('hero',{x:2,y:0},250).x;
 motion.accept(6,[['hero',{x:50,y:0}]],255);expect(motion.position('hero',{x:2,y:0},260).x).toBeGreaterThanOrEqual(x);
 expect(motion.position('hero',{x:2,y:0},1000)).toEqual({x:2,y:0});
});
it('snaps teleports, starts new actors at their real positions, and restarts on new runs',()=>{
 const motion=new AuthoritativeMotion();motion.accept(90,[['hero',{x:0,y:0}]],0);
 motion.accept(93,[['hero',{x:30,y:30}],['new',{x:4,y:5}]],100);
 for(const now of [100,150,250]){expect(motion.position('hero',{x:30,y:30},now)).toEqual({x:30,y:30});expect(motion.position('new',{x:4,y:5},now)).toEqual({x:4,y:5});}
 motion.accept(0,[['hero',{x:2,y:3}]],300);expect(motion.position('hero',{x:2,y:3},300)).toEqual({x:2,y:3});expect(motion.fraction(300)).toBe(0);
 motion.reset();expect(motion.position('hero',{x:7,y:8},400)).toEqual({x:7,y:8});
});
