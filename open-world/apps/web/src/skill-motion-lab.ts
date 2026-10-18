// Visible motion lab: authored skill motions on the live rig, per weapon kit, with real windups.
import {AssetManager,AtlasAttachmentLoader,RegionAttachment,SceneRenderer,SkeletonJson,Skin,Vector2,type SkeletonData,type Slot,type TextureAtlas} from '@esotericsoftware/spine-webgl';
import {MiniNativePlayback,miniSourceTime,type MiniNativeProfile} from './mini-native-renderer.ts';
import {loadMiniNativeAssets} from './mini-native-loading.ts';
import {installSkillMotions,skillMotions} from './skill-motions.ts';
import {skillMotionNames} from './skill-motion-map.ts';
import {attachExtWeapon,extPlacement,type NativeWeaponExt} from './native-weapon-ext.ts';
import {expandedSkills} from '../../../packages/content/skills-expanded.ts';
import {skillWeapons} from '../../../packages/content/skill-weapons.ts';

type Kit={label:string;body:string;right:string;left?:string;native:string[];weapons:string[]};
/** Lab kits: one body per outfit class with its own weapon; the production mapping lives in the profile. */
const kits:Record<string,Kit>={
  sword:{label:'单手剑',body:'BODY/knight_rare1',right:'RIGHTHAND/Sword_OneHand_Rare1',native:['Attack_OneHand1','Attack_OneHand2'],weapons:['sword']},
  sword2:{label:'双手剑',body:'BODY/knight_epic1',right:'RIGHTHAND/Sword_TwoHand_Rare1',native:['Attack_TwoHand1','Attack_TwoHand2'],weapons:['sword']},
  hammer:{label:'锤',body:'BODY/warrior_rare1',right:'EXT/hammer_standard_t2',native:['Attack_TwoHand1','Attack_TwoHand2'],weapons:['hammer']},
  axe:{label:'斧',body:'BODY/warrior_epic2',right:'EXT/axe_primal_t3',native:['Attack_TwoHand1','Attack_TwoHand2'],weapons:['axe']},
  staff:{label:'法杖',body:'BODY/wizard_rare1',right:'RIGHTHAND/Staff_Rare1',native:['Spell1','Spell2','Cast1'],weapons:['staff','spell']},
  wand:{label:'魔杖',body:'BODY/wizard_epic1',right:'RIGHTHAND/Scepter_Rare1',native:['Cast1','Cast2','Spell1'],weapons:['wand','spell']},
  hidden:{label:'暗器（双匕首）',body:'BODY/rogue_rare1',right:'RIGHTHAND/Dagger_Rare1',left:'LEFTHAND/Dagger_Rare1',native:['Attack_DualHand1','Attack_DualHand2'],weapons:['hidden']},
  bow:{label:'弓',body:'BODY/archer_rare1',right:'RIGHTHAND/Bow_Rare1',native:['Shoot1'],weapons:['bow']},
};
type Cell={label:string;anim:string;impact:number;windup:number;sub?:string};
const query=new URLSearchParams(location.search),SHEET=query.get('sheet'),sheetCount=Number(query.get('n')??8);
// ?sheet=A,B,C lays several motions out one per row at their key poses only (compact review strips).
const STRIPS=SHEET?.includes(',')?SHEET.split(','):undefined,stripMax=STRIPS?Math.max(...STRIPS.map(n=>skillMotions.find(m=>m.name===n)?.poses.length??sheetCount)):0;
const RECOVERY=8/30,LEAD=.5,TAIL=.7,SCALE=STRIPS?.62:SHEET?.9:.8,CELL=STRIPS?135:SHEET?205:210,ROW=STRIPS?165:SHEET?235:265;
let COLUMNS=STRIPS?stripMax:SHEET?3:6;
const canvas=document.querySelector<HTMLCanvasElement>('#stage')!,overlay=document.querySelector<HTMLCanvasElement>('#overlay')!;
const $=<T extends HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const ui={kit:$<HTMLSelectElement>('#weapon'),mode:$<HTMLSelectElement>('#mode'),timing:$<HTMLSelectElement>('#timing'),speed:$<HTMLSelectElement>('#speed'),
  pause:$<HTMLButtonElement>('#pause'),scrub:$<HTMLInputElement>('#scrub'),mirror:$<HTMLInputElement>('#mirror'),trail:$<HTMLInputElement>('#trail'),status:$<HTMLDivElement>('#status')};
