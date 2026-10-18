import {z} from 'zod';
import raw from './reputation.json';
const schema=z.object({factions:z.array(z.object({id:z.string().min(1),chapter:z.number().int().positive(),island:z.string().min(1),name:z.string().min(1),maps:z.array(z.string().min(1)).min(1)}).strict()).min(1)}).strict().superRefine(({factions},ctx)=>{
 for(const values of [factions.map(f=>f.id),factions.map(f=>f.chapter),factions.flatMap(f=>f.maps)])if(new Set<string|number>(values).size!==values.length)ctx.addIssue({code:'custom',message:'Duplicate Starsea reputation binding'});
});
export const starseaFactions=schema.parse(raw).factions.sort((a,b)=>a.chapter-b.chapter);
export const starseaFactionByMap=new Map(starseaFactions.flatMap(f=>f.maps.map(map=>[map,f] as const)));
export const starseaFactionById=new Map(starseaFactions.map(f=>[f.id,f]));
