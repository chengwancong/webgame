import {it,expect} from 'vitest';
import {assertContinuousSolve} from '../tools/spine/solve.ts';
it('真实时序敏感性超过2%的构筑轴不得进入牛顿求解',()=>{
 expect(()=>assertContinuousSolve([{key:'quake/B3/delay',error:-.0628}],['quake'])).toThrow('拒绝');
 expect(()=>assertContinuousSolve([{key:'quake/B3/delay',error:NaN}],['quake'])).toThrow('拒绝');
 expect(()=>assertContinuousSolve([{key:'quake/B3/delay',error:.019}],['quake'])).not.toThrow();
});
