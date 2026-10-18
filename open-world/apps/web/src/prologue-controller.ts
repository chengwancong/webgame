/**
 * 开场「坠星觉醒」（docs/opening-hook-design.md）：新角色第一次进游戏时在客户端沙盒里打一场满力的仗，再把力量收走。
 * 沙盒 World 用 prologue.json 里冻结的受控授予构筑，不上报击杀、不发奖励、不进存档；
 * 服务端只记两件事：三选一（定初始武器，只发一次）和开场结束。跳过时仍要三选一，不选默认剑。
 */
import {PrologueBattle,T} from './prologue-battle.ts';
import {prologueConfig,prologueFamilies,type PrologueFamily} from '../../../packages/content/starsea/prologue.ts';
import {weaponNames} from '../../../packages/contracts/weapons.ts';
import type {Snapshot,Vec} from '../../../packages/contracts/index.ts';
import {buttonHtml} from './ui-components.ts';
import {escapeHtml as esc} from './ui/primitives.ts';
import {skillArt} from './ui-assets.ts';
import './prologue.css';

export type PrologueHost={
 snapshot():Snapshot|undefined;
 /** 换上沙盒世界（场景按 bridge.world 渲染）。 */
 setWorld(world:PrologueBattle['world']):void;
 /** 发开场命令（三选一 / 结束），成功后宿主更新快照；失败抛错。 */
 command(body:{weapon?:PrologueFamily;finish?:boolean}):Promise<void>;
 /** 开场结束后进入正常野外（落点求生）。 */
 finished():Promise<void>;
 automation():Record<string,unknown>;
 interactKey():string;
 motionReduced():boolean;
 shake(px:number,ms:number):void;
};
type Phase='idle'|'fall'|'choose'|'land'|'waves'|'boss'|'fade'|'closing';
const lines=prologueConfig.lines;
const icons:Record<PrologueFamily,string>={sword:'blade_fury',staff:'meteor',hidden:'fan_of_knives'};

