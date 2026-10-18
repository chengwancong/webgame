import {craftBuffValue} from '../../../packages/rules/crafting-consumables.ts';
import numericRateLimits from '../../../packages/content/spine-rate-limits.json';
import {registerPacingLab,type PacingLabOptions} from './pacing-lab.ts';
import {registerCombatReview} from './combat-review-service.ts';
import {registerStageKeyService} from './stage-key-service.ts';
import {registerCrafting} from './crafting-service.ts';
import {publicCraftingContent} from '../../../packages/content/crafting.ts';
import {awardCraftingLoot,freezeCraftingLoot} from './crafting-loot.ts';
import {learnCraftPattern} from '../../../packages/rules/crafting.ts';
import {worldTierChoices,recordHardmodeBoss} from '../../../packages/rules/world-tier.ts';
import {freezeFieldGuarantees,guaranteedFieldQualities} from './field-loot.ts';
import {registerFieldActivities} from './field-activities.ts';
import {freezeItemRules,issueCombatGear} from '../../../packages/rules/item-issuance.ts';
import {effectAtomById} from '../../../packages/content/effect-atoms.ts';
import {resolveAtomParts} from '../../../packages/rules/atom-parts.ts';
import {scaledDescription} from '../../../packages/rules/set-bonus-descriptions.ts';
import {rollInscription,extractInscriptionRubbing,inscriptionRubbings} from '../../../packages/rules/inscriptions.ts';
import {inscriptionConfig} from '../../../packages/content/inscriptions.ts';
import {reinforceAffixNode} from '../../../packages/rules/affix-reinforcement.ts';
import {rerollSingleAffix} from '../../../packages/rules/single-affix-reroll.ts';
import {beginFieldReplay} from './field-replay-service.ts';
import {quoteTalentBatch,applyTalentBatch} from '../../../packages/rules/talent-batch.ts';
import {compareResolvedStats,compareVerdict} from '../../../packages/rules/stat-comparison.ts';
import {assignMainStat} from '../../../packages/rules/main-stats.ts';
import {archiveQuestCompletions} from './quest-journal.ts';
import {countBountyKill} from '../../../packages/rules/bounty.ts';
import type {QuestCompletion} from '../../../packages/rules/starsea.ts';
import {worldTables} from '../../../packages/content/world-tables.ts';
import {resolveWorldPhase} from '../../../packages/rules/world-phase.ts';
import {campSource} from '../../../packages/rules/world-camps.ts';
import {questTarget,recordCampFact} from '../../../packages/rules/starsea.ts';
import {minimumClearMs} from './clear-floor.ts';
import {makeStarseaStarterWeapon,makeStarseaStarterJewelry} from '../../../packages/rules/starsea-starter.ts';
import {choosePrologueWeapon,finishPrologue} from '../../../packages/rules/starsea-prologue.ts';
import {applyDevCheckpoint,devCheckpointIds} from '../../../packages/rules/dev-checkpoints.ts';
import {prologueFamilies,prologueConfig} from '../../../packages/content/starsea/prologue.ts';
import encounterBalance from '../../../packages/content/encounter-balance.json';
import {walkable} from '../../../packages/simulation/navigation.ts';
import {changeMainHand,rememberWeaponSkills,skillWeaponAllowed,skillWeaponRequirement} from '../../../packages/rules/skill-weapon-access.ts';
import {combatNumerics} from '../../../packages/rules/combat-numerics.ts';
import {batchSalvageCandidates,batchSalvageProtected} from '../../../packages/rules/salvage-batch.ts';
import Fastify from 'fastify';
import {appearanceSelectionSchema} from '../../../packages/contracts/appearance.ts';
import {ensureAppearance,appearanceView,resolveAppearance,previewAppearance,applyAppearance,AppearanceError} from '../../../packages/rules/appearance.ts';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import {registerDungeons} from './dungeon-service.ts';
import {migrateFieldEntry} from '../../../packages/rules/field-migration.ts';
import {tierReward,worldTier} from '../../../packages/rules/world-tier.ts';
import {campTier} from './world-camps.ts';
import {registerField,markClearedCamps} from './field-service.ts';
import '../../../packages/content/open-world/index.ts';
import type {dungeonContent} from '../../../packages/content/dungeons.ts';
import {randomBytes,randomUUID,createHash,scryptSync,timingSafeEqual,randomInt} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import {credentials,testCredentials,command,claimRewardsSchema,reportSchema,versions,type CharacterState,type Snapshot,type Permit,type Receipt,type Reward,type Spawn,type GearQuality,type Gear} from '../../../packages/contracts/index.ts';
import {settings,regions,regionById,fieldRegionInfo,economyRegionOf,skillCatalog,starterSkills,effectText,skillBookRewards,equipmentCatalog,equipmentItems,getEquipmentItem} from '../../../packages/content/index.ts';
import {gearMaxRank,gearUpgradeCost,applyItemPower} from '../../../packages/rules/item-power.ts';
import {skillRecoveryView,skillSlotCount,signatureSealed} from '../../../packages/rules/skill-recovery.ts';
import {craftGoalView} from '../../../packages/rules/craft-goal.ts';
import {resolveBuild,resolveSkillAccess,skillUnlocked,makeGear,applyXp,upgradeCost,gearBases,gearContribution,gearPrimaryAttribute,instantiateGearTemplate} from '../../../packages/rules/index.ts';
import {generateGearAffixes,gearAffixConfig} from '../../../packages/rules/affix-generator.ts';
import {withCurrentEquipmentNames} from '../../../packages/rules/equipment-names.ts';
import {getEquippedSets} from '../../../packages/simulation/set-calculator.ts';
import {transaction} from './database.ts';
import {rewards as economy,dropProfileFor,rollGearDrop,rewardFor,starseaKillReward,scaleWorldGear,equipmentDropRules,gearTemplatesForRegion,pickRegionalGearTemplate,worldGearTemplates} from './economy.ts';
import {resolveBossAccess} from '../../../packages/rules/boss-access.ts';
import {progressionActionSchema} from '../../../packages/contracts/deep-progression.ts';
import {ensureProgression,progressionView,previewProgressionAction,applyProgressionAction,awardProgression,isProgressionGearReferenced,assignGearAspect,ProgressionError} from '../../../packages/rules/deep-progression.ts';
import {registerProgressionChallenges} from './progression-challenges.ts';
import {challengeContent} from '../../../packages/content/progression-challenges.ts';
import {awardSeasonXp} from '../../../packages/rules/progression-challenges.ts';
import {progressionConfig,progressionGearTemplates} from '../../../packages/content/deep-progression.ts';
import {claimTask,completionState,recordTaskCompletions,resolveTasks} from './task-journal.ts';
import {newBattleRecord,accumulateBattle,type BattleRecord} from './battle-result.ts';
import {bossPhaseProgress} from './boss-phase-progress.ts';
import {newStoryState,recordStoryEvent,resolveStory,storyHas,storyChapterAvailable,storyFeatureUnlocked,storyFeatureReason} from '../../../packages/rules/story-campaign.ts';
import {storyChapter,storyFeatures} from '../../../packages/content/story-campaign.ts';
import {newStarseaState,ensureStarsea,evaluateUnlocks,starseaView,starseaRegionOpen,applyStarseaOp,recordStarseaKill,starseaClearPlausible,starseaPendingWave,isTideNightSpawn,StarseaError} from '../../../packages/rules/starsea.ts';
import {starseaHub,starseaIslands,isStarseaRegion,starseaSpawns,starseaMap} from '../../../packages/content/starsea/index.ts';
import {starseaQuestOpSchema} from '../../../packages/contracts/starsea.ts';
import {regionUnlocked,rememberRegion,resumeRegion} from '../../../packages/rules/world-location.ts';
const worldGearBases=worldGearTemplates(gearBases);
class Fault extends Error{constructor(public code:string,message:string,public status=409){super(message);}}
function fail(code:string,message:string,status=409):never{throw new Fault(code,message,status);}
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
function stable(v:unknown):string{if(Array.isArray(v))return '['+v.map(stable).join(',')+']';if(v&&typeof v==='object')return '{'+Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>JSON.stringify(k)+':'+stable(x)).join(',')+'}';return JSON.stringify(v);}
function passwordHash(p:string){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(p,salt,64).toString('hex');}
function checkPassword(p:string,h:string){const [salt,key]=h.split(':');const actual=scryptSync(p,salt,64);return timingSafeEqual(actual,Buffer.from(key,'hex'));}
type Identity={account:string;session:string;resume?:string};
export function createApp(pool:Pool,options:{pacingLab?:PacingLabOptions;logger?:boolean;production?:boolean;testLogin?:boolean;origins?:string[];dungeons?:false|typeof dungeonContent;/** 新角色的主线：默认星潮海；legacy 为旧版营地主线（旧系统的回归测试使用）。 */campaign?:'starsea'|'legacy';/** QA-only field regions (M0 graybox); never in production. */fieldQa?:boolean;/** 本地验收检查点（qa_ 测试号跳任务节点）；never in production. */devCheckpoints?:boolean}={}){
 if(options.production&&options.pacingLab)throw Error('Pacing trials cannot be enabled in production.');
 if(options.production&&options.fieldQa)throw Error('QA field regions cannot be enabled in production.');
 if(options.production&&options.testLogin)throw Error('Test login cannot be enabled in production.');
 if(options.production&&options.devCheckpoints)throw Error('Dev checkpoints cannot be enabled in production.');
 if(options.production&&options.dungeons===false)throw Error('Production dungeon runtime cannot be disabled.');
 const app=Fastify({logger:options.logger??false,bodyLimit:128*1024});app.register(cookie);
 app.register(websocket);
 const origins=new Set(options.origins??['http://127.0.0.1:8612','http://127.0.0.1:8611']);
 app.addHook('onRequest',async(req,reply)=>{if(['POST','DELETE','PUT','PATCH'].includes(req.method)){
 const origin=req.headers.origin;if(origin&&!origins.has(origin))fail('ORIGIN','请求来源不受支持。',403);
 if(!origin&&req.headers['sec-fetch-site']==='cross-site')fail('ORIGIN','请求来源不受支持。',403);
 }});
 app.setErrorHandler((e,req,reply)=>{if(e instanceof z.ZodError)return reply.code(400).send({code:'INPUT',message:'输入格式不正确，请检查后重试。'});if(e instanceof AppearanceError)return reply.code(409).send({code:e.code,message:e.message});if(e instanceof ProgressionError||e instanceof StarseaError)return reply.code(409).send({code:e.code,message:e.message});if(e instanceof Fault){req.log.warn({code:e.code,request:req.id,command_id:(req.body as any)?.command_id,permit_id:(req.body as any)?.permit_id},'business request rejected');return reply.code(e.status).send({code:e.code,message:e.message});}
 req.log.error({err:e,request:req.id},'request failed');reply.code(500).send({code:'SERVER',message:'服务暂时不可用，操作未完成，请重试。'});});
 async function identity(req:any):Promise<Identity>{const token=req.cookies.aw_session;if(!token)fail('AUTH','请先登录。',401);const session=sha(token);const r=await pool.query('SELECT account FROM ow_sessions WHERE token_hash=$1 AND expires>now()',[session]);if(!r.rowCount)fail('AUTH','登录已过期，请重新登录。',401);return {account:r.rows[0].account,session,resume:z.uuid().optional().parse(req.headers['x-aw-resume-lease'])};}
 async function state(c:Pool|PoolClient,who:Identity,lock=false):Promise<CharacterState>{const r=await c.query('SELECT state FROM ow_characters WHERE account=$1'+(lock?' FOR UPDATE':''),[who.account]);if(!r.rowCount)fail('CHARACTER','请先创建角色。',404);const s:CharacterState=r.rows[0].state;s.gear=s.gear.map(withCurrentEquipmentNames);ensureProgression(s);ensureAppearance(s);ensureStarsea(s);return s;}
 async function snapshot(c:Pool|PoolClient,s:CharacterState):Promise<Snapshot>{ensureProgression(s);const rewards=await c.query('SELECT data FROM ow_rewards WHERE character=$1 AND NOT claimed ORDER BY id',[s.id]);ensureStarsea(s);const currentRegion=resumeRegion(s),field={gathered:s.field?.region===currentRegion?[...s.field.gathered]:[]};const {taskJournal,...visible}=s;if(visible.starsea){const {trackedManually,...publicStarsea}=visible.starsea;visible.starsea=publicStarsea;}return {...visible,field,lastRegion:currentRegion,gear:s.gear.map(withCurrentEquipmentNames),...resolveBuild(s),bossAccess:resolveBossAccess(s.progress),rewards:rewards.rows.map(r=>({...r.data,gear:withCurrentEquipmentNames(r.data.gear)})),capacity:settings.capacity,resolvedAppearance:resolveAppearance(s),starseaView:starseaView(s),skillRecovery:skillRecoveryView(s),craftGoal:craftGoalView(s),worldView:resolveWorldPhase(s),worldTierChoices:worldTierChoices(s)};}
 // 心跳每 15 秒；浏览器后台标签页会把定时器压到约每分钟一次，租约须覆盖两次以上被压后的心跳间隔。
 const controlLeaseSeconds=150;
 async function lease(c:Pool|PoolClient,s:CharacterState,who:Identity,id:string){const r=await c.query('SELECT lease,session,expires FROM ow_controls WHERE character=$1',[s.id]);const control=r.rows[0];if(!control||control.lease!==id||control.session!==who.session||new Date(control.expires).getTime()<=Date.now())fail('CONTROL','角色控制已失效，请重新获取或接管。');}
 async function save(c:PoolClient,s:CharacterState){await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);}
 async function write(who:Identity,input:z.infer<typeof command>,body:unknown,fn:(c:PoolClient,s:CharacterState)=>Promise<{delta?:Receipt['delta'];rewards?:Reward[];spawns?:Spawn[];questCompletions?:QuestCompletion[]}>):Promise<Receipt>{
 return transaction(pool,async c=>{const s=await state(c,who,true),fingerprint=sha(stable(body));const old=await c.query('SELECT fingerprint,receipt FROM ow_receipts WHERE character=$1 AND command=$2',[s.id,input.command_id]);
 if(old.rowCount){if(old.rows[0].fingerprint!==fingerprint)fail('COMMAND_CONFLICT','同一操作编号不能使用不同内容。');return old.rows[0].receipt;}
 await lease(c,s,who,who.resume??input.lease_id);if(s.revision!==input.revision)fail('REVISION','角色状态已更新，请刷新后重试。');
 if(options.dungeons!==false){const membership=(await c.query("SELECT d.data FROM ow_dungeon_members m JOIN ow_dungeons d ON d.id=m.instance WHERE m.character=$1 AND m.active AND d.status='running'",[s.id])).rows[0];if(membership?.data.definition.policy.buildLocked&&(/^(gear\.|skills\.|deep-progression|crafting\.|raid-|challenge-run)/.test((body as any).operation??(body as any).action??'')||(body as any).gear_id||(body as any).skill_id||(body as any).skills))fail('DUNGEON_BUILD_LOCKED','本场装备和技能已锁定，请结束副本后调整。');}
 if(s.starsea){s.starsea.fieldFacts??={open_chest:[],complete_event:[],kill_rare:[],clear_dungeon:[]};const clears=(await c.query('SELECT dungeon FROM ow_dungeon_completions WHERE character=$1',[s.id])).rows;for(const row of clears)if(!s.starsea.fieldFacts.clear_dungeon.includes(row.dungeon))s.starsea.fieldFacts.clear_dungeon.push(row.dungeon);}
 if((/^(gear\.|skills\.|deep-progression|crafting\.|raid-|challenge-run)/.test((body as any).operation??(body as any).action??'')||(body as any).gear_id||(body as any).skill_id||(body as any).skills)&&(await c.query("SELECT 1 FROM ow_field_activities WHERE character=$1 AND status='running'",[s.id])).rowCount)fail('FIELD_BUILD_LOCKED','世界活动进行中，结束后再调整技能和装备。');
 const priorBuild=s.build,beforeTasks=completionState(s);const result=await fn(c,s);
 if(s.starsea){const cleared=await c.query('SELECT DISTINCT camp FROM ow_camp_cycles WHERE character=$1 AND cleared_at IS NOT NULL',[s.id]);for(const {camp} of cleared.rows){const g=recordCampFact(s,camp);if(g.completed.length){s.gold+=g.gold;applyXp(s,g.xp);result.delta??={gold:0,xp:0,material:0};result.delta.gold+=g.gold;result.delta.xp+=g.xp;(result.questCompletions??=[]).push(...g.completed);}}}
 if(result.questCompletions?.length)archiveQuestCompletions(s,result.questCompletions,input.command_id,new Date().toISOString());recordTaskCompletions(s,beforeTasks,new Date().toISOString());ensureProgression(s);ensureAppearance(s);evaluateUnlocks(s);if(s.build!==priorBuild&&!(body as any).permit_id)await c.query('UPDATE ow_permits SET build=$1 WHERE character=$2',[s.build,s.id]);s.revision++;await save(c,s);
 const receipt:Receipt={command_id:input.command_id,revision:s.revision,delta:result.delta??{gold:0,xp:0,material:0},rewards:result.rewards??[],snapshot:await snapshot(c,s),...(result.spawns?.length?{spawns:result.spawns}:{})};
 await c.query('INSERT INTO ow_receipts VALUES($1,$2,$3,$4)',[s.id,input.command_id,fingerprint,receipt]);
 await c.query('INSERT INTO ow_ledger(character,command,delta) VALUES($1,$2,$3)',[s.id,input.command_id,receipt.delta]);return receipt;
 });}
 app.get('/api/health',async()=>{await pool.query('SELECT 1');return {ok:true,versions,auth_mode:options.testLogin?'account-only':'password'};});
 app.get('/api/content',async()=>({versions,settings,regions,skillCatalog,equipmentItems,crafting:publicCraftingContent}));
 app.get('/api/items',async()=>equipmentCatalog);
 app.get('/api/items/:id',async req=>{
  const item=getEquipmentItem((req.params as {id:string}).id);if(!item)fail('NOT_FOUND','道具定义不存在。',404);return item;
 });
 app.post('/api/session/:action',async(req,reply)=>{const action=(req.params as any).action;if(!['register','login'].includes(action))fail('INPUT','未知操作。',400);let account:string;
 if(options.testLogin){
 const {username}=testCredentials.parse(req.body);
 const inserted=await pool.query('INSERT INTO ow_accounts VALUES($1,$2,$3) ON CONFLICT(username) DO NOTHING RETURNING id',[randomUUID(),username,passwordHash(randomBytes(32).toString('hex'))]);
 account=inserted.rows[0]?.id??(await pool.query('SELECT id FROM ow_accounts WHERE username=$1',[username])).rows[0].id;
 }else{const v=credentials.parse(req.body);
 if(action==='register'){account=randomUUID();try{await pool.query('INSERT INTO ow_accounts VALUES($1,$2,$3)',[account,v.username,passwordHash(v.password)]);}catch(e:any){if(e.code==='23505')fail('USERNAME','账号已存在，请登录。');throw e;}}
 else{const r=await pool.query('SELECT id,password FROM ow_accounts WHERE username=$1',[v.username]);if(!r.rowCount||!checkPassword(v.password,r.rows[0].password))fail('LOGIN','账号或密码不正确。',401);account=r.rows[0].id;}}
 const token=randomBytes(32).toString('hex');await pool.query('INSERT INTO ow_sessions VALUES($1,$2,now()+interval \'7 days\')',[sha(token),account]);reply.setCookie('aw_session',token,{path:'/',httpOnly:true,secure:options.production??false,sameSite:'strict',maxAge:604800});return {ok:true};});
 app.post('/api/logout',async(req,reply)=>{const who=await identity(req);await transaction(pool,async c=>{await c.query('DELETE FROM ow_controls WHERE session=$1',[who.session]);await c.query('DELETE FROM ow_sessions WHERE token_hash=$1',[who.session]);});reply.clearCookie('aw_session',{path:'/'});return {ok:true};});
 app.get('/api/character',async req=>{const who=await identity(req);return snapshot(pool,await state(pool,who));});
 app.get('/api/tasks',async req=>resolveTasks(await state(pool,await identity(req))));
 app.get('/api/story',async req=>resolveStory(await state(pool,await identity(req)),(req.query as {chapter?:string}).chapter));
 app.post('/api/story/talk',async req=>{const who=await identity(req),v=command.extend({chapter:z.string(),npc:z.string(),op:z.enum(['accept','return'])}).strict().parse(req.body);return write(who,v,{...v,operation:'story.talk'},async(c,s)=>{
  const chapter=storyChapter(v.chapter);if(!chapter||chapter.npc!==v.npc)fail('STORY_NPC','请向本章的营地同伴交谈。');
  if(s.dungeon?.instance||s.dungeon?.pendingResult)fail('STORY_CAMP','请先结束本场参与并返回营地。');
  if(!storyChapterAvailable(s,chapter.id)||s.level<chapter.level)fail('STORY_LOCKED','请先完成上一章并达到地区进入等级。');
  const at=new Date().toISOString();
  if(v.op==='accept'){recordStoryEvent(s,chapter.id+':accept',at);return {};}
  if(!storyHas(s,chapter.id+':boss'))fail('STORY_INCOMPLETE','本章调查、救援与首领目标尚未完成。');
  if(storyHas(s,chapter.id+':return'))return {};
  const archive=claimTask(s,'story-'+chapter.id,v.command_id,at);if(!archive&&!s.progress.tasks.includes('story-'+chapter.id))fail('STORY_INCOMPLETE','章节记录尚未完整确认。');
  recordStoryEvent(s,chapter.id+':return',at);return {delta:archive?.reward??{gold:0,xp:0,material:0}};
 });});
 app.get('/api/combat/results/:id',async req=>{
  const who=await identity(req),s=await state(pool,who),id=z.uuid().parse((req.params as {id:string}).id);
  const row=(await pool.query('SELECT * FROM ow_permits WHERE id=$1 AND character=$2',[id,s.id])).rows[0];
  if(!row)fail('NOT_FOUND','这次战斗记录不存在。',404);
  const sources=row.data.spawns.map((m:Spawn)=>m.id),bosses=row.data.spawns.filter((m:Spawn)=>m.boss).map((m:Spawn)=>m.id);
  const kills=(await pool.query('SELECT source FROM ow_kills WHERE character=$1 AND source=ANY($2::text[])',[s.id,sources])).rows.map(r=>r.source);
  const drops=(await pool.query('SELECT claimed,data FROM ow_rewards WHERE character=$1 AND source=ANY($2::text[])',[s.id,sources])).rows;
  const record:BattleRecord|undefined=row.private_data.battleResult,complete=record?.complete===true;
  return {permit_id:id,region:row.region,cycle:row.cycle,success:bosses.length>0&&bosses.every((source:string)=>kills.includes(source)),first_clear:complete?record.firstClear:null,unlocked_regions:record?.unlocked??[],totals:{gold:complete?record.gold:null,xp:complete?record.xp:null,material:complete?record.material:null},materials:record?.materials??{},books:record?.books??{},gear:record?.gear??drops.map(r=>r.data.gear),pending_gear:drops.filter(r=>!r.claimed).length,delivery:row.private_data.delivery??'ground',history_complete:complete};
 });
 app.get('/api/combat/results/:id/progress',async req=>{
  const who=await identity(req),s=await state(pool,who),id=z.uuid().parse((req.params as {id:string}).id);
  const row=(await pool.query('SELECT region,data FROM ow_permits WHERE id=$1 AND character=$2',[id,s.id])).rows[0];
  if(!row)fail('NOT_FOUND','这次战斗记录不存在。',404);
  return {phase_progress:bossPhaseProgress(s,row.region,row.data.spawns)};
 });
 app.get('/api/appearance',async req=>appearanceView(await state(pool,await identity(req))));
 app.post('/api/appearance/preview',async req=>{const who=await identity(req),v=z.object({revision:z.number().int().nonnegative().optional(),selection:appearanceSelectionSchema}).strict().parse(req.body),s=await state(pool,who);if(v.revision!==undefined&&v.revision!==s.revision)fail('REVISION','角色状态已更新，请刷新后重试。');return previewAppearance(s,v.selection);});
 app.post('/api/appearance/apply',async req=>{const who=await identity(req),v=command.extend({selection:appearanceSelectionSchema}).strict().parse(req.body);return write(who,v,{...v,operation:'appearance.apply'},async(_c,s)=>{applyAppearance(s,v.selection);return {};});});
 for(const action of ['reset','default'])app.post('/api/appearance/'+action,async req=>{const who=await identity(req),v=command.strict().parse(req.body);return write(who,v,{...v,operation:'appearance.'+action},async(_c,s)=>{applyAppearance(s,{});return {};});});
 app.get('/api/progression',async req=>{const who=await identity(req);return progressionView(await state(pool,who));});
 app.post('/api/progression/preview',async req=>{const who=await identity(req),v=z.object({action:progressionActionSchema,revision:z.number().int().nonnegative().optional()}).strict().parse(req.body),s=await state(pool,who);if(v.revision!==undefined&&v.revision!==s.revision)fail('REVISION','角色状态已更新，请刷新后重试。');return previewProgressionAction(s,v.action);});
 app.post('/api/progression/talents/max-preview',async req=>{const s=await state(pool,await identity(req)),v=z.object({revision:z.number().int().nonnegative(),target:z.string().min(1).max(100)}).strict().parse(req.body);if(v.revision!==s.revision)fail('REVISION','角色状态已更新，请重新预览。');return quoteTalentBatch(s,v.target);});
 app.post('/api/progression/talents/max',async req=>{const who=await identity(req),v=command.extend({target:z.string().min(1).max(100),expected_count:z.number().int().positive().max(5)}).strict().parse(req.body);return write(who,v,{...v,operation:'deep-progression.talent-max'},async(_c,s)=>{try{return {delta:applyTalentBatch(s,v.target,v.expected_count)};}catch(error){fail('TALENT_BATCH',error instanceof Error?error.message:'批量投入失败。');}});});
 app.post('/api/progression/action',async req=>{const who=await identity(req),v=command.extend({action:progressionActionSchema}).strict().parse(req.body);return write(who,v,{...v,operation:'deep-progression'},async(_c,s)=>({delta:applyProgressionAction(s,v.action)}));});
 app.get('/api/travel/:region/drops',async req=>{
  const who=await identity(req),s=await state(pool,who),region=regions.find(r=>r.id===(req.params as {region:string}).region);
  if(!region||region.id==='town')fail('REGION','请选择野外区域或首领试炼。',404);
  // Publish display summaries only. Never roll or reveal an instance/candidate/RNG.
  const active=(await pool.query('SELECT private_data FROM ow_permits WHERE character=$1 AND region=$2 AND expires>now() AND data->>\'rules\'=$3 ORDER BY cycle DESC LIMIT 1',[s.id,region.id,versions.rules])).rows[0];
  const rules=active?.private_data?.economy??economy;
  const gains=region.spawns.map(m=>rewardFor(region.id,m.boss?'boss':m.elite?'elite':'normal',rules));
  const range=(key:'gold'|'xp'|'material')=>({min:gains.length?Math.min(...gains.map(v=>v[key])):0,max:gains.length?Math.max(...gains.map(v=>v[key])):0});
  const profile=active?.private_data?.dropProfile??dropProfileFor(region.id);
  const templates=gearTemplatesForRegion(worldGearTemplates<typeof gearBases[number]>(active?.private_data?.gearBases??worldGearBases),region.id,active?.private_data?.collectionDrops??equipmentDropRules).map(template=>scaleWorldGear(template,profile));
  const entryNote=region.boss?(!s.progress.bosses.includes(region.id)?'首次击败本首领必得一件稀有或更高品质装备。':'重复挑战必得一件魔法或更高品质装备。'):'普通敌人有机会掉落装备，地区精英必掉一件装备。';
  const stageNote=profile.boss.quality.legendary===0?'本地区不掉落传说装备。':`重复首领传说概率 ${profile.boss.quality.legendary}%。`;
  const odds=region.boss?`重复首领稀有 ${profile.boss.quality.rare}%。`:`普通装备概率 ${profile.normal.gearPercent}%。`;
  return {region:region.id,ruleset_version:versions.rules,basis:'per-kill',rewards:{gold:range('gold'),xp:range('xp'),material:range('material')},equipment:templates.map(({base,name,slot,attack,armor,effect}:typeof gearBases[number])=>withCurrentEquipmentNames({base,name,slot,attack,armor,effect,primary_attribute:gearPrimaryAttribute({base}),random_main:gearAffixConfig.mainStats.some(row=>row.slot===slot)})),note:entryNote+odds+stageNote+'图标展示可能掉落的种类，实际战利品由战斗结算确认。'};
 });
 app.post('/api/character',async req=>{const who=await identity(req);const v=z.object({name:z.string().trim().min(1).max(20)}).strict().parse(req.body);return transaction(pool,async c=>{
 await c.query('SELECT id FROM ow_accounts WHERE id=$1 FOR UPDATE',[who.account]);const exists=await c.query('SELECT state FROM ow_characters WHERE account=$1',[who.account]);if(exists.rowCount)return snapshot(c,exists.rows[0].state);
 const legacy=options.campaign==='legacy',gear=[makeGear(0,randomUUID()),makeGear(2,randomUUID()),makeGear(1,randomUUID()),makeGear(4,randomUUID()),makeGear(3,randomUUID()),makeGear(5,randomUUID())].map(g=>legacy?g:applyItemPower(g,1));
 if(!legacy)gear[0]=makeStarseaStarterWeapon(gear[0].id);
 if(!legacy){const jewelry=makeStarseaStarterJewelry([gear[3].id,randomUUID()]);gear[3]=jewelry[0];gear.push(jewelry[1]);}
 // 星潮海新角色只带本武器的起手招（剑：斩击），其余技能按任务一个一个给（docs/progression-goal-plan.md §11.3）。
 const start=legacy?starterSkills:prologueConfig.families.sword.starterSkills;
 const s:CharacterState={field:{gathered:[]},id:randomUUID(),name:v.name,revision:0,build:1,level:1,xp:0,gold:0,material:0,gear,equipment:{weapon:gear[0].id,armor:gear[1].id},weaponLoadouts:{},skills:[...start],skillRanks:Object.fromEntries(start.map(id=>[id,1])),skillBooks:{},progress:legacy?{kills:0,regions:['town','meadow'],bosses:[],safe:'town',tasks:[]}:{kills:0,regions:[starseaHub,starseaIslands[0]],bosses:[],safe:starseaIslands[0],tasks:[]}};
 if(!legacy){s.equipment.accessory=gear[3].id;s.equipment.ring=gear.at(-1)!.id;}
 // 新角色只走星潮海主线：从风栖岛落点醒来（docs/hybrid-implementation.md H6）。
 s.story=newStoryState();if(!legacy)s.starsea=newStarseaState();ensureProgression(s);ensureAppearance(s);await c.query('INSERT INTO ow_characters VALUES($1,$2,$3)',[s.id,who.account,s]);return snapshot(c,s);
 });});
 app.post('/api/control',async req=>{const who=await identity(req);const v=z.object({takeover:z.boolean().default(false),client_id:z.uuid()}).strict().parse(req.body);return transaction(pool,async c=>{
 const s=await state(c,who,true);const old=(await c.query('SELECT * FROM ow_controls WHERE character=$1',[s.id])).rows[0];if(old&&new Date(old.expires).getTime()>Date.now()&&(old.session!==who.session||old.client_id!==v.client_id)&&!v.takeover)fail('BUSY','角色正在其他设备游玩，可选择接管。');
 const id=old&&old.session===who.session&&old.client_id===v.client_id&&new Date(old.expires).getTime()>Date.now()?old.lease:randomUUID();await c.query('INSERT INTO ow_controls(character,lease,session,expires,client_id) VALUES($1,$2,$3,now()+make_interval(secs=>$5),$4) ON CONFLICT(character) DO UPDATE SET lease=$2,session=$3,expires=now()+make_interval(secs=>$5),client_id=$4',[s.id,id,who.session,v.client_id,controlLeaseSeconds]);return {lease_id:id,expires_at:new Date(Date.now()+controlLeaseSeconds*1000).toISOString()};
 });});
 app.post('/api/control/renew',async req=>{const who=await identity(req);const v=z.object({lease_id:z.uuid()}).strict().parse(req.body);return transaction(pool,async c=>{const s=await state(c,who,true);await lease(c,s,who,v.lease_id);await c.query('UPDATE ow_controls SET expires=now()+make_interval(secs=>$2) WHERE character=$1',[s.id,controlLeaseSeconds]);return {ok:true};});});
 app.post('/api/permit',async req=>{const who=await identity(req);const v=z.object({lease_id:z.uuid(),region:z.string(),attempt_id:z.uuid().optional(),position:z.object({x:z.number().finite(),y:z.number().finite()}).optional()}).strict().parse(req.body);return transaction(pool,async c=>{
 const s=await state(c,who,true);await lease(c,s,who,v.lease_id);const field=fieldRegionInfo(v.region);if(field?.qa&&!options.fieldQa)fail('REGION','请选择野外区域。');const region=regions.find(r=>r.id===v.region)??(field?regionById(v.region):undefined);if(!region||region.id==='town'||region.id===starseaHub)fail('REGION','请选择野外区域。');const starsea=isStarseaRegion(region.id)||Boolean(field);
 if(starsea){if(!s.starsea||!starseaRegionOpen(s.starsea,field?.island??region.id))fail('LOCKED','航图上还没有这条航线。');}
 else if(options.dungeons!==false&&region.boss)fail('DUNGEON_ENTRY','请从副本列表创建本场挑战。');if(options.dungeons!==false&&(await c.query('SELECT 1 FROM ow_dungeon_members WHERE character=$1 AND active',[s.id])).rowCount)fail('DUNGEON_ACTIVE','请先结束当前副本参与。');const parent=region.id.replace('-boss','');if(!starsea&&!s.progress.regions.includes(parent))fail('LOCKED','请先击败前一区域首领。');if(!starsea&&region.boss){const access=resolveBossAccess(s.progress)[region.id];if(!access?.eligible)fail('LOCKED',access?.message??'首领试炼尚未解锁。');}
 const previous=(await c.query('SELECT * FROM ow_permits WHERE character=$1 AND region=$2 ORDER BY cycle DESC LIMIT 1',[s.id,region.id])).rows[0];let row=previous;const completed=row?(await c.query('SELECT count(*)::integer n FROM ow_kills WHERE character=$1 AND source=ANY($2::text[])',[s.id,row.data.spawns.map((m:Spawn)=>m.id)])).rows[0].n:0;const refreshReady=row&&completed===row.data.spawns.length&&(Date.now()-new Date(row.created).getTime())>=settings.refreshSeconds*1000;
 // Field regions refresh per camp cycle (/api/field/camps); an entry never resets them.
 const newAttempt=!field&&Boolean(v.attempt_id&&row?.private_data.attempt_id!==v.attempt_id&&(region.boss||refreshReady));
 if(newAttempt||!row||row.data.rules!==versions.rules){
  // Rule upgrades continue the same enemy instances. Only an explicit entry may reset a cleared area.
  const continuing=Boolean(row&&!newAttempt),cycle=(row?.cycle??0)+1,id=randomUUID();const fieldSpawns=field?[]:starsea&&s.starsea?.hardmode?starseaSpawns(starseaMap(region.id),true):region.spawns;
  const spawns=continuing?row.data.spawns:[...fieldSpawns.map(m=>({...m,id:`${region.id}:${cycle}:${m.id}`})),...starseaPendingWave(s,region.id)];const permit:Permit={id,region:region.id,cycle,build:s.build,rules:versions.rules,expires_at:new Date(Date.now()+settings.permitSeconds*1000).toISOString(),spawns,completed:[],seed:continuing?row.data.seed:randomInt(1,100000),from_tick:0,sequence:0};
  const battleResult=continuing?(row.private_data.battleResult??newBattleRecord(completed===0)):newBattleRecord();
  row=(await c.query('INSERT INTO ow_permits(id,character,region,cycle,build,created,expires,data,private_data) VALUES($1,$2,$3,$4,$5,now(),$6,$7,$8) RETURNING *',[id,s.id,region.id,cycle,s.build,permit.expires_at,permit,{economy,itemRules:freezeItemRules(),gearBases:worldGearBases,collectionDrops:equipmentDropRules,skillBookRewards,dropProfile:dropProfileFor(region.id),progressionRewards:progressionConfig.rewards,craftingLoot:freezeCraftingLoot(),battleResult,priorKills:continuing?completed:0,attempt_id:v.attempt_id,replayPilot:row?.private_data.replayPilot,fieldLootRules:field?freezeFieldGuarantees():undefined,delivery:region.boss?'inventory':'ground'}])).rows[0];
 }else{
  if(new Date(row.expires).getTime()-Date.now()<30000){row.data.expires_at=new Date(Date.now()+settings.permitSeconds*1000).toISOString();await c.query('UPDATE ow_permits SET expires=$1,data=$2 WHERE id=$3',[row.data.expires_at,row.data,row.id]);}
  if(row.build!==s.build){await c.query('UPDATE ow_permits SET build=$1 WHERE id=$2',[s.build,row.id]);row.build=s.build;}
 }
 beginFieldReplay(row.private_data,region.id,v.attempt_id);
 if(v.position){if(!walkable(region,v.position))fail('POSITION','当前位置不可通行。');row.private_data.lastPosition=v.position;}
 await c.query('UPDATE ow_permits SET data=$1,private_data=$2 WHERE id=$3',[row.data,row.private_data,row.id]);
 const done=await c.query('SELECT source FROM ow_kills WHERE character=$1 AND source=ANY($2::text[])',[s.id,row.data.spawns.map((m:Spawn)=>m.id)]);
 // Old characters on a zoned map: reached landing/boss waypoints, unwalkable saved spot.
 if(field){migrateFieldEntry(s,region.id);if(!s.field||s.field.region!==region.id||v.attempt_id&&v.attempt_id!==s.field.entry)s.field={region:region.id,entry:v.attempt_id,gathered:[]};}
 rememberRegion(s,region.id);await save(c,s);
 // 旧一轮引擎守护撤离的袭击者仍留在授权里（只用于校验），不再发给客户端显示。
 const live=new Set(starseaPendingWave(s,region.id).map(m=>m.id)),phaseCamps=new Set([...resolveWorldPhase(s).camps,...resolveWorldPhase(s).patrols]);
 return {...row.data,spawns:row.data.spawns.filter((m:Spawn)=>(!campSource(m.id)||phaseCamps.has(campSource(m.id)!.camp))&&(!(/^(q:|gate:)/.test(m.id))||live.has(m.id))),build:row.build,sequence:row.sequence,from_tick:row.tick,completed:done.rows.map(r=>r.source)};
 });});
 app.post('/api/combat/report',async req=>{const who=await identity(req),v=reportSchema.parse(req.body);return write(who,v,v,async(c,s)=>{
 if(options.dungeons!==false&&(await c.query('SELECT 1 FROM ow_dungeon_members WHERE character=$1 AND active',[s.id])).rowCount)fail('DUNGEON_ACTIVE','你正在副本中，结束副本后再进行这项操作。');
 const row=(await c.query('SELECT * FROM ow_permits WHERE id=$1 AND character=$2 FOR UPDATE',[v.permit_id,s.id])).rows[0];if(!row)fail('PERMIT','战斗授权不存在。');
 if(row.data.rules!==versions.rules)fail('RULESET','战斗规则已更新，请重新出发。');if(new Date(row.expires).getTime()+30000<Date.now())fail('EXPIRED','战斗授权已过期，请恢复连接。');if(row.build!==v.build)fail('BUILD','技能和装备变了，请重新准备出发。');
 if(v.sequence!==row.sequence+1||v.from_tick!==row.tick||v.to_tick<v.from_tick)fail('SEQUENCE','战斗报告顺序不正确。');
 const elapsed=(Date.now()-new Date(row.created).getTime())/1000;
 if(v.to_tick>Math.ceil((elapsed+3)*30))fail('RATE','战斗推进速度异常，请恢复连接。');
 if(new Set(v.kills.map(k=>k.source_id)).size!==v.kills.length)fail('DUPLICATE','报告包含重复击杀。');
 const spawns:Spawn[]=row.data.spawns;
 const known=new Map(spawns.map(m=>[m.id,m]));for(const k of v.kills){if(/^(q:|gate:)/.test(k.source_id)&&!s.starsea?.wave?.spawns.some(m=>m.id===k.source_id))fail('QUEST_WAVE_EXPIRED','这组任务敌人已经撤离。');if(!known.has(k.source_id)||k.tick<v.from_tick||k.tick>v.to_tick)fail('SOURCE','击杀不属于当前战斗范围。');}
 const wave=s.starsea?.wave;if(wave&&wave.region===row.region){const left=wave.spawns.filter(m=>!wave.killed.includes(m.id)).map(m=>m.id);if(left.length&&left.every(id=>v.kills.some(k=>k.source_id===id))&&!starseaClearPlausible(wave,Date.now()))fail('RATE','清场速度和当前技能装备对不上，请恢复连接。');}
 const count=(await c.query('SELECT count(*)::integer n FROM ow_kills WHERE character=$1 AND source=ANY($2::text[])',[s.id,spawns.map(m=>m.id)])).rows[0].n;
 if(count-(row.private_data.priorKills??0)+v.kills.length>Math.ceil(elapsed*numericRateLimits.killsPerSecond)+2)fail('RATE','收益超过当前战斗时间允许范围。');
 const rewardRules=row.private_data.economy,frozenTemplates=row.private_data.gearBases;if(!rewardRules||!frozenTemplates)fail('EXPIRED','这次战斗授权需要更新。');const templates=worldGearTemplates<typeof gearBases[number]>(frozenTemplates);if(!templates.length)fail('EXPIRED','这次战斗授权需要更新。');const delta:Receipt['delta']={gold:0,xp:0,material:0},rewards:Reward[]=[];
 const record:BattleRecord=row.private_data.battleResult??newBattleRecord(count===0);
 for(const k of v.kills){const m=known.get(k.source_id)!;const inserted=await c.query('INSERT INTO ow_kills(character,source,killed_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING source',[s.id,k.source_id,new Date(Date.now())]);if(!inserted.rowCount)fail('DUPLICATE','这次击杀已经结算。');
 const rank=m.monster?.rank??(m.boss?'boss':m.elite?'elite':'normal'),base=isStarseaRegion(economyRegionOf(row.region))&&m.monster?starseaKillReward(m.monster.level,rank,s.level,row.region,s.starsea?.hardmode):rewardFor(row.region,rank,rewardRules),tier=await campTier(c,s.id,k.source_id),gain=tier===1?base:{...base,...tierReward(tier,base)};gain.gold=Math.round(gain.gold*(1+craftBuffValue(s,'gold')));delta.gold+=gain.gold;delta.xp+=gain.xp;delta.material+=gain.material;s.progress.kills++;
 // Bounties count server-confirmed camp kills only, inside this kill transaction.
 if(s.starsea)countBountyKill(s.starsea,{source:k.source_id,template:m.monster?.template,elite:m.elite,xp:gain.xp});
 if(!row.private_data.progressionRewards)fail('EXPIRED','养成掉落规则已更新，请重新出发。');
 const crafting=awardCraftingLoot(s,{region:row.region,kind:rank==='rare'?'rare':m.boss?'boss':m.elite?'elite':'normal',dungeon:Boolean(s.dungeon?.instance),tide:isTideNightSpawn(s,k.source_id),worldTier:tier},row.private_data.craftingLoot);
 delta.materials??={};for(const[id,amount]of Object.entries(crafting.materials))delta.materials[id]=(delta.materials[id]??0)+amount;
 if(crafting.recipes.length)(delta.recipes??=[]).push(...crafting.recipes);
 const growth=awardProgression(s,{region:row.region,boss:m.boss,elite:m.elite,source:'world',sourceId:k.source_id,level:s.level},row.private_data.progressionRewards);
 delta.progression??={materials:{},reputation:{}};
 for(const [id,amount] of Object.entries(growth.materials))delta.progression.materials[id]=(delta.progression.materials[id]??0)+amount;
 for(const [id,amount] of Object.entries(growth.reputation))delta.progression.reputation[id]=(delta.progression.reputation[id]??0)+amount;
 awardSeasonXp(s,m.boss?challengeContent.season.bossXp:challengeContent.season.killXp);
 if(!regionById(row.region).boss){s.progress.regionKills??={};s.progress.regionElites??={};s.progress.regionKills[row.region]=(s.progress.regionKills[row.region]??0)+1;if(m.elite)s.progress.regionElites[row.region]=(s.progress.regionElites[row.region]??0)+1;}
 // Private RNG; neither this roll nor unrevealed reward candidates are shipped to Web.
 const dropProfile=row.private_data.dropProfile;if(!dropProfile)fail('EXPIRED','掉落规则已更新，请重新出发。');
 const rolled=rollGearDrop(m,dropProfile,m.boss&&!s.progress.bosses.includes(row.region),undefined,worldTier(tier).reward.gear);
 // 星潮夜入侵怪：必掉稀有及以上。
 const quality=isTideNightSpawn(s,k.source_id)&&rolled!=='legendary'?'rare':rolled;
 const qualities=isTideNightSpawn(s,k.source_id)?[quality!]:fieldRegionInfo(row.region)&&row.private_data.fieldLootRules?guaranteedFieldQualities(rank,row.private_data.fieldLootRules)??(quality?[quality]:[]):quality?[quality]:[];
 for(const [gearIndex,quality]of qualities.entries()){
  const sea=isStarseaRegion(economyRegionOf(row.region)),picked=pickRegionalGearTemplate(templates,row.region,row.private_data.collectionDrops??equipmentDropRules),template=sea?picked:scaleWorldGear(picked,dropProfile);
  const gear:Gear=instantiateGearTemplate(template,randomUUID(),quality,[]);gear.origin={kind:'random'};
  // 星潮海：物品等级 = 怪物等级，阶段与主属性由物品等级决定。
  if(sea)applyItemPower(gear,m.monster?.level??s.level);
  issueCombatGear(gear,gear.ilvl??m.monster?.level??1,dropProfile.maxAffixTier,s.level,row.region==='dragonbone-boss',row.private_data.itemRules);
  const reward:Reward={id:randomUUID(),source_id:gearIndex===0?k.source_id:k.source_id+':gear:'+gearIndex,region:row.region,position:{x:m.x,y:m.y},gear};
  const direct=row.private_data.delivery==='inventory';
  if(direct)s.gear.push(gear);
  await c.query('INSERT INTO ow_rewards(id,character,source,data,claimed) VALUES($1,$2,$3,$4,$5)',[reward.id,s.id,reward.source_id,reward,direct]);rewards.push(reward);record.gear.push(structuredClone(gear));
 }
 if(m.boss&&!s.progress.bosses.includes(row.region)){
 record.firstClear=true;
 for(const book of (row.private_data.skillBookRewards??[]) as typeof skillBookRewards)if(book.boss===row.region){s.skillBooks??={};s.skillBooks[book.skill]=(s.skillBooks[book.skill]??0)+book.quantity;delta.books??={};delta.books[book.skill]=(delta.books[book.skill]??0)+book.quantity;}
 s.progress.bosses.push(row.region);const next=isStarseaRegion(row.region)?undefined:regionById(row.region.replace('-boss','')).next;if(next&&!s.progress.regions.includes(next)){s.progress.regions.push(next);record.unlocked.push(next);}}
 }
 const questCompletions:QuestCompletion[]=[];let invaded=false;
 for(const k of v.kills){const m=known.get(k.source_id)!;const story=recordStarseaKill(s,row.region,k.source_id,m.boss,row.private_data.fieldObserver??row.private_data.lastPosition,{x:m.x,y:m.y});if(m.boss&&m.monster)recordHardmodeBoss(s,row.region,m.monster.level);delta.xp+=story.xp;delta.gold+=story.gold;questCompletions.push(...story.completed);
  // 星潮夜入侵怪追加进本次授权，后续击杀照常校验。
  if(story.spawns?.length){const ids=new Set(spawns.map(x=>x.id));spawns.push(...story.spawns.filter(x=>!ids.has(x.id)));invaded=true;}}
 if(fieldRegionInfo(row.region))await markClearedCamps(c,s.id,row.region,v.kills.map(k=>k.source_id));
 accumulateBattle(record,delta);row.private_data.battleResult=record;
 if(v.position){if(!walkable(regionById(row.region),v.position))fail('POSITION','当前位置不可通行。');row.private_data.lastPosition=v.position;}
 const respawns:Spawn[]=[];
 s.gold+=delta.gold;s.material+=delta.material;applyXp(s,delta.xp);await c.query('UPDATE ow_permits SET sequence=$1,tick=$2,private_data=$4'+(invaded?',data=$5':'')+' WHERE id=$3',[v.sequence,v.to_tick,row.id,row.private_data,...(invaded?[row.data]:[])]);return {delta,rewards,spawns:respawns,questCompletions};
 });});
 app.get('/api/receipt/:id',async req=>{const who=await identity(req),s=await state(pool,who);const id=z.uuid().parse((req.params as any).id);const row=await pool.query('SELECT receipt FROM ow_receipts WHERE character=$1 AND command=$2',[s.id,id]);if(!row.rowCount)fail('NOT_FOUND','该操作尚未确认。',404);return row.rows[0].receipt;});
 app.post('/api/reward/claim',async req=>{const who=await identity(req),v=command.extend({reward_id:z.uuid()}).strict().parse(req.body);return write(who,v,v,async(c,s)=>{
 const r=(await c.query('SELECT * FROM ow_rewards WHERE id=$1 AND character=$2 FOR UPDATE',[v.reward_id,s.id])).rows[0];if(!r||r.claimed)fail('REWARD','战利品已领取或不存在。');if(s.gear.length>=settings.capacity)fail('CAPACITY','背包满了，整理后再领取。');assignGearAspect(r.data.gear,0);s.gear.push(r.data.gear);await c.query('UPDATE ow_rewards SET claimed=true,data=$2 WHERE id=$1',[v.reward_id,r.data]);return {};
 });});
 /** Upgrade and reroll only at the port workshop (2026-10-11, docs/forge-workshop.md): body carries where the hero stands, checked against forge landmarks like the bounty board. */
 const gearSchema=command.extend({gear_id:z.uuid(),region:z.string().min(1).max(120).optional(),position:z.object({x:z.number().finite(),y:z.number().finite()}).strict().optional()}).strict(),forgeReach=5;
 const atForge=(s:CharacterState,v:{region?:string;position?:{x:number;y:number}})=>{if(s.dungeon?.instance||s.dungeon?.pendingResult||!v.region||!v.position)return false;let r;try{r=regionById(v.region);}catch{return false;}return (r.landmarks??[]).some(l=>l.kind==='forge'&&Math.hypot(l.x-v.position!.x,l.y-v.position!.y)<=forgeReach);};
 const forgePlace='请到拾星港工坊进行强化和重铸。',rerollLevel=()=>'重铸需要角色等级 '+inscriptionConfig.reroll.level+'。';
 const rerollSchema=gearSchema.extend({affix_slot:z.number().int().nonnegative().max(8).optional()}).strict();
 app.post('/api/reward/claim-many',async req=>{const who=await identity(req),v=claimRewardsSchema.parse(req.body);return write(who,v,v,async(c,s)=>{
  const ids=[...new Set(v.reward_ids)],rows=(await c.query('SELECT * FROM ow_rewards WHERE id=ANY($1::uuid[]) AND character=$2 FOR UPDATE',[ids,s.id])).rows;
  if(rows.length!==ids.length)fail('REWARD','部分战利品不存在或不属于当前角色。');
  const pending=ids.map(id=>rows.find(r=>r.id===id)!).filter(r=>!r.claimed),space=Math.max(0,settings.capacity-s.gear.length);
  if(pending.length&&!space)fail('CAPACITY','背包满了，战利品留在地上和待领取里。');
  for(const row of pending.slice(0,space)){assignGearAspect(row.data.gear,0);s.gear.push(row.data.gear);await c.query('UPDATE ow_rewards SET claimed=true,data=$2 WHERE id=$1',[row.id,row.data]);}
  return {};
 });});
 app.get('/api/gear/salvage-batch/preview',async req=>{const s=await state(pool,await identity(req)),gear=batchSalvageCandidates(s);return {revision:s.revision,gear,material:gear.length*economy.salvageMaterial,protectedCount:s.gear.length-gear.length};});
 app.post('/api/gear/salvage-batch',async req=>{const who=await identity(req),v=command.extend({gear_ids:z.array(z.uuid()).min(1).max(200)}).strict().parse(req.body);
 return write(who,v,{...v,operation:'gear.salvage-batch'},async(c,s)=>{
  if(new Set(v.gear_ids).size!==v.gear_ids.length)fail('INPUT','请勿重复选择装备。',400);
  const gear=v.gear_ids.map(id=>s.gear.find(g=>g.id===id));
  if(gear.some(g=>!g))fail('GEAR','装备已变化，请重新查看分解清单。');
  if(gear.some(g=>batchSalvageProtected(s,g!)))fail('PROTECTED','清单包含已装备、锁定、强化、传奇、威能或武器盘装备，请重新预览。');
  const patterns=gear.flatMap(item=>learnCraftPattern(s,item!));for(const item of gear)collectRubbing(s,item!);const removed=new Set(v.gear_ids),material=removed.size*economy.salvageMaterial;s.gear=s.gear.filter(g=>!removed.has(g.id));s.material+=material;
  return {delta:{gold:0,xp:0,material,...(patterns.length?{patterns}:{})}};
 });});
 app.post('/api/gear/:action',async req=>{const who=await identity(req),v=rerollSchema.parse(req.body),action=(req.params as any).action;if(!['equip','unequip','lock','salvage','upgrade','reroll'].includes(action))fail('INPUT','未知装备操作。',400);
 if(action!=='reroll'&&v.affix_slot!==undefined)fail('INPUT','只有重铸可指定词缀槽。',400);return write(who,v,{...v,action},async(c,s)=>{const g=s.gear.find(g=>g.id===v.gear_id);if(!g)fail('GEAR','装备不存在。');const worn=Object.values(s.equipment).includes(g.id);const delta:Receipt['delta']={gold:0,xp:0,material:0};
 if(action==='equip'){if(s.level<(g.requiredLevel??1))fail('GEAR_LEVEL','需要角色等级 '+g.requiredLevel+' 才能穿戴。');if(g.slot==='weapon'){const p=ensureProgression(s);for(let i=1;i<p.weaponGrid.length;i++)if(p.weaponGrid[i]===g.id)p.weaponGrid[i]=null;}if(g.slot==='weapon')changeMainHand(s,g.id);else s.equipment[g.slot]=g.id;ensureProgression(s);s.build++;}
 if(action==='unequip'){if(worn){if(g.slot==='weapon')changeMainHand(s,undefined);else delete s.equipment[g.slot];ensureProgression(s);s.build++;}}
 if(action==='lock')g.locked=!g.locked;
 if(action==='salvage'){if(g.locked||worn||isProgressionGearReferenced(s,g.id))fail('PROTECTED','请先解除锁定、卸下装备并从武器盘移除。');delta.patterns=learnCraftPattern(s,g);collectRubbing(s,g);s.gear=s.gear.filter(v=>v.id!==g.id);s.material+=economy.salvageMaterial;delta.material=economy.salvageMaterial;}
 if(action==='upgrade'){if(!storyFeatureUnlocked(s,'forge'))fail('STORY_LOCKED',storyFeatureReason(s,'forge'));if(!atForge(s,v))fail('FORGE_PLACE',forgePlace);if(g.rank>=gearMaxRank(g,5))fail('MAX_RANK','已达到本品质强化上限。');const cost=gearUpgradeCost(g,upgradeCost);if(s.gold<cost.gold||s.material<cost.material)fail('COST','金币或强化石不足。');s.gold-=cost.gold;s.material-=cost.material;delta.gold=-cost.gold;delta.material=-cost.material;g.rank++;reinforceAffixNode(g);s.build++;}
 if(action==='reroll'){
  if(!storyFeatureUnlocked(s,'forge'))fail('STORY_LOCKED',storyFeatureReason(s,'forge'));if(!atForge(s,v))fail('FORGE_PLACE',forgePlace);if(s.level<inscriptionConfig.reroll.level)fail('REFORGE_LEVEL',rerollLevel());
  const cost={gold:inscriptionConfig.reroll.gold,material:inscriptionConfig.reroll.material};
  if(s.gold<cost.gold||s.material<cost.material)fail('COST','金币或材料不足。');
  s.gold-=cost.gold;s.material-=cost.material;delta.gold=-cost.gold;delta.material=-cost.material;
  const slot=v.affix_slot??g.rerollSlot;if(slot===undefined)fail('REFORGE_SLOT','请先选择一条要反复重铸的副属性。');try{Object.assign(g,rerollSingleAffix(g,slot));}catch(e){fail('REFORGE_SLOT',e instanceof Error?e.message:'重铸槽无效。');}
  s.build++;
 }
 return {delta};
 });});
 app.get('/api/gear/:id/tip',async req=>{
  const who=await identity(req),s=await state(pool,who),id=z.uuid().parse((req.params as {id:string}).id),gear=s.gear.find(g=>g.id===id);if(!gear)fail('GEAR','装备不在你的行囊中。',404);
  const replaces=s.gear.find(g=>g.id===s.equipment[gear.slot])??null,next=structuredClone(s);next.equipment[gear.slot]=gear.id;
  const current=resolveBuild(s).stats,equipped=resolveBuild(next).stats;
  const currentSets=getEquippedSets(s.gear.filter(g=>Object.values(s.equipment).includes(g.id)));
  const equippedSets=getEquippedSets(s.gear.filter(g=>Object.values(next.equipment).includes(g.id)));
  const inscription_info=gear.inscription?{name:effectAtomById.get(gear.inscription.atomId)!.name,description:scaledDescription(effectAtomById.get(gear.inscription.atomId)!,resolveAtomParts([{id:gear.inscription.atomId,tier:gear.inscription.tier,source:gear.id}])[0])}:undefined;
  return {gear,verdict:compareVerdict(current,equipped),...(inscription_info?{inscription_info}:{}),reforge:(()=>{const reason=!gear.affixes.length?'本件还没有可重铸的副属性':!storyFeatureUnlocked(s,'forge')?storyFeatureReason(s,'forge'):s.level<inscriptionConfig.reroll.level?rerollLevel():'';return {gold:inscriptionConfig.reroll.gold,material:inscriptionConfig.reroll.material,level:inscriptionConfig.reroll.level,slot:gear.rerollSlot,allowed:!reason,reason};})(),primary_attribute:gearPrimaryAttribute(gear),revision:s.revision,ruleset_version:versions.rules,equipped:replaces?.id===gear.id,max_rank:gearMaxRank(gear,5),attributes:gearContribution(gear),effect_description:effectText[gear.effect],replaces,comparison:compareResolvedStats(current,equipped,gear.mainStat?[gear.mainStat.stat]:[]),currentSets,equippedSets};
 });
 app.get('/api/gear/:id/preview',async req=>{const who=await identity(req),s=await state(pool,who),id=z.uuid().parse((req.params as any).id),g=s.gear.find(g=>g.id===id);if(!g)fail('GEAR','装备不存在。');const equipped=structuredClone(s);equipped.equipment[g.slot]=g.id;const upgraded=structuredClone(s);const next=upgraded.gear.find(v=>v.id===id)!;if(next.rank<gearMaxRank(next,5))next.rank++;
 const worn=Object.values(s.equipment).includes(g.id),blocked=g.locked?'locked':worn?'equipped':isProgressionGearReferenced(s,g.id)?'grid':'';
 const currentBuild=resolveBuild(s),equippedBuild=resolveBuild(equipped);
 return {gear_id:g.id,revision:s.revision,ruleset_version:versions.rules,verdict:compareVerdict(currentBuild.stats,equippedBuild.stats),equipBlock:s.level<(g.requiredLevel??1)?'需要角色等级 '+g.requiredLevel+' 才能穿戴。':'',cost:gearUpgradeCost(g,upgradeCost),upgradeBlock:storyFeatureUnlocked(s,'forge')?'':storyFeatureReason(s,'forge'),current:currentBuild,equipped:equippedBuild,upgraded:resolveBuild(upgraded),max:g.rank>=gearMaxRank(g,5),salvage:{gear_id:g.id,material:economy.salvageMaterial,allowed:blocked==='',blocked}};});
 app.get('/api/skills/preview',async req=>{const who=await identity(req),s=await state(pool,who);return {revision:s.revision,ruleset_version:versions.rules,skills:resolveSkillAccess(s)};});
 app.post('/api/skills',async req=>{const who=await identity(req),v=command.extend({skills:z.array(z.string()).min(1).max(4)}).strict().parse(req.body);return write(who,v,{...v,action:'save-skills'},async(c,s)=>{
  if(new Set(v.skills).size!==v.skills.length||v.skills.some(id=>!skillCatalog.some(sk=>sk.id===id)))fail('SKILL','请选择一至四个不同的有效技能。');
  if(v.skills.length>skillSlotCount(s))fail('SKILL_SLOTS',`现在只有${skillSlotCount(s)}个技能位。`);
  // 起手里封存的招牌技可以留在技能栏占位（灰色、待找回），不进战斗。
  if(v.skills.some(id=>!skillUnlocked(s,id)&&!(signatureSealed(s,id)&&s.skillRanks[id]>0)))fail('SKILL_INACTIVE','请先激活技能，再保存装配。');
  if(v.skills.some(id=>!skillWeaponAllowed(s,id)))fail('SKILL_WEAPON',skillWeaponRequirement(v.skills.find(id=>!skillWeaponAllowed(s,id))!));
  s.skills=v.skills;rememberWeaponSkills(s);s.build++;return {};
 });});
 const skillCommand=command.extend({skill_id:z.string()}).strict();
 app.post('/api/skills/activate',async req=>{const who=await identity(req),v=skillCommand.parse(req.body);return write(who,v,{...v,action:'activate'},async(c,s)=>{
  const quote=resolveSkillAccess(s).find(sk=>sk.id===v.skill_id);if(!quote)fail('SKILL','技能不存在。');
  if(quote.activated)fail('ALREADY_ACTIVE','该技能已经激活。');
  const condition=quote.activation;
  if(!quote.eligible)fail(condition.type==='level'||condition.type==='island'&&condition.current<condition.required?'SKILL_LEVEL':condition.type==='book'?'SKILL_BOOK':condition.type==='recovery'?'SKILL_RECOVERY':'SKILL_ISLAND',condition.type==='level'||condition.type==='island'&&condition.current<condition.required?`角色需达到${condition.required}级。`:condition.type==='book'?`缺少${condition.name}，还需${condition.required-condition.current}本。`:condition.type==='recovery'?`完成「${condition.name}」后找回。`:`到过${condition.type==='island'?condition.islandName:''}后才能学。`);
  const delta:Receipt['delta']={gold:0,xp:0,material:0};
  if(condition.type==='book'){s.skillBooks??={};s.skillBooks[condition.book]=condition.current-condition.required;delta.books={[condition.book]:-condition.required};}
  s.skillRanks[v.skill_id]=1;s.build++;return {delta};
 });});
 app.post('/api/skills/upgrade',async req=>{const who=await identity(req),v=skillCommand.parse(req.body);return write(who,v,{...v,action:'upgrade'},async(c,s)=>{
  const quote=resolveSkillAccess(s).find(sk=>sk.id===v.skill_id);if(!quote)fail('SKILL','技能不存在。');
  if(!quote.activated)fail('SKILL_INACTIVE','请先激活技能，再升级。');
  if(quote.max)fail('MAX_RANK','技能已达上限。');if(!quote.affordable)fail('COST','金币不足。');
  const cost=quote.cost!;s.gold-=cost.gold;s.material-=cost.material;s.skillRanks[v.skill_id]=quote.rank+1;s.build++;
  return {delta:{gold:-cost.gold,xp:0,material:-cost.material}};
 });});
 app.post('/api/task/claim',async req=>{const who=await identity(req),v=command.extend({task:z.string().min(1).max(80)}).strict().parse(req.body);return write(who,v,v,async(_c,s)=>{if(s.progress.tasks.includes(v.task))fail('CLAIMED','任务奖励已经领取。');const record=claimTask(s,v.task,v.command_id,new Date().toISOString());if(!record)fail('TASK','任务不存在或尚未完成目标。');return {delta:record.reward!};});});
 app.post('/api/quest',async req=>{const who=await identity(req),v=command.extend({op:starseaQuestOpSchema,region:z.string().min(1).max(100),task:z.string().min(1).max(120).nullable().optional(),gate:z.string().min(1).max(120).optional(),retry:z.boolean().optional(),position:z.object({x:z.number().finite(),y:z.number().finite()}).optional(),target:z.string().min(1).max(120).optional(),choice:z.enum(['a','b']).optional()}).strict().parse(req.body);return write(who,v,{...v,operation:'starsea.quest'},async(c,s)=>{
  // 战斗步骤把任务波次追加进当前区域最新的野外授权，击杀仍由 /combat/report 校验。
  const row=['start','gate','interact','defense-finish'].includes(v.op)?(await c.query('SELECT * FROM ow_permits WHERE character=$1 AND region=$2 ORDER BY cycle DESC LIMIT 1 FOR UPDATE',[s.id,v.region])).rows[0]:undefined;
  if(v.op==='start'&&(!row||new Date(row.expires).getTime()<Date.now()))fail('PERMIT','请重新进入该区域后再开始战斗。');
  if(v.op==='waypoint'&&!v.position)fail('QUEST_DISTANCE','请走到航标旁再激活。');
  const target=questTarget(s,v.op,v);if(target&&v.position){if(!walkable(regionById(v.region),v.position)||Math.hypot(target.x-v.position.x,target.y-v.position.y)>4.5)fail('QUEST_DISTANCE','请走到目标身边再操作。');}
  const result=applyStarseaOp(s,v.op,{region:v.region,task:v.task,gate:v.gate,target:v.target,position:v.position,retry:v.retry,choice:v.choice,now:Date.now()});
  // 新波次开打时按当前构筑离线估一次最快清场时间，之后只在清场时抽查，不跟随实时战斗。
  const fresh=s.starsea?.wave;if(fresh&&fresh.startedAt!==undefined&&fresh.minClearMs===undefined&&fresh.spawns.length)fresh.minClearMs=minimumClearMs(s,fresh.region,{x:fresh.spawns[0].x,y:fresh.spawns[0].y},fresh.spawns);
  if(result.spawns.length&&(!row||new Date(row.expires).getTime()<Date.now()))fail('PERMIT','请重新进入该区域后启动。');
  if(row&&result.spawns.length){const known=new Set(row.data.spawns.map((m:Spawn)=>m.id));const added=result.spawns.filter(m=>!known.has(m.id));if(added.length){row.data.spawns.push(...added);await c.query('UPDATE ow_permits SET data=$1 WHERE id=$2',[row.data,row.id]);}}
  const delta:Receipt['delta']={gold:result.gain.gold,xp:result.gain.xp,material:0};s.gold+=delta.gold;applyXp(s,delta.xp);return {delta,questCompletions:result.gain.completed};
 });});
 for(const action of ['store','withdraw'])app.post('/api/warehouse/'+action,async req=>{const who=await identity(req),v=command.extend({gear_id:z.uuid()}).strict().parse(req.body);return write(who,v,{...v,operation:'warehouse.'+action},async(c,s)=>{
  if(s.dungeon?.instance||s.dungeon?.pendingResult)fail('WAREHOUSE_LOCATION','请先结束副本并返回港口或前哨。');
  const region=regionById(resumeRegion(s));let available=region.id==='town'||region.id===starseaHub;
  if(!available){const row=(await c.query('SELECT private_data FROM ow_permits WHERE character=$1 AND region=$2 ORDER BY cycle DESC LIMIT 1',[s.id,region.id])).rows[0],p=row?.private_data.lastPosition;available=!!p&&region.landmarks.some(l=>l.kind==='safe'&&Math.hypot(l.x-p.x,l.y-p.y)<=3);}
  if(!available)fail('WAREHOUSE_LOCATION','请到港口或前哨仓库整理。');
  s.warehouse??=[];
  if(action==='store'){const gear=s.gear.find(g=>g.id===v.gear_id);if(!gear)fail('GEAR','这件装备不在背包中。');if(Object.values(s.equipment).includes(gear.id)||isProgressionGearReferenced(s,gear.id))fail('GEAR_IN_USE','请先卸下装备或从武器盘移除。');s.gear=s.gear.filter(g=>g.id!==gear.id);s.warehouse.push(gear);}
  else{const gear=s.warehouse.find(g=>g.id===v.gear_id);if(!gear)fail('GEAR','这件装备不在仓库中。');if(s.gear.length>=settings.capacity)fail('CAPACITY','背包满了，先存入或整理装备。');s.warehouse=s.warehouse.filter(g=>g.id!==gear.id);s.gear.push(withCurrentEquipmentNames(gear));}
  return {};
 });});
 app.post('/api/location',async req=>{const who=await identity(req),v=command.extend({region:z.string()}).strict().parse(req.body);return write(who,v,{...v,operation:'location'},async(c,s)=>{if(!regionUnlocked(s,v.region))fail('LOCKED','这张地图尚未解锁。');rememberRegion(s,v.region);return {};});});
 // 开场「坠星觉醒」：三选一定初始武器（只发一次），看完或跳过后标记完成；开场战斗本身不经服务端、不发奖励。
 app.post('/api/prologue',async req=>{const who=await identity(req),v=command.extend({weapon:z.enum(prologueFamilies).optional(),finish:z.boolean().default(false)}).strict().parse(req.body);if(!v.weapon&&!v.finish)fail('INPUT','请选择武器或结束开场。');return write(who,v,{...v,operation:'prologue'},async(_c,s)=>{if(v.weapon)choosePrologueWeapon(s,v.weapon);if(v.finish)finishPrologue(s);return {};});});
 // 本地验收检查点：只给 qa_ 开头的测试号、只在还没打开场的新角色上用，任务按正常完成流程走（packages/rules/dev-checkpoints.ts）。
 if(options.devCheckpoints)app.post('/api/dev/checkpoint',async req=>{const who=await identity(req),v=command.extend({checkpoint:z.enum(devCheckpointIds),weapon:z.enum(prologueFamilies)}).strict().parse(req.body);
  const username=String((await pool.query('SELECT username FROM ow_accounts WHERE id=$1',[who.account])).rows[0]?.username??'');if(!username.startsWith('qa_'))fail('DEV_CHECKPOINT','只有 qa_ 开头的测试号能跳检查点。',403);
  return write(who,v,{...v,operation:'dev.checkpoint'},async(_c,s)=>{const g=applyDevCheckpoint(s,v.checkpoint,v.weapon,Date.now());const delta:Receipt['delta']={gold:g.gold,xp:g.xp,material:0};s.gold+=delta.gold;applyXp(s,delta.xp);return {delta,questCompletions:g.completed};});});
 app.post('/api/safe',async req=>{const who=await identity(req),v=command.extend({region:z.string(),point:z.string()}).strict().parse(req.body);return write(who,v,v,async(c,s)=>{const sea=isStarseaRegion(v.region);if(sea?!s.starsea||!starseaRegionOpen(s.starsea,v.region):!s.progress.regions.includes(v.region))fail('LOCKED','据点尚未开放。');const r=regionById(v.region);if(!((r.id==='town'||sea)&&v.point==='')&&!r.landmarks.some(l=>l.kind==='safe'&&l.name===v.point))fail('SAFE','据点不存在。');s.progress.safe=v.region;if((r.id==='town'||sea)&&v.point==='')delete s.progress.safePoint;else s.progress.safePoint=v.point;return {};});});
 registerProgressionChallenges(app,{pool,identity,state,snapshot,write,fail,dungeonsEnabled:options.dungeons!==false});
 registerField(app,{write,pool,identity,state,lease,fail,transaction});
 registerFieldActivities(app,{write,pool,identity,state,lease,fail});
 registerStageKeyService(app,{pool,identity,state,fail,write});
 registerCrafting(app,{pool,identity,state,fail,write,atForge,forgeReason:forgePlace});
 if(options.dungeons!==false)registerDungeons(app,{pool,identity,state,snapshot,lease,fail,origins},options.dungeons);
 registerCombatReview(app,{pool,identity,state,fail});
 if(options.pacingLab)registerPacingLab(app,{pool,identity,state,fail},options.pacingLab);
 return app;
}

function collectRubbing(s:import('../../../packages/contracts/index.ts').CharacterState,g:import('../../../packages/contracts/index.ts').Gear){const rubbing=extractInscriptionRubbing(g);if(!rubbing)return;const entry=inscriptionRubbings.find(r=>r.slot===rubbing.slot&&r.atomId===rubbing.atomId)!;const p=ensureProgression(s);p.materials[entry.id]=(p.materials[entry.id]??0)+1;}
