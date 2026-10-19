// 目标阶段（docs/hud-arbitration-plan.md §2.4）：出航→前往→击败→完成，追踪条只显示一行；距离数字只在追踪条。
export type ObjectivePhase='voyage'|'travel'|'engage'|'done';
export type ObjectiveInput={
 name:string;
 /** 目标所在岛；与当前岛不同即为出航阶段。 */
 island:string;islandName:string;currentIsland:string;
 distance:number;engageRadius:number;
 /** 正在与该目标交战（受击或命中过它，且未脱战）。 */
 fighting:boolean;defeated:boolean;
 /** 'defeat' 击败类目标；'reach' 到达/交互类目标（进入半径即完成交互前的最后一步）。 */
 verb?:'defeat'|'reach';
};
/** 回滞：已在交战阶段时，离开 1.6 倍半径且脱战才退回前往，避免文案来回闪。 */
export function objectivePhase(input:ObjectiveInput,previous?:ObjectivePhase):ObjectivePhase{
 if(input.defeated)return 'done';
 if(input.island!==input.currentIsland)return 'voyage';
 const near=input.distance<=input.engageRadius,stay=previous==='engage'&&input.distance<=input.engageRadius*1.6;
 return near||input.fighting||stay?'engage':'travel';
}
export function objectivePhaseCopy(phase:ObjectivePhase,input:ObjectiveInput){
 const verb=input.verb??'defeat';
 switch(phase){
  case 'voyage':return {line:`出航 · 前往${input.islandName}`,arrow:false,distance:undefined};
  case 'travel':return {line:`前往 · ${input.name}`,arrow:true,distance:Math.max(1,Math.round(input.distance))};
  case 'engage':return {line:verb==='defeat'?`击败 · ${input.name}`:`到达 · ${input.name}`,arrow:false,distance:undefined};
  case 'done':return {line:verb==='defeat'?`已击败 · ${input.name}`:'已完成',arrow:false,distance:undefined};
 }
}
