import {beforeEach,it,expect,vi} from 'vitest';
const {request}=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('../apps/web/src/network.ts',()=>({api:request}));
import {BattleResultController} from '../apps/web/src/battle-result-controller.ts';
beforeEach(()=>{request.mockReset();const saved=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>saved.set(k,v),removeItem:(k:string)=>saved.delete(k)});});
function controller(){const returnSafe=vi.fn().mockResolvedValue(true),recover=vi.fn().mockResolvedValue(undefined),c=new BattleResultController({character:()=> 'player',settle:async()=>{},blocked:()=>false,recover,returnSafe,refresh:()=>{}});return {c,returnSafe,recover};}
it('keeps the failed run and return action after a return error, then clears them only after successful return',async()=>{
 request.mockResolvedValue({success:false});const {c,returnSafe}=controller();await c.start('permit','meadow','failure');returnSafe.mockResolvedValueOnce(false);
 await c.return();expect(c.phase).toBe('return-error');expect(c.context?.outcome).toBe('failure');expect(localStorage.getItem('aw-battle-result')).not.toBeNull();
 await c.return();expect(c.context).toBeUndefined();expect(localStorage.getItem('aw-battle-result')).toBeNull();
});
it('recovers failed result loading and returns in the same explicit click',async()=>{
 request.mockRejectedValueOnce(Error('连接中断'));const {c,returnSafe,recover}=controller();await c.start('permit','meadow','failure');expect(c.phase).toBe('offline');
 request.mockResolvedValue({success:false});await c.return();expect(recover).toHaveBeenCalledOnce();expect(returnSafe).toHaveBeenCalledOnce();expect(c.context).toBeUndefined();
});
it('loads island phase progress through the additive read endpoint',async()=>{
 request.mockResolvedValueOnce({success:true}).mockResolvedValueOnce({phase_progress:{phase:'tide',completed:5,total:6,remaining:['龙眠岛']}});
 const {c}=controller();await c.start('permit','ss-map-boss-6','success');expect(c.phase).toBe('ready');expect(request).toHaveBeenCalledWith('combat/results/permit/progress');expect(c.data?.phase_progress?.completed).toBe(5);
});
it('a missing phase read never overwrites confirmed loot or prevents returning',async()=>{
 request.mockResolvedValueOnce({success:true,gear:[{id:'saved'}]}).mockRejectedValueOnce(Error('phase read unavailable'));
 const {c,returnSafe}=controller();await c.start('permit','ss-map-boss-6','success');expect(c.phase).toBe('ready');expect(c.data?.gear).toEqual([{id:'saved'}]);expect(c.error).toContain('首领进度请到航图查看');await c.return();expect(returnSafe).toHaveBeenCalledOnce();
});
