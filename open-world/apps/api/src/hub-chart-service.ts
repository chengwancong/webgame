import {currentGearCount} from '../../../packages/rules/current-inventory.ts';
import {createHash,randomInt} from 'node:crypto';
import type {PoolClient,Pool} from 'pg';
import type {FastifyInstance} from 'fastify';
import {versions,type CharacterState} from '../../../packages/contracts/index.ts';
import {chartViewSchema,hubSeaTierRequestSchema,hubReturnAckRequestSchema,type HubSettlement} from '../../../packages/contracts/hub.ts';
import {hubChartContent,hubNodeById,hubShardById} from '../../../packages/content/hub-chart.ts';
import {settings} from '../../../packages/content/index.ts';
import {hubChartView,hubNodeStatus,hubShardSlots,hubDaily,hubRecommended,queueHubUnlocks,HUB_DAILY_FIRST_CLEAR_LIMIT} from '../../../packages/rules/hub-chart.ts';
import {activeWorldTier,worldTierUnlocked,tierReward} from '../../../packages/rules/world-tier.ts';
import {hubDay,requireHub,HubOutsideError,type HubState} from '../../../packages/rules/hub-state.ts';
import {applySkillRecovery} from '../../../packages/rules/skill-recovery.ts';
import {applyXp,ensureProgression} from '../../../packages/rules/index.ts';
import {crystalSources,ownedCrystalSources} from '../../../packages/rules/crystal-progress.ts';
import {addHubReputation,hubForgeOpen} from '../../../packages/rules/hub-port.ts';
import {countHubCommissionNodeClear} from '../../../packages/rules/hub-commissions.ts';
import {readHubState,saveHubState} from './hub-state.ts';
import {transaction} from './database.ts';
import {worldProgressSchema} from '../../../packages/contracts/open-world.ts';
import {tasks} from '../../../packages/content/task-tables.ts';
import {recordHubNodeFact,recordHubFact,recordHubReturnFact} from '../../../packages/rules/starsea.ts';
import {archiveQuestCompletions} from './quest-journal.ts';
import {hubChallengeAvailability,consumeHubChallenge} from '../../../packages/rules/hub-challenges.ts';
import {challengeContent,type ChallengeDefinition} from '../../../packages/content/progression-challenges.ts';
import {recordHubOutsideActivity,pendingHubOutsideNumbers,type HubOutsideNumbers} from './hub-outside-service.ts';

function completedSideReputation(h:HubState,completed:Parameters<typeof archiveQuestCompletions>[1],numbers:HubOutsideNumbers){const count=completed.filter(({id})=>{const row=tasks.find(t=>t.id===id);return row?.type==='side'&&!id.startsWith('hub-gate-');}).length;return recordHubOutsideActivity(h,'side',numbers,count).delta;}

/** Additive tables. Version 19 is deliberately written only by switch S. */
export async function migrateHubChart(c:PoolClient){await c.query(`
 CREATE TABLE IF NOT EXISTS ow_hub_node_first_clears(character uuid REFERENCES ow_characters(id),node text NOT NULL,instance uuid NOT NULL,first_at timestamptz NOT NULL DEFAULT now(),best_seconds integer NOT NULL,PRIMARY KEY(character,node));
 CREATE TABLE IF NOT EXISTS ow_hub_daily_node_clears(character uuid REFERENCES ow_characters(id),day date NOT NULL,node text NOT NULL,instance uuid NOT NULL,PRIMARY KEY(character,day,node));
 CREATE TABLE IF NOT EXISTS ow_hub_commands(character uuid REFERENCES ow_characters(id),command uuid NOT NULL,fingerprint text NOT NULL,response jsonb NOT NULL,PRIMARY KEY(character,command));
 CREATE TABLE IF NOT EXISTS ow_hub_node_settlements(character uuid REFERENCES ow_characters(id),instance uuid NOT NULL,response jsonb NOT NULL,PRIMARY KEY(character,instance));
 CREATE TABLE IF NOT EXISTS ow_hub_entries(character uuid REFERENCES ow_characters(id),instance uuid NOT NULL,data jsonb NOT NULL,PRIMARY KEY(character,instance));
 `);}
