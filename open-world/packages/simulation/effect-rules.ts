import type {Stats} from '../contracts/index.ts';
import {comboToEffect,executableRule,type EffectRule} from '../contracts/effects.ts';
const cache=new WeakMap<object,ReturnType<typeof executableRule>>();
export function combatRules(stats:Stats){return (stats.rules??stats.combos??[]).map(source=>{let r=cache.get(source);if(!r){r=executableRule('icd' in source?source:comboToEffect(source));cache.set(source,r);}return r;});}
/** Unsupported effects disable this sample only; never change penalty policy. */
export function upperBoundSupported(r:EffectRule){return ['hit','crit','kill','cast','nth','passive'].includes(r.trigger)&&['nova','shards','status','spread','echo','refund','amplify'].includes(r.action.type);}
