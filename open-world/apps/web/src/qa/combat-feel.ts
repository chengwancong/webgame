import Phaser from 'phaser';
import '../style.css';
import '../ui/tokens.css';
import '../ui/controls.css';
import {World,type CombatEvent} from '../../../../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../../../../packages/content/index.ts';
import {WorldScene,type ViewBridge} from '../scene.ts';
import {CombatAudio} from '../combat-audio.ts';
import {loadWorldFont} from '../ui/world-text.ts';
import type {ResolvedAppearance} from '../../../../packages/contracts/appearance.ts';

// Isolated QA entry. It calls the real simulation damage resolver, never injects
// CombatEvents, and has no account, reward, network or production-entry access.
const scenarios=['hit','crit','kill','minor','hurt','heal','shield','break','expire','miss','stress','boss','ice','snapshot','elite'] as const;
let selected:string='hit',paused=false,steps=0,history:CombatEvent[]=[],sounds:string[]=[],sequence=0;
const audio=new CombatAudio(),region={...regionById('meadow'),safe:{x:12,y:12},landmarks:[],obstacles:[]};
const parts=['head','body','hands','legs','feet','back','weapon'] as const;
const appearance:ResolvedAppearance={rig:'modular-hero',family:'sword',styleProfile:'v2-soft',revision:1,parts:Object.fromEntries(parts.map(part=>[part,{setId:'100011'}])) as ResolvedAppearance['parts']};
const spawn=(n:number)=>({id:'target-'+n,x:13.8+n%3*.4,y:12+Math.floor(n/3)*.4,name:'验收靶',kind:'melee' as const,hp:1000,attack:0,elite:n===1,boss:false,art:'raider'});
// Inert monster block: enemy AI reads monster.ai every tick, so affix-only stubs crash the step.
const qaMonster=(affixes:string[])=>({version:1,template:'qa',level:1,rank:'elite',baseStats:{hp:1000,attack:0},difficulty:{},armor:0,ai:{speed:.01,range:1,cooldown:999999,skillChance:0,basicAttackBonus:0},skills:[],bossKey:null,affixes}) as any;
function make(id:string){
 selected=id;paused=true;steps=0;bridge.stepFrames=0;history=[];sounds=[];audio.reset();(scene as any).frames=[];(scene as any).logicTimes=[];(scene as any).renderTimes=[];
 const skills=skillCatalog.filter(s=>['ward','barrier','mend'].includes(s.id)).map(s=>s.id==='ward'||s.id==='barrier'?{...s,duration:45}:s);
 const w=new World(region,{hp:2000,attack:20,armor:0,speed:6,mana:1000,regen:0,effects:[],critChance:id==='crit'?1:0,critMultiplier:1.5,dodge:id==='miss'?1:0},skills,Array.from({length:id==='stress'?12:3},(_,n)=>({...spawn(n),boss:id==='boss'&&n===0})),[],73);
 if(id==='elite'){const [a,b,c]=w.enemies;for(const [n,e] of [a,b,c].entries()){e.position={x:13.6+n*2.2,y:12.4};(e as any).x=e.position.x;(e as any).y=e.position.y;}a.elite=true;a.monster=qaMonster(['shielded','frost_nova']);b.monster=qaMonster(['swift','fire_trail','teleport']);}
 w.mode='manual';for(const e of w.enemies)e.cooldown=999999;w.paused=true;bridge.world=w;bridge.authoritativeWorld=id==='snapshot';bridge.authoritativeSequence=++sequence;
}
function resolve(w:World,tick:number){
 const sim=w as any,target=w.enemies[0];sim.stepping=true;
 const context=(sourceId:string,key:string,fn:()=>void)=>sim.withVfx({sourceId,vfxKey:key},fn);
 const damage=(amount:number,category='direct',damageType='physical')=>context('hero',category==='periodic'?'system/burn':'player/cut',()=>sim.damage(target,amount,false,category==='periodic'?'burn':'cut',{category,damageType,scaled:true}));
 if(['shield','break','expire','ice','snapshot'].includes(selected)&&tick===1)w.cast(selected==='ice'?'barrier':'ward');
 if(selected==='elite'){if(tick===1){target.shield=300;target.shieldUntil=tick+9000;sim.emit({type:'shielded',id:target.id,position:{...target.position},amount:300,skill:'elite-shield',tick,shieldPhase:'applied',shieldRemaining:300});}if(tick===20||tick===40)damage(120);if(tick===60)damage(200);}
 if(tick===10){
  if(['hit','crit','boss'].includes(selected))damage(35);
  if(selected==='kill')damage(2000);
  if(selected==='hurt'||selected==='heal')context(target.id,'monster/basic-melee',()=>sim.hurt(selected==='heal'?1100:300,'basic-melee'));
  if(selected==='shield'||selected==='snapshot'||selected==='ice')context(target.id,'monster/basic-melee',()=>sim.hurt(10,'basic-melee'));
  if(selected==='break')context(target.id,'monster/basic-melee',()=>sim.hurt(300,'basic-melee'));
  if(selected==='miss')context(target.id,'monster/basic-melee',()=>sim.hurt(30,'basic-melee'));
 }
 if(selected==='heal'&&tick===15)w.cast('mend');
 if(selected==='minor'&&[10,16,22].includes(tick))damage(15,'periodic','fire');
 if(selected==='stress'&&tick>=10&&tick<120&&tick%3===0)for(const e of w.enemies)context('hero','player/cut',()=>sim.damage(e,5,false,'cut',{category:'direct',damageType:'physical',scaled:true}));
 sim.stepping=false;
}
const bridge:ViewBridge={world:new World(region,{hp:2000,attack:20,armor:0,speed:6,mana:1000,regen:0,effects:[]},[],[]),rewards:[],panel:'',loggedIn:true,stepFrames:0,motionReduced:false,resolvedAppearance:appearance,
 step(){if(paused&&steps<=0)return;steps=Math.max(0,steps-1);const w=this.world;w.paused=false;w.step();resolve(w,w.tick);history.push(...w.events);if(selected==='snapshot'){this.world=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));this.authoritativeSequence=++sequence;}this.world.paused=paused;},
 cast(){},interact(){},pause(){paused=!paused;this.world.paused=paused;},open(){},pick(){},sound(kind){sounds.push(kind);audio.play(kind,this.world.tick,.22);}
};
const scene=new WorldScene(bridge);
Object.defineProperty(window,'awCombatFeelScene',{value:scene});
const toolbar=document.createElement('aside');toolbar.id='combat-feel-controls';toolbar.style.cssText='position:fixed;left:16px;bottom:16px;z-index:30000;max-width:600px;padding:12px;background:var(--color-panel);color:var(--color-text-primary);border-radius:var(--radius-panel);font:var(--font-size-body) var(--font-family)';
toolbar.innerHTML=`<div>战斗手感验收 · 模拟器事件 · 不连接玩家存档</div><div>${scenarios.map(id=>`<button class="ui-button" type="button" data-scenario="${id}">${id}</button>`).join('')}</div><button class="ui-button" id="qa-step">推进 1 tick</button><button class="ui-button" id="qa-play">播放 / 暂停</button><button class="ui-button" id="qa-reduced">减少动态效果</button><output id="qa-state"></output>`;document.body.append(toolbar);
toolbar.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest('button');if(!button)return;if(button.dataset.scenario)make(button.dataset.scenario);else if(button.id==='qa-step'){steps++;bridge.stepFrames=(bridge.stepFrames??0)+1;}else if(button.id==='qa-play')bridge.pause();else if(button.id==='qa-reduced')bridge.motionReduced=!bridge.motionReduced;});
Object.defineProperty(window,'awCombatFeelQA',{value:()=>({selected,tick:bridge.world.tick,hp:bridge.world.hero.hp,shield:bridge.world.hero.shield,reduced:bridge.motionReduced,paused,history,sounds,attachments:scene.attachmentDiagnostics(),metrics:scene.metrics(),frameTiming:{meanMs:(scene as any).frames.reduce((a:number,b:number)=>a+b,0)/Math.max(1,(scene as any).frames.length),fps:1000/((scene as any).frames.reduce((a:number,b:number)=>a+b,0)/Math.max(1,(scene as any).frames.length))},numbers:(scene as any).numbers?.entries.map((n:any)=>({kind:n.kind,amount:n.amount,stack:n.stack,x:n.x,y:n.y,style:{color:(scene as any).numbers.nodes?.get(n.serial)?.text.style.color,fontSize:(scene as any).numbers.nodes?.get(n.serial)?.text.style.fontSize},render:{x:(scene as any).numbers.nodes?.get(n.serial)?.text.x,y:(scene as any).numbers.nodes?.get(n.serial)?.text.y,scale:(scene as any).numbers.nodes?.get(n.serial)?.text.scaleX}})),actors:[...(scene as any).actors].map(([id,a]:any)=>({id,x:a.sprite.x,y:a.sprite.y,scaleX:a.sprite.scaleX,scaleY:a.sprite.scaleY,tint:a.sprite.tintTopLeft,fill:a.sprite.tintMode===Phaser.TintModes.FILL,paused:a.sprite.anims.isPaused,hitStop:(scene as any).feedback.state(id,bridge.world.tick).paused})),layers:(scene.children?.list??[]).filter((n:any)=>n.visible&&n.active&&n.getData('vfx-key')?.startsWith('shield-')).map((n:any)=>({key:n.getData('vfx-key'),depth:n.depth,tint:n.tintTopLeft}))}),writable:false});
void loadWorldFont().then(()=>{new Phaser.Game({type:Phaser.WEBGL,parent:'game',width:window.innerWidth,height:window.innerHeight,scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[scene],render:{antialias:true},audio:{noAudio:true}});make('hit');});
