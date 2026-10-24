import type {TacticalCell,TacticalCommand,TacticalEncounterView,TacticalPreview} from './contract.ts';
import {sameCell} from './contract.ts';

/**
 * 选择状态（纯函数）。当前行动者（view.actorId）、查看单位（inspectId）与目标（target）三者分开记录：
 * 点敌人在「未选指令」时只是查看，不会变成攻击目标。预览只读，结果按序号丢弃过期响应。
 */
export type TacticalCommandMode='none'|'move'|'ability';
export type SelectionState={
 command:TacticalCommandMode;abilityId:string|null;inspectId:string|null;
 cursor:TacticalCell;hover:TacticalCell|null;target:TacticalCell|null;
 preview:TacticalPreview|null;previewPending:boolean;previewSerial:number;
 /** 已发出、等待回执的指令；重试必须复用同一 commandId。 */
 submitting:TacticalCommand|null;
 message:string|null;confirmRetreat:boolean;
};
export type SelectionAction=
 |{type:'choose-move'}|{type:'choose-ability';abilityId:string}|{type:'cancel'}
 |{type:'pick-cell';cell:TacticalCell}|{type:'hover';cell:TacticalCell|null}|{type:'cursor';cell:TacticalCell}
 |{type:'inspect';unitId:string|null}
 |{type:'preview-result';serial:number;preview:TacticalPreview}|{type:'preview-failed';serial:number;message:string}
 |{type:'submit-start';command:TacticalCommand}|{type:'submit-done'}|{type:'submit-failed';message:string;keep:boolean}
 |{type:'retreat-ask'}|{type:'retreat-cancel'}
 |{type:'view';view:TacticalEncounterView}|{type:'message';message:string|null};

export const initialSelection=(cursor:TacticalCell):SelectionState=>({command:'none',abilityId:null,inspectId:null,cursor,hover:null,
 target:null,preview:null,previewPending:false,previewSerial:0,submitting:null,message:null,confirmRetreat:false});

/** 只有手动等待且未提交时，玩家才能下指令。 */
export function canCommand(view:TacticalEncounterView|null,selection:Pick<SelectionState,'submitting'>){
 return !!view&&view.phase==='awaiting'&&view.control.mode==='manual'&&view.control.phase==='awaiting'&&!view.budget.ended&&!selection.submitting;
}
const clearTarget=(s:SelectionState):SelectionState=>({...s,target:null,preview:null,previewPending:false,previewSerial:s.previewSerial+1});
const reset=(s:SelectionState):SelectionState=>({...clearTarget(s),command:'none',abilityId:null,confirmRetreat:false});

export function reduceSelection(s:SelectionState,action:SelectionAction,view:TacticalEncounterView|null):SelectionState{
 switch(action.type){
  case 'choose-move':{
   if(!canCommand(view,s))return {...s,message:'现在不能操作。'};
   if(view!.budget.moveUsed)return {...s,message:'本回合的移动已用。'};
   if(s.command==='move')return {...reset(s),message:null};
   return {...clearTarget(s),command:'move',abilityId:null,message:null,confirmRetreat:false};
  }
  case 'choose-ability':{
   if(!canCommand(view,s))return {...s,message:'现在不能操作。'};
   const ability=view!.abilities.find(a=>a.id===action.abilityId);
   if(!ability)return s;
   if(ability.migration!=='supported')return {...s,message:'这个技能尚未迁移到回合制。'};
   if(view!.budget.mainActionUsed)return {...s,message:'本回合的技能已用。'};
   if(!ability.available)return {...s,message:ability.reason??'当前无法使用这个技能。'};
   if(s.command==='ability'&&s.abilityId===ability.id)return {...reset(s),message:null};
   return {...clearTarget(s),command:'ability',abilityId:ability.id,message:null,confirmRetreat:false};
  }
  case 'cancel':
   if(s.confirmRetreat)return {...s,confirmRetreat:false};
   if(s.target)return {...clearTarget(s),message:null};
   if(s.command!=='none')return {...reset(s),message:null};
   return {...s,inspectId:null,message:null};
  case 'pick-cell':{
   const cursor=action.cell;
   if(s.command==='none'||!canCommand(view,s)){
    const unit=view?.units.find(u=>u.alive&&sameCell(u.cell,action.cell));
    return {...s,cursor,inspectId:unit?unit.id:null,message:null};
   }
   if(sameCell(s.target,action.cell))return {...s,cursor};
   return {...s,cursor,target:{...action.cell},preview:null,previewPending:true,previewSerial:s.previewSerial+1,message:null};
  }
  case 'hover':return {...s,hover:action.cell};
  case 'cursor':return {...s,cursor:action.cell};
  case 'inspect':return {...s,inspectId:action.unitId};
  case 'preview-result':
   if(action.serial!==s.previewSerial||!s.target)return s;
   return {...s,preview:action.preview,previewPending:false};
  case 'preview-failed':
   if(action.serial!==s.previewSerial)return s;
   return {...s,preview:null,previewPending:false,message:action.message};
  case 'submit-start':return {...s,submitting:action.command,message:null};
  case 'submit-done':return {...reset(s),submitting:null};
  case 'submit-failed':return action.keep?{...s,message:action.message}:{...s,submitting:null,message:action.message};
  case 'retreat-ask':return canCommand(view,s)?{...clearTarget(s),command:'none',abilityId:null,confirmRetreat:true}:s;
  case 'retreat-cancel':return {...s,confirmRetreat:false};
  case 'message':return {...s,message:action.message};
  case 'view':{
   const v=action.view;let next=s;
   if(!canCommand(v,{submitting:null})&&!s.submitting)next=reset(s);
   else if(next.command==='move'&&v.budget.moveUsed)next=reset(next);
   else if(next.command==='ability'&&v.budget.mainActionUsed)next=reset(next);
   if(next.inspectId&&!v.units.some(u=>u.id===next.inspectId&&u.alive))next={...next,inspectId:null};
   const inside=next.cursor.x<v.board.width&&next.cursor.y<v.board.height;
   return inside?next:{...next,cursor:{x:0,y:0}};
  }
 }
}

/** 预览结果对应的指令（只在 ok 时可确认）。 */
export function commandFromPreview(view:TacticalEncounterView,s:SelectionState,commandId:string):TacticalCommand|null{
 const p=s.preview;if(!p||!p.ok||!view.actionToken)return null;
 const base={commandId,encounterId:view.encounterId,expectedRevision:view.revision,actionToken:view.actionToken};
 if(p.kind==='move')return {...base,kind:'move',to:{...p.destination}};
 return {...base,kind:'ability',abilityId:p.abilityId,target:{...p.target}};
}
