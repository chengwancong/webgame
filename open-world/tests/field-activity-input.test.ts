import {it,expect,vi,afterEach} from 'vitest';
vi.mock('../apps/web/src/network.ts',()=>({api:vi.fn(async()=>({}))}));
import {api} from '../apps/web/src/network.ts';
import {FieldActivities} from '../apps/web/src/field-activities.ts';
const mocked=vi.mocked(api);
afterEach(()=>{vi.restoreAllMocks();mocked.mockReset();mocked.mockResolvedValue({});});
function controller(){const activities=new FieldActivities({lease:()=> 'lease',notice:vi.fn()} as any);(activities as any).current={instance:'test',status:'running'};return activities;}
it('sends a stop once and does not flood the server while the player is stationary',async()=>{
 const activities=controller();vi.spyOn(performance,'now').mockReturnValue(1000);
 activities.move(0,0);await Promise.resolve();
 for(let i=0;i<120;i++){activities.move(0,0);await Promise.resolve();}
 expect(mocked).toHaveBeenCalledTimes(1);
});
it('retries the latest stop after an in-flight move, and renews held input before the server timeout',async()=>{
 const activities=controller();let now=1000;vi.spyOn(performance,'now').mockImplementation(()=>now);
 let resolve!:()=>void;mocked.mockImplementationOnce(()=>new Promise<void>(r=>resolve=r));
 activities.move(1,0);activities.move(0,0);expect(mocked).toHaveBeenCalledTimes(1);
 resolve();await Promise.resolve();activities.move(0,0);await Promise.resolve();
 expect(mocked).toHaveBeenLastCalledWith('field/activity/input',expect.objectContaining({movement:{x:0,y:0}}));
 activities.move(1,0);await Promise.resolve();const calls=mocked.mock.calls.length;
 now+=399;activities.move(1,0);expect(mocked).toHaveBeenCalledTimes(calls);
 now+=1;activities.move(1,0);expect(mocked).toHaveBeenCalledTimes(calls+1);
});
it('retries a failed input rather than remembering it as delivered',async()=>{
 const activities=controller();mocked.mockRejectedValueOnce(new Error('offline'));
 activities.move(0,0);await Promise.resolve();activities.move(0,0);expect(mocked).toHaveBeenCalledTimes(2);
});
