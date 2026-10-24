import {regionExplore,dockExploreBonus} from '../../../packages/rules/zhangjian.ts';
import type {Pool,PoolClient} from 'pg';
import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import type {CharacterState} from '../../../packages/contracts/index.ts';
import {hubPortClaimRequestSchema,hubDockRequestSchema,hubCommissionRequestSchema,hubModePreferenceRequestSchema,hubPortViewSchema,hubCommissionsViewSchema,todayViewSchema,type HubBuildingId,type ChartRegionId} from '../../../packages/contracts/hub.ts';
import {readHubState,saveHubState} from './hub-state.ts';
import {hubPortView,claimHubPortTier,addHubReputation} from '../../../packages/rules/hub-port.ts';
import {commandHubDock,type HubDockRates} from '../../../packages/rules/hub-dock.ts';
import {fillHubCommissions,hubCommissionsView,commandHubCommission,countHubCommissionKill,countHubCommissionNodeClear,type HubCommissionEconomy} from '../../../packages/rules/hub-commissions.ts';
import {enterHubPort,hubTodayView,observeHubPortSession} from '../../../packages/rules/hub-today.ts';
import {queueHubUnlocks} from '../../../packages/rules/hub-chart.ts';
import {setHubModePreference} from '../../../packages/rules/hub-mode.ts';
import {type HubState,requireHub,HubOutsideError} from '../../../packages/rules/hub-state.ts';
import {transaction} from './database.ts';
import {hubCommand} from './hub-chart-service.ts';
import {buyHubRecipe,type HubPortEconomy} from '../../../packages/rules/hub-port-economy.ts';
import {recordHubFact} from '../../../packages/rules/starsea.ts';
import {applyXp} from '../../../packages/rules/index.ts';
import {archiveQuestCompletions} from './quest-journal.ts';
export {donateHubProgression,previewHubDonation} from '../../../packages/rules/hub-port-economy.ts';

export type HubOutsideNumbers=HubPortEconomy&HubCommissionEconomy&{dockRates:HubDockRates;commissionRep:number;forgeRep:{craft:number;salvage:number;enhance:number;donate:number};sideRep:number};
/** D4: no invented rewards before B4. Production composition must inject derived workbook data. */
export const pendingHubOutsideNumbers:HubOutsideNumbers={dockRates:{},commissionRep:0,forgeRep:{craft:0,salvage:0,enhance:0,donate:0},sideRep:0};
export async function prepareHubOutside(c:PoolClient,s:CharacterState,now=Date.now()){
 const h=await readHubState(c,s.id,now);fillHubCommissions(s,h,now);return h;
}
export function outsideHubViews(s:CharacterState,h:HubState,numbers:HubOutsideNumbers=pendingHubOutsideNumbers,now=Date.now()){
 return {port:hubPortView(s,h),today:hubTodayView(s,h,now),commissions:hubCommissionsView(s,h,numbers.commissionRep,numbers),mode:{mode:h.mode}};
}
/** The route transaction owns auth, character lock, command receipt and character save.
 * Keeping those in the existing application path avoids a second write authority. */
export async function executeHubOutside(c:PoolClient,s:CharacterState,h:HubState,action:
 |{kind:'port';building:HubBuildingId;tier:number}
 |{kind:'dock';op:'send'|'collect'|'quick';fleet?:number;region?:ChartRegionId}
 |{kind:'commissions';op:'claim'|'abandon';id:string}
 |{kind:'recipe';recipe:string}
 |{kind:'mode';mode:'manual'|'semi'|'auto'},numbers:HubOutsideNumbers=pendingHubOutsideNumbers,now=Date.now(),commandId?:string){
 const dockRates=Object.fromEntries(Object.entries(numbers.dockRates).map(([region,rate])=>{const factor=1+(['wind','mist','forge','frost','rift','dragon'].includes(region)?dockExploreBonus(regionExplore(h,region as ChartRegionId).percent):0);return [region,{goldPerHour:rate!.goldPerHour*factor,materialsPerHour:Object.fromEntries(Object.entries(rate!.materialsPerHour).map(([id,n])=>[id,n*factor]))}];}));
 const result=action.kind==='port'?claimHubPortTier(s,h,action.building,action.tier):action.kind==='dock'?commandHubDock(s,h,action,dockRates,now):action.kind==='commissions'?commandHubCommission(s,h,action,numbers.commissionRep,now,numbers):action.kind==='recipe'?buyHubRecipe(s,h,action.recipe,numbers):setHubModePreference(h,action.mode);
 const questRewards=action.kind==='dock'&&action.op==='send'?recordHubFact(s,'hub-gate:dispatch',now):undefined;
 if(questRewards){s.gold+=questRewards.gold;applyXp(s,questRewards.xp);if(questRewards.completed.length)archiveQuestCompletions(s,questRewards.completed,commandId??`hub-dispatch:${s.id}`,new Date(now).toISOString());}
 h.lastSeenAt=now;await saveHubState(c,s.id,h);return {result:questRewards?{...result,questRewards}:result,...outsideHubViews(s,h,numbers,now)};
}
export async function arriveHubOutside(c:PoolClient,s:CharacterState,h:HubState,now=Date.now()){
 fillHubCommissions(s,h,now);enterHubPort(h,now);await saveHubState(c,s.id,h);
}
/** Call after the existing successful crafting/progression/salvage/task transaction,
 * once per receipt. Confirmed unit counts are server values, never request counts. */
