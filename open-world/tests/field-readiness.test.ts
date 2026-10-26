import {it,expect} from 'vitest';
import {autoBattleBlock,bagFull} from '../apps/web/src/field-readiness.ts';
it('blocks full and overfull auto battle independently of pending drops, and permits it after cleanup',()=>{
 const gear=Array.from({length:24},()=>({})) as any[];
 expect(bagFull({gear,capacity:24})).toBe(true);expect(autoBattleBlock({gear,capacity:24},100)).toContain('回港整理');
 expect(autoBattleBlock({gear:[...gear,{}] as any[],capacity:24},100)).toContain('已停止');
 expect(autoBattleBlock({gear:gear.slice(0,23),capacity:24},100)).toBe('');
 expect(autoBattleBlock({gear:[],capacity:24},0)).toContain('回港整备');
});
