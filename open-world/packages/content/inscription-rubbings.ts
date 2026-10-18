import {z} from 'zod';import raw from './inscription-rubbings.json';import {inscriptionRubbingSchema} from '../contracts/inscriptions.ts';
export const inscriptionRubbings=z.array(inscriptionRubbingSchema.extend({id:z.string().min(1)}).strict()).length(41).parse(raw);
