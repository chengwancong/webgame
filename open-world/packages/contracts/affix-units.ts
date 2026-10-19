import {z} from 'zod';
import {statRegistry,statDefinition} from './stats.ts';
export const affixStatSchema=z.enum(statRegistry.filter(s=>s.affix).map(s=>s.id) as [string,...string[]]);
export const tagAffixStats:Record<string,string>=Object.fromEntries(statRegistry.filter(s=>s.affix&&s.tag).map(s=>[s.id,s.tag!]));
export const ratioAffixStats=new Set(statRegistry.filter(s=>s.affix&&s.unit==='ratio').map(s=>s.id));
export function validAffixValue(stat:string,value:number){return Number.isFinite(value)&&value>=0&&(!ratioAffixStats.has(stat)||value<=(statDefinition(stat)?.affixValueMax??1));}
export function displayNumber(value:number,digits=2){return String(Math.round((value+Number.EPSILON)*10**digits)/10**digits);}
export function affixDisplayValue(stat:string,value:number){const def=statDefinition(stat);return def?.display==='multiplier'?'×'+displayNumber(value,3):def?.unit==='seconds'?displayNumber(value,3)+'秒':def?.display==='percent'?displayNumber(value*100)+'%':displayNumber(value);}
