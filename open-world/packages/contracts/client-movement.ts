import {z} from 'zod';
export type ClientMovementPoint={x:number;y:number};
export type ClientMovementReport={epoch:string;revision:number;seq:number;position:ClientMovementPoint;direction:ClientMovementPoint;active:boolean;release?:boolean};
export type ClientMovementView={epoch:string;revision:number;ack:number;owner:'client'|'server';position:ClientMovementPoint;reason?:string};
const point=z.object({x:z.number().finite(),y:z.number().finite()}).strict();
export const clientMovementReportSchema=z.object({epoch:z.string().min(1).max(160),revision:z.number().int().nonnegative(),seq:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),position:point,direction:point,active:z.boolean(),release:z.boolean().optional()}).strict().superRefine((v,c)=>{if(Math.hypot(v.direction.x,v.direction.y)>1.000001)c.addIssue({code:'custom',message:'Movement direction is not normalized'});if(v.release&&v.active)c.addIssue({code:'custom',message:'Released movement cannot remain active'});});
export const clientMovementViewSchema=z.object({epoch:z.string().min(1).max(160),revision:z.number().int().nonnegative(),ack:z.number().int().nonnegative(),owner:z.enum(['client','server']),position:point,reason:z.string().optional()}).strict();
/** Timing is an ownership lease, not a periodic trajectory audit. */
export const clientMovementTiming={keepaliveMs:750,leaseTicks:68,stopGraceTicks:45} as const;
