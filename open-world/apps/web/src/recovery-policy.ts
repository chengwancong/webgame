/** Definitive rejections must not be replayed as uncertain network writes. */
export const finalReportCodes=new Set(['EXPIRED','RULESET','PERMIT','SEQUENCE','QUEST_WAVE_EXPIRED','REVISION','BUILD']);
export function finalReportFailure(error:unknown){return typeof error==='object'&&error!==null&&'code' in error&&finalReportCodes.has(String(error.code));}
export function resultActionAllowed(action:string){return ['result-return','result-retry','recover','close'].includes(action);}
export function dungeonSocketURL(origin:string,instance:string){const u=new URL('/api/dungeons/'+encodeURIComponent(instance)+'/live',origin);u.username='';u.password='';u.protocol=u.protocol==='https:'?'wss:':'ws:';return u.toString();}
/** A slow heartbeat cannot overlap its successor, or revoke a newer successful renewal. */
export class RenewalGate{
 pending=false;private successAt=0;
 begin(now=Date.now()){if(this.pending)return false;this.pending=true;if(!this.successAt)this.successAt=now;return true;}
 success(now=Date.now()){this.successAt=now;}
 finish(){this.pending=false;}
 canRetry(error:unknown,now=Date.now()){return typeof error==='object'&&error!==null&&'code' in error&&['NETWORK','SERVER'].includes(String(error.code))&&now-this.successAt<120000;}
}
