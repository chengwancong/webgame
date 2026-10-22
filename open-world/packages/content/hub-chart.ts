import {z} from 'zod';
import raw from './hub-chart.json';
import {chartRegionIdSchema,nodeKindSchema} from '../contracts/hub.ts';
const id=z.string().min(1),nn=z.number().int().nonnegative();
export const hubNodeDefinitionSchema=z.object({_row:z.number().optional(),id,region:chartRegionIdSchema,kind:nodeKindSchema,name:id,line:id,dungeonId:id,map:id,recommendedLevel:z.number().int().positive(),estimatedMinutes:z.tuple([z.number().positive(),z.number().positive()]),links:z.array(id),pos:z.object({col:z.number().int(),row:z.number().int()}),storyTasks:z.array(id),storySteps:z.array(z.record(z.string(),z.unknown())),storyRoutes:z.array(z.record(z.string(),z.unknown())),firstClearReward:z.array(z.string()),publicDropNote:id,collectible:z.enum(['lifeCrystal','starCore']).optional(),appearance:id.optional(),recipe:id.optional(),budgetReady:z.boolean().default(false),combatScale:z.object({hp:z.number().positive(),attack:z.number().positive()}).strict().optional(),dropCountScale:z.number().min(0).max(1).optional(),reward:z.object({xp:nn,gold:nn,material:nn,shards:nn,shardChance:z.number().min(0).max(1).optional(),rep:nn}).strict()}).strict();
export const hubChartContentSchema=z.object({source:z.literal('config/excel/航图.xlsx'),regions:z.array(z.object({_row:z.number().optional(),id:chartRegionIdSchema,name:id,levelRange:z.tuple([z.number().int(),z.number().int()]),status:z.enum(['open','locked'])}).strict()),nodes:z.array(hubNodeDefinitionSchema),shards:z.array(z.object({_row:z.number().optional(),id,name:id,effect:id,kind:z.enum(['slot','hex-style','elite']),value:id}).strict())}).strict().superRefine((v,ctx)=>{
 const ids=new Set(v.nodes.map(n=>n.id));if(ids.size!==v.nodes.length)ctx.addIssue({code:'custom',message:'航图节点ID重复'});
 if(v.regions.length!==7||new Set(v.regions.map(r=>r.id)).size!==7)ctx.addIssue({code:'custom',message:'航图必须包含7个航区'});
 for(const region of ['wind','mist'])if(v.nodes.filter(n=>n.region===region).length!==10)ctx.addIssue({code:'custom',message:region+'必须包含10个节点'});
 for(const n of v.nodes){if(!['wind','mist'].includes(n.region))ctx.addIssue({code:'custom',message:'样板外航区不能建节点'});for(const linked of n.links){const other=v.nodes.find(x=>x.id===linked);if(!other||other.region!==n.region||!other.links.includes(n.id))ctx.addIssue({code:'custom',message:n.id+'无效或非双向连线 '+linked});}if(n.estimatedMinutes[0]>n.estimatedMinutes[1])ctx.addIssue({code:'custom',message:n.id+'时长区间倒置'});}
});
export const hubChartContent=hubChartContentSchema.parse(raw);
export type HubNodeDefinition=z.infer<typeof hubNodeDefinitionSchema>;
export const hubNodeById=new Map(hubChartContent.nodes.map(n=>[n.id,n]));
export const hubShardById=new Map(hubChartContent.shards.map(n=>[n.id,n]));



