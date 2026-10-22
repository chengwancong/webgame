import {test,expect,vi,afterEach} from 'vitest';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

function setup(){
 const root:any={innerHTML:'',onclick:null,onpointerover:null,addEventListener(){},querySelectorAll:()=>[],replaceChildren(){this.innerHTML='';},parentElement:null};
 vi.stubGlobal('document',{getElementById:()=>root,body:{classList:{add(){},remove(){}},appendChild:(e:any)=>e},createElement:()=>({})});
 vi.stubGlobal('window',globalThis);
 return import('../apps/web/src/prologue-controller.ts');
}
const host=()=>({snapshot:()=>({starsea:{prologue:{done:false}}}) as any,setWorld(){},command:async()=>{},finished:async()=>{},automation:()=>({}),interactKey:()=>'E',motionReduced:()=>true,shake(){}});

test('宿主不调用 step 时，墙钟兜底仍会从坠落进入三选一（UX-A-F02）',async()=>{
 vi.useFakeTimers();
 const {PrologueController}=await setup();const {FALL_MS}=await import('../apps/web/src/prologue-fx.ts');
 const c=new PrologueController(host() as any);
 expect(c.start()).toBe(true);expect(c.phase).toBe('fall');
 vi.advanceTimersByTime(FALL_MS+2999);expect(c.phase).toBe('fall');
 vi.advanceTimersByTime(2);expect(c.phase).toBe('choose');
});

test('正常 step 路径先进入 choose 后，兜底定时器被清除不再触发',async()=>{
 vi.useFakeTimers();
 const {PrologueController}=await setup();const {FALL_MS}=await import('../apps/web/src/prologue-fx.ts');const {T}=await import('../apps/web/src/prologue-battle.ts');
 const c=new PrologueController(host() as any);c.start();
 for(let i=0;i<Math.ceil(FALL_MS/1000*T)+2;i++)c.step({x:0,y:0});
 expect(c.phase).toBe('choose');
 const before=c.inspect().log.length;vi.advanceTimersByTime(FALL_MS+10000);
 expect(c.phase).toBe('choose');expect(c.inspect().log.length).toBe(before);
});
