// Toast 队列（docs/hud-arbitration-plan.md §2.2）：一个通道、最多 3 条、同 key 合并、切场景清空。
export type ToastKind='info'|'success'|'loot'|'warn'|'error';
export type ToastInput={kind?:ToastKind;key?:string;ttl?:number;sticky?:boolean;/** 同 key 时只换文案、刷新计时，不累计 ×N（施放失败等反复按键的提示）。 */replace?:boolean};
export type Toast={id:number;key:string;text:string;kind:ToastKind;count:number;expires:number;sticky:boolean;/** 上一次计入 ×N 的时刻；按住键重复触发的同一提示不再逐次累计。 */countedAt:number};
/** 同 key 两次提示间隔短于此值（按键重复、每帧重试）只刷新计时，不累计 ×N。 */
export const COUNT_GAP_MS=100;
export const COUNT_CAP=99;
export const toastLimit=3;
const defaultTtl=(kind:ToastKind)=>kind==='error'?6000:3500;

export class ToastQueue{
 private items:Toast[]=[];private seq=0;
 /** 加一条；同 key（缺省为文本）合并为 ×N 并刷新计时。超出上限时挤掉最旧的非 sticky 条目。 */
 push(text:string,now:number,input:ToastInput={}):Toast{
  const kind=input.kind??'info',key=input.key??text,ttl=input.ttl??defaultTtl(kind);
  const same=this.items.find(t=>t.key===key);
  if(same){const counts=!input.replace&&now-same.countedAt>=COUNT_GAP_MS;Object.assign(same,{text,kind,expires:now+ttl,count:counts?Math.min(COUNT_CAP,same.count+1):same.count,countedAt:counts?now:same.countedAt,sticky:same.sticky||Boolean(input.sticky)});return same;}
  const toast:Toast={id:++this.seq,key,text,kind,count:1,expires:now+ttl,sticky:Boolean(input.sticky),countedAt:now};this.items.push(toast);
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
