import {z} from 'zod';
import raw from './level-stats.json';
import progression from './deep-progression.json';
// 角色等级属性表：服务端按等级查表得到基础属性，装备、养成、突破在此基础上叠加。
const i=z.number().int().nonnegative(),p=z.number().positive().finite();
export const levelStatsRowSchema=z.object({level:z.number().int().min(1),hp:z.number().int().positive(),attack:i,armor:i,speed:p,mana:i,regen:z.number().nonnegative().finite()}).strict();
export type LevelStatsRow=z.infer<typeof levelStatsRowSchema>;
export const levelStatsSchema=z.object({version:z.number().int().positive(),note:z.string(),levels:z.array(levelStatsRowSchema).min(1)}).strict().superRefine((t,ctx)=>{
 t.levels.forEach((row,n)=>{
  if(row.level!==n+1)ctx.addIssue({code:'custom',path:['levels',n,'level'],message:`等级必须从 1 连续，第 ${n+1} 行是 ${row.level}`});
  const prev=t.levels[n-1];if(prev)for(const key of ['hp','attack','armor','speed','mana','regen'] as const)if(row[key]<prev[key])ctx.addIssue({code:'custom',path:['levels',n,key],message:`${row.level} 级的 ${key} 低于上一级`});
 });
 const cap=Math.max(...progression.characterCaps);if(t.levels.length<cap)ctx.addIssue({code:'custom',path:['levels'],message:`等级表只到 ${t.levels.length} 级，突破上限是 ${cap} 级`});
});
export const levelStatsTable=levelStatsSchema.parse(raw);
/** 查某个等级的基础属性；超出表尾时按最后一行（等级上限已由突破表约束）。 */
export function levelStats(level:number):LevelStatsRow{const rows=levelStatsTable.levels;return rows[Math.min(rows.length,Math.max(1,Math.floor(level)))-1];}
