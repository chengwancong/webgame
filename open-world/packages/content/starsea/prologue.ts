import {z} from 'zod';
import source from './prologue.json';
import {statsSchema,skillSchema} from '../../contracts/index.ts';
/** 开场「坠星觉醒」配置（tools/prologue-build.ts 生成，docs/opening-hook-design.md）。
 * granted 是受控授予的冻结构筑：只给客户端开场沙盒用，不进角色存档，与自然养成分开。 */
export const prologueFamilies=['sword','staff','hidden'] as const;
export type PrologueFamily=typeof prologueFamilies[number];
const id=z.string().min(1);
const text=z.string().min(1);
const family=z.object({blurb:text,echo:text,weaponTemplate:id,starterSkills:z.array(id).min(1).max(4),grantedSkills:z.array(id).length(4),
 bossDifficulty:z.object({hp:z.number().positive(),attack:z.number().positive()}).strict(),
 /** 推导与验证记录：probe 为初值血量下的实跑秒数；bossSeconds 为定稿血量下潮能一满就按爆发（eager）的实跑秒数，Hold 为爆发留到巨兽战。 */
 measured:z.object({singleDps:z.number(),probeBossSeconds:z.number(),bossSeconds:z.number(),bossSecondsHold:z.number(),openingSeconds:z.number(),lowestHeroHp:z.number(),echoBossShare:z.number()}).strict(),
 granted:z.object({stats:statsSchema,skills:z.array(skillSchema)}).strict(),
 /** 回响爆发：开场沙盒里由玩家按键释放，不在自动施法列表里。 */burst:skillSchema}).strict();
export const prologueConfig=z.object({version:z.literal(1),generator:z.literal('tools/prologue-build.ts'),grantLevel:z.number().int().positive(),map:id,waves:z.array(z.number().int().positive()).min(1),
 waveCadence:z.object({groupSize:z.number().int().positive(),everySeconds:z.number().positive(),spawnRadius:z.number().positive()}).strict(),
 burst:z.object({kills:z.number().int().positive(),bossShare:z.number().positive().max(1),bossUnlock:z.number().positive().max(1)}).strict(),
 mob:z.object({template:id,level:z.number().int().positive()}).strict(),
 boss:z.object({template:id,name:z.string().min(1),level:z.number().int().positive(),targetSeconds:z.number().positive()}).strict(),
 families:z.object({sword:family,staff:family,hidden:family}).strict(),
 lines:z.object({fall:text,choose:text,skipNote:text,land:text,waves:z.array(text),energyFull:text,boss:text,bossUnlock:text,fade:text}).strict()}).strict().parse(source);
