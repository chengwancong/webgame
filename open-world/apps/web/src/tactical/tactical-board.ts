/**
 * 预览页入口 —— 仅由 tactical-board.html 使用，不进入游戏 bundle，不替换 World 运行路径。
 * URL 参数：
 *   ?source=fixture|sandbox|auto  — 强制指定数据源（auto = 先尝试沙盒，404 退回 fixture）
 *   ?scenario=…                   — 指定 fixture 场景（存在时始终走 fixture）
 *   ?wait=秒 &warn=秒 &skew=毫秒 &latency=毫秒 &pace=倍率  — fixture 选项
 */
import {TacticalBoardController,newCommandId} from './controller.ts';
import {FixtureSource,fixtureOptionsFromQuery} from './fixture-source.ts';
import {SandboxSource} from './sandbox-source.ts';
import {pixelSkin} from './pixel-skin.ts';
if(pixelSkin)document.body.classList.add('tb-skin-pixel');
import type {TacticalSource} from './contract.ts';
import type {SandboxCreateOptions} from './sandbox-source.ts';
import type {SandboxCatalogWire} from './sandbox-wire.ts';
import {SKILL_LABEL} from './sandbox-wire.ts';

const esc=(t:string)=>t.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const q=new URLSearchParams(location.search);
const sourceParam=q.get('source')||'auto';
const scenarioParam=q.get('scenario');
// ?scenario= 存在时始终走 fixture
const forceFixture=scenarioParam!=null;

const stage=document.querySelector<HTMLElement>('#stage')!;
const toolbar=document.querySelector<HTMLElement>('#toolbar')!;
const diag=document.querySelector<HTMLElement>('#diag')!;
const sourceLabel=document.querySelector<HTMLElement>('#source-label');

let reduced=q.get('motion')==='reduced'||matchMedia('(prefers-reduced-motion: reduce)').matches;
let controller:TacticalBoardController|null=null;
let activeSource:TacticalSource|null=null;

function fit(){
 const bar=toolbar?.offsetHeight??0;
 const scale=Math.min(innerWidth/1280,(innerHeight-bar)/720);
 document.documentElement.style.setProperty('--tb-stage-scale',String(Math.max(.25,scale)));
}
addEventListener('resize',fit);fit();

// ── 工具条标准按钮 ───────────────────────────────────────────────────────

const button=(id:string)=>document.querySelector<HTMLButtonElement>('#'+id)!;

button('btn-motion').setAttribute('aria-pressed',String(reduced));
button('btn-motion').addEventListener('click',()=>{
 reduced=!reduced;controller?.setReducedMotion(reduced);
 button('btn-motion').setAttribute('aria-pressed',String(reduced));
});
button('btn-refresh').addEventListener('click',()=>{
 if(!controller||!activeSource)return;
 const options=fixtureOptionsFromQuery(location.search);
 const src=activeSource instanceof FixtureSource?activeSource:null;
 if(src){
  controller.destroy();
  controller=new TacticalBoardController(stage,src,{reducedMotion:reduced});
  void controller.start({commandId:newCommandId('engage'),nodeName:'雾港外礁 · 样例遭遇',groupId:'fx-group'});
  note('已重建界面：应恢复同一场战斗，截止时刻不变');
 }
 void options;// 仅在 fixture 模式使用，沙盒无需
});

// ── 数据源初始化 ─────────────────────────────────────────────────────────

async function startWithFixture(reason?:string){
 const options=fixtureOptionsFromQuery(location.search);
 const src=new FixtureSource(options);
 activeSource=src;
 if(sourceLabel){sourceLabel.textContent=reason?`沙盒未开启，当前为隔离 fixture（${reason}）`:'隔离 fixture（非正式数据）';}
 // 重新接入工具条 fixture 按钮
 wireFixtureButtons(src,options.scenario);
 const intent={commandId:newCommandId('engage'),nodeName:'雾港外礁 · 样例遭遇',groupId:'fx-group'};
 controller=new TacticalBoardController(stage,src,{reducedMotion:reduced});
 void controller.start(intent);
}

function wireFixtureButtons(src:FixtureSource,scenario:string){
 const scenario_el=document.querySelector<HTMLSelectElement>('#scenario');
 if(scenario_el){
  scenario_el.value=scenario;
  scenario_el.addEventListener('change',()=>{const qp=new URLSearchParams(location.search);qp.set('scenario',scenario_el.value);if(scenario_el.value==='timeout')qp.delete('wait');location.search=qp.toString();});
 }
 const offline=button('btn-offline');
 offline?.addEventListener('click',()=>{
  const off=!src.offline;src.setOffline(off);
  offline.setAttribute('aria-pressed',String(off));offline.textContent=off?'恢复连接':'断开连接';
  if(off&&controller)controller.lostConnection();
 });
 button('btn-drop')?.addEventListener('click',()=>{src.dropNextReceipt();note('下一条指令回执将丢失（服务端照常执行）');});
 button('btn-conflict')?.addEventListener('click',()=>{src.conflictNext();note('下一次指令将返回「这个角色正在另一处操作」');});
}

