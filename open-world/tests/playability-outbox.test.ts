import {afterEach,expect,it,vi} from 'vitest';
import {Outbox} from '../apps/web/src/network.ts';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('前置持久化不完成时超时并终止事务，不无限卡忙',async()=>{
 vi.useFakeTimers();let request:any;const abort=vi.fn(),tx:any={abort,objectStore:()=>({put:()=>{}})};
 vi.stubGlobal('indexedDB',{open:()=>{request={result:{transaction:()=>tx}};return request;}});
 const outbox=new Outbox(),init=outbox.init();request.onsuccess();await init;
 const pending=outbox.put({command_id:'timeout'},'hero');const assertion=expect(pending).rejects.toThrow('超时');await vi.advanceTimersByTimeAsync(10000);await assertion;expect(abort).toHaveBeenCalledOnce();
});
it('前置失败立即拒绝；成功事务正常完成且不触发超时',async()=>{
 vi.useFakeTimers();let request:any;const abort=vi.fn(),tx:any={abort,objectStore:()=>({put:()=>{}})};
 vi.stubGlobal('indexedDB',{open:()=>{request={result:{transaction:()=>tx}};return request;}});
 const outbox=new Outbox(),init=outbox.init();request.onsuccess();await init;
 const pending=outbox.put({command_id:'ok'},'hero');tx.oncomplete();await pending;await vi.advanceTimersByTimeAsync(10000);expect(abort).not.toHaveBeenCalled();
});
it('本机存储同步拒绝时立即释放等待，不继续发送业务命令',async()=>{
 let request:any;const abort=vi.fn(),tx:any={abort,objectStore:()=>({put:()=>{throw Error('storage unavailable');}})};
 vi.stubGlobal('indexedDB',{open:()=>{request={result:{transaction:()=>tx}};return request;}});
 const outbox=new Outbox(),init=outbox.init();request.onsuccess();await init;
 await expect(outbox.put({command_id:'rejected'},'hero')).rejects.toMatchObject({code:'NETWORK',message:expect.stringContaining('恢复连接'),cause:expect.objectContaining({message:'storage unavailable'})});expect(abort).toHaveBeenCalledOnce();
});
it('读取待确认记录卡住也有超时保护',async()=>{
 vi.useFakeTimers();let request:any;const abort=vi.fn(),tx:any={abort,objectStore:()=>({getAll:()=>({})})};
 vi.stubGlobal('indexedDB',{open:()=>{request={result:{transaction:()=>tx}};return request;}});
 const outbox=new Outbox(),init=outbox.init();request.onsuccess();await init;
 const assertion=expect(outbox.all('hero')).rejects.toThrow('超时');await vi.advanceTimersByTimeAsync(10000);await assertion;expect(abort).toHaveBeenCalledOnce();
});
it('数据库打开超时后迟到的连接会关闭，不留下可误用的连接',async()=>{
 vi.useFakeTimers();let request:any;const close=vi.fn();vi.stubGlobal('indexedDB',{open:()=>{request={result:{close}};return request;}});
 const outbox=new Outbox(),assertion=expect(outbox.init()).rejects.toThrow('超时');await vi.advanceTimersByTimeAsync(10000);await assertion;
 request.onsuccess();expect(close).toHaveBeenCalledOnce();expect(await outbox.all('hero')).toEqual([]);
});
it('创建事务被拒绝时给出恢复提示，并清掉计时器',async()=>{
 vi.useFakeTimers();let request:any;vi.stubGlobal('indexedDB',{open:()=>{request={result:{transaction:()=>{throw Error('connection closed');}}};return request;}});
 const outbox=new Outbox(),init=outbox.init();request.onsuccess();await init;
 await expect(outbox.put({command_id:'closed'},'hero')).rejects.toMatchObject({code:'NETWORK',message:expect.stringContaining('恢复连接')});expect(vi.getTimerCount()).toBe(0);
});
it('恢复读取等待事务完成，只返回本角色未拒绝的记录并兼容旧路径',async()=>{
 let opening:any,reading:any;const tx:any={abort:vi.fn(),objectStore:()=>({getAll:()=>{reading={result:[{character_id:'hero',body:{command_id:'a'}},{character_id:'other',body:{command_id:'b'}},{character_id:'hero',rejected:{reason:'checked'},body:{command_id:'c'}}]};return reading;}})};
 vi.stubGlobal('indexedDB',{open:()=>{opening={result:{transaction:()=>tx}};return opening;}});
 const outbox=new Outbox(),init=outbox.init();opening.onsuccess();await init;let resolved=false;
 const pending=outbox.all('hero');void pending.then(()=>{resolved=true;});reading.onsuccess();await Promise.resolve();expect(resolved).toBe(false);
 tx.oncomplete();expect(await pending).toEqual([{body:{command_id:'a'},path:'combat/report'}]);
});
