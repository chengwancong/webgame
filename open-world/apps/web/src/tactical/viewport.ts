/** One reference stage, fitted to the measured safe container without cropping. */
import tokens from '../../../../packages/ui-tokens/tokens.json';

export const tacticalStageSize=Object.freeze({
 width:Number.parseFloat(tokens.Size.UiQaStageWidth),
 height:Number.parseFloat(tokens.Size.UiQaStageHeight),
});

export type TacticalStageFit={scale:number;width:number;height:number;offsetX:number;offsetY:number};

export function fitTacticalStage(availableWidth:number,availableHeight:number):TacticalStageFit{
 if(!Number.isFinite(availableWidth)||!Number.isFinite(availableHeight)||availableWidth<=0||availableHeight<=0){
  return {scale:0,width:0,height:0,offsetX:0,offsetY:0};
 }
 const scale=Math.min(availableWidth/tacticalStageSize.width,availableHeight/tacticalStageSize.height);
 const width=tacticalStageSize.width*scale,height=tacticalStageSize.height*scale;
 return {scale,width,height,offsetX:Math.max(0,(availableWidth-width)/2),offsetY:Math.max(0,(availableHeight-height)/2)};
}
