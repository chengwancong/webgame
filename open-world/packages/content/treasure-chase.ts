import {z} from 'zod';
import source from './treasure-chase.json';

const seconds=z.number().positive().max(30);
export const treasureChaseRulesSchema=z.object({
 version:z.literal(1),legs:z.number().int().min(1).max(3),wakeSeconds:seconds,totalSeconds:seconds,
 restSeconds:seconds,interceptSeconds:seconds,stalledSeconds:seconds,
 routeDistance:z.number().positive().max(12),minimumRouteDistance:z.number().positive().max(12),maximumPathLength:z.number().positive().max(30),
 arrivalRadius:z.number().positive().max(1),interceptRadius:z.number().positive().max(3),interceptApproach:z.number().positive().max(5),
 candidateTurns:z.array(z.number().min(-180).max(180)).min(1).max(12),
 text:z.object({waking:z.string().min(1),running:z.string().min(1),staggered:z.string().min(1),cornered:z.string().min(1)}).strict(),
}).strict().refine(r=>r.minimumRouteDistance<=r.routeDistance&&r.routeDistance<=r.maximumPathLength&&r.wakeSeconds<r.totalSeconds,'Invalid treasure chase route or timing');
export type TreasureChaseRules=z.infer<typeof treasureChaseRulesSchema>;
export const treasureChaseRules=treasureChaseRulesSchema.parse(source);
