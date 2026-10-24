import {effectRuleSchema} from '../packages/contracts/effects.ts';

// Test-only probes for the shared effect interpreter. These are not player content,
// are never offered in a run, and do not depend on the removed random-pick system.
const base={tier:1,chance:1,icd:0,when:[],filter:{},vfxKey:'player/whirl',scale:[]};
export const orbitFixture=()=>effectRuleSchema.parse({...base,id:'fixture-orbit',name:'环绕机制夹具',description:'固定机制测试',source:'fixture-orbit',trigger:'interval',every:90,action:{type:'field',ratio:.8,damageType:'arcane',radius:2.5,duration:90,interval:15,at:'self',orbit:true,projectiles:3}});
export const alternatingCritFixture=()=>effectRuleSchema.parse({...base,id:'fixture-alternating-crit',name:'分阶段机制夹具',description:'固定机制测试',source:'fixture-alternating-crit',trigger:'interval',every:150,action:{type:'buff',duration:150,maxStacks:1,mods:{},alternate:[{critChance:1},{critChance:0}],setMods:['critChance']}});
export const lethalProtectionFixture=()=>effectRuleSchema.parse({...base,id:'fixture-last-stand',name:'致命防护机制夹具',description:'固定机制测试',source:'fixture-last-stand',trigger:'lethal',maxTriggers:1,action:{type:'buff',duration:1,maxStacks:1,mods:{reviveRatio:.85},flags:{immortal:true}}});
