/**
 * 预览页入口 —— 仅由 tactical-board.html 使用，不进入游戏 bundle，不替换 World 运行路径。
 * 数据源是隔离 fixture（FixtureSource）；工具条只是测试开关，不属于游戏界面。
 * URL：?scenario=default|timeout|defeat|load-error|conflict|version|empty &wait=秒 &warn=秒 &skew=毫秒 &latency=毫秒 &pace=倍率
 */
import {TacticalBoardController,newCommandId} from './controller.ts';
import {FixtureSource,fixtureOptionsFromQuery} from './fixture-source.ts';

const options=fixtureOptionsFromQuery(location.search);
const source=new FixtureSource(options);
const stage=document.querySelector<HTMLElement>('#stage')!;
const intent={commandId:newCommandId('engage'),nodeName:'雾港外礁 · 样例遭遇',groupId:'fx-group'};
let reduced=new URLSearchParams(location.search).get('motion')==='reduced'||matchMedia('(prefers-reduced-motion: reduce)').matches;
let controller=new TacticalBoardController(stage,source,{reducedMotion:reduced});
void controller.start(intent);

function fit(){
 const bar=document.querySelector<HTMLElement>('#toolbar')?.offsetHeight??0;
 const scale=Math.min(innerWidth/1280,(innerHeight-bar)/720);
 document.documentElement.style.setProperty('--tb-stage-scale',String(Math.max(.25,scale)));
}
addEventListener('resize',fit);fit();

const button=(id:string)=>document.querySelector<HTMLButtonElement>('#'+id)!;
const scenario=document.querySelector<HTMLSelectElement>('#scenario')!;
scenario.value=options.scenario;
scenario.addEventListener('change',()=>{const q=new URLSearchParams(location.search);q.set('scenario',scenario.value);if(scenario.value==='timeout')q.delete('wait');location.search=q.toString();});
button('btn-offline').addEventListener('click',()=>{
 const off=!source.offline;source.setOffline(off);
 button('btn-offline').setAttribute('aria-pressed',String(off));button('btn-offline').textContent=off?'恢复连接':'断开连接';
 if(off)controller.lostConnection();
});
button('btn-drop').addEventListener('click',()=>{source.dropNextReceipt();note('下一条指令回执将丢失（服务端照常执行）');});
button('btn-conflict').addEventListener('click',()=>{source.conflictNext();note('下一次指令将返回「这个角色正在另一处操作」');});
button('btn-refresh').addEventListener('click',()=>{
 // 只重建前端控制器；fixture 服务端保持运行，用来验证刷新不重置等待截止时刻。
 controller.destroy();controller=new TacticalBoardController(stage,source,{reducedMotion:reduced});
 void controller.start({...intent,commandId:newCommandId('engage')});note('已重建界面：应恢复同一场战斗，截止时刻不变');
});
button('btn-motion').setAttribute('aria-pressed',String(reduced));
button('btn-motion').addEventListener('click',()=>{reduced=!reduced;controller.setReducedMotion(reduced);button('btn-motion').setAttribute('aria-pressed',String(reduced));});

let noteText='',noteUntil=0;
function note(text:string){noteText=text;noteUntil=Date.now()+4000;}
const diag=document.querySelector<HTMLElement>('#diag')!;
setInterval(()=>{
 const s=controller.snapshot(),server=source.server?.view();
 const deadline=server?.control.deadlineAtMs,remain=deadline!=null?Math.max(0,Math.ceil((deadline-server!.control.serverNowMs)/1000)):null;
 diag.textContent=[Date.now()<noteUntil?noteText:'',`界面:${s.screen}`,`连接:${s.connection}`,`阶段:${s.phase??'-'}`,`控制:${s.mode??'-'}`,
  `版本:${s.revision??'-'}`,`服务端等待剩余:${remain===null?'—':remain+'s'}${deadline!=null?`（截止 ${deadline}）`:''}`].filter(Boolean).join(' · ');
 document.body.dataset.tacticalScreen=s.screen;
},500);
Object.assign(window,{__tactical:{snapshot:()=>controller.snapshot(),source}});
