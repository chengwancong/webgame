import {z} from 'zod';
import {damageTypeSchema} from './skill-mechanics.ts';
export const monsterRankSchema=z.enum(['normal','elite','rare','boss']);
export const monsterRoleSchema=z.enum(['swarm','normal','ranged']);
export const monsterBehaviorSchema=z.enum(['melee','ranged','charger','shaman','guard','assassin','summoner','artillery']);
export const monsterAiSchema=z.object({speed:z.number().positive(),range:z.number().positive(),aggroRadius:z.number().positive().optional(),cooldown:z.number().int().positive(),skillChance:z.number().min(0).max(1),basicAttackBonus:z.number().nonnegative()}).strict();
export const monsterStatsSchema=z.object({hp:z.number().positive(),attack:z.number().nonnegative(),armor:z.number().nonnegative()}).strict();
export const monsterDifficultySchema=z.object({hp:z.number().positive(),attack:z.number().positive(),armor:z.number().positive()}).strict();
/** Field elite affixes the simulation can execute (grind-feel §2.4, first batch of three). */
export const eliteAffixSchema=z.enum(['swift','shielded','frost_nova','fire_trail','summon_minions','teleport']);
export const eliteAffixContentSchema=z.object({
 swift:z.object({name:z.string().min(1),speed:z.number().positive(),cooldown:z.number().positive()}).strict(),
 shielded:z.object({name:z.string().min(1),ratio:z.number().positive(),first:z.number().int().positive(),every:z.number().int().positive(),duration:z.number().int().positive()}).strict(),
 frost_nova:z.object({name:z.string().min(1),skill:z.string().min(1)}).strict(),
 fire_trail:z.object({name:z.string().min(1),skill:z.string().min(1),every:z.number().int().positive(),radius:z.number().positive(),damage:z.number().positive(),duration:z.number().int().positive(),delay:z.number().int().nonnegative()}).strict(),
 summon_minions:z.object({name:z.string().min(1),skill:z.string().min(1)}).strict(),
 teleport:z.object({name:z.string().min(1),skill:z.string().min(1)}).strict(),
}).strict();
export const monsterPatrolSchema=z.object({path:z.array(z.object({x:z.number().finite(),y:z.number().finite()}).strict()).min(2),speed:z.number().positive()}).strict();
export const monsterCombatSchema=z.object({version:z.literal(1),template:z.string().min(1),level:z.number().int().positive(),rank:monsterRankSchema,role:monsterRoleSchema.optional(),baseStats:monsterStatsSchema,difficulty:monsterDifficultySchema,armor:z.number().int().nonnegative(),ai:monsterAiSchema,skills:z.array(z.string().min(1)),bossKey:z.string().nullable(),bossProfile:z.string().min(1).optional(),bossPhaseMode:z.enum(['single','phased']).optional(),affixes:z.array(eliteAffixSchema).max(3).optional(),patrol:monsterPatrolSchema.optional(),/** M17 Z1：航区弱点，受到该元素的玩家伤害 ×(1+bonus)。 */weakness:z.object({type:damageTypeSchema,bonus:z.number().positive().max(1)}).strict().optional()}).strict();
export type MonsterCombat=z.infer<typeof monsterCombatSchema>;
export type EliteAffix=z.infer<typeof eliteAffixSchema>;
export type MonsterRank=z.infer<typeof monsterRankSchema>;
export type MonsterRole=z.infer<typeof monsterRoleSchema>;
export type MonsterDifficulty=z.infer<typeof monsterDifficultySchema>;