export class PrologueController{
 phase:Phase='idle';
 private battle?:PrologueBattle;private family:PrologueFamily='sword';private clock=0;private phaseAt=0;
 private caption='';private captionUntil=0;private busy=false;private error='';private skipRequested=false;
 private root?:HTMLElement;private lastHtml='';
 constructor(private host:PrologueHost){}
 get active(){return this.phase!=='idle';}
 static pending(s?:Snapshot){return s?.starsea?.prologue?.done===false;}
 start(){
  const p=this.host.snapshot()?.starsea?.prologue;if(!p||p.done)return false;
  document.body.classList.add('prologue-active');this.root=document.getElementById('prologue')??document.body.appendChild(Object.assign(document.createElement('div'),{id:'prologue'}));
  this.root.onclick=e=>{const t=(e.target as HTMLElement).closest<HTMLElement>('[data-action]');if(t)void this.action(t.dataset.action!,t.dataset.id??'');};
  if(p.weapon){this.family=p.weapon;this.land();}else this.go('fall');
  this.render();return true;
 }
 /** 返回 true 表示按键已被开场接管。 */
 keydown(event:KeyboardEvent,bindings:Record<string,string>){
  if(!this.active)return false;
  if(this.phase==='choose'){const i=['Digit1','Digit2','Digit3'].indexOf(event.code);if(i>=0){event.preventDefault();void this.choose(prologueFamilies[i]);}return true;}
  if(event.code===bindings.interact&&!event.repeat){event.preventDefault();this.queueBurst();return true;}
  if([bindings.bag,bindings.skills,bindings.pause,'Escape',...Object.keys(bindings).filter(k=>k.startsWith('skill')).map(k=>bindings[k])].includes(event.code)){event.preventDefault();return true;}
  return false;
 }
 private go(phase:Phase){this.log.push(`${this.clock}:${this.phase}->${phase}`);this.phase=phase;this.phaseAt=this.clock;this.render();}
 private keyed(text:string){return text.replaceAll('{key}',this.host.interactKey());}
 private say(text:string,seconds=3.5){this.caption=text;this.captionUntil=this.clock+seconds*T;}
 private async action(action:string,id:string){
  if(action==='prologue-choose')await this.choose(id as PrologueFamily);
  else if(action==='prologue-skip')await this.skip();
  else if(action==='prologue-burst')this.queueBurst();
  else if(action==='prologue-retry'){this.error='';if(this.phase==='closing')await this.close();else this.render();}
 }
 private async choose(family:PrologueFamily){
  if(this.busy||this.phase!=='choose')return;this.busy=true;this.error='';this.render();
  // close() 在 busy 时是空操作：跳过开场时须先释放，否则选完武器面板卡住。
  try{await this.host.command({weapon:family});this.family=family;if(this.skipRequested){this.busy=false;await this.close();return;}this.land();}
  catch(e){this.error=e instanceof Error?e.message:'选择没有提交成功，请重试。';}
  finally{this.busy=false;this.render();}
 }
 private async skip(){
  if(this.busy||this.phase==='closing')return;
  if(!this.host.snapshot()?.starsea?.prologue?.weapon){this.skipRequested=true;this.go('choose');return;}
  await this.close();
 }
 private land(){
  this.battle=new PrologueBattle(this.family,{automation:this.host.automation(),motionReduced:()=>this.host.motionReduced(),hooks:{
   phase:p=>{if(p!=='done'&&p!=='land')this.go(p);},say:(text,seconds)=>this.say(this.keyed(text),seconds),shake:(px,ms)=>this.host.shake(px,ms)}});
  this.host.setWorld(this.battle.world);
  this.go('land');this.say(lines.land,3);if(!this.host.motionReduced())this.host.shake(6,420);
 }
 /** 宿主每个逻辑帧调用；move 为已换算到世界坐标的方向键输入。战斗本身在 PrologueBattle（与巨兽血量推导共用）。 */
 step(move:Vec){
  if(!this.active)return;this.clock++;const b=this.battle,age=this.clock-this.phaseAt;
  if(this.phase==='fall'&&age>=8*T)this.go('choose');
  if(!b||['idle','fall','choose','closing'].includes(this.phase)){this.renderLive();return;}
  b.step(move);
  if(b.phase==='done')void this.close();
  this.renderLive();
 }
 private queueBurst(){if(['waves','boss'].includes(this.phase))this.battle?.queueBurst();}
 private async close(){
  if(this.busy)return;this.log.push(`${this.clock}:close@${this.phase}`);this.busy=true;this.phase='closing';this.error='';this.render();
  try{await this.host.command({finish:true});}catch(e){this.error=e instanceof Error?e.message:'没有连上服务器，请重试。';this.busy=false;this.render();return;}
  this.busy=false;this.phase='idle';this.battle=undefined;document.body.classList.remove('prologue-active');this.root?.replaceChildren();this.lastHtml='';await this.host.finished();
 }
 inspect(){const b=this.battle;return {phase:this.phase,wave:b?.wave??0,queued:b?.queuedCount??0,energy:b?.energy??0,bossId:b?.bossId??'',clock:this.clock,burstQueued:b?.burstQueued??false,castFailure:b?.world.lastCastFailure,sequences:b?.world.sequences.length,skills:b?.world.skills.map(s=>s.id),log:this.log.slice(-20)};}
 private log:string[]=[];
 private renderLive(){if(this.clock%6===0)this.render();}
 render(){
  const root=this.root;if(!root)return;if(!this.active){root.replaceChildren();return;}
  const caption=this.clock<this.captionUntil?this.caption:'',f=prologueConfig.families[this.family],energy=this.battle?.energy??0,full=energy>=prologueConfig.burst.kills;
  const skip=this.phase!=='closing'&&this.phase!=='fade'?buttonHtml('跳过开场',{action:'prologue-skip',variant:'secondary',size:'compact',className:'prologue-skip',disabled:this.busy}):'';
  const error=this.error?`<div class="prologue-error" role="alert">${esc(this.error)} ${buttonHtml('重试',{action:'prologue-retry',size:'compact'})}</div>`:'';
  let body='';
  if(this.phase==='fall')body=`<div class="prologue-sky" aria-hidden="true"><i class="prologue-rift"></i><i class="prologue-faller"></i></div><p class="prologue-line">${esc(lines.fall)}</p>`;
  else if(this.phase==='choose')body=`<div class="prologue-sky prologue-sky--still" aria-hidden="true"></div><div class="prologue-choice" role="group" aria-label="三道回响"><p class="prologue-line">${esc(lines.choose)}</p><div class="prologue-cards">${prologueFamilies.map((k,i)=>{const x=prologueConfig.families[k];return `<button type="button" class="prologue-card" data-action="prologue-choose" data-id="${k}" ${this.busy?'disabled':''}><img src="${skillArt(icons[k])}" alt="" draggable="false"><b>${esc(x.echo)}</b><span class="prologue-weapon">${esc(weaponNames[k])} · 按 ${i+1}</span><span>${esc(x.blurb)}</span></button>`;}).join('')}</div>${this.skipRequested?`<p class="prologue-note">${esc(lines.skipNote)}</p>`:''}</div>`;
  else if(this.phase==='closing')body=`<div class="prologue-sky prologue-sky--still" aria-hidden="true"></div><p class="prologue-line">${this.busy?'正在醒来…':''}</p>`;
  else{const boss=this.battle?.boss;
   body=`${this.phase==='fade'?'<div class="prologue-fade" aria-hidden="true"></div>':''}<div class="prologue-tag">回响之力 · 醒来后消散</div>${boss&&boss.alive?`<div class="prologue-boss"><b>${esc(prologueConfig.boss.name)}</b><span style="--fill:${Math.max(0,boss.hp/boss.maxHp)}"></span></div>`:''}
   <div class="prologue-bar ${this.phase==='fade'?'is-fading':''}">${f.grantedSkills.map((id,i)=>`<img class="prologue-skill" style="--i:${i}" src="${skillArt(id)}" alt="${esc(f.granted.skills[i]?.name??id)}" draggable="false">`).join('')}
   <button type="button" class="prologue-burst ${full&&this.phase!=='fade'?'is-full':''}" data-action="prologue-burst" ${full&&this.phase!=='fade'?'':'disabled'} style="--fill:${this.phase==='fade'?0:Math.min(1,energy/prologueConfig.burst.kills)}"><img src="${skillArt(icons[this.family])}" alt="" draggable="false"><span>回响爆发 · ${esc(this.host.interactKey())}</span></button></div>`;}
  const html=`${body}${caption?`<p class="prologue-caption" role="status">${esc(caption)}</p>`:''}${skip}${error}`;
  if(html!==this.lastHtml){root.innerHTML=html;this.lastHtml=html;}
 }
}
