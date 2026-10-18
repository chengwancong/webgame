/** 主干推导的技能系数与节点每点数值。缺项保持内容源声明，不增加独立公式。 */
import {z} from 'zod';
import skillData from './skill-coefficients.json';
import nodeData from './progression-node-values.json';
export const skillCoefficients=z.record(z.string().min(1),z.number().finite().positive()).parse(skillData);
export const progressionNodeValues=z.record(z.string().min(1),z.array(z.number().finite().nonnegative())).parse(nodeData);
