import {z} from 'zod';
import {statRegistry,statDefinitionSchema} from '../contracts/stats.ts';
import {effectRuleSchema,type EffectRule} from '../contracts/effects.ts';
import type {Stats} from '../contracts/index.ts';
const specSchema=z.object({stat:z.string(),path:z.enum(['chance','action.flat','action.ratio','action.ticks']),scale:z.number().finite().positive(),rule:effectRuleSchema}).strict();
export const attributeEffectConfigSchema=z.object({version:z.literal(1),stats:z.array(statDefinitionSchema),specs:z.array(specSchema)}).strict().superRefine((c,ctx)=>{
 if(new Set(c.stats.map(s=>s.id)).size!==c.stats.length||new Set(c.specs.map(s=>s.stat)).size!==c.specs.length)ctx.addIssue({code:'custom',message:'Duplicate frozen attribute definition'});
 for(const spec of c.specs)if(!c.stats.some(s=>s.id===spec.stat)||spec.rule.id!=='stat-'+spec.stat)ctx.addIssue({code:'custom',message:'Unknown frozen attribute effect'});
});
export type AttributeEffectConfig=z.infer<typeof attributeEffectConfigSchema>;
function makeConfig():AttributeEffectConfig{
 const specs:AttributeEffectConfig['specs']=[],rule=(id:string,trigger:EffectRule['trigger'],action:unknown)=>effectRuleSchema.parse({id:'stat-'+id,name:statRegistry.find(s=>s.id===id)!.name,description:'装备属性触发',source:'装备与养成属性',tier:1,trigger,filter:trigger==='hit'?{categories:['direct']}:{},when:[],chance:1,icd:0,action,scale:[],vfxKey:id==='thorns'?'player/counter_strike':id.includes('Chance')?'player/'+({igniteChance:'ember',chillChance:'frost',shockChance:'chain',poisonChance:'poison_arrow',bleedChance:'execute'} as Record<string,string>)[id]:'player/mend'});
 for(const [id,status]of [['igniteChance','burn'],['chillChance','slow'],['shockChance','shock'],['poisonChance','poison'],['bleedChance','bleed']] as const)specs.push({stat:id,path:'chance',scale:1,rule:rule(id,'hit',{type:'status',status,duration:status==='slow'?60:90,strength:status==='slow'?.3:status==='shock'?.12:0,ratio:['burn','poison','bleed'].includes(status)?.3:0,ref:'dealt'})});
 specs.push({stat:'manaOnKill',path:'action.flat',scale:1,rule:rule('manaOnKill','kill',{type:'mana',ratio:0,flat:1,ref:'maxMana'})},{stat:'lifeOnKill',path:'action.ratio',scale:1,rule:rule('lifeOnKill','kill',{type:'heal',ratio:1,ref:'maxHp'})},{stat:'cooldownOnKill',path:'action.ticks',scale:30,rule:rule('cooldownOnKill','kill',{type:'cooldown',mode:'all',ticks:30})},{stat:'thorns',path:'action.ratio',scale:1,rule:rule('thorns','hurt',{type:'nova',ratio:1,radius:0,ref:'armor',at:'target',maxTargets:1,damageType:'physical'})});
 return attributeEffectConfigSchema.parse({version:1,stats:structuredClone(statRegistry),specs});
}
const current=makeConfig();
export function freezeAttributeEffects():AttributeEffectConfig{return structuredClone(current);}
/** Shared source for gear, progression and frozen run stat triggers. Templates,
 * caps, conditions, defaults and value-to-parameter units are frozen together. */
export function resolveAttributeEffects(stats:Stats,config:AttributeEffectConfig=current){
 const value=(id:string)=>{const definition=config.stats.find(s=>s.id===id);if(!definition)throw Error('Attribute not in frozen registry '+id);const raw=(stats as unknown as Record<string,unknown>)[id],amount=typeof raw==='number'?raw:definition.default;if(!Number.isFinite(amount)||amount<0)throw Error('Invalid attribute value '+id);return definition.cap===null?amount:Math.min(amount,definition.cap);};
 const conditional:NonNullable<Stats['conditional']>=config.stats.flatMap(def=>def.pool==='cond'&&def.cond&&value(def.id)?[{id:'stat-'+def.id,pool:'cond' as const,value:value(def.id),when:structuredClone(def.cond)}]:[]),rules:EffectRule[]=[];
 for(const spec of config.specs){const n=value(spec.stat);if(!n)continue;const rule=structuredClone(spec.rule),parameter=spec.path==='action.ticks'?Math.round(n*spec.scale):n*spec.scale;if(spec.path==='chance')rule.chance=parameter;else {const key=spec.path.slice('action.'.length);(rule.action as unknown as Record<string,unknown>)[key]=parameter;}rules.push(effectRuleSchema.parse(rule));}
 return {rules,conditional};
}
