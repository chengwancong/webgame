import type {FastifyInstance} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {CharacterState,Receipt,Reward} from '../../../packages/contracts/index.ts';
import {starseaHub} from '../../../packages/content/starsea/index.ts';
import {storyFeatureUnlocked} from '../../../packages/rules/story-campaign.ts';
import {previewStageKey} from './stage-key-preview.ts';
import {stageKeyProgress,craftStageKey,StageKeyError} from './stage-key-pools.ts';
type Identity={account:string;session:string;resume?:string};
type Context={pool:Pool;identity:(req:any)=>Promise<Identity>;state:(c:Pool|PoolClient,who:Identity,lock?:boolean)=>Promise<CharacterState>;fail:(code:string,message:string,status?:number)=>never;write:(who:Identity,input:any,body:any,fn:(c:PoolClient,s:CharacterState)=>Promise<{delta?:Receipt['delta'];rewards?:Reward[]}> )=>Promise<Receipt>};
export async function storeKeyGear(c:PoolClient,s:CharacterState,items:CharacterState['gear'],source:string,region:string,position={x:0,y:0}){const rewards:Reward[]=[];for(const [i,gear]of items.entries()){const reward:Reward={id:randomUUID(),source_id:source+':key:'+i,region,position,gear};await c.query('INSERT INTO ow_rewards(id,character,source,data,claimed) VALUES($1,$2,$3,$4,true)',[reward.id,s.id,reward.source_id,reward]);rewards.push(reward);}return rewards;}
export function registerStageKeyService(app:FastifyInstance,ctx:Context){
 app.get('/api/stage-keys',async req=>{const s=await ctx.state(ctx.pool,await ctx.identity(req)),query=z.object({stage:z.coerce.number().int().min(1).max(24).optional()}).parse(req.query),stage=query.stage??s.world?.activeKeyStage;if(!stage)return {progress:null};return {progress:stageKeyProgress(s,stage,null,stage===s.world?.activeKeyStage?s.world?.activeKeyTier:0)};});
 app.post('/api/stage-keys/preview',async req=>{const s=await ctx.state(ctx.pool,await ctx.identity(req)),v=z.object({revision:z.number().int().nonnegative(),stage:z.number().int().min(1).max(24),key:z.string().min(1).max(120)}).strict().parse(req.body);if(v.revision!==s.revision)ctx.fail('REVISION','角色状态已更新，请重新预览。');try{return previewStageKey(s,v.stage,v.key,v.stage===s.world?.activeKeyStage?s.world?.activeKeyTier:0);}catch(error){ctx.fail('KEY_PREVIEW',error instanceof StageKeyError?error.message:'钥匙预览失败，请重试。');}});
 app.post('/api/stage-keys/craft',async req=>{const who=await ctx.identity(req),v=z.object({command_id:z.uuid(),revision:z.number().int().nonnegative(),lease_id:z.uuid(),stage:z.number().int().min(1).max(24),key:z.string().min(1).max(120)}).strict().parse(req.body);return ctx.write(who,v,{...v,operation:'deep-progression.stage-key'},async(c,s)=>{
  if(s.dungeon?.instance||s.dungeon?.pendingResult)ctx.fail('KEY_PLACE','请先返回港口再制作钥匙。');if(!storyFeatureUnlocked(s,'forge'))ctx.fail('STORY_LOCKED','请先开放锻造。');if(s.lastRegion!==starseaHub&&s.starsea?.location?.map!==starseaHub)ctx.fail('KEY_PLACE','请回港口锻造台制作钥匙。');let gain;try{gain=craftStageKey(s,v.stage,v.key,v.stage===s.world?.activeKeyStage?s.world?.activeKeyTier:0);}catch(error){ctx.fail('KEY_CRAFT',error instanceof StageKeyError?error.message:'钥匙制作失败，请重试。');}
  return {rewards:await storeKeyGear(c,s,gain.gear,'craft:'+v.command_id,starseaHub)};
 });});
}
