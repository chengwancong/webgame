import {z} from 'zod';
import source from './progression-challenges.json';
import {regions} from './index.ts';
const positive=z.number().positive(),int=z.number().int().positive();
const seasonDefinitionSchema=z.object({id:z.string(),name:z.string(),start:z.iso.datetime({offset:true}),end:z.iso.datetime({offset:true}),killXp:int,bossXp:int,challengeXp:int,rewards:z.array(z.object({id:z.string(),name:z.string(),xp:int,gold:int,material:int}))}).strict();
export const challengeContentSchema=z.object({version:int,limits:z.object({highDaily:int,nightmareDaily:int,raidWeekly:int,maxTicks:int.max(18000),raidMaxTicks:int.max(18000),raidSize:int.max(20),raidRoles:z.object({tank:int,healer:int,damage:int}),lobbyHours:int,maxOpenLobbies:int}),nightmare:z.object({maxTier:int.max(100),hpPerTier:positive,attackPerTier:positive,rewardPerTier:positive,affixCount:int}),affixes:z.array(z.object({id:z.string(),name:z.string(),hp:positive,attack:positive,cooldown:positive,healing:positive.optional()})).min(1),entries:z.array(z.object({id:z.string(),name:z.string(),kind:z.enum(['high','nightmare','raid']),region:z.string(),level:int,hp:positive,attack:positive,stages:int.max(12),description:z.string(),reward:z.object({gold:int,xp:int,material:int})})),season:seasonDefinitionSchema,seasons:z.array(seasonDefinitionSchema).optional()}).strict().superRefine((value,ctx)=>{
 const list=[value.season,...(value.seasons??[])].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
 for(let i=0;i<list.length;i++){const s=list[i];if(Date.parse(s.end)<=Date.parse(s.start)||list.some((other,j)=>j!==i&&other.id===s.id)||i>0&&Date.parse(list[i-1].end)>Date.parse(s.start)||new Set(s.rewards.map(r=>r.id)).size!==s.rewards.length)ctx.addIssue({code:'custom',path:['seasons'],message:'Invalid season schedule '+s.id});}
});
const configured=challengeContentSchema.parse(source);
const seasons=[configured.season,...(configured.seasons??[])].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
/** During gaps show the most recent season as closed, without awarding XP. */
export function seasonForTime(now=Date.now()){return seasons.find(s=>now>=Date.parse(s.start)&&now<Date.parse(s.end))??[...seasons].reverse().find(s=>now>=Date.parse(s.start))??seasons[0];}
export const challengeContent={...configured,get season(){return seasonForTime();}};
export type ChallengeDefinition=typeof challengeContent.entries[number];
const ids=new Set<string>();
for(const entry of challengeContent.entries){if(ids.has(entry.id)||!regions.some(r=>r.id===entry.region&&r.boss))throw Error('Invalid challenge '+entry.id);ids.add(entry.id);}
if(Object.values(challengeContent.limits.raidRoles).reduce((a,b)=>a+b,0)!==challengeContent.limits.raidSize)throw Error('Raid roles must match party size');
if(challengeContent.nightmare.affixCount>challengeContent.affixes.length)throw Error('Not enough distinct nightmare affixes');
if(Date.parse(challengeContent.season.end)<=Date.parse(challengeContent.season.start))throw Error('Invalid season dates');
export function seasonActive(now=Date.now()){const season=seasonForTime(now);return now>=Date.parse(season.start)&&now<Date.parse(season.end);}