/** Caller holds the character row lock and transaction. Same command cannot perform a different action. */
export async function hubCommand<T>(c:PoolClient,s:CharacterState,command:string,body:unknown,fn:()=>Promise<T>):Promise<T>{
 const fingerprint=createHash('sha256').update(JSON.stringify(body)).digest('hex'),old=await c.query('SELECT fingerprint,response FROM ow_hub_commands WHERE character=$1 AND command=$2',[s.id,command]);
 if(old.rowCount){requireHub(old.rows[0].fingerprint===fingerprint,'COMMAND_REUSED','命令编号已用于其他操作，请重试。');return old.rows[0].response as T;}
 const response=await fn();await c.query('INSERT INTO ow_hub_commands(character,command,fingerprint,response) VALUES($1,$2,$3,$4)',[s.id,command,fingerprint,response]);return response;
}
export type FrozenHubEntry={budgetReady:boolean;nodeId:string;dungeonId:string;region:'wind'|'mist';kind:string;tier:number;rules:string;shards:string[];shardEffects:{id:string;kind:'slot'|'hex-style'|'elite';value:string}[];challenge?:'high'|'nightmare';challengeDefinition?:ChallengeDefinition;challengeTimeLimitSeconds?:number;reward:{xp:number;gold:number;material:number;shards:number;shardChance?:number;rep:number};shardPool:string[];combatScale:{hp:number;attack:number};dropCountScale:number};
export async function prepareHubEntry(c:PoolClient,s:CharacterState,input:{node_id?:string;shards?:string[];challenge?:'high'|'nightmare';tier?:number}):Promise<FrozenHubEntry>{
 requireHub(s.starsea&&s.starsea.location?.map==='ss-map-port','HUB_PLACE','请回到拾星港星门出发。');
 const node=hubNodeById.get(input.node_id??'');requireHub(node,'HUB_NODE','请选择有效的航图节点。');const h=await readHubState(c,s.id),status=hubNodeStatus(s,h,node);requireHub(status.status==='open'||status.status==='cleared','HUB_NODE_LOCKED',status.lockReason??'该节点尚未开放。');
 requireHub(currentGearCount(s.gear)<settings.capacity,'BAG_FULL','背包已满，请先回港整理。');const tier=activeWorldTier(s);requireHub(input.tier===undefined||input.tier===tier,'HUB_TIER','请使用航图当前选择的海域难度。');
 const shards=input.shards??[];requireHub(shards.length<=(['story','gate'].includes(node.kind)?0:hubShardSlots(h)),'HUB_SHARD_SLOTS','当前节点残页槽位不足。');
 const challenge=input.challenge?hubChallengeAvailability(s,node,input.challenge):undefined;if(challenge)requireHub(challenge.eligible,'HUB_CHALLENGE',challenge.reason);const counts=new Map<string,number>();for(const id of shards)counts.set(id,(counts.get(id)??0)+1);for(const [id,count]of counts)requireHub(hubShardById.has(id)&&(h.chart.shards[id]??0)>=count,'HUB_SHARD','残页不足或不适用于当前节点。');
 return {budgetReady:node.budgetReady===true,nodeId:node.id,dungeonId:node.dungeonId,region:node.region as 'wind'|'mist',kind:node.kind,tier,rules:versions.rules,reward:{...structuredClone(node.reward),...tierReward(tier,challenge?.definition?.reward??node.reward)},combatScale:structuredClone(node.combatScale??{hp:1,attack:1}),dropCountScale:node.dropCountScale??1,shardPool:hubChartContent.shards.map(x=>x.id),shards:[...shards],shardEffects:shards.map(id=>{const r=hubShardById.get(id)!;return {id:r.id,kind:r.kind,value:r.value};}),...(input.challenge?{challenge:input.challenge,challengeDefinition:structuredClone(challenge!.definition!),challengeTimeLimitSeconds:challengeContent.limits.maxTicks/30}:{})};
}
export async function consumeHubEntry(c:PoolClient,s:CharacterState,entry:FrozenHubEntry,instanceId:string,now=Date.now()){
 if((await c.query('SELECT 1 FROM ow_hub_entries WHERE character=$1 AND instance=$2',[s.id,instanceId])).rowCount)return;
 const h=await readHubState(c,s.id),counts=new Map<string,number>();for(const id of entry.shards)counts.set(id,(counts.get(id)??0)+1);for(const [id,count]of counts)requireHub((h.chart.shards[id]??0)>=count,'HUB_SHARD','残页不足，尚未出发。');for(const [id,count]of counts)h.chart.shards[id]-=count;h.chart.lastRegion=entry.region;
 if(entry.challenge)consumeHubChallenge(s,hubNodeById.get(entry.nodeId)!,entry.challenge,now);
 if(entry.nodeId==='wind-story-1')for(const fact of ['hub-guide:near','hub-guide:open','hub-guide:depart']){const g=recordHubFact(s,fact);s.gold+=g.gold;applyXp(s,g.xp);archiveQuestCompletions(s,g.completed,instanceId,new Date().toISOString());}
 const stored={...entry,chargedAt:now,...(entry.challenge?{chargedQuotaKey:entry.challenge+':'+hubDay(now)}:{}),shardRoll:randomInt(4294967296)/4294967296,shardOffset:randomInt(Math.max(1,entry.shardPool.length))};
 await c.query('INSERT INTO ow_hub_entries(character,instance,data) VALUES($1,$2,$3)',[s.id,instanceId,stored]);await saveHubState(c,s.id,h);
}
/** Only the trusted system-abort path with policy.refundSystemAbort may call this.
 * The character lock/transaction belongs to the caller. Ordinary defeat and
 * voluntary exit must never call it. Always refund server-stored charges. */
