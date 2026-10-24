/**
 * 棋盘回合制前端「消费侧」视图契约草案（Claude，2026-10-24）。
 *
 * 这不是已注册的服务端 API。字段只描述界面需要读到什么；实际字段名与语义以后端冻结的
 * 遭遇投影为准，缺口清单见 docs/hub-portal-rework-20261021/planning-bd-v1/claude-frontend-progress.md。
 * 界面只显示这些已解析结果：路径、可达格、射程、视线、费用、伤害、冷却、超时与奖励都不在前端计算。
 * 唯一的实现是 `TacticalSource`；当前只有隔离 fixture（`source:'fixture'`），没有生产实现。
 */
export type TacticalSourceKind='fixture'|'server'|'sandbox';
export type TacticalCell={x:number;y:number};
export const cellKey=(c:TacticalCell)=>c.x+','+c.y;
export const sameCell=(a:TacticalCell|null|undefined,b:TacticalCell|null|undefined)=>!!a&&!!b&&a.x===b.x&&a.y===b.y;

/** 格子属性来自冻结棋盘模板；图像只是表现，`dressing` 不赋予任何规则。 */
export type TacticalCellView={x:number;y:number;walkable:boolean;blocksSight:boolean|null;revealed:boolean;
 /** 已公开的危险格（例如地面区）。说明文字来自服务端；没有规则效果的样例必须写明。 */
 hazard:{label:string;detail:string}|null;dressing:string|null};
export type TacticalStatusView={id:string;label:string;remaining:string|null;tone:'buff'|'debuff'|'neutral'};
export type TacticalArtRef={kind:'hero-native'|'starsea-atlas';assetId:string};
export type TacticalUnitView={id:string;side:'hero'|'enemy';name:string;cell:TacticalCell;footprint:1;alive:boolean;
 hp:{current:number;max:number};shield:number|null;resource:{label:string;current:number;max:number}|null;
 statuses:TacticalStatusView[];art:TacticalArtRef;tier:'normal'|'elite'|'boss'};
/** 两项额度分开记录，不是共用 AP。`moveSteps` 为本次移动上限，来自规则；未知时为 null。 */
export type TacticalBudgetView={moveUsed:boolean;mainActionUsed:boolean;ended:boolean;moveSteps:number|null};
export type TacticalAbilityView={id:string;slot:number;label:string;iconSrc:string|null;
 /** basic/skill 由新回合契约明确给出；旧 0 槽 basic 不自动映射。 */
 category:'basic'|'skill';migration:'supported'|'unsupported';available:boolean;reason:string|null;
 cost:string|null;cooldown:string|null;rangeText:string|null;description:string};
export type TacticalPetView={familyId:string;runtimeId:string;name:string;
 conditionText:string|null;status:'ready'|'not-met'|'spent'|'unconfigured';statusText:string;
 /** 本触发窗口剩余次数（服务端给出）；未配置为 null。 */
 remainingInWindow:number|null};
/** 控制投影：对应 control.ts 的 tacticalControlView，加服务端时间基准。客户端只展示。 */
export type TacticalControlView={mode:'manual'|'auto';phase:'boundary'|'awaiting'|'resolving'|'enemy'|'ended';
 pendingManual:boolean;deadlineAtMs:number|null;warningMs:number;serverNowMs:number;
 autoReason:'manual-timeout'|'player'|null;canRequestAuto:boolean;canRequestManual:boolean};
export type TacticalLegalMove={cell:TacticalCell;cost:number;path:TacticalCell[]};
export type TacticalResultView={outcome:'victory'|'defeat'|'retreat'|'system-abort';receiptId:string|null;
 rewards:{label:string;amount:string}[];rewardsNote:string;nodeCompleted:boolean;returnLabel:string};
export type TacticalEncounterView={
 source:TacticalSourceKind;encounterId:string;revision:number;ruleVersion:string;protocolVersion:string;
 node:{name:string;objective:string;enemyGroup:string};round:number|null;
 phase:'awaiting'|'resolving'|'enemy'|'settling'|'ended';
 /** 当前行动者；敌方阶段时为正在行动的敌人（若公开）。 */
 actorId:string|null;actionToken:string|null;
 board:{width:number;height:number;cells:TacticalCellView[]};
 units:TacticalUnitView[];budget:TacticalBudgetView;abilities:TacticalAbilityView[];
 /** 当前行动者的合法移动集合（含完整路径）。移动额度已用或非手动等待时为空。 */
 legalMoves:TacticalLegalMove[];
 pet:TacticalPetView|null;control:TacticalControlView;result:TacticalResultView|null;
 /** 本轮已公布的敌方意图（按 order 排序）；有意图时 unsupported 不再列"敌方意图"。 */
 intents:TacticalIntentView[];
 /** 尚未接通、在界面上必须明确写出的能力（例如行动顺序）。 */
 unsupported:string[]};

