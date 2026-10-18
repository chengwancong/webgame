import {z} from 'zod';
import source from './monsters.json';
import {monsterAiSchema,monsterBehaviorSchema,monsterStatsSchema,monsterRoleSchema} from '../contracts/monsters.ts';
import {monsterSkills,chapterBossSkills} from './chapter-combat.ts';
const point=z.object({level:z.number().int().positive(),hp:z.number().positive(),attack:z.number().positive(),armor:z.number().positive()}).strict();
const factors=z.object({hp:z.number().positive(),attack:z.number().positive(),armor:z.number().positive()}).strict();
export const monsterContentSchema=z.object({version:z.literal(1),curves:z.record(z.string(),z.array(point).min(2)),ranks:z.object({normal:factors,elite:factors,rare:factors,boss:factors}).strict(),roles:z.object({swarm:z.object({hpShare:z.number().positive(),speed:z.number().positive(),aggroRadius:z.number().positive()}).strict(),normal:z.object({hpShare:z.number().positive(),speed:z.number().positive()}).strict(),ranged:z.object({hpShare:z.number().positive(),speed:z.number().positive()}).strict()}).strict(),templates:z.array(z.object({role:monsterRoleSchema.default('normal'),id:z.string().min(1),name:z.string().min(1),art:z.string().min(1),kind:monsterBehaviorSchema,curve:z.string(),referenceLevel:z.number().int().positive(),base:monsterStatsSchema,ai:monsterAiSchema,skills:z.array(z.string()),bossKey:z.string().nullable(),bossProfile:z.string().optional()}).strict()).min(1),summons:z.object({echo:z.string(),ritual:z.string(),undead:z.string(),whelp:z.string()}).strict(),legacy:z.object({guardReduction:z.number().nonnegative(),guardAttackBonus:z.number().nonnegative(),skillChance:z.number().min(0).max(1),skillMap:z.record(z.string(),z.string())}).strict()}).strict();
export type MonsterContent=z.infer<typeof monsterContentSchema>;
export function resolveMonsterContent(raw:unknown):MonsterContent{
 const data=monsterContentSchema.parse(raw),ids=new Set<string>();
 for(const curve of Object.values(data.curves))for(let i=1;i<curve.length;i++)if(curve[i].level<=curve[i-1].level||['hp','attack','armor'].some(k=>curve[i][k as 'hp']<curve[i-1][k as 'hp']))throw Error('Invalid monster level curve');
 for(const t of data.templates){if(ids.has(t.id))throw Error('Duplicate monster template '+t.id);ids.add(t.id);const c=data.curves[t.curve];if(!c||t.referenceLevel<c[0].level||t.referenceLevel>c.at(-1)!.level)throw Error('Invalid monster curve reference '+t.id);if(t.skills.some(s=>!monsterSkills[s]))throw Error('Unknown monster skill '+t.id);if(t.bossKey&&!['meadow-boss','forest-boss','rift-boss',...Object.keys(chapterBossSkills),'dragon_king'].includes(t.bossKey))throw Error('Unknown monster boss behavior '+t.id);}
 for(const id of Object.values(data.summons))if(!ids.has(id))throw Error('Unknown summon template '+id);
 return data;
}
export const monsterContent=resolveMonsterContent(source);
/** Version-1 checkpoints predate rare/role declarations. Supply only dormant
 * role metadata for their frozen catalogue; never refresh curves, ranks, AI or
 * skills from the live source. Existing actors keep their exact snapshot. */
export function parseFrozenMonsterContent(raw:unknown):MonsterContent{
 const legacy=structuredClone(raw) as any;
 const predatesRoles=legacy?.version===1&&!legacy.roles&&!legacy.ranks?.rare&&Array.isArray(legacy.templates)&&legacy.templates.every((t:any)=>!Object.hasOwn(t,'role'));
 if(predatesRoles){legacy.roles=structuredClone(source.roles);legacy.roles.normal={hpShare:1,speed:1};legacy.ranks.rare=structuredClone(source.ranks.rare);for(const template of legacy.templates)template.role='normal';}
 return monsterContentSchema.parse(legacy);
}
