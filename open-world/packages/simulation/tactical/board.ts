/** Isolated tactical prototype. Not connected to World, rewards or live dungeon execution. */
export type TacticalCell={x:number;y:number};
export type TacticalBoard={width:number;height:number;blocked:readonly TacticalCell[];occupied:readonly TacticalCell[]};
export type TacticalReachable={cell:TacticalCell;cost:number;path:TacticalCell[]};
const key=(p:TacticalCell)=>p.x+','+p.y;
const same=(a:TacticalCell,b:TacticalCell)=>a.x===b.x&&a.y===b.y;
const offsets=[[-1,0],[0,-1],[1,0],[0,1],[-1,-1],[1,-1],[1,1],[-1,1]] as const;
function index(board:TacticalBoard){
 if(!Number.isSafeInteger(board.width)||!Number.isSafeInteger(board.height)||board.width<1||board.height<1||board.width*board.height>16384)throw Error('Invalid tactical board dimensions');
 const inside=(p:TacticalCell)=>Number.isSafeInteger(p.x)&&Number.isSafeInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<board.width&&p.y<board.height;
 if([...board.blocked,...board.occupied].some(p=>!inside(p)))throw Error('Invalid tactical cell');
 const blocked=new Set(board.blocked.map(key)),occupied=new Set(board.occupied.map(key));
 return {inside,blocked,free:(p:TacticalCell)=>inside(p)&&!blocked.has(key(p))&&!occupied.has(key(p))};
}
/** Prototype default: each adjacent step costs one. Both side cells must be free for a diagonal. */
export function tacticalReachable(board:TacticalBoard,from:TacticalCell,maxSteps:number):TacticalReachable[]{
 if(!Number.isSafeInteger(maxSteps)||maxSteps<0)throw Error('Invalid movement budget');
 const map=index(board);if(!map.inside(from)||map.blocked.has(key(from)))throw Error('Invalid movement origin');
 const queue:TacticalReachable[]=[{cell:{...from},cost:0,path:[{...from}]}],seen=new Set([key(from)]);
 for(let at=0;at<queue.length;at++){
  const current=queue[at];if(current.cost>=maxSteps)continue;
  for(const [dx,dy] of offsets){
   const next={x:current.cell.x+dx,y:current.cell.y+dy};
   if(seen.has(key(next))||!map.free(next))continue;
   if(dx!==0&&dy!==0&&(!map.free({x:current.cell.x+dx,y:current.cell.y})||!map.free({x:current.cell.x,y:current.cell.y+dy})))continue;
   seen.add(key(next));queue.push({cell:next,cost:current.cost+1,path:[...current.path,next]});
  }
 }
 return queue.slice(1);
}
export function tacticalPath(board:TacticalBoard,from:TacticalCell,to:TacticalCell,maxSteps:number):TacticalCell[]|null{
 if(!Number.isSafeInteger(maxSteps)||maxSteps<0)throw Error('Invalid movement budget');
 if(same(from,to)){tacticalReachable(board,from,0);return [{...from}];}
 return tacticalReachable(board,from,maxSteps).find(row=>same(row.cell,to))?.path??null;
}
export type TacticalActionBudget={moveUsed:boolean;mainActionUsed:boolean;ended:boolean};
export const freshTacticalBudget=():TacticalActionBudget=>({moveUsed:false,mainActionUsed:false,ended:false});
/** Call only after the server validates the requested skill/target/resources. */
export function spendTacticalAction(budget:TacticalActionBudget,kind:'move'|'skill'|'basic'|'end'):TacticalActionBudget{
 if(!['move','skill','basic','end'].includes(kind))throw Error('Unknown tactical action');
 if(budget.ended)throw Error('Turn already ended');
 if(kind==='end')return {...budget,ended:true};
 if(kind==='move'){if(budget.moveUsed)throw Error('Movement already used');return {...budget,moveUsed:true};}
 if(budget.mainActionUsed)throw Error('Main action already used');
 return {...budget,mainActionUsed:true};
}
/** Preview consumes nothing. Commit uses one complete path; remaining distance cannot be banked. */
export function commitTacticalMove(board:TacticalBoard,from:TacticalCell,to:TacticalCell,maxSteps:number,budget:TacticalActionBudget){
 if(same(from,to))throw Error('Choose a different destination');
 const path=tacticalPath(board,from,to,maxSteps);if(!path)throw Error('Unreachable destination');
 return {position:{...to},path,budget:spendTacticalAction(budget,'move')};
}
