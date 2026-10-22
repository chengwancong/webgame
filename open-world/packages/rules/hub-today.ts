import type {CharacterState} from '../contracts/index.ts';
import type {TodayView} from '../contracts/hub.ts';
import {challengeContent} from '../content/progression-challenges.ts';
import {storyFeatureUnlocked} from './story-campaign.ts';
import {hubDay,hubNextReset,type HubState} from './hub-state.ts';
import {hubCommissionSlots,hubCommissionsOpen} from './hub-port.ts';
import {refreshHubCommissions} from './hub-commissions.ts';
import {accrueHubDock,hubDockView} from './hub-dock.ts';

/** Call exactly once per actual port arrival/login (not on GET polling). */
export function enterHubPort(h:HubState,now=Date.now()){
 refreshHubCommissions(h,now);accrueHubDock(h,now);
 const away=h.lastSeenAt===undefined?0:Math.floor(Math.max(0,now-h.lastSeenAt)/86400000);
 if(away>=3&&!h.chart.returnQueue.some(q=>q.item.kind==='away'))h.chart.returnQueue.push({id:`away:${h.lastSeenAt}`,item:{kind:'away',days:away,lines:[...h.dock.fleets.filter(f=>f.region).map(f=>`第 ${f.fleet} 支船队已累积 ${(f.accruedMs/3600000).toFixed(1)} / 12 小时。`),`委托可用次数 ${h.commissions.banked} / 24。`]}});
 h.chart.returnSerial++;h.chart.returnUnlockId=h.chart.returnQueue.find(q=>q.item.kind==='unlock')?.id;h.lastPortAt=now;h.lastSeenAt=now;h.pendingPortSession=true;
}
/** Bind the first authenticated view after a real arrival without creating a second
 * visit. A different login session thereafter is a new login visit. The identifier
 * is the existing server token hash, never a raw cookie or a second auth mechanism. */
export function observeHubPortSession(h:HubState,session:string,now=Date.now()){
 const away=h.lastSeenAt!==undefined&&now-h.lastSeenAt>=3*86400000;
 const seen=h.portSessionsSeen??=(h.lastPortSession?[h.lastPortSession]:[]);
 if(away||!seen.includes(session)&&!h.pendingPortSession)enterHubPort(h,now);
 if(!seen.includes(session))seen.push(session);
 h.lastPortSession=session;h.pendingPortSession=false;
}
export function hubReturnQueue(h:HubState){return h.chart.returnQueue.filter(q=>q.item.kind!=='unlock'||q.id===h.chart.returnUnlockId).map(q=>q.item);}
export function hubTodayView(s:CharacterState,h:HubState,now=Date.now()):TodayView{
 const highOpen=storyFeatureUnlocked(s,'high'),limit=challengeContent.limits.highDaily;
 // HUB entry passes the aligned service day to the existing quota lifecycle.
 const highUsed=s.challengeProgress?.daily['high:'+hubDay(now)]??0;
 return {resetAt:hubNextReset(now),firstClear:{used:h.chart.daily.day===hubDay(now)?h.chart.daily.nodes.length:0,limit:10},commissions:{open:hubCommissionsOpen(h),active:hubCommissionsOpen(h)?h.commissions.slots.length:0,slots:hubCommissionSlots(s),doneToday:h.commissions.doneToday,banked:h.commissions.banked},dock:hubDockView(s,h,now),high:highOpen?{left:Math.max(0,limit-highUsed),limit}:null,returnQueue:hubReturnQueue(h)};
}
