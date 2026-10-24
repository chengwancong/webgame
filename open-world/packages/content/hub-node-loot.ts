import {z} from 'zod';
import raw from './hub-node-loot.json';
import {hubNodeById} from './hub-chart.ts';
const slot=z.enum(['weapon','armor','helmet','boots','accessory','ring']);
export const hubNodeLootSchema=z.record(z.string(),z.array(slot).length(2)).superRefine((v,c)=>{if(Object.keys(v).length!==18)c.addIssue({code:'custom',message:'Require 18 nest biases'});for(const[id,slots]of Object.entries(v))if(hubNodeById.get(id)?.kind!=='nest'||new Set(slots).size!==2)c.addIssue({code:'custom',message:'Invalid nest bias '+id});});
export const hubNodeLoot=hubNodeLootSchema.parse(raw);
export function hubDropSlots(node:string,shards:string[]=[]){return [...new Set([...(hubNodeLoot[node]??[]),...(hubNodeById.get(node)?.kind==='hunt'?['weapon']:[]),...shards])];}
