import raw from './set-effects.json';
import {z} from 'zod';
import {statIdSchema,statLabels} from '../contracts/stats.ts';
import {conditionSchema} from '../contracts/conditions.ts';
import {effectRuleSchema} from '../contracts/effects.ts';
import {damageZoneSchema} from '../contracts/damage-zones.ts';
import {equipmentFamilies,equipmentSeries} from '../contracts/equipment-catalog.ts';
import {equipmentItems} from './equipment-catalog.ts';
import type {Gear,GearSet} from '../contracts/index.ts';
import {effectAtoms} from './effect-atoms.ts';
const atom=z.object({id:z.string(),tier:z.number().positive(),set:z.record(z.string(),z.unknown()).optional()}).strict();
const part=z.object({stats:z.array(z.object({stat:statIdSchema,value:z.number().finite().nonnegative()}).strict()).default([]),atoms:z.array(atom).default([]),rules:z.array(effectRuleSchema).default([]),conditional:z.array(z.object({id:z.string(),pool:z.enum(['cond','stat']),stat:z.string().optional(),value:z.number().finite(),when:conditionSchema}).strict()).default([]),flags:z.object({dotCrit:z.boolean().optional()}).strict().optional(),zones:z.array(damageZoneSchema).default([])}).strict();
export const setEffectsSchema=z.array(z.object({id:z.string(),family:z.enum(equipmentFamilies),series:z.enum(equipmentSeries),name:z.string(),artStageScale:z.tuple([z.number().positive(),z.number().positive(),z.number().positive()]),two:part,four:part}).strict()).length(18);
export const setEffects=setEffectsSchema.parse(raw);
const byId=new Map(setEffects.map(s=>[s.id,s]));
if(byId.size!==18)throw Error('Duplicate set identity');
for(const s of setEffects)for(const p of [s.two,s.four])for(const a of p.atoms)if(!effectAtoms.some(r=>r.id===a.id))throw Error('Unknown set atom '+a.id);
export function collectionSetIdentity(id:string){const match=/^(standard|omega|primal)-(sword|hammer|axe|staff|hidden|wand)-t[123]$/.exec(id);return match?`set-${match[2]}-${match[1]}`:id;}
export function gearSetIdentity(g:Pick<Gear,'base'|'setId'>){return g.setId?collectionSetIdentity(g.setId):undefined;}
export function setEffect(id:string){return byId.get(collectionSetIdentity(id));}
const describe=(p:typeof setEffects[number]['two'])=>[...p.stats.map(s=>`${statLabels[s.stat]} +${s.value<1?Math.round(s.value*100)+'%':s.value}`),...p.atoms.map(a=>effectAtoms.find(r=>r.id===a.id)!.description),...p.rules.map(r=>r.description),...p.zones.map(z=>`${z.label} ×${z.value}`),...p.conditional.map(c=>c.pool==='stat'?'满足条件时生命偷取翻倍':`满足条件时伤害 +${Math.round(c.value*100)}%`),...(p.flags?.dotCrit?['持续伤害可暴击（暴击率减半）']:[])].join('；');
export const unifiedGearSets:GearSet[]=setEffects.map(s=>({id:s.id,name:s.name,pieces:equipmentItems.filter(i=>i.family===s.family&&i.series===s.series).map(i=>i.id),bonuses:[{pieces:2,description:describe(s.two)},{pieces:4,description:describe(s.four)}]}));