export function recordHubOutsideActivity(h:HubState,kind:'craft'|'salvage'|'enhance'|'donate'|'side',numbers:HubOutsideNumbers=pendingHubOutsideNumbers,count=1){
 requireHub(Number.isSafeInteger(count)&&count>=0,'HUB_COUNT','港口行为次数不合法。');const building=kind==='side'?'post':'forge',amount=(kind==='side'?numbers.sideRep:numbers.forgeRep[kind])*count;addHubReputation(h,building,amount);if(kind==='enhance'&&count>0&&!h.chart.gateFacts.includes('enhance'))h.chart.gateFacts.push('enhance');return {building,delta:amount};
}
export function recordHubKill(h:HubState,input:Parameters<typeof countHubCommissionKill>[1]){return countHubCommissionKill(h,input);}
export function recordHubNode(h:HubState,nodeId:string,instance:string,xp=0){return countHubCommissionNodeClear(h,nodeId,instance,xp);}
type HubIdentity={account:string;session:string};
type HubOutsideContext={pool:Pool;identity:(req:any)=>Promise<HubIdentity>;state:(c:Pool|PoolClient,who:HubIdentity,lock?:boolean)=>Promise<CharacterState>;fail:(code:string,message:string,status?:number)=>never};
export function registerHubOutside(app:FastifyInstance,ctx:HubOutsideContext,numbers:HubOutsideNumbers=pendingHubOutsideNumbers){
 const guarded=async<T>(fn:()=>Promise<T>)=>{try{return await fn();}catch(e){if(e instanceof HubOutsideError)ctx.fail(e.code,e.message,409);throw e;}};
 const view=async(req:any,kind:'port'|'today'|'commissions')=>guarded(async()=>{const who=await ctx.identity(req);return transaction(ctx.pool,async c=>{const s=await ctx.state(c,who,true),h=await prepareHubOutside(c,s),now=Date.now();
  if(s.starsea?.location?.map==='ss-map-port'&&!s.dungeon?.instance){const active=await c.query('SELECT 1 FROM ow_dungeon_members WHERE character=$1 AND active LIMIT 1',[s.id]);if(!active.rowCount){queueHubUnlocks(s,h);observeHubPortSession(h,who.session,now);}}
  h.lastSeenAt=now;await saveHubState(c,s.id,h);const views=outsideHubViews(s,h,numbers,now);return kind==='port'?hubPortViewSchema.parse(views.port):kind==='commissions'?hubCommissionsViewSchema.parse(views.commissions):todayViewSchema.parse(views.today);});});
 app.get('/api/hub/port',req=>view(req,'port'));app.get('/api/hub/today',req=>view(req,'today'));app.get('/api/hub/commissions',req=>view(req,'commissions'));
 const command=async(req:any,input:{command_id:string},action:Parameters<typeof executeHubOutside>[3])=>guarded(async()=>{const who=await ctx.identity(req);return transaction(ctx.pool,async c=>{const s=await ctx.state(c,who,true);return hubCommand(c,s,input.command_id,{operation:'hub.'+action.kind,...input},async()=>{
  if(action.kind!=='mode'){const active=await c.query('SELECT 1 FROM ow_dungeon_members WHERE character=$1 AND active LIMIT 1',[s.id]);requireHub(!s.dungeon?.instance&&!active.rowCount,'BUILD_LOCKED','请先结束当前副本。');requireHub(s.starsea?.location?.map==='ss-map-port','HUB_PLACE','请回到拾星港办理。');}
  const h=await prepareHubOutside(c,s),result=await executeHubOutside(c,s,h,action,numbers,Date.now(),input.command_id);s.revision++;await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);return result;
 });});});
 app.post('/api/hub/port/claim',req=>{const v=hubPortClaimRequestSchema.parse(req.body);return command(req,v,{kind:'port',building:v.building,tier:v.tier});});
 app.post('/api/hub/port/recipe',req=>{const v=z.object({recipe:z.string().min(1).max(100),command_id:z.uuid()}).strict().parse(req.body);return command(req,v,{kind:'recipe',recipe:v.recipe});});
 app.post('/api/hub/dock',req=>{const v=hubDockRequestSchema.parse(req.body);return command(req,v,{kind:'dock',op:v.op,fleet:v.fleet,region:v.region});});
 app.post('/api/hub/commissions',req=>{const v=hubCommissionRequestSchema.parse(req.body);return command(req,v,{kind:'commissions',op:v.op,id:v.id});});
 app.post('/api/control/mode-preference',req=>{const v=hubModePreferenceRequestSchema.parse(req.body);return command(req,v,{kind:'mode',mode:v.mode});});
}
