/**
 * 棋盘单位表现层：只播放已提交事件（移动路径、出手、受击、倒下），不推导任何规则结果。
 * 主角复用原生 MiniFantasy（navy 默认 profile），敌人复用 SP33 暮界刀兵图集，宠物复用 SP33 风绒·幼年图集。
 * 加载失败时退回带文字的占位标记，不用其他图片冒充。
 */
import {MiniNativePreview} from '../mini-native-renderer.ts';
import {StarseaActorPreview} from '../starsea-actor-preview.ts';
import {loadJSON,loadStarsea} from '../starsea-assets.ts';
import type {Asset} from '../starsea-assets.ts';
import {appearanceSlots} from '../../../../packages/contracts/appearance.ts';
import type {ResolvedAppearance} from '../../../../packages/contracts/appearance.ts';
import type {WardrobeAction} from '../wardrobe-renderer.ts';
import {esc} from '../ui-components.ts';
import type {TacticalCell,TacticalPetView,TacticalUnitView} from './contract.ts';

type Painter={render(action:string,clock:number,facing:number):void;duration(action:string):number|undefined;destroy():void};
type Actor={id:string;el:HTMLElement;plate:HTMLElement;painter:Painter|null;status:'loading'|'ready'|'placeholder';
 pos:{x:number;y:number};path:TacticalCell[];stepMs:number;stepStart:number;
 action:string;actionStart:number;facing:number;alive:boolean;side:'hero'|'enemy'|'pet'};
export type ActorStatus={id:string;status:Actor['status']};

const heroAppearance=():ResolvedAppearance=>({rig:'modular-hero',styleProfile:'v2-soft',family:'sword',revision:1,
 parts:Object.fromEntries(appearanceSlots.map(slot=>[slot,{setId:'100011'}]))} as ResolvedAppearance);
let starsea:Promise<Asset|undefined>|undefined;
let petAsset:Promise<Asset|undefined>|undefined;
const findMonster=(id:string)=>(starsea??=loadStarsea().then(p=>p.assets.find(a=>a.id===id)).catch(()=>undefined));
const findPet=(id:string)=>(petAsset??=loadJSON<{assets:{id:string;name:string;[k:string]:unknown}[]}>('/art/starsea/pets/v3/manifest.json')
 .then(m=>{const row=m.assets.find(a=>a.id===id);return row?{id:row.id,name:row.name,group:'npc',type:'pet',chapters:[],source:{mode:'native',path:'',sha256:''},
  status:'ready',dependencies:[],notes:[],actions:{},states:{},runtime:row as unknown as Asset['runtime']} as Asset:undefined;}).catch(()=>undefined));

export class TacticalActors{
 private actors=new Map<string,Actor>();private raf=0;private cell=80;private reduced=false;
 onStatus?:(rows:ActorStatus[])=>void;
 constructor(private readonly layer:HTMLElement,private readonly fx:HTMLElement){this.raf=requestAnimationFrame(t=>this.frame(t));}
 setReducedMotion(value:boolean){this.reduced=value;}
 destroy(){cancelAnimationFrame(this.raf);for(const a of this.actors.values())a.painter?.destroy();this.actors.clear();this.layer.replaceChildren();this.fx.replaceChildren();}
 statuses():ActorStatus[]{return [...this.actors.values()].map(a=>({id:a.id,status:a.status}));}

