import {tacticalReachable,type TacticalBoard,type TacticalCell} from './board.ts';
import type {TacticalProjection,TacticalUnit} from '../../contracts/tactical.ts';
export const sameCell=(a:TacticalCell,b:TacticalCell)=>a.x===b.x&&a.y===b.y;
export const distance=(a:TacticalCell,b:TacticalCell)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
export const cellKey=(c:TacticalCell)=>`${c.x},${c.y}`;
export const inside=(b:{width:number;height:number},c:TacticalCell)=>c.x>=0&&c.y>=0&&c.x<b.width&&c.y<b.height;
export const direction=(a:TacticalCell,b:TacticalCell)=>({x:Math.sign(b.x-a.x),y:Math.sign(b.y-a.y)});
export const aligned=(a:TacticalCell,b:TacticalCell)=>a.x===b.x||a.y===b.y||Math.abs(a.x-b.x)===Math.abs(a.y-b.y);
export function lineCells(a:TacticalCell,b:TacticalCell):TacticalCell[]{
 const result:TacticalCell[]=[];let x=a.x,y=a.y;const dx=Math.abs(b.x-x),sx=x<b.x?1:-1,dy=-Math.abs(b.y-y),sy=y<b.y?1:-1;let err=dx+dy;
 while(true){result.push({x,y});if(x===b.x&&y===b.y)break;const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}return result;
}
export function hasLineOfSight(board:TacticalProjection['board'],a:TacticalCell,b:TacticalCell){return inside(board,b)&&lineCells(a,b).slice(1).every(c=>!board.blocked.some(w=>sameCell(c,w)));}
export function boardFor(s:Pick<TacticalProjection,'board'|'units'>,unit:TacticalUnit,jump=false):TacticalBoard{return {...s.board,occupied:jump?[]:s.units.filter(u=>u.hp>0&&u.id!==unit.id).map(u=>u.cell)};}
export function reachableFor(s:Pick<TacticalProjection,'board'|'units'>,unit:TacticalUnit,steps:number,jump=false){
 const occupied=s.units.filter(u=>u.hp>0&&u.id!==unit.id).map(u=>u.cell);
 return tacticalReachable(boardFor(s,unit,jump),unit.cell,steps).filter(r=>!occupied.some(c=>sameCell(c,r.cell)));
}
export function area(board:TacticalProjection['board'],center:TacticalCell,radius:number){const out:TacticalCell[]=[];for(let y=center.y-radius;y<=center.y+radius;y++)for(let x=center.x-radius;x<=center.x+radius;x++){const c={x,y};if(inside(board,c)&&!board.blocked.some(w=>sameCell(w,c)))out.push(c);}return out;}
export const compareCells=(a:TacticalCell,b:TacticalCell)=>a.y-b.y||a.x-b.x;
export function ray(s:Pick<TacticalProjection,'board'>,from:TacticalCell,dir:TacticalCell,range:number){const cells:TacticalCell[]=[];for(let i=1;i<=range;i++){const c={x:from.x+dir.x*i,y:from.y+dir.y*i};if(!inside(s.board,c)||s.board.blocked.some(w=>sameCell(w,c)))break;cells.push(c);}return cells;}
