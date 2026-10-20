import {z} from 'zod';
import source from './skill-costs.json';
/** Migrated numeric controls; other skill costs retain their current content owner. */
export const skillCostsSchema=z.object({throwing_knife:z.number().int().nonnegative()}).strict();
export const skillCosts=Object.freeze(skillCostsSchema.parse(source));