/** 意图视图（服务端已公布、前端只读）。 */
export type TacticalIntentView={
 unitId:string;order:number;
 type:'grid'|'chase'|'lock'|'buff'|'summon'|'charge-windup'|'move-only';
 /** 格子型：受击格列表；追击型：预计可达格；锁定型：直线格；其他：空。 */
 cells:TacticalCell[];
 /** 追击型/锁定型的目标单位 id；无目标时为 null。 */
 targetId:string|null;
 /** 锁定型/冲锋型的路径直线；不适用时为 null。 */
 line:TacticalCell[]|null;
 /** 预计伤害数值或档位；不公开时为 null。 */
 damage:{kind:'amount';value:number}|{kind:'tier';tier:'light'|'heavy'|'lethal'}|null;
 /** 意图在执行时已落空（被控制、断视线等）。 */
 /** 服务端单独给出的威胁档位（重 / 致命）；普通档不标。 */
 tier?:'heavy'|'lethal';
 fizzled:boolean;
 /** 刺客首回合隐身：隐藏类型与伤害，前端只显示"?"。 */
 hidden:boolean;
 label:string;
};
/** 托管编排参数（开局时提交，之后不变）。 */
export type TacticalOrchestration={
 priority:string[];
 target:'nearest'|'lowest-hp'|'support-first'|null;
 position:'stay-close'|'keep-distance'|'behind-cover'|null;
 guard:boolean;
};
/** 行动结果预测（来自服务端预览；前端不自行计算）。 */
export type TacticalForecast={
 kills:string[];
 damage:{unitId:string;amount:number}[];
 /** 执行完本轮全部敌方意图后主角预计剩余生命；缺失时为 null。 */
 heroHpAfterIntents:number|null;
 heroMaxHp:number;
};
export type TacticalPreviewRequest={kind:'move';to:TacticalCell}|{kind:'ability';abilityId:string;target:TacticalCell};
export type TacticalDenial={code:'unreachable'|'blocked'|'occupied'|'corner'|'out-of-budget'|'out-of-range'|'sight'|'invalid-target'|'used'|'unsupported'|'not-your-turn';message:string};
export type TacticalPreview=
 |{ok:true;kind:'move';destination:TacticalCell;path:TacticalCell[];steps:number;notes:string[];forecast?:TacticalForecast}
 |{ok:true;kind:'ability';abilityId:string;target:TacticalCell;rangeCells:TacticalCell[];affectedCells:TacticalCell[];
   targets:string[];known:{label:string;value:string}[];uncertain:string[];notes:string[];forecast?:TacticalForecast}
 |{ok:false;denial:TacticalDenial};
export type TacticalCommand={commandId:string;encounterId:string;expectedRevision:number;actionToken:string}&(
 |{kind:'move';to:TacticalCell}|{kind:'ability';abilityId:string;target:TacticalCell}|{kind:'end-activation'}
 /** 撤退：服务端判定是否允许与后果；界面只在确认对话后发出。 */
 |{kind:'retreat'});
export type TacticalControlCommand={commandId:string;encounterId:string;op:'request-auto'|'request-manual'};
/** 已提交事实。表现只播放这些事件；`id` 用于去重，重放不重复反馈。 */
export type TacticalEvent={id:string;seq:number;actionId:string|null;atMs:number}&(
 |{kind:'move';unitId:string;path:TacticalCell[]}
 |{kind:'ability';unitId:string;abilityId:string;label:string;target:TacticalCell}
 |{kind:'damage';unitId:string;sourceId:string;amount:number;absorbed:number;hpAfter:number}
 |{kind:'shield';unitId:string;sourceId:string;added:number;total:number}
 |{kind:'defeated';unitId:string}
 |{kind:'pet-assist';petRuntimeId:string;rootActionId:string;label:string;effect:string}
 |{kind:'pet-skipped';petRuntimeId:string;rootActionId:string;reason:string}
 |{kind:'turn';phase:'hero'|'enemy';round:number}
 |{kind:'end-activation';unitId:string}
 |{kind:'control';change:'timeout-auto'|'auto-applied'|'manual-requested'|'manual-applied'|'manual-cancelled'|'ended'}
 |{kind:'result';outcome:TacticalResultView['outcome']}
 /** 没有专门表现的服务端事实（治疗、拉拽、蓄力、阶段切换、意图落空等），只进战报。 */
 |{kind:'note';unitId:string|null;text:string});
export type TacticalReceipt={commandId:string;accepted:boolean;revision:number;events:TacticalEvent[];
 denial?:TacticalDenial};
export type TacticalPush={events:TacticalEvent[];view:TacticalEncounterView};
export type TacticalSourceErrorCode='network'|'control-conflict'|'version-mismatch'|'not-found'|'stale-revision'|'load-failed'|'empty';
export class TacticalSourceError extends Error{
 constructor(readonly code:TacticalSourceErrorCode,message:string,readonly retryable=true){super(message);}
}
export type TacticalEncounterIntent={commandId:string;nodeName:string;groupId:string};
export type TacticalEncounterHandle={encounterId:string;node:{name:string;objective:string;enemyGroup:string};alreadyActive:boolean};

/** 唯一的数据源接口。生产实现须发 HTTP/WS 到服务端；本批只有 fixture。 */
export interface TacticalSource{
 readonly kind:TacticalSourceKind;
 /** 遇敌意图：服务端校验接触并返回同一遭遇（重复请求返回已存在的那一场）。 */
 engage(intent:TacticalEncounterIntent):Promise<TacticalEncounterHandle>;
 /** 读取冻结遭遇；断线恢复也走这里。不得刷新等待截止时刻。 */
 load(encounterId:string):Promise<TacticalEncounterView>;
 /** 只读预览，不消耗额度、不推进随机、不续期等待。 */
 preview(encounterId:string,request:TacticalPreviewRequest):Promise<TacticalPreview>;
 submit(command:TacticalCommand):Promise<TacticalReceipt>;
 control(command:TacticalControlCommand):Promise<TacticalReceipt>;
 /** 服务端推送（敌方阶段、托管、超时）。返回取消订阅。 */
 subscribe(encounterId:string,listener:(push:TacticalPush)=>void):()=>void;
 /** 胜利/失败后确认结果并返回探索。返回的是服务端给出的返回说明。 */
 returnToExplore(encounterId:string,commandId:string):Promise<{message:string}>;
}
