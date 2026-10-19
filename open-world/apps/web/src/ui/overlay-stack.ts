// 弹窗栈（docs/hud-arbitration-plan.md §2.1）：所有全屏层只“申请”，由这里决定谁在上、谁收输入、要不要暂停世界。
export type OverlayLayer='connection'|'result'|'confirm'|'panel'|'card';
export type OverlayEntry={id:string;layer:OverlayLayer;pause?:boolean};
const rank:Record<OverlayLayer,number>={connection:40,result:30,confirm:25,panel:20,card:10};

export class OverlayStack{
 private open:OverlayEntry[]=[];private deferred:OverlayEntry[]=[];private seq=0;private order=new Map<string,number>();private combat=false;
 /** 申请打开；卡片在战斗中只排队。返回是否已显示。同 id 重复申请只刷新。 */
 request(entry:OverlayEntry):boolean{
  this.close(entry.id);
  if(entry.layer==='card'&&this.combat){this.deferred.push(entry);return false;}
  this.order.set(entry.id,++this.seq);this.open.push(entry);return true;
 }
 close(id:string){this.open=this.open.filter(e=>e.id!==id);this.deferred=this.deferred.filter(e=>e.id!==id);this.order.delete(id);}
 /** 切场景/切角色：只保留恢复连接层。 */
 clearScene(){this.open=this.open.filter(e=>e.layer==='connection');this.deferred=[];}
 /** 战斗开始/结束；脱战时把排队的卡片按申请顺序放出来，返回放出的条目。 */
 setCombat(active:boolean):OverlayEntry[]{
  this.combat=active;if(active)return [];
  const released=this.deferred;this.deferred=[];for(const e of released){this.order.set(e.id,++this.seq);this.open.push(e);}return released;
 }
 /** 栈顶：层级高者在上，同层后申请者在上。 */
 top():OverlayEntry|undefined{return [...this.open].sort((a,b)=>rank[b.layer]-rank[a.layer]||this.order.get(b.id)!-this.order.get(a.id)!)[0];}
 isOpen(id:string){return this.open.some(e=>e.id===id);}
 has(layer:OverlayLayer){return this.open.some(e=>e.layer===layer);}
 /** 只有栈顶收输入；恢复连接层的操作永远可用（结算层盖在上面时也能点）。 */
 accepts(id:string){const e=this.open.find(x=>x.id===id);return Boolean(e&&(e.layer==='connection'||this.top()?.id===id));}
 /** 世界暂停只看显式 pause 的条目；卡片和结算永不暂停。 */
 pausesWorld(){return this.open.some(e=>e.pause&&e.layer!=='card'&&e.layer!=='result');}
 pending(){return this.deferred.length;}
}
