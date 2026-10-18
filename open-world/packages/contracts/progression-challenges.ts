import {z} from 'zod';

const n=z.number().int().nonnegative();
export const challengeResultSchema=z.object({run_id:z.uuid(),challenge_id:z.string(),name:z.string(),kind:z.enum(['high','nightmare','raid']),tier:n,won:z.boolean(),ticks:n,stages:n,totalStages:n,remainingHp:z.number().finite().nonnegative(),reason:z.string(),rules:z.string(),seed:n,reward:z.object({gold:n,xp:n,material:n}),affixes:z.array(z.string())});
export type ChallengeResult=z.infer<typeof challengeResultSchema>;
export const challengeProgressSchema=z.object({daily:z.record(z.string(),n).default({}),weekly:z.record(z.string(),n).default({}),bestTier:n.default(0),seasonXp:z.record(z.string(),n).default({}),seasonClaims:z.array(z.string()).default([]),last:challengeResultSchema.optional()});
export type ChallengeProgress=z.infer<typeof challengeProgressSchema>;
export const raidRoleSchema=z.enum(['tank','healer','damage']);
export type RaidRole=z.infer<typeof raidRoleSchema>;
export const raidLobbySchema=z.object({id:z.uuid(),raid_id:z.string(),name:z.string(),leader:z.uuid(),status:z.enum(['forming','complete']),created:z.string(),members:z.array(z.object({id:z.uuid(),name:z.string(),role:raidRoleSchema,ready:z.boolean(),build:n})),size:n,required:z.object({tank:n,healer:n,damage:n}),canStart:z.boolean(),message:z.string(),result:challengeResultSchema.optional()});
export type RaidLobby=z.infer<typeof raidLobbySchema>;
export const challengeViewSchema=z.object({revision:n,ruleset_version:z.string(),entries:z.array(z.object({id:z.string(),name:z.string(),kind:z.enum(['high','nightmare','raid']),description:z.string(),level:n,eligible:z.boolean(),reason:z.string(),used:n,limit:n,maxTier:n,stages:n,reward:z.string()})),bestTier:n,last:challengeResultSchema.optional(),season:z.object({id:z.string(),name:z.string(),start:z.string(),end:z.string(),active:z.boolean(),xp:n,rewards:z.array(z.object({id:z.string(),name:z.string(),xp:n,claimed:z.boolean(),eligible:z.boolean(),gold:n,material:n}))}),leaderboard:z.array(z.object({name:z.string(),tier:n,ticks:n})),lobbies:z.array(raidLobbySchema)});
export type ChallengeView=z.infer<typeof challengeViewSchema>;
export const challengeRunInput=z.object({challenge_id:z.string().min(1).max(100),tier:z.number().int().min(1).max(100).default(1)}).strict();
