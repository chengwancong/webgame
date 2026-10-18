import {z} from 'zod';
import type {Region} from './index.ts';
import {resolveMonsterSpawn} from '../rules/monster-stats.ts';
import {monsterRankSchema} from '../contracts/monsters.ts';
const property=z.object({name:z.string(),value:z.union([z.string(),z.number(),z.boolean()])});
const object=z.object({name:z.string(),x:z.number(),y:z.number(),width:z.number(),height:z.number(),properties:z.array(property)});
const map=z.object({width:z.number().int().positive(),height:z.number().int().positive(),tilewidth:z.literal(32),tileheight:z.literal(32),properties:z.array(property),layers:z.array(z.object({name:z.string(),objects:z.array(object)}))});
const props=(p:z.infer<typeof property>[])=>Object.fromEntries(p.map(v=>[v.name,v.value]));
export function parseMap(input:unknown):Region{
 const m=map.parse(input),p=props(m.properties),objects=(name:string)=>m.layers.find(l=>l.name===name)?.objects??[],pos=(v:z.infer<typeof object>)=>({x:v.x/32,y:v.y/32});
 const connection=(name:string)=>{const v=objects('connections').find(v=>v.name===name);if(!v)throw Error('Missing connection '+name);return pos(v);};
 return {id:String(p.id),name:String(p.name),subtitle:String(p.subtitle),theme:String(p.theme),width:m.width,height:m.height,boss:Boolean(p.boss),auto:Boolean(p.auto),next:p.next?String(p.next):undefined,requireBoss:p.requireBoss?String(p.requireBoss):undefined,
 safe:connection('safe'),portal:connection('portal'),bossPortal:objects('connections').some(v=>v.name==='boss')?connection('boss'):undefined,
 obstacles:objects('navigation').map(v=>({...pos(v),w:v.width/32,h:v.height/32})),
 spawns:objects('spawns').map(v=>{const p=props(v.properties);return resolveMonsterSpawn({id:v.name,...pos(v),template:z.string().min(1).parse(p.monster),level:z.number().int().positive().parse(p.level),rank:monsterRankSchema.parse(p.rank)});}),
 landmarks:objects('landmarks').map(v=>({...pos(v),name:v.name,kind:String(props(v.properties).kind)}))};
}
