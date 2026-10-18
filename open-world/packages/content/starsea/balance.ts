import {z} from 'zod';
import source from './balance.json';
const level=z.number().int().min(1).max(60),positive=z.number().finite().positive();
export const starseaBalance=z.object({version:z.literal(1),generator:z.literal('tools/starsea-balance-model.ts'),
 islandBands:z.array(z.tuple([level,level]).refine(([lo,hi])=>hi>=lo)).length(6),bossLevels:z.array(level).length(6),
 killXpMultipliers:z.array(positive).length(6),bossXpMultipliers:z.array(positive).length(6),
 taskXp:z.array(z.array(z.number().int().nonnegative()).length(6)).length(6),
 supportShieldHpRatio:positive.max(1),
 supportShieldDuration:z.number().int().positive(),
 bossHpCalibration:z.array(positive).length(6).optional(),bossAttackCalibration:z.array(positive).length(6).optional(),
 starterWeapon:z.object({template:z.string().min(1),quality:z.enum(['common','magic','rare','legendary']),attackAffix:z.number().int().nonnegative()}).strict()
 ,starterJewelry:z.array(z.object({template:z.string().min(1),slot:z.enum(['accessory','ring']),quality:z.enum(['common','magic','rare','legendary']),attackAffix:z.number().int().nonnegative()}).strict()).length(2)
}).strict().parse(source);
for(let i=0;i<6;i++)if(starseaBalance.bossLevels[i]!==starseaBalance.islandBands[i][1]+2)throw Error('Starsea boss recommendation mismatch');