async function startWithSandbox(){
 const sandboxSrc=new SandboxSource();
 activeSource=sandboxSrc;
 if(sourceLabel)sourceLabel.textContent='战棋沙盒 · 不发奖';
 showSandboxPanel(sandboxSrc);
}

// ── 沙盒开局面板 ─────────────────────────────────────────────────────────

let lastSandboxOpts:SandboxCreateOptions|null=null;

function showSandboxPanel(src:SandboxSource){
 const panel=document.querySelector<HTMLElement>('#sandbox-panel');
 if(!panel){return;}
 panel.hidden=false;

 // 加载目录
 src.loadCatalog().then(catalog=>{
  fillCatalog(panel,catalog,src);
 }).catch(err=>{
  panel.querySelector('#sandbox-status')!.textContent=err instanceof Error?err.message:'无法加载沙盒目录。';
 });
}

function fillCatalog(panel:HTMLElement,catalog:SandboxCatalogWire,src:SandboxSource){
 const status=panel.querySelector<HTMLElement>('#sandbox-status')!;
 const boardSel=panel.querySelector<HTMLSelectElement>('#sandbox-board')!;
 const heroSel=panel.querySelector<HTMLSelectElement>('#sandbox-hero')!;
 const seedInput=panel.querySelector<HTMLInputElement>('#sandbox-seed')!;
 const priorityList=panel.querySelector<HTMLElement>('#sandbox-priority')!;
 const targetSel=panel.querySelector<HTMLSelectElement>('#sandbox-target')!;
 const posSel=panel.querySelector<HTMLSelectElement>('#sandbox-position')!;
 const guardCheck=panel.querySelector<HTMLInputElement>('#sandbox-guard')!;
 const startBtn=panel.querySelector<HTMLButtonElement>('#sandbox-start')!;

 status.textContent='';

 // 棋盘选项（目录给难度，附在名称后）
 const DIFF:Record<string,string>={normal:'普通',elite:'精英',boss:'首领'};
 boardSel.innerHTML=catalog.boards.map(b=>`<option value="${esc(b.id)}">${esc(b.name)}（${DIFF[b.difficulty]??b.difficulty}）</option>`).join('');

 // 英雄选项：sword / hidden，技能来自目录 skillIds；普攻 basicSkillId 不进托管优先级
 heroSel.innerHTML=catalog.heroes.map(h=>`<option value="${esc(h.id)}">${esc(h.name)}</option>`).join('');
 const defaults=catalog.orchestration.defaults;
 if(catalog.orchestration.target.includes(defaults.target))targetSel.value=defaults.target;
 if(catalog.orchestration.position.includes(defaults.position))posSel.value=defaults.position;
 guardCheck.checked=defaults.guard==='on';
 if(!seedInput.value)seedInput.placeholder='留空=随机；Grok 复测用 37';

 function buildPriority(heroId:string){
  const hero=catalog.heroes.find(h=>h.id===heroId);
  const own=(hero?.skillIds??[]).filter(id=>id!==hero?.basicSkillId);
  const skills=[...defaults.priority.filter(id=>own.includes(id)),...own.filter(id=>!defaults.priority.includes(id))];
  const labelOf=(id:string)=>esc(SKILL_LABEL[id]??id);
  priorityList.innerHTML=skills.map((s,i)=>`
<li class="sandbox-priority-item" data-skill="${esc(s)}" draggable="false">
 <span class="sandbox-priority-order">${i+1}</span>
 <span class="sandbox-priority-label">${labelOf(s)}</span>
 <button type="button" class="sandbox-priority-up" data-up="${esc(s)}" aria-label="上移 ${labelOf(s)}" ${i===0?'disabled':''}>▲</button>
 <button type="button" class="sandbox-priority-down" data-down="${esc(s)}" aria-label="下移 ${labelOf(s)}" ${i===skills.length-1?'disabled':''}>▼</button>
</li>`).join('');
 }
 buildPriority(heroSel.value);
 heroSel.addEventListener('change',()=>buildPriority(heroSel.value));

 // 优先级按钮
 priorityList.addEventListener('click',e=>{
  const el=e.target as HTMLElement;
  const up=el.closest<HTMLElement>('[data-up]')?.dataset.up;
  const down=el.closest<HTMLElement>('[data-down]')?.dataset.down;
  const items=[...priorityList.querySelectorAll<HTMLElement>('[data-skill]')];
  const idx=up!=null?items.findIndex(x=>x.dataset.skill===up):items.findIndex(x=>x.dataset.skill===down);
  if(up!=null&&idx>0){priorityList.insertBefore(items[idx],items[idx-1]);}
  else if(down!=null&&idx<items.length-1){priorityList.insertBefore(items[idx+1],items[idx]);}
  // 刷新序号与禁用状态
  const updated=[...priorityList.querySelectorAll<HTMLElement>('[data-skill]')];
  updated.forEach((x,i)=>{
   x.querySelector('.sandbox-priority-order')!.textContent=String(i+1);
   (x.querySelector('[data-up]') as HTMLButtonElement).disabled=i===0;
   (x.querySelector('[data-down]') as HTMLButtonElement).disabled=i===updated.length-1;
  });
 });

 // "开始"按钮
 startBtn.addEventListener('click',async()=>{
  startBtn.disabled=true;status.textContent='正在创建遭遇…';
  const priority=[...priorityList.querySelectorAll<HTMLElement>('[data-skill]')].map(x=>x.dataset.skill!);
  const target=(targetSel.value||null) as 'nearest'|'lowest-hp'|'support-first'|null;
  const position=(posSel.value||null) as 'stay-close'|'keep-distance'|'behind-cover'|null;
  const guard=guardCheck.checked;
  const opts:SandboxCreateOptions={
   boardId:boardSel.value,heroId:heroSel.value as SandboxCreateOptions['heroId'],
   seed:/^\d+$/.test(seedInput.value.trim())?Number(seedInput.value.trim()):undefined,
   orchestration:{priority,target,position,guard},
  };
  lastSandboxOpts=opts;
  try{
   await src.create(opts);
   panel.hidden=true;
   controller?.destroy();
   controller=new TacticalBoardController(stage,src,{reducedMotion:reduced});
   void controller.start({commandId:newCommandId('engage'),nodeName:'沙盒遭遇',groupId:'sandbox'});
  }catch(err){
   status.textContent=err instanceof Error?err.message:'创建失败，请重试。';
   startBtn.disabled=false;
  }
 });

 // 键盘可操作（panel 内 focus trap 不做，依赖 tab 顺序）
 panel.hidden=false;
}

