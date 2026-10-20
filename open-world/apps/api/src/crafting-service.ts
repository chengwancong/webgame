import {craftText} from '../../../packages/content/crafting.ts';
import type {FastifyInstance} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import {craftActionRequestSchema,craftPreviewRequestSchema,craftPinRequestSchema,fieldGatherRequestSchema} from '../../../packages/contracts/crafting.ts';
import {gatherMaterial} from '../../../packages/rules/crafting-gather.ts';
import {pinCraftGoal} from '../../../packages/rules/craft-goal.ts';
import type {CharacterState,Receipt} from '../../../packages/contracts/index.ts';
import {applyCraft,previewCraft,craftingView,CraftError} from '../../../packages/rules/crafting.ts';
import {storyFeatureUnlocked,storyFeatureReason} from '../../../packages/rules/story-campaign.ts';
import {stageKeyProgress,stageKeyPools} from './stage-key-pools.ts';
import {dungeonContent} from '../../../packages/content/dungeons.ts';
import {starseaIslands,starseaBossMaps} from '../../../packages/content/starsea/index.ts';
import {starseaFactionById} from '../../../packages/content/starsea/reputation.ts';
type Identity={account:string;session:string;resume?:string};
type Context={pool:Pool;identity:(req:any)=>Promise<Identity>;state:(c:Pool|PoolClient,who:Identity)=>Promise<CharacterState>;fail:(code:string,message:string,status?:number)=>never;atForge:(s:CharacterState,v:{region?:string;position?:{x:number;y:number}})=>boolean;forgeReason:string;write:(who:Identity,input:{command_id:string;revision:number;lease_id:string},body:unknown,fn:(c:PoolClient,s:CharacterState)=>Promise<{delta?:Receipt['delta']}>)=>Promise<Receipt>};
export async function maxCraftLevel(db:Pool|PoolClient,s:CharacterState){
  const rows=(await db.query('SELECT dungeon FROM ow_dungeon_completions WHERE character=$1',[s.id])).rows,stages=rows.flatMap(row=>{const n=dungeonContent.definitions.find(d=>d.id===row.dungeon)?.numericStage;return n?[n]:[];});
  const actual=(await db.query("SELECT DISTINCT d.data->'definition'->>'numericStage' AS stage FROM ow_dungeon_awards a JOIN ow_dungeons d ON d.id=a.instance WHERE a.character=$1 AND a.source='result' AND d.status='success' AND EXISTS (SELECT 1 FROM jsonb_array_elements(d.data->'members') m WHERE m->>'id'=$2 AND (m->>'charged')::boolean)",[s.id,s.id])).rows;
  stages.push(...actual.map(row=>Number(row.stage)).filter(n=>Number.isInteger(n)&&n>=1&&n<=24));
  // 旧版首领通关是既有事实，只投影制作上限，不补造新地城历史。
  for(const [index,boss]of starseaBossMaps.entries()){
   const definitions=dungeonContent.definitions.filter(d=>d.area===starseaIslands[index]&&d.numericStage);
   if(s.starsea?.bosses.includes(boss))stages.push(...definitions.map(d=>d.numericStage!));
   if(s.world?.hardmodeBosses?.includes(boss))stages.push(...definitions.flatMap(d=>d.hardmode?[d.hardmode.numericStage]:[]));
  }
  if(!s.starsea)for(const boss of s.progress.bosses){const faction=starseaFactionById.get(boss.replace(/-boss$/,'')),island=faction?.maps.find(map=>starseaIslands.includes(map));if(island)stages.push(...dungeonContent.definitions.filter(d=>d.area===island&&d.numericStage).map(d=>d.numericStage!));}
  return Math.max(0,...stageKeyPools.filter(p=>stages.includes(p.stage)).map(p=>p.level));
 }
export function registerCrafting(app:FastifyInstance,ctx:Context){
 app.post('/api/field/gather',async req=>{const who=await ctx.identity(req),v=fieldGatherRequestSchema.parse(req.body);const receipt=await ctx.write(who,v,{...v,operation:'field.gather'},async(_c,s)=>{try{return {delta:{gold:0,xp:0,material:0,...gatherMaterial(s,v)}};}catch(e){if(e instanceof CraftError)ctx.fail(e.code,e.message);throw e;}});req.log.info({command_id:v.command_id,node:v.node,mode:v.mode},'采集命令已结算');return receipt;});
 const place=(s:CharacterState,v:{region?:string;position?:{x:number;y:number}})=>{const storyUnlocked=storyFeatureUnlocked(s,'forge'),atForge=storyUnlocked&&ctx.atForge(s,v);return {storyUnlocked,atForge,reason:!storyUnlocked?storyFeatureReason(s,'forge'):atForge?'':craftText.forge};};
 app.get('/api/crafting',async req=>{const s=await ctx.state(ctx.pool,await ctx.identity(req)),q=z.object({region:z.string().optional(),x:z.coerce.number().finite().optional(),y:z.coerce.number().finite().optional()}).strict().parse(req.query);return craftingView(s,place(s,{region:q.region,position:q.x!==undefined&&q.y!==undefined?{x:q.x,y:q.y}:undefined}),s.world?.activeKeyStage?stageKeyProgress(s,s.world.activeKeyStage,null,s.world.activeKeyTier):null);});
 app.post('/api/crafting/preview',async req=>{const s=await ctx.state(ctx.pool,await ctx.identity(req)),v=craftPreviewRequestSchema.parse(req.body);if(s.revision!==v.revision)ctx.fail('REVISION',craftText.revision);return previewCraft(s,v.action,{...place(s,v),maxCraftLevel:await maxCraftLevel(ctx.pool,s)});});
 // 钉选不改变构筑，操作名避开副本锁定的 crafting. 前缀：副本里也能改目标。
 app.post('/api/crafting/pin',async req=>{const who=await ctx.identity(req),v=craftPinRequestSchema.parse(req.body);return ctx.write(who,v,{...v,operation:'goal.pin'},async(_c,s)=>{try{pinCraftGoal(s,v.pin);return {delta:{gold:0,xp:0,material:0}};}catch(e){if(e instanceof CraftError)ctx.fail(e.code,e.message);throw e;}});});
 app.post('/api/crafting/action',async req=>{const who=await ctx.identity(req),v=craftActionRequestSchema.parse(req.body);return ctx.write(who,v,{...v,operation:'crafting.action'},async(c,s)=>{try{return {delta:{xp:0,material:0,...applyCraft(s,v.action,{...place(s,v),maxCraftLevel:await maxCraftLevel(c,s)})}};}catch(e){if(e instanceof CraftError)ctx.fail(e.code,e.message);throw e;}});});
}
