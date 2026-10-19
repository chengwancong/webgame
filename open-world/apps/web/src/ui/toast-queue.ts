// Toast 队列（docs/hud-arbitration-plan.md §2.2）：一个通道、最多 3 条、同 key 合并、切场景清空。
export type ToastKind='info'|'success'|'loot'|'warn'|'error';
export type ToastInput={kind?:ToastKind;key?:string;ttl?:number;sticky?:boolean};
export type Toast={id:number;key:string;text:string;kind:ToastKind;count:number;expires:number;sticky:boolean};
export const toastLimit=3;
const defaultTtl=(kind:ToastKind)=>kind==='error'?6000:3500;

export class ToastQueue{
 private items:Toast[]=[];private seq=0;
 /** 加一条；同 key（缺省为文本）合并为 ×N 并刷新计时。超出上限时挤掉最旧的非 sticky 条目。 */
 push(text:string,now:number,input:ToastInput={}):Toast{
  const kind=input.kind??'info',key=input.key??text,ttl=input.ttl??defaultTtl(kind);
  const same=this.items.find(t=>t.key===key);
  if(same){Object.assign(same,{text,kind,expires:now+ttl,count:same.count+1,sticky:same.sticky||Boolean(input.sticky)});return same;}
  const toast:Toast={id:++this.seq,key,text,kind,count:1,expires:now+ttl,sticky:Boolean(input.sticky)};this.items.push(toast);
  while(this.items.length>toastLimit){const drop=this.items.findIndex(t=>!t.sticky);this.items.splice(drop<0?0:drop,1);}
  return toast;
 }
 /** 当前可见条目（旧在上、新在下）；过期的非 sticky 条目在这里移除。 */
 visible(now:number):readonly Toast[]{this.items=this.items.filter(t=>t.sticky||t.expires>now);return this.items;}
 dismiss(key:string){this.items=this.items.filter(t=>t.key!==key);}
 /** 出航、回港、进出副本时调用：只留 sticky（连接类）提示。 */
 clearScene(){this.items=this.items.filter(t=>t.sticky);}
 /** 切角色/登出：全部清空。 */
 clearAll(){this.items=[];}
}
export const toastText=(t:Pick<Toast,'text'|'count'>)=>t.count>1?`${t.text}　×${t.count}`:t.text;
