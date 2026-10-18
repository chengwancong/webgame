import {z} from 'zod';
import atoms from '../content/effect-atoms.json';
export const inscriptionSlotSchema=z.enum(['weapon','armor','helmet','boots','accessory','ring']);
export const inscriptionAtomSchema=z.enum(atoms.map(a=>a.id) as [string,...string[]]);
export const inscriptionSchema=z.object({atomId:inscriptionAtomSchema,tier:z.literal(.5)}).strict();
export const inscriptionRubbingSchema=inscriptionSchema.extend({slot:inscriptionSlotSchema}).strict();
export type Inscription=z.infer<typeof inscriptionSchema>;
export type InscriptionRubbing=z.infer<typeof inscriptionRubbingSchema>;
