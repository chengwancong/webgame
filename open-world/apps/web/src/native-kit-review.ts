// Visible review of the production native path: server-shaped appearance kits through MiniNativePreview,
// one row per weapon type, standard/primal/omega × T1–T3, each looping one of its skills at game timing.
import {MiniNativePreview} from './mini-native-renderer.ts';
import {expandedSkills} from '../../../packages/content/skills-expanded.ts';
import {skillWeapons} from '../../../packages/content/skill-weapons.ts';
import {skillMotionNames} from './skill-motion-map.ts';
import {weaponTypes,type WeaponType} from '../../../packages/contracts/weapons.ts';
import type {ResolvedAppearance} from '../../../packages/contracts/appearance.ts';

const grid=document.querySelector('#grid')!,status=document.querySelector('#status')!,still=document.querySelector<HTMLInputElement>('#still')!;
const query=new URLSearchParams(location.search),only=query.get('type');
const series=['standard','primal','omega'] as const,RECOVERY=8/30,GAP=.6;
type Cell={painter:MiniNativePreview;canvas:HTMLCanvasElement;overlay:CanvasRenderingContext2D;skills:{id:string;windup:number}[]};
const cells:Cell[]=[];
function appearance(type:WeaponType,s:typeof series[number],tier:number):ResolvedAppearance{
  return {rig:'modular-hero',family:'sword',styleProfile:'v2-soft',revision:0,parts:Object.fromEntries(['head','body','hands','legs','feet','back','weapon'].map(k=>[k,{setId:'100011'}])) as ResolvedAppearance['parts'],
    kit:{weapon:{type,series:s,tier},armor:{family:type,series:s,tier}}};
}
for(const type of weaponTypes.filter(t=>!only||t===only)){
  // Wand has no weapon skills: it loops the weapon-free spells instead.
  const skills=expandedSkills.filter(k=>(type==='wand'?!skillWeapons[k.id]?.length:skillWeapons[k.id]?.includes(type))&&skillMotionNames[k.id]).map(k=>({id:k.id,windup:k.windup/30}));
  // Overview: standard T1, primal T2, omega T3 per type; ?type=x shows all nine grades.
  const grades=only?series.flatMap(s=>[1,2,3].map(tier=>[s,tier] as const)):[['standard',1],['primal',2],['omega',3]] as const;
  for(const [s,tier] of grades){
    const figure=document.createElement('figure'),canvas=document.createElement('canvas'),overlay=document.createElement('canvas');
    canvas.width=overlay.width=420;canvas.height=overlay.height=400;overlay.style.cssText='position:absolute;inset:0;width:210px;height:200px;pointer-events:none';
    figure.append(canvas,overlay);const caption=document.createElement('figcaption');caption.textContent=`${type} ${s} T${tier}`;figure.append(caption);grid.append(figure);
    const painter=new MiniNativePreview(canvas,{height:250,footX:.5,footY:.86});
    cells.push({painter,canvas,overlay:overlay.getContext('2d')!,skills:skills.length?skills:[{id:'',windup:.3}]});
    void painter.setAppearance(appearance(type,s,tier));
  }
}
const start=performance.now();
function frame(){
  const now=(performance.now()-start)/1000,lines:string[]=[];
  for(const [i,cell] of cells.entries()){
    if(!cell.painter.ready){lines.push(`${i}: loading ${cell.painter.errors.join(' ')}`);continue;}
    const cycle=Math.max(...cell.skills.map(s=>s.windup))+RECOVERY+GAP,round=Math.floor(now/cycle),skill=cell.skills[round%cell.skills.length],t=now%cycle;
    const casting=skill.id&&t<skill.windup+RECOVERY;
    cell.painter.render(casting?{action:'skill',clock:t,facing:-1,skill:skill.id,reducedMotion:still.checked,cast:{elapsed:t,windup:skill.windup,recovery:RECOVERY}}:{action:'idle',clock:now,facing:-1});
    const o=cell.overlay;o.clearRect(0,0,420,400);
    for(const [name,color] of [['weapon','#e0303a'],['muzzle','#2a62e0'],['leftHand','#20a040']] as const){const p=cell.painter.socket(name);if(p){o.fillStyle=color;o.beginPath();o.arc(p.x,p.y,5,0,7);o.fill();}}
    const d=cell.painter.diagnostics();o.fillStyle='#3a3226';o.font='20px monospace';o.fillText(`${skill.id||'-'} ${casting?(t<skill.windup?'前摇':'收招'):''}`,10,390);
    if(d.errors.length)lines.push(`${i}: ${d.errors.join(' ')}`);
  }
  status.textContent=lines.join('\n')||'全部就绪';requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
