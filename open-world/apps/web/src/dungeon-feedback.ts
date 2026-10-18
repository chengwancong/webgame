import type {DungeonStatus} from '../../../packages/contracts/dungeons.ts';
const failureLabels:Record<string,string>={busy:'施法仍在进行。',controlled:'受控制，不能施法。',cooldown:'技能仍在冷却。',resource:'能量不足。',range:'目标超出施放距离。',blocked:'路径或落点被阻挡。',target:'目标已失效。',unneeded:'当前没有需要恢复或净化的状态。'};
/** Completed encounters report their current result, not failures replayed from their final checkpoint. */
export function dungeonFrameNotices(previous:DungeonStatus|undefined,current:DungeonStatus,failures:readonly {reason:string}[]):string[]{
 if(current==='success')return previous===current?[]:['挑战成功，战利品已保存。'];
 if(current==='failed'||current==='abandoned')return previous===current?[]:['本次挑战已结束，请查看结算。'];
 if(current!=='running')return [];
 return failures.map(event=>failureLabels[event.reason]??'本次技能未释放。');
}
