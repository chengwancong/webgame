/** A display projection only: logical square cells, paths and ranges are untouched. */
import tokens from '../../../../packages/ui-tokens/tokens.json';
import type {TacticalCell,TacticalEncounterView} from './contract.ts';

export const tacticalGeometry={
 depth:Number(tokens.Tactical.CellDepth),maxCell:Number.parseFloat(tokens.Size.TacticalCellMax),
 labelWidth:Number.parseFloat(tokens.Size.TacticalLabelWidth),labelHeight:Number.parseFloat(tokens.Size.TacticalLabelHeight),
 labelGap:Number.parseFloat(tokens.Size.TacticalLabelGap),
};
export type BoardDisplayLayout={cell:number;rowHeight:number;width:number;height:number};
export function fitSceneBoard(view:Pick<TacticalEncounterView,'board'>,width:number,height:number):BoardDisplayLayout{
 const cell=Math.max(1,Math.min(tacticalGeometry.maxCell,Math.floor(Math.min(width/view.board.width,height/(view.board.height*tacticalGeometry.depth)))));
 const rowHeight=cell*tacticalGeometry.depth;
 return {cell,rowHeight,width:cell*view.board.width,height:rowHeight*view.board.height};
}
export function cellFoot(cell:TacticalCell,layout:Pick<BoardDisplayLayout,'cell'|'rowHeight'>){
 return {x:(cell.x+.5)*layout.cell,y:(cell.y+.82)*layout.rowHeight};
}
