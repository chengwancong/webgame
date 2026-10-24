import {expect,it} from 'vitest';
import {TacticalActionSchema,TacticalIntentSchema,TacticalProjectionSchema,TacticalUnitSchema} from '../packages/contracts/tactical.ts';

it('tactical commands reject unknown actions, negative cells and hidden client fields',()=>{
 expect(TacticalActionSchema.parse({type:'move',to:{x:1,y:2}})).toEqual({type:'move',to:{x:1,y:2}});
 expect(()=>TacticalActionSchema.parse({type:'win'})).toThrow();
 expect(()=>TacticalActionSchema.parse({type:'move',to:{x:-1,y:2}})).toThrow();
 expect(()=>TacticalActionSchema.parse({type:'end',damage:99})).toThrow();
});
it.each(['grid','chase','lock','buff','summon','charge-windup','move-only'])('accepts declared intent %s with public execution order',type=>{
 expect(TacticalIntentSchema.parse({id:'i',sourceId:'m',type,sequence:0,cells:[],line:[],damage:0,range:1,move:2,executeRound:1}).type).toBe(type);
});
it('unit directions are signed unit vectors and hidden RNG does not belong to public schema',()=>{
 const unit={id:'hero',side:'hero',kind:'hero',cell:{x:1,y:1},hp:100,maxHp:100,shield:0,statuses:[],cooldowns:{},eliteAffixes:[],facing:{x:0,y:-1},activeFromRound:1,flags:[]};
 expect(TacticalUnitSchema.parse(unit).facing).toEqual({x:0,y:-1});
 expect(()=>TacticalUnitSchema.parse({...unit,facing:{x:2,y:0}})).toThrow();
 expect('rngState' in TacticalProjectionSchema.shape).toBe(false);
});
