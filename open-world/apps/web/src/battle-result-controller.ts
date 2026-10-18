import type {CombatReview} from '../../../packages/simulation/combat-review.ts';
import type {StageKeyProgress} from '../../../packages/contracts/stage-keys.ts';
import type {BattleResult} from '../../../packages/contracts/index.ts';
import {combatReviewSchema} from '../../../packages/contracts/index.ts';
import {api} from './network.ts';
import {battleResultHtml} from './battle-result-panel.ts';
import {starseaBossMaps} from '../../../packages/content/starsea/index.ts';

type Context={review?:CombatReview;character:string;permit:string;region:string;outcome:'success'|'failure'};
export type ResultPhase='saving'|'ready'|'offline'|'returning'|'return-error';
export class BattleResultController{
 context?:Context; data?:BattleResult;keyProgress?:StageKeyProgress|null; phase:ResultPhase='saving'; error=''; private visual=''; private pending=false;
 constructor(private deps:{revision?:()=>number;review?:()=>CombatReview|undefined;character:()=>string;settle:()=>Promise<unknown>;blocked:()=>boolean;recover:()=>Promise<void>;returnSafe:()=>Promise<boolean>;refresh:()=>void}){}
 restore(){try{const saved=JSON.parse(localStorage.getItem('aw-battle-result')??'null');if(saved?.character===this.deps.character()&&typeof saved.permit==='string'&&typeof saved.region==='string'&&['success','failure'].includes(saved.outcome)){if(saved.review&&!combatReviewSchema.safeParse(saved.review).success)delete saved.review;if(saved.review)saved.review.advice=[];this.context=saved;return true;}}catch{}return false;}
 async start(permit:string,region:string,outcome:Context['outcome']){
  this.context={character:this.deps.character(),permit,region,outcome,...(outcome==='failure'?{review:this.deps.review?.()}: {})};this.keyProgress=undefined;this.data=undefined;this.visual='';
  if(this.context.review)this.context.review.advice=[];localStorage.setItem('aw-battle-result',JSON.stringify(this.context));await this.load(false);
 }
 async load(reconnect:boolean){
  if(this.pending||!this.context)return;this.pending=true;this.phase='saving';this.error='';this.deps.refresh();
  try{if(reconnect)await this.deps.recover();await this.deps.settle();if(this.deps.blocked())throw Error('连接中断，请重新连接。');
   this.data=await api<BattleResult>('combat/results/'+this.context.permit);
   if(starseaBossMaps.includes(this.context.region))try{this.data.phase_progress=(await api<{phase_progress?:BattleResult['phase_progress']}>('combat/results/'+this.context.permit+'/progress')).phase_progress;if(!this.data.phase_progress)this.error='首领进度暂未读到，可到航图查看。';}
   catch{this.error='收获已收好，首领进度请到航图查看。';}
   if(!starseaBossMaps.includes(this.context.region))try{this.keyProgress=(await api<{progress:StageKeyProgress|null}>('stage-keys')).progress;}catch{this.keyProgress=undefined;}
   if(this.context.outcome==='failure'&&this.context.review){
    const review=this.context.review;
    try{this.context.review=combatReviewSchema.parse(await api<CombatReview>('combat/review',{permit:this.context.permit,fatal:review.fatal,recent:review.recent}));localStorage.setItem('aw-battle-result',JSON.stringify(this.context));}
    catch{this.context.review={...review,advice:[]};this.error='建议暂未读到，回港整备后再来。';}
   }
   if(this.context.outcome==='success'&&!this.data.success)throw Error('通关记录正在保存，请恢复连接后查看。');
   this.phase='ready';
  }catch(error){this.phase='offline';this.error=error instanceof Error?error.message:'连接中断，请重新连接。';}
  finally{this.pending=false;this.deps.refresh();}
 }
 async return(){
  if(this.pending||!this.context)return;
  if(this.phase==='offline')await this.load(true);
  if(!['ready','return-error'].includes(this.phase))return;
  this.pending=true;this.phase='returning';this.deps.refresh();
  try{if(this.deps.blocked())await this.deps.recover();if(!await this.deps.returnSafe())throw Error('返回失败，请重试。');this.context=undefined;this.data=undefined;localStorage.removeItem('aw-battle-result');}
  catch(error){this.phase='return-error';this.error=error instanceof Error?error.message:'返回失败，请重试。';}
  finally{this.pending=false;this.deps.refresh();}
 }
 /** 「再来一次」：清掉结算页，由调用方重新进入同一地区；这里只负责丢弃本地记录。 */
 dismiss(){if(!this.context)return;this.context=undefined;this.data=undefined;this.keyProgress=undefined;this.error='';this.phase='ready';localStorage.removeItem('aw-battle-result');this.deps.refresh();}
 render(root:HTMLElement,safe:string){
  if(!this.context)return;const scroll=root.querySelector('.loot-scroll')?.scrollTop??0,key=(document.activeElement as HTMLElement)?.dataset.id,action=(document.activeElement as HTMLElement)?.dataset.action;
  const visual=this.data?.success?'success':this.context.outcome==='failure'?'failure':'pending',enter=this.visual!==visual;this.visual=visual;
  root.hidden=false;root.classList.add('open');root.innerHTML=battleResultHtml(this.context,this.data,this.phase,safe,this.error,enter,this.deps.revision?.()??0,this.context.review,this.keyProgress);
  const list=root.querySelector<HTMLElement>('.loot-scroll');if(list)list.scrollTop=scroll;
  if(action){const target=Array.from(root.querySelectorAll<HTMLElement>('[data-action]')).find(el=>el.dataset.action===action&&el.dataset.id===key);target?.focus({preventScroll:true});}
 }
}
