import {z} from 'zod';
import {statRegistry,statDefinition} from './stats.ts';
export const affixStatSchema=z.enum(statRegistry.filter(s=>s.affix).map(s=>s.id) as [string,...string[]]);
export const tagAffixStats:Record<string,string>=Object.fromEntries(statRegistry.filter(s=>s.affix&&s.tag).map(s=>[s.id,s.tag!]));
export const ratioAffixStats=new Set(statRegistry.filter(s=>s.affix&&s.unit==='ratio').map(s=>s.id));
export function validAffixValue(stat:string,value:number){return Number.isFinite(value)&&value>=0&&(!ratioAffixStats.has(stat)||value<=(statDefinition(stat)?.affixValueMax??1));}
export function affixDisplayValue(stat:string,value:number){const def=statDefinition(stat);return def?.display==='multiplier'?'×'+String(Math.round(value*1000)/1000):def?.unit==='seconds'?String(Math.round(value*1000)/1000)+'秒':def?.display==='percent'?(Math.round(value*10000)/100)+'%':String(value);}
