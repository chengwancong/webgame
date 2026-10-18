import {defenseById,steps} from '../task-tables.ts';
/** 守护参数来自 config/excel/章节.xlsx「守护配置」；哪些任务使用它由步骤表 defense 列决定。 */
const row=defenseById.get('engine');
if(!row)throw Error('配置表 chapters.json：缺少守护配置 engine');
export const engineDefense={tasks:[...new Set(steps.filter(s=>s.defense==='engine').map(s=>s.task))],radius:row.radius,holdTicks:row.hold_ticks,hp:row.hp,hpMultiplier:row.hp_multiplier,attackMultiplier:row.attack_multiplier,/** 失败后至少隔这么久才能修复重开。 */retrySeconds:row.retry_seconds};
