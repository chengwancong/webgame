import {beforeEach,it,expect,vi} from 'vitest';
const {request}=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('../apps/web/src/network.ts',()=>({api:request}));
import {BattleResultController} from '../apps/web/src/battle-result-controller.ts';
beforeEach(()=>{request.mockReset();const saved=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>saved.set(k,v),removeItem:(k:string)=>saved.delete(k)});});
function controller(){const returnSafe=vi.fn().mockResolvedValue(true),recover=vi.fn().mockResolvedValue(undefined),c=new BattleResultController({character:()=> 'player',settle:async()=>{},blocked:()=>false,recover,returnSafe,refresh:()=>{}});return {c,returnSafe,recover};}
it('keeps local cumulative and omitted damage when the advice endpoint returns its own fields',async()=>{
 const review={totalTaken:693,omittedTaken:400,source:'client' as const,fatal:{enemy:'乌洛',skill:'重击',damage:93,damageType:'物理',statuses:[],hint:'离开攻击范围',kind:'melee' as const},recent:['乌洛 · 重击：200 伤害'],advice:[]};
 request.mockImplementation(async(path:string)=>path==='combat/review'?{fatal:review.fatal,recent:review.recent,advice:[]}:{success:false});
 const c=new BattleResultController({character:()=> 'player',review:()=>review,settle:async()=>{},blocked:()=>false,recover:async()=>{},returnSafe:async()=>true,refresh:()=>{}});
 await c.start('permit','meadow','failure');expect(c.context?.review).toMatchObject({totalTaken:693,omittedTaken:400,source:'client'});
 expect(JSON.parse(localStorage.getItem('aw-battle-result')!).review.omittedTaken).toBe(400);
});
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
it('restored result recovers before returning and never clears saved loot when recovery remains blocked',async()=>{
 localStorage.setItem('aw-battle-result',JSON.stringify({character:'player',permit:'permit',region:'meadow',outcome:'failure'}));
 let blocked=false;const order:string[]=[],returnSafe=vi.fn(async()=>{order.push('safe');return true;});
 const recover=vi.fn(async()=>{order.push('recover');});
 const c=new BattleResultController({character:()=> 'player',settle:async()=>{},blocked:()=>blocked,recover,returnSafe,refresh:()=>{}});
 request.mockResolvedValue({success:false});expect(c.restore()).toBe(true);await c.load(false);blocked=true;
 await c.return();expect(order).toEqual(['recover']);expect(returnSafe).not.toHaveBeenCalled();expect(c.context).toBeDefined();
 recover.mockImplementationOnce(async()=>{order.push('recover');blocked=false;});await c.return();expect(order).toEqual(['recover','recover','safe']);expect(c.context).toBeUndefined();
});
it('a missing phase read never overwrites confirmed loot or prevents returning',async()=>{
 request.mockResolvedValueOnce({success:true,gear:[{id:'saved'}]}).mockRejectedValueOnce(Error('phase read unavailable'));
 const {c,returnSafe}=controller();await c.start('permit','ss-map-boss-6','success');expect(c.phase).toBe('ready');expect(c.data?.gear).toEqual([{id:'saved'}]);expect(c.error).toContain('首领进度请到航图查看');await c.return();expect(returnSafe).toHaveBeenCalledOnce();
});
