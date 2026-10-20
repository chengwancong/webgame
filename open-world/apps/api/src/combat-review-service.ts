import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {z} from 'zod';
import {combatFatalHitSchema,combatReviewSchema} from '../../../packages/contracts/combat-review.ts';
import type {CharacterState} from '../../../packages/contracts/index.ts';
import type {DamageType,StatusKind} from '../../../packages/contracts/skill-mechanics.ts';
import {damageTypeLabels,statusLabels} from '../../../packages/content/combat-hints.ts';
import {deathCause,selectCombatAdvice} from '../../../packages/rules/combat-advice.ts';
import {gapDiagnosis} from '../../../packages/rules/gap-diagnosis.ts';
import {maxCraftLevel} from './crafting-service.ts';

/** Island combat runs in the client executor. Its observed hit can request advice,
 * but cannot grant anything or choose its own recommended actions. */
export function registerCombatReview(app:FastifyInstance,ctx:{pool:Pool;identity:(request:any)=>Promise<any>;state:(pool:Pool,who:any)=>Promise<CharacterState>;fail:(code:string,message:string,status?:number)=>never}){
 const input=z.object({permit:z.uuid(),fatal:combatFatalHitSchema.nullable(),recent:z.array(z.string().min(1).max(60)).max(4)}).strict();
 app.post('/api/combat/review',async req=>{
  const who=await ctx.identity(req),s=await ctx.state(ctx.pool,who),v=input.parse(req.body);
  if(!(await ctx.pool.query('SELECT 1 FROM ow_permits WHERE id=$1 AND character=$2',[v.permit,s.id])).rowCount)ctx.fail('NOT_FOUND','找不到这场战斗。',404);
  const damageType=Object.entries(damageTypeLabels).find(([,label])=>label===v.fatal?.damageType)?.[0] as DamageType|undefined;
  const statuses=v.fatal?.statuses.flatMap(label=>Object.entries(statusLabels).filter(([,value])=>value===label).map(([kind])=>kind as StatusKind))??[];
  const advice=selectCombatAdvice(v.fatal?deathCause({kind:v.fatal.kind,damageType,statuses}):'unknown');
  const gap=gapDiagnosis(s,{damageType,maxCraftLevel:await maxCraftLevel(ctx.pool,s)});
  return combatReviewSchema.parse({fatal:v.fatal,recent:v.recent,advice,...(gap?{gap}:{})});
 });
}