 /** 投影同步：位置以投影为准（动画中的单位等动画结束后自然落到同一格）。 */
 sync(units:readonly TacticalUnitView[],pet:TacticalPetView|null,cell:number,activeId:string|null){
  if(cell!==this.cell){this.cell=cell;for(const a of this.actors.values())a.el.remove(),a.painter?.destroy();this.actors.clear();}
  const live=new Set<string>();
  for(const unit of units){
   live.add(unit.id);let actor=this.actors.get(unit.id);
   if(!actor){actor=this.create(unit.id,unit.side,unit.name);this.load(actor,unit);actor.pos={...unit.cell};actor.facing=unit.side==='hero'?1:-1;}
   if(!actor.path.length&&(actor.pos.x!==unit.cell.x||actor.pos.y!==unit.cell.y))actor.pos={...unit.cell};
   if(!unit.alive&&actor.alive){actor.alive=false;this.setAction(actor,'death');}
   if(unit.alive&&!actor.alive){actor.alive=true;this.setAction(actor,'idle');}
   actor.el.classList.toggle('is-active',unit.id===activeId);actor.el.classList.toggle('is-down',!unit.alive);
   actor.el.dataset.side=unit.side;
   const pct=Math.round(unit.hp.current/Math.max(1,unit.hp.max)*100);
   actor.plate.innerHTML=`<span class="tb-plate-name">${esc(unit.name)}</span><span class="tb-plate-hp" role="img" aria-label="生命 ${unit.hp.current}/${unit.hp.max}"><i style="width:${pct}%"></i>${unit.shield?`<b style="width:${Math.min(100,Math.round(unit.shield/Math.max(1,unit.hp.max)*100))}%"></b>`:''}</span>`;
  }
  if(pet){
   live.add('pet');let actor=this.actors.get('pet');
   if(!actor){actor=this.create('pet','pet',pet.name);this.loadPet(actor,pet.runtimeId);}
   const hero=this.actors.get('hero');if(hero)actor.pos={...hero.pos};
  }
  for(const [id,actor] of this.actors)if(!live.has(id)){actor.el.remove();actor.painter?.destroy();this.actors.delete(id);}
  this.place();this.onStatus?.(this.statuses());
 }
 private create(id:string,side:Actor['side'],name:string):Actor{
  const el=document.createElement('div');el.className='tb-actor';el.dataset.unit=id;el.dataset.side=side;
  el.setAttribute('aria-hidden','true');
  const plate=document.createElement('div');plate.className='tb-plate';
  const token=document.createElement('div');token.className='tb-token';token.textContent=side==='pet'?'宠':name.slice(0,1);
  el.append(token,plate);if(side==='pet')plate.innerHTML='<span class="tb-plate-name">不占格</span>';
  this.layer.append(el);
  const actor:Actor={id,el,plate,painter:null,status:'loading',pos:{x:0,y:0},path:[],stepMs:220,stepStart:0,action:'idle',actionStart:performance.now(),facing:1,alive:true,side};
  this.actors.set(id,actor);return actor;
 }
 private size(side:Actor['side']){const c=this.cell;return side==='pet'?{w:Math.round(c*.9),h:Math.round(c*.9)}:{w:Math.round(c*1.5),h:Math.round(c*1.6)};}
 private mount(actor:Actor,canvas:HTMLCanvasElement){canvas.className='tb-actor-canvas';actor.el.prepend(canvas);actor.el.classList.add('is-ready');}
 private fail(actor:Actor){actor.status='placeholder';actor.el.classList.add('is-placeholder');actor.el.title='美术加载失败：显示占位标记';this.onStatus?.(this.statuses());}
 private async load(actor:Actor,unit:TacticalUnitView){
  const {w,h}=this.size(actor.side);
  try{
   if(unit.art.kind==='hero-native'){
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const painter=new MiniNativePreview(canvas,{height:Math.round(this.cell*1.05),footX:.5,footY:.86});
    if(!await painter.setAppearance(heroAppearance()))throw Error('native refused');
    if(!this.actors.has(actor.id)){painter.destroy();return;}
    actor.painter={render:(a,c,f)=>{painter.render({action:a as WardrobeAction,clock:c,facing:f});},duration:a=>painter.actionDuration(a as WardrobeAction),destroy:()=>painter.destroy()};
    this.mount(actor,canvas);
   }else{
    const asset=await findMonster(unit.art.assetId);if(!asset)throw Error('missing '+unit.art.assetId);
    const preview=new StarseaActorPreview(w,h,{x:w/2,y:h*.86});
    const scaled={...asset,runtime:{...asset.runtime,scale:(asset.runtime.scale??1)*(this.cell*1.0)/(asset.runtime.displayHeight??80)}};
    await preview.load(scaled);if(!this.actors.has(actor.id))return;
    actor.painter={render:(a,c,f)=>{preview.render(a,c,f);},duration:a=>preview.actionDuration(a),destroy:()=>{}};
    this.mount(actor,preview.canvas);
   }
   actor.status='ready';this.onStatus?.(this.statuses());
  }catch{this.fail(actor);}
 }
 private async loadPet(actor:Actor,runtimeId:string){
  const {w,h}=this.size('pet');
  try{
   const asset=await findPet(runtimeId);if(!asset)throw Error('missing pet');
   const preview=new StarseaActorPreview(w,h,{x:w/2,y:h*.9});
   const scaled={...asset,runtime:{...asset.runtime,scale:(asset.runtime.scale??1)*(this.cell*.55)/(asset.runtime.displayHeight??44)}};
   await preview.load(scaled);if(!this.actors.has(actor.id))return;
   actor.painter={render:(a,c,f)=>{preview.render(a in (scaled.runtime.actions??{})?a:'idle',c,f);},duration:a=>preview.actionDuration(a),destroy:()=>{}};
   this.mount(actor,preview.canvas);actor.status='ready';this.onStatus?.(this.statuses());
  }catch{this.fail(actor);}
 }
 private setAction(actor:Actor,action:string){actor.action=action;actor.actionStart=performance.now();}
 private place(){
  const c=this.cell;
  for(const a of this.actors.values()){
   const {w,h}=this.size(a.side);
   const ox=a.side==='pet'?-c*.32:0,oy=a.side==='pet'?c*.18:0;
   const left=(a.pos.x+.5)*c+ox-w/2,top=(a.pos.y+.82)*c+oy-h*(a.side==='pet'?.9:.86);
   a.el.style.cssText=`width:${w}px;height:${h}px;transform:translate(${left.toFixed(1)}px,${top.toFixed(1)}px);z-index:${Math.round((a.pos.y+(a.side==='pet'?.5:0))*10)+10}`;
  }
 }

