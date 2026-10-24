import {z} from 'zod';
import raw from './hub-endgame.json';
import {hubNodeById} from './hub-chart.ts';
import elite from './elite-affixes.json';
import challenges from './progression-challenges.json';
const id=z.string().min(1);
export const hubEndgameSchema=z.object({version:z.literal(1),reset:z.object({utcOffsetHours:z.literal(8),hour:z.literal(5),weekStart:z.literal('monday')}).strict(),daily:z.object({count:z.literal(6),requiredKinds:z.array(z.enum(['nest','hunt','tide','treasure'])).length(4),pool:z.array(id).length(36),firstClearSharesDailyLimit:z.literal(true)}).strict(),weekly:z.object({rewardLimit:z.literal(2),rotation:z.array(z.object({weekIndex:z.number().int().min(0).max(5),node:id,map:id,name:id}).strict()).length(6),deepAffixCount:z.literal(2),affixes:z.array(id).length(8)}).strict(),abyss:z.object({maxFloor:z.literal(100),timeLimitSeconds:z.literal(300),bossPool:z.array(z.object({id,map:id,name:id}).strict()).length(12),milestones:z.array(z.object({floor:z.number().int().multipleOf(10).min(10).max(100),components:z.array(z.enum(['legendaryEssence','goldMoon','chartShard'])).length(3),cosmeticRequired:z.literal(true).optional(),budgetStatus:z.literal('awaiting-M14-valuation')}).strict()).length(10)}).strict(),risks:z.array(z.object({id,source:z.enum(['elite','nightmare']),ref:id,name:id,rewardBonus:z.literal(.5),measured:z.boolean()}).strict()).length(14)}).strict().superRefine((v,c)=>{
 for(const n of v.daily.pool)if(!hubNodeById.has(n)||!v.daily.requiredKinds.includes(hubNodeById.get(n)!.kind as never))c.addIssue({code:'custom',message:'Invalid daily node '+n});
 for(const r of v.risks)if(r.source==='elite'?!Object.hasOwn(elite,r.ref):!challenges.affixes.some(a=>a.id===r.ref))c.addIssue({code:'custom',message:'Unknown risk '+r.ref});
 for(const xs of [v.daily.pool,v.abyss.bossPool.map(b=>b.id),v.risks.map(r=>r.id)])if(new Set(xs).size!==xs.length)c.addIssue({code:'custom',message:'Duplicate pool member'});
});
export const hubEndgame=hubEndgameSchema.parse(raw);
