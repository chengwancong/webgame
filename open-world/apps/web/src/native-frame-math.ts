// 纯工具模块：无 Phaser/DOM 依赖，便于 Node 单测
export type Point={x:number;y:number};
/** 镜像挂点：flipped 时绕 footX 对称 */
export function mirrorSocket(p:Point,footX:number,flipped:boolean):Point{return flipped?{x:2*footX-p.x,y:p.y}:p;}
/** 每逻辑帧限制烘焙次数，帧号变化时自动重置 */
export class FrameBudget{private count=0;private loopFrame=-1;constructor(readonly perFrame:number){}take(loopFrame:number):boolean{if(loopFrame!==this.loopFrame){this.count=0;this.loopFrame=loopFrame;}if(this.count>=this.perFrame)return false;this.count++;return true;}}
type LruEntry<T>={value:T;bytes:number;touched:number};
/** 带字节计量的 LRU 键值缓存 */
export class FrameLru<T>{
 private map=new Map<string,LruEntry<T>>();private _bytes=0;
 get bytes(){return this._bytes;}get size(){return this.map.size;}
 get(key:string,now:number):T|undefined{const e=this.map.get(key);if(!e)return;e.touched=now;return e.value;}
 set(key:string,value:T,bytes:number,now:number){const old=this.map.get(key);if(old)this._bytes-=old.bytes;this._bytes+=bytes;this.map.set(key,{value,bytes,touched:now});}
 evict(maxBytes:number,now:number,minIdleMs:number,onEvict:(key:string,value:T)=>void){
  if(this._bytes<=maxBytes)return;
  const entries=[...this.map.entries()].sort((a,b)=>a[1].touched-b[1].touched);
  for(const [key,entry] of entries){if(this._bytes<=maxBytes)break;if(now-entry.touched<minIdleMs)continue;this.map.delete(key);this._bytes-=entry.bytes;onEvict(key,entry.value);}
 }
 deleteWhere(pred:(key:string,value:T)=>boolean,onEvict:(key:string,value:T)=>void){
  for(const [key,entry] of [...this.map]){if(pred(key,entry.value)){this.map.delete(key);this._bytes-=entry.bytes;onEvict(key,entry.value);}}
 }
 clear(onEvict:(key:string,value:T)=>void){for(const [key,entry] of this.map)onEvict(key,entry.value);this.map.clear();this._bytes=0;}
}
