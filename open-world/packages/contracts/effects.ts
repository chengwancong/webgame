import {statusEffectSchema as importStatusSchema} from './skill-mechanics.ts';
import {z} from 'zod';
import {conditionSchema} from './conditions.ts';
import {damageTypeSchema,statusKindSchema} from './skill-mechanics.ts';
import {weaponTypeSchema,weaponTypes} from './weapons.ts';
import type {ComboRule} from './weapon-combos.ts';
export const effectTriggers=['hit','crit','kill','cast','nth','passive','kill_elite','dash','status_apply','hurt','dodge','block','shield_break','shield_gain','low_hp','lethal','interval','combat_start','moved','mana_empty','mana_spent','zone_end'] as const;
export const effectTriggerSchema=z.enum(effectTriggers);
const num=z.number().finite(),ratio=num.nonnegative(),ticks=num.int().positive(),ref=z.enum(['hit','shield','armor','maxHp','attack','maxMana','cost']);
const flags=z.object({forceCrit:z.boolean().optional(),freeCost:z.boolean().optional(),noChainDecay:z.boolean().optional(),dotCrit:z.boolean().optional(),dotCritFull:z.boolean().optional(),immortal:z.boolean().optional(),surviveAtOne:z.boolean().optional()}).strict();
const buffMods=z.record(z.string(),num).superRefine((mods,c)=>{const supported=new Set(['cooldownRecovery','critChance','critMultiplier','damageAdd','damageMult','speedPercent','lifesteal','lifestealMultiplier','damageReduction','dodge','blockChance','vulnerableBonus','statusDuration','reviveRatio','projectiles']);for(const key of Object.keys(mods))if(!supported.has(key))c.addIssue({code:'custom',message:'Unsupported buff modifier '+key});if(mods.projectiles!==undefined&&(!Number.isInteger(mods.projectiles)||mods.projectiles<0))c.addIssue({code:'custom',message:'Projectile increment must be a nonnegative integer'});});
const override=z.object({maxStacks:ticks.max(20),stackMode:z.enum(['refresh','independent']),onStacks:z.object({at:ticks,convert:statusKindSchema,duration:ticks,consume:ticks}).strict().optional()}).strict();
const op=z.object({path:z.literal('mechanics.projectile.returns'),op:z.literal('set'),value:z.boolean()}).strict();
export const effectPatchSchema=z.object({skills:z.array(z.string()).optional(),tags:z.array(z.string()).optional(),ops:z.array(op).min(1)}).strict();
export const effectActionSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('nova'),ratio,radius:num.nonnegative(),damageType:damageTypeSchema.default('physical'),ref:ref.default('hit'),at:z.enum(['target','self']).default('target'),maxTargets:ticks.optional(),crit:z.boolean().optional(),status:importStatusSchema.optional(),perCrowd:ratio.optional(),crowdCap:ticks.optional(),radiusRef:z.literal('skill').optional(),vfx:z.string().optional()}).strict(),
 z.object({type:z.literal('shards'),count:ticks.max(12),ratio,range:num.positive(),damageType:damageTypeSchema.default('physical'),ref:ref.default('hit'),vfx:z.string().optional()}).strict(),
 z.object({type:z.literal('status'),ref:z.enum(['hit','dealt']).default('hit'),status:statusKindSchema,duration:ticks,strength:ratio.default(0),ratio:ratio.default(0),maxStacks:ticks.optional(),stackMode:z.enum(['refresh','independent']).optional(),onStacks:z.object({at:ticks,convert:statusKindSchema,duration:ticks,consume:ticks}).strict().optional()}).strict(),
 z.object({type:z.literal('spread'),statuses:z.array(statusKindSchema).min(1),radius:num.positive(),count:ticks.max(12)}).strict(),
 z.object({type:z.literal('echo'),ratio,delay:ticks,skill:z.enum(['same','slot1']).default('same'),retarget:z.boolean().optional()}).strict(),
 z.object({type:z.literal('refund'),ticks:ticks.optional(),fraction:num.min(0).max(1).optional(),mode:z.literal('longest').optional()}).strict().refine(a=>a.mode==='longest'?a.fraction!==undefined:a.ticks!==undefined,'Refund requires ticks or longest fraction'),
 z.object({type:z.literal('amplify'),ratio,against:z.array(statusKindSchema).default([]),penetration:ratio.optional(),selfHpSteps:num.positive().optional(),maxSteps:ticks.optional(),perCrowd:ratio.optional(),crowdCap:ticks.optional()}).strict(),
 z.object({type:z.literal('buff'),duration:ticks,maxStacks:ticks,mods:buffMods.default({}),setMods:z.array(z.enum(['critChance'])).optional(),alternate:z.array(buffMods).min(2).max(10).optional(),variants:z.array(z.object({mods:buffMods,when:z.array(conditionSchema)}).strict()).min(2).max(10).optional(),statusMultipliers:z.partialRecord(statusKindSchema,num.positive()).optional(),consume:z.enum(['nextCast','nextMelee','nextHit']).optional(),flags:flags.optional(),statusOverrides:z.partialRecord(statusKindSchema,override).optional(),patches:z.array(effectPatchSchema).optional(),firstPerTarget:ticks.optional(),targetScoped:z.boolean().optional(),resetOnTarget:z.boolean().optional(),currentCast:z.boolean().optional(),echoOnConsume:z.object({ratio,delay:ticks}).strict().optional()}).strict(),
 z.object({type:z.literal('shield'),ratio,ref:ref.default('maxHp'),duration:ticks,mods:buffMods.optional(),aura:z.object({status:statusKindSchema,radius:num.positive(),strength:ratio}).strict().optional()}).strict(),
 z.object({type:z.literal('heal'),ratio:num,ref:ref.default('maxHp'),overflowShield:ratio.optional(),nonlethal:z.boolean().optional()}).strict(),
 z.object({type:z.literal('mana'),ratio:num,ref:ref.default('maxMana'),flat:num.optional()}).strict(),
 z.object({type:z.literal('cooldown'),fraction:num.min(0).max(1).optional(),mode:z.enum(['current','others','all','random']),ticks:num.nonnegative().optional(),reset:z.boolean().optional()}).strict().refine(a=>a.reset||a.ticks!==undefined||a.fraction!==undefined,'Cooldown operation required'),
 z.object({type:z.literal('field'),orbit:z.boolean().optional(),projectiles:ticks.max(15).optional(),ratio,damageType:damageTypeSchema,radius:num.positive(),duration:ticks,interval:ticks,at:z.enum(['self','target','path']),pull:ratio.optional(),statuses:z.array(statusKindSchema).optional()}).strict(),
 z.object({type:z.literal('detonate'),statuses:z.array(statusKindSchema).min(1),ratio,remove:z.boolean(),radius:num.nonnegative().optional()}).strict(),
 z.object({type:z.literal('extend'),maxMode:z.enum(['absolute','bonus']).optional(),statuses:z.array(statusKindSchema).optional(),buff:z.string().optional(),duration:ticks,max:ticks}).strict(),
 z.object({type:z.literal('reduce'),ratio:num.min(0).max(1)}).strict(),
 z.object({type:z.literal('arc'),ratio,count:ticks.max(12),range:num.positive(),damageType:damageTypeSchema.default('lightning'),decay:ratio.default(.7)}).strict(),
]);
export const effectRuleSchema=z.object({id:z.string().min(1),name:z.string().min(1),description:z.string().min(1),source:z.string().min(1),tier:num.positive().default(1),trigger:effectTriggerSchema,also:z.array(effectTriggerSchema).optional(),chance:num.min(0).max(1),icd:num.int().nonnegative(),every:ticks.optional(),startReady:z.boolean().optional(),count:z.enum(['hit','crit','cast','kill']).optional(),status:statusKindSchema.optional(),maxTriggers:ticks.optional(),filter:z.object({lastPart:z.boolean().optional(),statusKinds:z.array(statusKindSchema).optional(),categories:z.array(z.enum(['direct','periodic','derived'])).optional(),skillKinds:z.array(z.string()).optional(),skills:z.array(z.string()).optional(),tags:z.array(z.string()).optional(),weapons:z.array(weaponTypeSchema).optional(),damageTypes:z.array(damageTypeSchema).optional()}).strict().default({}),when:z.array(conditionSchema).default([]),action:effectActionSchema,scale:z.array(z.string()).default([]),vfxKey:z.string().min(1)}).strict().superRefine((r,c)=>{
 const a=r.action;
 if(a.type==='field'){
  if(a.projectiles!==undefined&&!a.orbit)c.addIssue({code:'custom',message:'Field projectile count requires orbit'});
  if(a.orbit&&(a.at!=='self'||a.pull!==undefined||a.statuses?.length))c.addIssue({code:'custom',message:'Orbit fields require self anchor without pull or zone statuses'});
 }
 if(a.type==='buff'){
  if(a.alternate&&a.variants)c.addIssue({code:'custom',message:'Only one buff phase table is allowed'});
  const phases=a.alternate??a.variants?.map(v=>v.mods)??[a.mods];
  if(a.setMods?.some(key=>phases.some(mods=>!Object.hasOwn(mods,key))))c.addIssue({code:'custom',message:'Absolute buff modifier must be declared in every phase'});
 }
if((r.action.type==='amplify'||r.action.type==='reduce')&&r.trigger!=='passive')c.addIssue({code:'custom',message:'Passive modifier requires passive trigger'});if(r.trigger==='passive'&&!['amplify','reduce','buff'].includes(r.action.type))c.addIssue({code:'custom',message:'Active action has no passive executor'});if(r.action.type==='echo'&&r.action.skill==='same'&&['hurt','dodge','block','shield_break','shield_gain','low_hp','lethal','interval','combat_start','moved','mana_empty','mana_spent','status_apply'].includes(r.trigger))c.addIssue({code:'custom',message:'Trigger requires echo slot1'});for(const path of r.scale){let value:unknown=r;for(const key of path.split('.'))value=value&&typeof value==='object'?(value as Record<string,unknown>)[key]:undefined;if(typeof value!=='number')c.addIssue({code:'custom',message:'Unknown numeric scale path '+path});}if(['nth','interval','moved','mana_spent'].includes(r.trigger)&&!r.every)c.addIssue({code:'custom',message:'Trigger requires every'});if(r.action.type==='status'&&['burn','poison','bleed'].includes(r.action.status)&&!r.action.ratio)c.addIssue({code:'custom',message:'DOT requires a damage budget'});});
export type EffectRule=z.infer<typeof effectRuleSchema>;
export type EffectAction=z.infer<typeof effectActionSchema>;
export const effectLimits={actionsPerTick:24,killDepth:2};

