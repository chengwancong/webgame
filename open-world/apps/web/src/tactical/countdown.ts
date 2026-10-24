import type {TacticalControlView,TacticalEncounterView,TacticalEvent} from './contract.ts';

/**
 * 等待倒计时的纯展示逻辑。截止时刻只来自服务端控制投影（`deadlineAtMs`，服务端时钟）。
 * 客户端只用「服务端当前时刻 − 本地时刻」的偏移换算剩余时间：本地不续期、不切托管、不因重连或预览重置。
 */
export type ClockSync={offsetMs:number};
/** 每次收到带 `serverNowMs` 的投影时更新偏移。 */
export const syncClock=(serverNowMs:number,clientNowMs:number):ClockSync=>({offsetMs:serverNowMs-clientNowMs});
export const serverNow=(sync:ClockSync,clientNowMs:number)=>clientNowMs+sync.offsetMs;

export type CountdownState=
 |{visible:false;remainingMs:number|null}
 |{visible:true;remainingMs:number;seconds:number;expired:boolean;label:string};

/** 只在「手动 + 主角等待行动」且进入最后提示窗口时显示；解析、敌方阶段、托管、结算、结束一律隐藏。 */
export function countdownState(view:Pick<TacticalEncounterView,'phase'>&{control:TacticalControlView},sync:ClockSync,clientNowMs:number):CountdownState{
 const c=view.control;
 if(view.phase!=='awaiting'||c.mode!=='manual'||c.phase!=='awaiting'||c.deadlineAtMs===null)return {visible:false,remainingMs:null};
 const remainingMs=Math.max(0,c.deadlineAtMs-serverNow(sync,clientNowMs));
 if(remainingMs>c.warningMs)return {visible:false,remainingMs};
 const seconds=Math.ceil(remainingMs/1000),expired=remainingMs<=0;
 return {visible:true,remainingMs,seconds,expired,label:expired?'等待服务端确认托管…':`将在${seconds}秒后托管`};
}

/** 事件按 id 只处理一次：重连补发、回执与推送重复到达时不重复播放反馈。 */
export class EventLedger{
 private seen=new Set<string>();private order:string[]=[];
 constructor(private readonly limit=2000){}
 /** 返回首次见到的事件，按 seq 升序。 */
 accept(events:readonly TacticalEvent[]):TacticalEvent[]{
  const fresh:TacticalEvent[]=[];
  for(const event of [...events].sort((a,b)=>a.seq-b.seq)){
   if(this.seen.has(event.id))continue;
   this.seen.add(event.id);this.order.push(event.id);fresh.push(event);
  }
  while(this.order.length>this.limit)this.seen.delete(this.order.shift()!);
  return fresh;
 }
 has(id:string){return this.seen.has(id);}
}
