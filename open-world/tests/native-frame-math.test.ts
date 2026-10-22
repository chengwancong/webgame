import {it,expect,describe} from 'vitest';
import {mirrorSocket,FrameBudget,FrameLru} from '../apps/web/src/native-frame-math.ts';

describe('mirrorSocket',()=>{
 it('returns the point unchanged when not flipped',()=>{
  expect(mirrorSocket({x:100,y:50},256,false)).toEqual({x:100,y:50});
 });
 it('mirrors around footX when flipped',()=>{
  // footX=256, p.x=300 → 2*256-300=212
  expect(mirrorSocket({x:300,y:50},256,true)).toEqual({x:212,y:50});
 });
 it('preserves y in both cases',()=>{
  expect(mirrorSocket({x:0,y:99},256,false).y).toBe(99);
  expect(mirrorSocket({x:0,y:99},256,true).y).toBe(99);
 });
 it('identity when x equals footX',()=>{
  expect(mirrorSocket({x:256,y:10},256,true)).toEqual({x:256,y:10});
 });
});

describe('FrameBudget',()=>{
 it('allows up to perFrame takes on the same loopFrame',()=>{
  const b=new FrameBudget(3);
  expect(b.take(1)).toBe(true);
  expect(b.take(1)).toBe(true);
  expect(b.take(1)).toBe(true);
  expect(b.take(1)).toBe(false);
 });
 it('resets count when loopFrame changes',()=>{
  const b=new FrameBudget(2);
  expect(b.take(0)).toBe(true);
  expect(b.take(0)).toBe(true);
  expect(b.take(0)).toBe(false);
  // new frame number → reset
  expect(b.take(1)).toBe(true);
  expect(b.take(1)).toBe(true);
  expect(b.take(1)).toBe(false);
 });
 it('allows new takes after each frame boundary',()=>{
  const b=new FrameBudget(1);
  for(let f=0;f<5;f++){
   expect(b.take(f)).toBe(true);
   expect(b.take(f)).toBe(false);
  }
 });
});

describe('FrameLru',()=>{
 it('returns undefined for unknown keys',()=>{
  const lru=new FrameLru<number>();
  expect(lru.get('x',0)).toBeUndefined();
 });
 it('stores and retrieves values',()=>{
  const lru=new FrameLru<string>();
  lru.set('a','hello',10,100);
  expect(lru.get('a',101)).toBe('hello');
 });
 it('accumulates byte count',()=>{
  const lru=new FrameLru<number>();
  lru.set('a',1,100,0);lru.set('b',2,200,0);
  expect(lru.bytes).toBe(300);expect(lru.size).toBe(2);
 });
 it('updates bytes on overwrite',()=>{
  const lru=new FrameLru<number>();
  lru.set('a',1,100,0);lru.set('a',2,50,1);
  expect(lru.bytes).toBe(50);
 });
 it('evicts least-recently-touched entries first',()=>{
  const lru=new FrameLru<string>();
  lru.set('old','A',100,0);
  lru.set('mid','B',100,10);
  lru.set('new','C',100,20);
  const evicted:string[]=[];
  // total=300 > maxBytes=150 → evict 'old'(→200>150), then 'mid'(→100≤150), stop
  lru.evict(150,100,0,(k)=>{evicted.push(k);});
  expect(evicted).toEqual(['old','mid']);
  expect(lru.bytes).toBe(100);
  expect(lru.size).toBe(1);
 });
 it('does not evict recently-touched entries even when over cap',()=>{
  const lru=new FrameLru<string>();
  lru.set('a','A',100,0);lru.set('b','B',100,1000);
  const evicted:string[]=[];
  // now=1001, minIdleMs=500: 'b' touched at 1000, idle=1ms < 500ms → skip; 'a' idle=1001ms → evict
  lru.evict(100,1001,500,(k)=>{evicted.push(k);});
  expect(evicted).toEqual(['a']);
  expect(lru.bytes).toBe(100);
 });
 it('stays over cap if all entries are recent',()=>{
  const lru=new FrameLru<string>();
  lru.set('a','A',100,1000);lru.set('b','B',100,1000);
  const evicted:string[]=[];
  // minIdleMs=2000, now=1001 → both are too recent
  lru.evict(50,1001,2000,()=>{evicted.push('x');});
  expect(evicted.length).toBe(0);
  expect(lru.bytes).toBe(200);
 });
 it('touch updates eviction priority',()=>{
  const lru=new FrameLru<string>();
  lru.set('a','A',100,0);lru.set('b','B',100,10);
  // touch 'a' at t=20, making 'b' the older one
  lru.get('a',20);
  const evicted:string[]=[];
  lru.evict(100,100,0,(k)=>{evicted.push(k);});
  expect(evicted).toEqual(['b']);
 });
 it('deleteWhere removes matching entries and updates bytes',()=>{
  const lru=new FrameLru<string>();
  lru.set('key1|a','X',100,0);lru.set('key1|b','Y',50,0);lru.set('key2|a','Z',75,0);
  const evicted:string[]=[];
  lru.deleteWhere(k=>k.startsWith('key1|'),(k)=>{evicted.push(k);});
  expect(evicted.sort()).toEqual(['key1|a','key1|b']);
  expect(lru.bytes).toBe(75);expect(lru.size).toBe(1);
 });
 it('clear removes all entries and resets bytes',()=>{
  const lru=new FrameLru<number>();
  lru.set('a',1,100,0);lru.set('b',2,200,0);
  const evicted:string[]=[];
  lru.clear((k)=>{evicted.push(k);});
  expect(evicted.sort()).toEqual(['a','b']);
  expect(lru.bytes).toBe(0);expect(lru.size).toBe(0);
 });
});