// ── 暴露"再来一局"入口 ─────────────────────────────────────────────────

/** 由控制器结算面板调用"再来一局"时，重显沙盒开局面板。 */
(window as any).__sandboxRestart=()=>{
 if(!(activeSource instanceof SandboxSource))return;
 const panel=document.querySelector<HTMLElement>('#sandbox-panel');
 if(panel){panel.hidden=false;}
};

// ── 诊断 ─────────────────────────────────────────────────────────────────

let noteText='',noteUntil=0;
function note(text:string){noteText=text;noteUntil=Date.now()+4000;}

setInterval(()=>{
 if(!controller)return;
 const s=controller.snapshot();
 const sandboxSrc=activeSource instanceof SandboxSource?activeSource:null;
 const fixtureSrc=activeSource instanceof FixtureSource?activeSource:null;
 const server=fixtureSrc?.server?.view();
 const deadline=server?.control.deadlineAtMs,remain=deadline!=null?Math.max(0,Math.ceil((deadline-server!.control.serverNowMs)/1000)):null;
 diag.textContent=[Date.now()<noteUntil?noteText:'',`界面:${s.screen}`,`连接:${s.connection}`,`阶段:${s.phase??'-'}`,`控制:${s.mode??'-'}`,
  `版本:${s.revision??'-'}`,
  fixtureSrc?`服务端等待剩余:${remain===null?'—':remain+'s'}${deadline!=null?`（截止 ${deadline}）`:''}`:null,
  sandboxSrc?'沙盒数据源':null,
 ].filter(Boolean).join(' · ');
 document.body.dataset.tacticalScreen=s.screen;
},500);

// ── 启动 ─────────────────────────────────────────────────────────────────

async function init(){
 if(forceFixture||sourceParam==='fixture'){
  await startWithFixture();
  return;
 }
 if(sourceParam==='sandbox'){
  // 先探测 catalog，404 → 明确错误
  const probe=new SandboxSource();
  try{
   await probe.loadCatalog();
   await startWithSandbox();
  }catch(err:unknown){
   const msg=err instanceof Error?err.message:'沙盒接口未开启（需服务端 TACTICAL_SANDBOX=1）';
   if(sourceLabel)sourceLabel.textContent=msg;
   // 强制 sandbox 失败时显示错误而不退回 fixture
   stage.innerHTML=`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:40px;text-align:center;color:var(--color-danger-strong,#c00)"><p>${msg}</p></div>`;
  }
  return;
 }
 // auto：先探测，失败退回 fixture
 try{
  const probe=new SandboxSource();
  await probe.loadCatalog();
  await startWithSandbox();
 }catch{
  await startWithFixture('沙盒未开启');
 }
}

void init();

Object.assign(window,{__tactical:{snapshot:()=>controller?.snapshot(),source:activeSource}});