/** Old frozen snapshots remain readable. Conversion adds no RNG draws or numeric scaling. */
export function comboToEffect(r:ComboRule):EffectRule{return effectRuleSchema.parse({id:r.id,name:r.name,description:r.description,source:r.source,tier:1,trigger:r.trigger,filter:{weapons:r.weapons,...(r.skillKinds?{skillKinds:r.skillKinds}:{}),...(r.damageTypes?{damageTypes:r.damageTypes}:{})},when:r.targetStatus?[{kind:'target_status',statuses:r.targetStatus}]:[],chance:r.chance,icd:r.cooldown,...(r.every?{every:r.every,count:'hit' as const}:{}),action:r.action,scale:'ratio' in r.action?['action.ratio']:[],vfxKey:'vfx' in r.action?r.action.vfx:'combo/'+r.id});}

export type ExecutableRule=Omit<ComboRule,'trigger'|'action'>&{trigger:EffectRule['trigger'];action:EffectAction;when:EffectRule['when'];filter:EffectRule['filter'];vfxKey:string;tier:number;rule:EffectRule};
export function executableRule(r:EffectRule):ExecutableRule{return {id:r.id,name:r.name,description:r.description,source:r.source,weapons:r.filter.weapons?.length?r.filter.weapons:[...weaponTypes],trigger:r.trigger,chance:r.chance,cooldown:r.icd,...(r.every?{every:r.every}:{}),...(r.filter.damageTypes?{damageTypes:r.filter.damageTypes}:{}),...(r.filter.skillKinds?{skillKinds:r.filter.skillKinds}:{}),action:r.action,when:r.when,filter:r.filter,vfxKey:r.vfxKey,tier:r.tier,rule:r};}

export const effectActionTypes=effectActionSchema.options.map(s=>s.shape.type.value);

export {flags as effectFlagsSchema,override as statusOverrideSchema};
