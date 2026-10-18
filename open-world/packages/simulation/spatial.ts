import type {Vec} from '../contracts/index.ts';
export class SpatialGrid<T extends {position:Vec}> {
 private cells=new Map<string,T[]>();constructor(private size=2){}
 rebuild(items:T[]){this.cells.clear();for(const item of items){const k=this.key(item.position);const a=this.cells.get(k);if(a)a.push(item);else this.cells.set(k,[item]);}}
 update(item:T,previous:Vec){const old=this.key(previous),next=this.key(item.position);if(old===next)return;const bucket=this.cells.get(old),index=bucket?.indexOf(item)??-1;if(bucket&&index>=0){bucket.splice(index,1);if(!bucket.length)this.cells.delete(old);}const target=this.cells.get(next);if(target)target.push(item);else this.cells.set(next,[item]);}
 remove(item:T){const key=this.key(item.position),bucket=this.cells.get(key),index=bucket?.indexOf(item)??-1;if(bucket&&index>=0){bucket.splice(index,1);if(!bucket.length)this.cells.delete(key);}}
 private key(p:Vec){return Math.floor(p.x/this.size)+','+Math.floor(p.y/this.size);}
 near(p:Vec,radius:number){const result:T[]=[];for(let y=Math.floor((p.y-radius)/this.size);y<=Math.floor((p.y+radius)/this.size);y++)for(let x=Math.floor((p.x-radius)/this.size);x<=Math.floor((p.x+radius)/this.size);x++){
 const a=this.cells.get(x+','+y);if(a)for(const item of a)if(Math.abs(item.position.x-p.x)<=radius&&Math.abs(item.position.y-p.y)<=radius)result.push(item);
 }return result;}
}
