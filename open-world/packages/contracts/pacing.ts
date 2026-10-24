import {z} from 'zod';
import {weaponTypeSchema} from './weapons.ts';
export const pacingScenes=['single','clear','survival','elite','safety'] as const;
export type PacingScene=typeof pacingScenes[number];
const finite=z.number().finite(),positive=finite.positive(),row=z.number().int().positive();
export const pacingProfileSchema=z.object({id:z.string(),name:z.string(),weapon:weaponTypeSchema,four:z.string(),two:z.string(),skills:z.array(z.string()).min(1).max(4),aspect:z.string(),keyStats:z.array(z.string()).min(2).max(3),focus:z.enum(['single','clear','survival'])}).strict();
const ratios=Object.fromEntries(pacingScenes.map(id=>[id,finite.min(0).max(1.5)])) as Record<PacingScene,typeof finite>;
const buildRow=z.object({id:z.string(),name:z.string(),...ratios,budget:positive.optional(),tolerance:finite.min(0).max(.05),profile:pacingProfileSchema.optional(),_row:row}).strict();
export const pacingTargetTablesSchema=z.object({source:z.literal('config/excel/节奏目标.xlsx'),
 milestones:z.array(z.object({id:z.string(),kind:z.enum(['level','boss','tier']),name:z.string(),level:z.number().int().min(1).max(100),currentMinutes:finite.nonnegative(),targetMinutes:finite.nonnegative(),wallMinutes:finite.nonnegative(),method:z.string(),bossKillSeconds:positive.optional(),baselineKillSeconds:positive.optional(),inferredDps:positive.optional(),enemyHp:positive.optional(),template:z.string().optional(),_row:row}).strict()).min(6),
 completion:z.array(z.object({id:z.string(),name:z.string(),total:z.number().int().positive(),target:finite.min(0).max(1),rate:positive,minutes:positive,unit:z.string(),measure:z.string(),costKey:z.string().optional(),notes:z.string(),_row:row}).strict()).min(1),
 builds:z.array(buildRow).length(9),settings:z.array(z.object({id:z.string(),value:z.unknown(),notes:z.string(),_row:row}).strict()).min(1),
}).strict().superRefine((v,c)=>{
 const settings=new Map(v.settings.map(r=>[r.id,r.value]));if(settings.size!==v.settings.length)c.addIssue({code:'custom',message:'Duplicate pacing settings'});
 const weights=v.builds.filter(r=>r.id==='weights');if(weights.length!==1){c.addIssue({code:'custom',message:'Exactly one user weight row required'});return;}
 if(Math.abs(pacingScenes.reduce((n,id)=>n+weights[0][id],0)-1)>1e-8)c.addIssue({code:'custom',message:'Scene weights must sum to one'});
 if(v.builds.some(r=>r.id!=='weights'&&(!r.profile||pacingScenes.some(id=>r[id]<.6))))c.addIssue({code:'custom',message:'Missing build or target below 0.6'});
 for(const r of v.builds.filter(r=>r.id!=='weights')){const sum=pacingScenes.reduce((n,id)=>n+r[id]*weights[0][id],0);if(Math.abs(sum-1)>r.tolerance+1e-8||r.budget!==undefined&&Math.abs(r.budget-sum)>1e-6)c.addIssue({code:'custom',message:'Invalid weighted budget '+r.id});}
 const levels=v.milestones.filter(r=>r.kind==='level').sort((a,b)=>a.level-b.level);for(let i=1;i<levels.length;i++)if(levels[i].level<=levels[i-1].level||levels[i].targetMinutes<=levels[i-1].targetMinutes)c.addIssue({code:'custom',message:'Level milestones must increase'});
 const main=z.number().min(210).max(270).safeParse(settings.get('mainGoal')),hard=z.number().max(300).safeParse(settings.get('hardLimit'));if(!main.success||!hard.success||main.success&&hard.success&&main.data>hard.data)c.addIssue({code:'custom',message:'Invalid virtual calendar goal'});
 const last=levels.find(r=>r.level===50);if(!last||main.success&&Math.abs(last.targetMinutes-main.data)>1e-6)c.addIssue({code:'custom',message:'Lv50 goal must match mainGoal'});
 if(new Set(v.builds.map(r=>r.id)).size!==9)c.addIssue({code:'custom',message:'Duplicate pacing build'});
});
export type PacingTargetTables=z.infer<typeof pacingTargetTablesSchema>;
/** Lab messages are read-only experiments: no wallet, reward or character patch. */
export const pacingOverrideSchema=z.object({monsterHp:positive.min(.25).max(2),monsterAttack:positive.min(.25).max(2)}).strict();
export type PacingOverride=z.infer<typeof pacingOverrideSchema>;
