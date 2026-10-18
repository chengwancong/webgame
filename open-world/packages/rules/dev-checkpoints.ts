import {StarseaError,devCompleteStarseaTasks,type StarseaGain} from './starsea.ts';
import {choosePrologueWeapon,finishPrologue,prologuePending} from './starsea-prologue.ts';
import type {PrologueFamily} from '../content/starsea/prologue.ts';
import type {CharacterState} from '../contracts/index.ts';
/** 本地验收检查点：把还没打开场的新测试号直接推到某个任务节点，省掉每段验收从头打的时间。
 * 只在开发服（testLogin 且非正式环境）对 qa_ 开头的账号开放；任务按正常完成流程走，奖励、经验、送技能和解锁与玩家亲手做完一致。 */
export const devCheckpoints={
 /** 开场结束，站在落点求生。 */
 landing:[],
 /** 抢救船台已接，引擎还没启动。 */
 salvage:['ss-c01-t01','ss-c01-n01','ss-c01-t02'],
 /** 抢救船台已完成（护身印到手），走到分岔口即可接「两条进港路」。 */
 'port-road':['ss-c01-t01','ss-c01-n01','ss-c01-t02','ss-c01-t03'],
} as const satisfies Record<string,readonly string[]>;
export type DevCheckpoint=keyof typeof devCheckpoints;
export const devCheckpointIds=Object.keys(devCheckpoints) as [DevCheckpoint,...DevCheckpoint[]];
export function applyDevCheckpoint(s:CharacterState,checkpoint:DevCheckpoint,weapon:PrologueFamily,at:number):StarseaGain{
 if(!prologuePending(s)||s.starsea?.prologue?.weapon||s.starsea!.done.length)throw new StarseaError('DEV_CHECKPOINT','检查点只能用在刚建好、还没打开场的角色上。');
 choosePrologueWeapon(s,weapon);finishPrologue(s);
 return devCompleteStarseaTasks(s,devCheckpoints[checkpoint],at);
}