const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true})!,renderer=new SceneRenderer(canvas,gl,true);
const profile=await (await fetch('/art/mini-hero/navy/profile.json')).json() as MiniNativeProfile;
const manager=new AssetManager(renderer.context);await loadMiniNativeAssets(manager,profile.runtime);
const data:SkeletonData=new SkeletonJson(new AtlasAttachmentLoader(manager.get(profile.runtime.atlas) as TextureAtlas)).readSkeletonData(installSkillMotions(manager.get(profile.runtime.json)));
const extItems=new Map(((await (await fetch('/art/mini-hero/extensions/extensions.json')).json()).items as NativeWeaponExt[]).map(i=>[i.id,i]));
const motion=(name:string)=>skillMotions.find(m=>m.name===name);
const nativeImpact:Record<string,number>={Attack_OneHand1:.35,Attack_OneHand2:.4,Attack_TwoHand1:25/60,Attack_TwoHand2:26/60,Spell1:20/60};

async function skinFor(kit:Kit,body=kit.body){
  const skin=new Skin('lab');for(const n of [body,...profile.skinNames.filter(n=>!n.startsWith('BODY/')),kit.left].filter(Boolean) as string[])skin.addSkin(data.findSkin(n)!);
  if(kit.right.startsWith('EXT/'))await attachExtWeapon(renderer.context,data,skin,extItems.get(kit.right.slice(4))!,'/art/mini-hero/extensions/');
  else skin.addSkin(data.findSkin(kit.right)!);
  for(const name of profile.activeBones??[]){const bone=data.findBone(name)!;if(!skin.bones.includes(bone))skin.bones.push(bone);}
  return skin;
}
/** Region tip: the image's top center (all rig weapons point along +y); extension items use their measured head. */
function tip(slot:Slot,kit:Kit){
  const a=slot.getAttachment();if(!(a instanceof RegionAttachment))return;
  const ext=kit.right.startsWith('EXT/')&&slot.data.name==='RIGHTHAND'?extPlacement(extItems.get(kit.right.slice(4))!).tip:undefined;
  const r=a.rotation*Math.PI/180,local=ext??{x:a.x-Math.sin(r)*a.height/2,y:a.y+Math.cos(r)*a.height/2};
  const w=slot.bone.localToWorld(new Vector2(local.x,local.y));return {x:w.x,y:w.y};
}
function cellsFor(kitId:string):Cell[]{
  const kit=kits[kitId],mode=ui.mode.value;
  if(mode==='native')return ['Wait1',...kit.native].map(anim=>({label:anim,anim,impact:nativeImpact[anim]??data.findAnimation(anim)!.duration/2,windup:anim==='Wait1'?0:8}));
  if(mode==='bodies'){const cls=kit.body.split('/')[1].replace(/_.*/,'');return data.skins.filter(s=>s.name.startsWith(`BODY/${cls}_`)).map(s=>({label:s.name.slice(5),anim:'Wait1',impact:0,windup:0,sub:s.name}));}
  const families=new Set(kit.weapons),spells=mode==='spells';
  return expandedSkills.filter(s=>{const w=skillWeapons[s.id]??[];return spells?w.length===0:w.some(x=>families.has(x));}).map(s=>{
    const name=skillMotionNames[s.id],m=name?motion(name):undefined;
    return m?{label:`${s.name} ${s.id}`,anim:m.name,impact:m.impact,windup:s.windup,sub:m.name}:{label:`${s.name} ${s.id}`,anim:kit.native[0],impact:nativeImpact[kit.native[0]]??.35,windup:s.windup,sub:`未制作 → ${kit.native[0]}`};
  });
}

