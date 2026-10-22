import {z} from 'zod';
/** true stops new work for this subsystem, not settlement of existing work.
 * Unimplemented switches are rejected rather than advertised as working. */
export const fieldFreezeSchema=z.object({
 camps:z.boolean().default(false),
 patrols:z.boolean().default(false),
 exploration:z.boolean().default(false),
 waypoints:z.boolean().default(false),
 bounties:z.boolean().default(false),
 events:z.boolean().default(false),
 fieldEntry:z.boolean().default(false),
 fieldGather:z.boolean().default(false),
 fieldSprint:z.boolean().default(false),
}).strict();
export type FieldFreeze=z.infer<typeof fieldFreezeSchema>;
export function parseFieldFreeze(value:unknown={}):Readonly<FieldFreeze>{
 return Object.freeze(fieldFreezeSchema.parse(value));
}
