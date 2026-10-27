/** Budget decoded idle references, not active painters. Eviction never clears or destroys an image. */
export class PixelImageCache<T>{
 private entries=new Map<string,{promise:Promise<T>;bytes:number;ready:boolean}>();private used=0;
 constructor(readonly budget=96*1024*1024){}
 get(key:string){const entry=this.entries.get(key);if(!entry)return;this.entries.delete(key);this.entries.set(key,entry);return entry.promise;}
 set(key:string,promise:Promise<T>){this.delete(key);this.entries.set(key,{promise,bytes:0,ready:false});}
 delete(key:string){const entry=this.entries.get(key);if(entry){this.used-=entry.bytes;this.entries.delete(key);}}
 measure(key:string,promise:Promise<T>,bytes:number){const entry=this.entries.get(key);if(!entry||entry.promise!==promise)return;this.used-=entry.bytes;entry.bytes=Math.max(0,bytes);entry.ready=true;this.used+=entry.bytes;for(const[k,e]of this.entries){if(this.used<=this.budget)break;if(e.ready){this.entries.delete(k);this.used-=e.bytes;}}}
 get bytes(){return this.used;}
}
