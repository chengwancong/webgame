import {deriveMechanismPlan} from './derive-model.ts';
/** 所有构筑统一使用实测弹性的一阶锚点模型，只有一轮显式调整。 */
export function calibratePacingPlan(targets:unknown,validation:any,combat:any,sources:Record<string,any>,options?:{recenter?:boolean;knobs?:import('./derive-model.ts').MechanismKnob[]}){return deriveMechanismPlan(targets,validation,combat,sources,{adjustment:true,recenter:options?.recenter,knobs:options?.knobs});}
