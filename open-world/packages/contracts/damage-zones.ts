import {z} from 'zod';
export const damageZoneSchema=z.object({id:z.string().min(1),label:z.string(),kind:z.enum(['add','mult']),pool:z.enum(['type','mult']).optional(),value:z.number().finite(),tags:z.array(z.string()).optional()}).strict().superRefine((zone,ctx)=>{
 const pool=zone.pool??(zone.kind==='add'?'type':'mult');
 if(zone.pool&&zone.pool!==(zone.kind==='add'?'type':'mult'))ctx.addIssue({code:'custom',message:'Damage pool conflicts with legacy kind'});
 if(pool==='mult'&&zone.value<=0)ctx.addIssue({code:'custom',message:'Independent multiplier must be positive'});
});