export async function refundHubEntry(c:PoolClient,s:CharacterState,entry:FrozenHubEntry,instanceId:string,now=Date.now()){
 const row=await c.query('SELECT data FROM ow_hub_entries WHERE character=$1 AND instance=$2 FOR UPDATE',[s.id,instanceId]);if(!row.rowCount)return {refunded:false};
 const stored=row.rows[0].data;requireHub(stored.nodeId===entry.nodeId,'HUB_ENTRY','退款对应的星门出发记录不一致。');
 if(stored.refundedAt!==undefined||(await c.query('SELECT 1 FROM ow_hub_node_settlements WHERE character=$1 AND instance=$2',[s.id,instanceId])).rowCount)return {refunded:false};
 const h=await readHubState(c,s.id),shards:Record<string,number>={};for(const id of stored.shards??[]){shards[id]=(shards[id]??0)+1;h.chart.shards[id]=(h.chart.shards[id]??0)+1;}
 let quotaKey:string|undefined=stored.chargedQuotaKey;if(!quotaKey&&stored.challenge){let at=stored.chargedAt;if(at===undefined){const run=await c.query('SELECT created FROM ow_dungeons WHERE id=$1',[instanceId]);if(run.rows[0]?.created)at=new Date(run.rows[0].created).getTime();}if(Number.isFinite(at))quotaKey=stored.challenge+':'+hubDay(at);}
 if(quotaKey&&s.challengeProgress?.daily[quotaKey])s.challengeProgress.daily[quotaKey]=Math.max(0,s.challengeProgress.daily[quotaKey]-1);
 stored.refundedAt=now;await c.query('UPDATE ow_hub_entries SET data=$1 WHERE character=$2 AND instance=$3',[stored,s.id,instanceId]);await saveHubState(c,s.id,h);return {refunded:true,shards,...(quotaKey?{quotaKey}:{})};
}
export async function settleHubNode(c:PoolClient,s:CharacterState,input:{nodeId:string;instanceId:string;seconds:number;shards?:string[];challenge?:'high'|'nightmare'},now=Date.now(),numbers:HubOutsideNumbers=pendingHubOutsideNumbers):Promise<HubSettlement>{
 const previous=await c.query('SELECT response FROM ow_hub_node_settlements WHERE character=$1 AND instance=$2',[s.id,input.instanceId]);if(previous.rowCount)return previous.rows[0].response;
 const node=hubNodeById.get(input.nodeId);requireHub(node,'HUB_NODE','副本对应的航图节点不存在。');requireHub(Number.isFinite(input.seconds)&&input.seconds>=0,'HUB_TIME','通关计时不合法。');
 const entry=await c.query('SELECT data FROM ow_hub_entries WHERE character=$1 AND instance=$2',[s.id,input.instanceId]);requireHub(entry.rowCount&&entry.rows[0].data.nodeId===node.id,'HUB_ENTRY','找不到本场星门出发记录。');
 requireHub(entry.rows[0].data.refundedAt===undefined,'HUB_ENTRY_REFUNDED','本场已因系统中断退还入场消耗，不能再次结算。');
 const budgetReady=entry.rows[0].data.budgetReady===true;const reward:FrozenHubEntry['reward']=budgetReady?(entry.rows[0].data.reward??node.reward):{gold:0,xp:0,material:0,shards:0,rep:0};const h=await readHubState(c,s.id,now),seconds=Math.max(0,Math.round(input.seconds)),firstClear=!(await c.query('SELECT 1 FROM ow_hub_node_first_clears WHERE character=$1 AND node=$2',[s.id,node.id])).rowCount;
 await c.query('INSERT INTO ow_hub_node_first_clears(character,node,instance,first_at,best_seconds) VALUES($1,$2,$3,$4,$5) ON CONFLICT(character,node) DO UPDATE SET best_seconds=LEAST(ow_hub_node_first_clears.best_seconds,EXCLUDED.best_seconds)',[s.id,node.id,input.instanceId,new Date(now),seconds]);
 h.chart.cleared[node.id]={firstAt:h.chart.cleared[node.id]?.firstAt??new Date(now).toISOString(),bestSeconds:Math.min(seconds,h.chart.cleared[node.id]?.bestSeconds??seconds)};
 const day=hubDay(now);h.chart.daily={day,nodes:[...hubDaily(h,now)]};let applied=false;
 if(h.chart.daily.nodes.length<HUB_DAILY_FIRST_CLEAR_LIMIT&&!h.chart.daily.nodes.includes(node.id)){const added=await c.query('INSERT INTO ow_hub_daily_node_clears(character,day,node,instance) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING node',[s.id,day,node.id,input.instanceId]);if(added.rowCount){h.chart.daily.nodes.push(node.id);applied=true;}}
 const rewards:string[]=[],collectibles:HubSettlement['collectibles']=[],st=s.starsea;let sideRep=0;
 if(firstClear){
  rewards.push(...node.firstClearReward);if(st){const gained=recordHubNodeFact(s,node.id,now);s.gold+=gained.gold;applyXp(s,gained.xp);rewards.push(...gained.messages);archiveQuestCompletions(s,gained.completed,input.instanceId,new Date(now).toISOString());sideRep+=completedSideReputation(h,gained.completed,numbers);
   if(node.kind==='gate'){const boss=node.region==='wind'?'ss-map-boss-1':'ss-map-boss-2';if(!st.bosses.includes(boss))st.bosses.push(boss);const next=node.region==='wind'?'ss-map-mist':'ss-map-forge';if(!st.islands.includes(next))st.islands.push(next);const dialogueId=node.region==='wind'?'ss-c01-t06:accept':'ss-c02-t06:accept';h.chart.returnQueue.push({id:dialogueId,item:{kind:'dialogue',dialogueId}});}
   if(node.id==='wind-story-1'){h.chart.returnQueue.push({id:'ss-c01-t02:accept',item:{kind:'dialogue',dialogueId:'ss-c01-t02:accept'}});h.chart.returnQueue.push({id:'hub:first-return:1',item:{kind:'dialogue',dialogueId:'hub:first-return:1'}});}
   if(node.collectible){const kind=node.collectible==='lifeCrystal'?'life':'core',sources=crystalSources(kind).filter(r=>r.region===`ss-map-${node.region}`),source=sources[node.kind==='treasure'?1:0];requireHub(source,'HUB_CRYSTAL','星晶来源尚未配置。');if(!st.crystals.includes(source.id))st.crystals.push(source.id);collectibles.push({kind:node.collectible,owned:ownedCrystalSources(s,kind).length,total:kind==='life'?12:6});}
  }
  if(node.appearance){s.appearance??={selection:{},unlocked:[]};if(!s.appearance.unlocked.includes(node.appearance))s.appearance.unlocked.push(node.appearance);}
  if(node.recipe){const p=ensureProgression(s);if(!p.recipes.includes(node.recipe))p.recipes.push(node.recipe);}
 }
 // D4 freezes only additional rewards before B4. Existing kill rewards remain payable in pending runs.
 const multiplier=applied?2:1,paid=entry.rows[0].data.alreadyPaid??{gold:0,xp:0,material:0};for(const key of ['gold','xp','material'] as const)requireHub(Number.isSafeInteger(paid[key])&&paid[key]>=0&&(!budgetReady||paid[key]<=reward[key]),'HUB_REWARD_BUDGET','本场已发收益与冻结预算不符。');if(budgetReady){s.gold+=reward.gold*multiplier-paid.gold;s.material+=reward.material*multiplier-paid.material;applyXp(s,reward.xp*multiplier-paid.xp);}addHubReputation(h,'shipyard',reward.rep);const shardCount=reward.shards+Number((entry.rows[0].data.shardRoll??randomInt(4294967296)/4294967296)<(reward.shardChance??0));if(shardCount){const pool:string[]=entry.rows[0].data.shardPool??hubChartContent.shards.map(x=>x.id),offset=(entry.rows[0].data.shardOffset??randomInt(Math.max(1,pool.length)))%pool.length;for(let i=0;i<shardCount;i++){const shard=pool[(offset+i)%pool.length];h.chart.shards[shard]=(h.chart.shards[shard]??0)+1;}}
 if(Object.keys(h.chart.cleared).filter(id=>id.startsWith('wind-nest-')).length>=2){const g=recordHubFact(s,'hub-gate:wind-nests',now);s.gold+=g.gold;applyXp(s,g.xp);archiveQuestCompletions(s,g.completed,input.instanceId,new Date(now).toISOString());}
 if(st&&hubForgeOpen(h)&&!st.features.includes('forge'))st.features.push('forge');
 countHubCommissionNodeClear(h,node.id,input.instanceId,reward.xp);const unlock=queueHubUnlocks(s,h).find(i=>i.kind==='unlock'),next=hubRecommended(s,h),shards=input.shards??entry.rows[0].data.shards??[];const retryReason=currentGearCount(s.gear)>=settings.capacity?'先回港整理':shards.some((id:string)=>(h.chart.shards[id]??0)<shards.filter((x:string)=>x===id).length)?'残页不足':undefined;
 const response:HubSettlement={nodeId:node.id,firstClear,firstClearRewards:rewards,dailyBonus:{applied,used:h.chart.daily.nodes.length,limit:HUB_DAILY_FIRST_CLEAR_LIMIT},collectibles,rep:[{building:'shipyard',delta:reward.rep},...(sideRep?[{building:'post' as const,delta:sideRep}]:[])],...(unlock?.kind==='unlock'?{unlock:{id:unlock.id,title:unlock.title,text:unlock.text}}:{}),retry:{allowed:!retryReason,...(retryReason?{reason:retryReason}:{})},...(next?{next:{nodeId:next.id,name:next.name}}:{})};
 await saveHubState(c,s.id,h);await c.query('INSERT INTO ow_hub_node_settlements(character,instance,response) VALUES($1,$2,$3)',[s.id,input.instanceId,response]);return response;
}
export function ackHubReturn(s:CharacterState,h:HubState,input:{kind:'unlock'|'dialogue'|'away';id:string;command_id:string},now=Date.now(),numbers:HubOutsideNumbers=pendingHubOutsideNumbers){
 const at=h.chart.returnQueue.findIndex(q=>q.item.kind===input.kind&&(q.id===input.id||input.kind==='away'&&input.id==='away'));if(at<0)return;
 requireHub(s.starsea&&s.starsea.location?.map==='ss-map-port','HUB_PLACE','请回到拾星港确认回港提示。');
 const entry=h.chart.returnQueue[at];if(input.kind==='unlock')requireHub(h.chart.returnUnlockId===entry.id,'HUB_QUEUE','请先播放本次回港开放提示。');
 if(entry.item.kind==='dialogue'){const row=tasks.find(t=>t.hub_return&&t.dialog_accept===(entry.item as {dialogueId:string}).dialogueId);if(row){const gain=recordHubReturnFact(s,row.id,now);s.gold+=gain.gold;applyXp(s,gain.xp);archiveQuestCompletions(s,gain.completed,input.command_id,new Date(now).toISOString());completedSideReputation(h,gain.completed,numbers);if(gain.completed.length){const archived=s.taskJournal?.archive.find(a=>a.id==='archive:'+input.command_id+':'+row.id);if(archived?.reward)archived.reward.material=gain.material;}}}
 h.chart.returnQueue.splice(at,1);
}
type Identity={account:string;session:string};
type Context={pool:Pool;identity:(req:any)=>Promise<Identity>;state:(c:Pool|PoolClient,who:Identity,lock?:boolean)=>Promise<CharacterState>;fail:(code:string,message:string,status?:number)=>never};
export function registerHubChart(app:FastifyInstance,ctx:Context,numbers:HubOutsideNumbers=pendingHubOutsideNumbers){
 app.get('/api/hub/chart',async req=>{const s=await ctx.state(ctx.pool,await ctx.identity(req)),h=await readHubState(ctx.pool,s.id);return chartViewSchema.parse(hubChartView(s,h));});
 const command=async(req:any,body:{command_id:string},operation:string,fn:(s:CharacterState,h:HubState)=>unknown)=>{const who=await ctx.identity(req);try{return await transaction(ctx.pool,async c=>{const s=await ctx.state(c,who,true);return hubCommand(c,s,body.command_id,{operation,...body},async()=>{requireHub(!s.dungeon?.instance,'BUILD_LOCKED','请先结束当前副本。');const h=await readHubState(c,s.id),result=fn(s,h);s.revision++;await saveHubState(c,s.id,h);await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);return result;});});}catch(e){if(e instanceof HubOutsideError)ctx.fail(e.code,e.message,409);throw e;}};
 app.post('/api/hub/sea-tier',async req=>{const v=hubSeaTierRequestSchema.parse(req.body);return command(req,v,'hub.sea-tier',(s,h)=>{requireHub(s.starsea?.location?.map==='ss-map-port','HUB_PLACE','请回到港口星门切换海域难度。');requireHub(worldTierUnlocked(s,v.tier),'HUB_TIER_LOCKED','所选海域难度尚未开放。');s.world??=worldProgressSchema.parse({});s.world.worldTier=v.tier;return {ok:true,tier:v.tier};});});
 app.post('/api/hub/return-ack',async req=>{const v=hubReturnAckRequestSchema.parse(req.body);return command(req,v,'hub.return-ack',(s,h)=>{ackHubReturn(s,h,v,Date.now(),numbers);return {ok:true};});});
}








