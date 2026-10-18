import {z} from 'zod';
import source from './progression-challenges.json';
import {regions} from './index.ts';
const positive=z.number().positive(),int=z.number().int().positive();
const schema=z.object({version:int,limits:z.object({highDaily:int,nightmareDaily:int,raidWeekly:int,maxTicks:int.max(18000),raidMaxTicks:int.max(18000),raidSize:int.max(20),raidRoles:z.object({tank:int,healer:int,damage:int}),lobbyHours:int,maxOpenLobbies:int}),nightmare:z.object({maxTier:int.max(100),hpPerTier:positive,attackPerTier:positive,rewardPerTier:positive,affixCount:int}),affixes:z.array(z.object({id:z.string(),name:z.string(),hp:positive,attack:positive,cooldown:positive,healing:positive.optional()})).min(1),entries:z.array(z.object({id:z.string(),name:z.string(),kind:z.enum(['high','nightmare','raid']),region:z.string(),level:int,hp:positive,attack:positive,stages:int.max(12),description:z.string(),reward:z.object({gold:int,xp:int,material:int})})),season:z.object({id:z.string(),name:z.string(),start:z.iso.datetime({offset:true}),end:z.iso.datetime({offset:true}),killXp:int,bossXp:int,challengeXp:int,rewards:z.array(z.object({id:z.string(),name:z.string(),xp:int,gold:int,material:int}))})}).strict();
export const challengeContent=schema.parse(source);
export type ChallengeDefinition=typeof challengeContent.entries[number];
const ids=new Set<string>();
for(const entry of challengeContent.entries){if(ids.has(entry.id)||!regions.some(r=>r.id===entry.region&&r.boss))throw Error('Invalid challenge '+entry.id);ids.add(entry.id);}
if(Object.values(challengeContent.limits.raidRoles).reduce((a,b)=>a+b,0)!==challengeContent.limits.raidSize)throw Error('Raid roles must match party size');
if(challengeContent.nightmare.affixCount>challengeContent.affixes.length)throw Error('Not enough distinct nightmare affixes');
if(Date.parse(challengeContent.season.end)<=Date.parse(challengeContent.season.start))throw Error('Invalid season dates');
export function seasonActive(now=Date.now()){return now>=Date.parse(challengeContent.season.start)&&now<Date.parse(challengeContent.season.end);}