 // ── 事件表现 ───────────────────────────────────────────────
 /** 沿服务端给出的完整路径行走；减少动态时直接落位。返回预计时长。 */
 walk(unitId:string,path:readonly TacticalCell[],stepMs=220){
  const a=this.actors.get(unitId);if(!a||path.length<2)return 0;
  if(this.reduced){a.pos={...path[path.length-1]};a.path=[];this.place();return 0;}
  a.path=path.map(p=>({...p}));a.stepMs=stepMs;a.stepStart=performance.now();this.setAction(a,'move');
  return (path.length-1)*stepMs;
 }
 act(unitId:string,action:'attack'|'hurt'|'skill',towards?:TacticalCell){
  const a=this.actors.get(unitId);if(!a||!a.alive)return;
  if(towards&&towards.x!==a.pos.x)a.facing=towards.x>a.pos.x?1:-1;
  if(this.reduced&&action==='hurt'){a.el.classList.remove('is-hit');void a.el.offsetWidth;a.el.classList.add('is-hit');setTimeout(()=>a.el.classList.remove('is-hit'),450);return;}
  this.setAction(a,action==='skill'?'attack':action);
 }
 float(unitId:string,text:string,tone:'damage-dealt'|'damage-taken'|'shield'|'info'){
  const a=this.actors.get(unitId);if(!a)return;
  const el=document.createElement('div');el.className=`tb-float tb-float-${tone}`;el.textContent=text;
  el.style.left=`${(a.pos.x+.5)*this.cell}px`;el.style.top=`${(a.pos.y)*this.cell}px`;
  this.fx.append(el);setTimeout(()=>el.remove(),this.reduced?900:1100);
 }
 pulsePet(){const a=this.actors.get('pet');if(!a)return;a.el.classList.remove('is-assist');void a.el.offsetWidth;a.el.classList.add('is-assist');setTimeout(()=>a.el.classList.remove('is-assist'),950);}
 private frame(t:number){
  this.raf=requestAnimationFrame(n=>this.frame(n));
  let moved=false;
  for(const a of this.actors.values()){
   if(a.path.length>1){
    const k=(t-a.stepStart)/a.stepMs,i=Math.floor(k);
    if(i>=a.path.length-1){a.pos={...a.path[a.path.length-1]};a.path=[];this.setAction(a,'idle');}
    else{const p=a.path[i],q=a.path[i+1],f=k-i;a.pos={x:p.x+(q.x-p.x)*f,y:p.y+(q.y-p.y)*f};if(q.x!==p.x)a.facing=q.x>p.x?1:-1;}
    moved=true;
   }
   if(a.side==='pet'){const hero=this.actors.get('hero');if(hero){a.pos={...hero.pos};a.facing=hero.facing;moved=true;}}
   if(!a.painter)continue;
   const clock=(t-a.actionStart)/1000;
   if(a.action!=='idle'&&a.action!=='move'&&a.action!=='death'){const d=a.painter.duration(a.action)??.8;if(clock>=d)this.setAction(a,'idle');}
   try{a.painter.render(a.action,this.reduced&&a.action==='idle'?0:Math.max(0,clock),a.facing);}catch{a.painter=null;this.fail(a);}
  }
  if(moved)this.place();
 }
}
