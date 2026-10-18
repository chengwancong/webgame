import {it,expect} from 'vitest';
import {refinePacingPlan} from '../tools/pacing/refine-model.ts';
import {calibratePacingPlan} from '../tools/pacing/calibrate-model.ts';
import {snapKnob,mechanismKnobs,validateKnobs} from '../tools/pacing/derive-model.ts';
it('旧refine入口使用同一调整规则，不保留单构筑分支',()=>{expect(refinePacingPlan).toBe(calibratePacingPlan);expect(()=>validateKnobs()).not.toThrow();for(const k of mechanismKnobs){expect(snapKnob(-1e6,k)).toBeCloseTo(Math.ceil((k.floor-1e-9)/k.step)*k.step);expect(snapKnob(1e6,k)).toBeCloseTo(Math.floor((k.ceiling+1e-9)/k.step)*k.step);expect(snapKnob(Math.ceil((k.floor-1e-9)/k.step)*k.step+k.step*.49,k)).toBeCloseTo(Math.ceil((k.floor-1e-9)/k.step)*k.step);expect(snapKnob(Math.ceil((k.floor-1e-9)/k.step)*k.step+k.step*.51,k)).toBeCloseTo(Math.ceil((k.floor-1e-9)/k.step)*k.step+k.step);}});
