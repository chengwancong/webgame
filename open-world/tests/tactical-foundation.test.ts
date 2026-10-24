import {expect,it} from 'vitest';
import {tacticalReachable,tacticalPath,commitTacticalMove,freshTacticalBudget,spendTacticalAction,type TacticalBoard} from '../packages/simulation/tactical/board.ts';
import {freshSupportLedger,claimTacticalSupport,type TacticalSupportTrigger} from '../packages/simulation/tactical/support.ts';
const board=(patch:Partial<TacticalBoard>={}):TacticalBoard=>({width:5,height:5,blocked:[],occupied:[],...patch});
it('eight adjacent cells cost one, and a clear diagonal reaches two-by-two in two steps',()=>{
 expect(tacticalReachable(board(),{x:2,y:2},1)).toHaveLength(8);
 expect(tacticalPath(board(),{x:0,y:0},{x:2,y:2},2)).toEqual([{x:0,y:0},{x:1,y:1},{x:2,y:2}]);
});
it.each(['blocked','occupied'] as const)('a %s side cell prevents diagonal corner cutting',field=>{
 const b=board({[field]:[{x:1,y:0}]});
 expect(tacticalPath(b,{x:0,y:0},{x:1,y:1},1)).toBeNull();
 expect(tacticalPath(b,{x:0,y:0},{x:1,y:1},2)).toEqual([{x:0,y:0},{x:0,y:1},{x:1,y:1}]);
});
it('two closed sides trap the corner, and targets occupied by another unit are not reachable',()=>{
 expect(tacticalReachable(board({blocked:[{x:1,y:0},{x:0,y:1}]}),{x:0,y:0},5)).toEqual([]);
 expect(tacticalPath(board({occupied:[{x:2,y:2}]}),{x:0,y:0},{x:2,y:2},8)).toBeNull();
});
it('bounded paths stay inside the board and reject malformed budgets and boards',()=>{
 expect(tacticalReachable(board(),{x:0,y:0},1)).toHaveLength(3);
 expect(()=>tacticalReachable(board(),{x:0,y:0},-1)).toThrow();
 expect(()=>tacticalPath(board(),{x:0,y:0},{x:0,y:0},-1)).toThrow();
 expect(()=>tacticalReachable(board({blocked:[{x:9,y:9}]}),{x:0,y:0},2)).toThrow();
 expect(()=>tacticalReachable(board({width:Infinity}),{x:0,y:0},2)).toThrow();
});
it('a preview is pure; one short move consumes the whole movement action, not only distance',()=>{
 const b=board(),budget=freshTacticalBudget(),before=structuredClone({b,budget});
 tacticalReachable(b,{x:0,y:0},3);expect({b,budget}).toEqual(before);
 const moved=commitTacticalMove(b,{x:0,y:0},{x:1,y:1},3,budget);
 expect(()=>commitTacticalMove(b,moved.position,{x:2,y:2},3,moved.budget)).toThrow('Movement already used');
 expect(budget).toEqual(freshTacticalBudget());
});
it.each([['move','skill'],['skill','move']] as const)('allows %s then %s, but does not allow a second main action', (first,second)=>{
 const b=spendTacticalAction(spendTacticalAction(freshTacticalBudget(),first),second);
 expect(b).toMatchObject({moveUsed:true,mainActionUsed:true});expect(()=>spendTacticalAction(b,'basic')).toThrow('Main action already used');
});
it('basic attacks share the skill action and ending a turn gives no additional action',()=>{
 const b=spendTacticalAction(freshTacticalBudget(),'basic');expect(()=>spendTacticalAction(b,'skill')).toThrow();
 const ended=spendTacticalAction(freshTacticalBudget(),'end');expect(()=>spendTacticalAction(ended,'move')).toThrow();
});
it('invalid/no-op moves leave the action budget intact',()=>{
 const b=freshTacticalBudget();expect(()=>commitTacticalMove(board(),{x:0,y:0},{x:0,y:0},3,b)).toThrow();
 expect(()=>commitTacticalMove(board(),{x:0,y:0},{x:4,y:4},1,b)).toThrow();expect(b).toEqual(freshTacticalBudget());
});
const trigger=(patch:Partial<TacticalSupportTrigger>={}):TacticalSupportTrigger=>({ownerTurnId:'turn-3',rootActionId:'action-7',effectGroup:'protect',origin:'enemy',conditionMet:true,...patch});
it('conditional support does not consume hero actions, and replayed sub-events share root deduplication',()=>{
 const budget=freshTacticalBudget(),ledger=freshSupportLedger('turn-3'),claimed=claimTacticalSupport(ledger,trigger(),2);
 expect(claimed.claimed).toBe(true);expect(ledger.counts).toEqual({});expect(budget).toEqual(freshTacticalBudget());
 expect(claimTacticalSupport(claimed.ledger,trigger(),2).reason).toBe('duplicate');
 const restored=JSON.parse(JSON.stringify(claimed.ledger));expect(claimTacticalSupport(restored,trigger(),2).reason).toBe('duplicate');
});
it('effect groups share a turn limit; a new turn must explicitly start a fresh ledger',()=>{
 const a=claimTacticalSupport(freshSupportLedger('turn-3'),trigger(),1);
 expect(claimTacticalSupport(a.ledger,trigger({rootActionId:'action-8'}),1).reason).toBe('limit');
 expect(claimTacticalSupport(a.ledger,trigger({ownerTurnId:'turn-4'}),1).reason).toBe('turn');
 expect(claimTacticalSupport(freshSupportLedger('turn-4'),trigger({ownerTurnId:'turn-4'}),1).claimed).toBe(true);
});
it('unmet conditions and pet-support recursion never consume support budget',()=>{
 const l=freshSupportLedger('turn-3');expect(claimTacticalSupport(l,trigger({conditionMet:false}),1).reason).toBe('condition');
 expect(claimTacticalSupport(l,trigger({origin:'pet-support'}),1).reason).toBe('recursive');expect(l.counts).toEqual({});
});