let players:{cell:Cell;playback:MiniNativePlayback;trail:{x:number;y:number;age:number}[][];flash:number;at?:number}[]=[],kit=kits.sword,building=0;
async function build(){
  const ticket=++building;kit={...kits[ui.kit.value]};kit.right=query.get('right')??kit.right;// ?right=EXT/axe_standard_t1 swaps the held item
  const base=await skinFor(kit),cells=cellsFor(ui.kit.value),skins=await Promise.all(cells.map(c=>c.sub?.startsWith('BODY/')?skinFor(kit,c.sub):base));
  if(ticket!==building)return;
  const authored=SHEET?motion(SHEET):undefined,keys=authored?[...new Set(authored.poses.flatMap((p,i,a)=>i?[(a[i-1].t+p.t)/2,p.t]:[p.t]))].map(t=>Math.round(t*60)/60):undefined;
  if(STRIPS){players=STRIPS.flatMap(name=>{const m=motion(name),d=data.findAnimation(name)!.duration,times=m?m.poses.map(p=>Math.round(p.t*60)/60):Array.from({length:sheetCount},(_,i)=>Math.round(i/(sheetCount-1)*d*60)/60);
    return Array.from({length:stripMax},(_,i)=>times[i]).map(at=>({cell:{label:at===undefined?'':`${name.replace('Skill_','')} ${at.toFixed(2)}`,anim:at===undefined?'Wait1':name,impact:m?.impact??-1,windup:0},playback:new MiniNativePlayback(data,base),trail:[[],[]] as {x:number;y:number;age:number}[][],flash:0,at:at??0}));});}
  else players=SHEET?Array.from({length:keys?.length??sheetCount},(_,i)=>{const d=data.findAnimation(SHEET)!.duration,at=keys?keys[i]:Math.round(i/(sheetCount-1)*d*60)/60;
    return {cell:{label:at.toFixed(3)+'s',anim:SHEET,impact:authored?.impact??nativeImpact[SHEET]??-1,windup:0},playback:new MiniNativePlayback(data,base),trail:[[],[]],flash:0,at};}):
    cells.map((cell,i)=>({cell,playback:new MiniNativePlayback(data,skins[i]),trail:[[],[]],flash:0}));
  const columns=Math.min(COLUMNS,players.length);canvas.width=overlay.width=CELL*columns;canvas.height=overlay.height=ROW*Math.ceil(players.length/columns);
}
const castLength=(p:typeof players[number])=>ui.timing.value==='game'?p.cell.windup/30+RECOVERY:data.findAnimation(p.cell.anim)!.duration;
const cycle=()=>LEAD+Math.max(...players.map(castLength))+TAIL;
let t=0,paused=false,last=performance.now();
function frame(now:number){
  const dt=Math.min(.05,(now-last)/1000)*Number(ui.speed.value);last=now;
  if(!paused&&players.length){t=(t+dt)%cycle();ui.scrub.value=String(t/cycle());}
  const camera=renderer.camera,ground=profile.ground;
  camera.viewportWidth=canvas.width/SCALE;camera.viewportHeight=canvas.height/SCALE;camera.position.x=0;camera.position.y=0;
  gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  const ctx=overlay.getContext('2d')!;ctx.clearRect(0,0,overlay.width,overlay.height);
  const toScreen=(x:number,y:number)=>({x:(x-camera.position.x)*SCALE+canvas.width/2,y:canvas.height/2-(y-camera.position.y)*SCALE});
  renderer.begin();
  players.forEach((p,i)=>{
    if(STRIPS&&!p.cell.label)return;
    const skeleton=p.playback.skeleton,col=i%COLUMNS,row=Math.floor(i/COLUMNS),cx=((col+.5)*CELL-canvas.width/2)/SCALE,cy=(canvas.height/2-(row+1)*ROW+48)/SCALE;
    skeleton.x=cx;skeleton.y=cy;skeleton.scaleX=ui.mirror.checked?-1:1;
    const elapsed=t-LEAD,length=castLength(p),casting=elapsed>=0&&elapsed<=length&&p.cell.windup>0;
    ctx.fillStyle='#5a4e3a';ctx.font='12px "Microsoft YaHei",sans-serif';ctx.fillText(p.cell.label,col*CELL+8,row*ROW+16);
    if(p.cell.sub&&!SHEET){ctx.fillStyle=p.cell.sub.startsWith('未')?'#b0503a':'#8a7e6a';ctx.fillText(p.cell.sub+(p.cell.windup?` · 前摇${p.cell.windup}`:''),col*CELL+8,row*ROW+31);}
    if(p.at!==undefined){p.playback.seek(data.findAnimation(p.cell.anim)!,p.at,profile.fps);if(Math.abs(p.at-p.cell.impact)<1/120){ctx.fillStyle='rgba(214,72,56,.9)';ctx.font='bold 15px sans-serif';ctx.fillText('打击帧',col*CELL+CELL-60,row*ROW+18);}}
    else if(casting){
      const animation=data.findAnimation(p.cell.anim)!;
      const time=ui.timing.value==='game'?miniSourceTime(animation.duration,{name:p.cell.anim,impactTime:p.cell.impact},{action:'attack',clock:0,facing:1,cast:{elapsed,windup:p.cell.windup/30,recovery:RECOVERY}}):Math.min(animation.duration,elapsed);
      const before=p.playback.sourceTime;p.playback.seek(animation,time,profile.fps);
      if(!paused&&p.playback.action===p.cell.anim&&before<p.cell.impact&&p.playback.sourceTime>=p.cell.impact)p.flash=.18;
      ['RIGHTHAND','LEFTHAND'].forEach((name,k)=>{const q=tip(skeleton.findSlot(name)!,kit);if(q&&!paused)p.trail[k].push({...toScreen(q.x,q.y),age:0});});
    }else{const idle=data.findAnimation('Wait1')!;p.playback.seek(idle,(t%idle.duration),profile.fps);p.trail.forEach(tr=>tr.length=0);}
    renderer.drawSkeleton(skeleton,profile.runtime.pma);
    const base=toScreen(cx+ground[0],cy+ground[1]);
    ctx.fillStyle='rgba(60,50,30,.18)';ctx.beginPath();ctx.ellipse(base.x,base.y+2,30,7,0,0,Math.PI*2);ctx.fill();
    for(const trail of p.trail){
      if(ui.trail.checked)for(let k=1;k<trail.length;k++){const a=trail[k-1],b=trail[k],alpha=Math.max(0,1-b.age/.16);ctx.strokeStyle=`rgba(255,248,214,${alpha})`;ctx.lineWidth=2+5*alpha;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
      for(const q of trail)q.age+=paused?0:dt;trail.splice(0,trail.length,...trail.filter(q=>q.age<.16));
    }
    if(p.flash>0){ctx.strokeStyle=`rgba(214,72,56,${p.flash/.18})`;ctx.lineWidth=4;ctx.strokeRect(col*CELL+3,row*ROW+3,CELL-6,ROW-6);if(!paused)p.flash-=dt;}
  });
  renderer.end();
  ui.status.textContent=`t=${(t-LEAD).toFixed(3)}s`;
  requestAnimationFrame(frame);
}
ui.kit.innerHTML=Object.entries(kits).map(([id,k])=>`<option value="${id}">${k.label}</option>`).join('');
if(query.get('kit'))ui.kit.value=query.get('kit')!;if(query.get('mode'))ui.mode.value=query.get('mode')!;
ui.kit.onchange=ui.mode.onchange=()=>void build();ui.pause.onclick=()=>{paused=!paused;ui.pause.textContent=paused?'播放':'暂停';};
ui.scrub.oninput=()=>{paused=true;ui.pause.textContent='播放';t=Number(ui.scrub.value)*cycle();for(const p of players){p.flash=0;p.trail.forEach(tr=>tr.length=0);}};
await build();requestAnimationFrame(frame);
/** Reads any animation frame back into DSL terms (character frame, facing left) to learn from the source moves. */
function pose(anim:string,time:number){
  const p=new MiniNativePlayback(data,new Skin('probe'));p.seek(data.findAnimation(anim)!,time,profile.fps);const s=p.skeleton,sd=data;
  const b=(n:string)=>s.findBone(n)!,setup=(n:string)=>sd.findBone(n)!,ang=(w:number)=>{let a=180-w;a=((a+180)%360+360)%360-180;return Math.round(a);};
  const off=(n:string)=>[Math.round(-(b(n).x-setup(n).x)),Math.round(b(n).y-setup(n).y)];
  return {t:time,hip:off('pelvis'),lean:Math.round(b('spine1').rotation-setup('spine1').rotation),chest:Math.round(b('spine2').rotation-setup('spine2').rotation),head:Math.round(b('head').rotation-setup('head').rotation),
    armR:[ang(b('armR1').getWorldRotationX()),ang(b('armR2').getWorldRotationX())],blade:ang(b('RIGHTHAND').getWorldRotationX()+90),
    armL:[ang(b('armL1').getWorldRotationX()),ang(b('armL2').getWorldRotationX())],bladeL:ang(b('LEFTHAND').getWorldRotationX()+90),footF:off('target_legR'),footB:off('target_legL')};
}
Object.assign(window,{motionLab:{pose,seek:(s:number)=>{paused=true;ui.pause.textContent='播放';t=s+LEAD;for(const p of players){p.flash=0;p.trail.forEach(tr=>tr.length=0);}},players:()=>players}});
