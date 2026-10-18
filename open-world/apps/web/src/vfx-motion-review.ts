/**
 * Joint motion + VFX review (Claude, 2026-10-16). Each skill is cast through the gallery's real World/WorldScene
 * path with the native kit of its weapon, then frames around the real release tick are cropped into one sheet per
 * weapon group. Sheets are saved locally by the lab server (.qa/review-sheets/), never committed.
 */
import type {World} from '../../../packages/simulation/index.ts';
import type {WorldScene} from './scene.ts';
import type {ResolvedAppearance} from '../../../packages/contracts/appearance.ts';
import type {WeaponType} from '../../../packages/contracts/weapons.ts';
import {skillWeapons} from '../../../packages/content/skill-weapons.ts';
import {skillCatalog} from '../../../packages/content/index.ts';
import {nativeKit} from './native-kit.ts';

type Deps={scene:WorldScene;world:()=>World;scenario:(id:string)=>void;cast:()=>void;step:()=>void;release:()=>number;
  setAppearance:(appearance:ResolvedAppearance)=>void;base:()=>ResolvedAppearance;setReduced:(on:boolean)=>void};
const spells=['ember','chain','lance','meteor','fireball','frost_bolt','lightning_bolt','barrage','frost','nova','miasma'];
const control=['arcane_missile','gravity_well','silence','petrify','slow_field','fear','root','blind','vortex','time_stop','static_field','dark_grasp'];
const support=['ward','mend','haste','regen','blink','barrier','cleanse','phase_shift','second_wind','guardian_angel'];
const of=(type:WeaponType)=>Object.keys(skillWeapons).filter(id=>skillWeapons[id][0]===type);
export const reviewGroups:Record<string,{kit:WeaponType;ids:string[]}>={
  sword:{kit:'sword',ids:of('sword')},hammer:{kit:'hammer',ids:of('hammer')},axe:{kit:'axe',ids:of('hammer')},staff:{kit:'staff',ids:of('staff')},
  hidden:{kit:'hidden',ids:of('hidden')},bow:{kit:'bow',ids:of('bow')},spells:{kit:'staff',ids:spells},control:{kit:'wand',ids:control},support:{kit:'wand',ids:support},
};
/** Frame offsets: mid-windup, then ticks after the first real release. */
type Column=[string,(cast:number,release:number)=>number];
/** ?fine=1 (or the checkbox): tick-by-tick around the release, for arrival and contact timing. */
const fine:Column[]=[['释放-1',(_,r)=>r-1],['释放',(_,r)=>r],['+1',(_,r)=>r+1],['+2',(_,r)=>r+2],['+4',(_,r)=>r+4]];
const normal:Column[]=[
  ['前摇中',(c,r)=>c+Math.round((r-c)*.5)],['释放',(_,r)=>r],['+3',(_,r)=>r+3],['+7',(_,r)=>r+7],['+14',(_,r)=>r+14],
];
/** Review renders the camera at 2x so poses and effect contact are legible. */
const ZOOM=2,CROP={w:640,h:400,dx:110,dy:-40},CELL={w:400,h:250},LABEL=110;

export function installMotionReview(d:Deps){
  const root=document.createElement('section');root.id='motion-review';
  root.innerHTML=`<hr><strong>动作＋特效联合审查（原生套装）</strong><div>${Object.keys(reviewGroups).map(g=>`<button data-review="${g}">${g}</button>`).join('')}<button data-review="all">全部</button></div><label><input type=checkbox id=review-reduced> 减少动态</label><output id=review-status aria-live=polite>就绪</output>`;
  document.querySelector('#qa')!.append(root);
  const status=root.querySelector('output')!;let busy=false;
  // The pane may report document.hidden, which pauses Phaser's rAF loop; pump the real game loop directly.
  let clock=performance.now();
  const rendered=async()=>{clock+=1000/60;d.scene.game.step(clock,1000/60);await new Promise(r=>setTimeout(r,0));};
  const frame=async()=>{const tick=d.world().tick;d.step();for(let i=0;i<6&&d.world().tick===tick;i++)await rendered();clock+=1000/60;d.scene.game.step(clock,1000/60);};
  const kitAppearance=(type:WeaponType):ResolvedAppearance=>({...d.base(),kit:{weapon:{type,series:'primal',tier:2},armor:{family:type,series:'primal',tier:2}}});
  const ready=async(type:WeaponType)=>{const want=nativeKit(kitAppearance(type).kit!).key;for(let i=0;i<480;i++){await rendered();await new Promise(r=>setTimeout(r,16));const w=d.scene.attachmentDiagnostics().wardrobe as {ready?:boolean;pending?:boolean;kit?:string}|undefined;if(w?.ready&&!w.pending&&w.kit===want)return;}throw Error('kit not ready: '+want);};
  type Options={reduced?:boolean;fine?:boolean;ids?:string[];kit?:WeaponType;name?:string;probe?:(column:number)=>unknown};
  async function sheet(group:string,o:Options={}){
    const reduced=!!o.reduced,columns=o.fine?fine:normal,kit=o.kit??reviewGroups[group].kit,ids=o.ids??reviewGroups[group].ids,canvas=document.createElement('canvas');canvas.width=LABEL+CELL.w*columns.length;canvas.height=24+CELL.h*ids.length;
    const g=canvas.getContext('2d')!;g.fillStyle='#1b2630';g.fillRect(0,0,canvas.width,canvas.height);g.font='13px sans-serif';g.fillStyle='#f4e8ce';
    columns.forEach(([name],i)=>g.fillText(name,LABEL+i*CELL.w+6,16));
    const notes:unknown[]=[];d.setReduced(reduced);
    try{
    for(const [row,id] of ids.entries()){
      status.textContent=`${group} ${row+1}/${ids.length} ${id}`;
      // Dry pass finds the real release tick; the deterministic second pass captures around it.
      const begin=async()=>{d.scenario(id);d.world().paused=true;d.setAppearance(kitAppearance(kit));await ready(kit);d.scene.cameras.main.setZoom(d.scene.scale.width/1280*ZOOM);d.world().paused=false;const at=d.world().tick;d.cast();d.world().paused=true;return at;};
      let start=await begin(),steps=0;while(!d.release()&&steps++<180)await frame();
      const release=d.release()-start;if(release<=0)throw Error(id+' has no cast_released');start=await begin();
      const y=24+row*CELL.h,skill=skillCatalog.find(s=>s.id===id)!;g.fillStyle='#f4e8ce';g.fillText(skill.name,6,y+20);g.fillText(id,6,y+38);g.fillText(`前摇 ${release}t`,6,y+56);
      const motions:string[]=[],probes:unknown[]=[];
      for(const [i,[,at]] of columns.entries()){
        const tick=Math.max(start+1,at(start,start+release));while(d.world().tick<tick)await frame();
        clock+=1000/60;d.scene.game.step(clock,1000/60);
        const source=d.scene.game.canvas,sx=source.width/2-CROP.w/2+CROP.dx,sy=source.height/2-CROP.h/2+CROP.dy;
        g.drawImage(source,sx,sy,CROP.w,CROP.h,LABEL+i*CELL.w,y,CELL.w,CELL.h);g.strokeStyle='#33424f';g.strokeRect(LABEL+i*CELL.w+.5,y+.5,CELL.w-1,CELL.h-1);
        if(o.probe)probes.push(o.probe(i));motions.push(String((d.scene.attachmentDiagnostics().wardrobe as {motion?:string}|undefined)?.motion));
      }
      const errors=d.scene.attachmentDiagnostics().effects?.errors??[];notes.push({id,release,motions,errors,...o.probe?{probes}:{}});
      if(errors.length){g.fillStyle='#ff8080';g.fillText('ERR',6,y+74);}
    }
    }finally{d.scene.cameras.main.setZoom(d.scene.scale.width/1280);}
    const name=o.name??`${group}${reduced?'-still':''}${o.fine?'-fine':''}`,blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Empty sheet')),'image/png'));
    for(const [file,body] of [[name+'.png',blob],[name+'.json',JSON.stringify(notes,null,1)]] as const){const r=await fetch('/__review/'+file,{method:'POST',body});if(!r.ok)throw Error(await r.text());}
    return name;
  }
  root.addEventListener('click',async event=>{
    const group=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-review]')?.dataset.review;if(!group||busy)return;busy=true;
    const reduced=(root.querySelector('#review-reduced') as HTMLInputElement).checked,saved:string[]=[];
    try{for(const g of group==='all'?Object.keys(reviewGroups):[group])saved.push(await sheet(g,{reduced}));status.textContent='已保存 '+saved.join(', ');}
    catch(e){status.textContent='失败 '+String(e);console.error(e);}finally{busy=false;d.setReduced(false);}
  });
  /** Scripted entry for the visible review: awMotionReview('sword',{fine:true,ids:['leap_strike']}). */
  Object.defineProperty(window,'awReviewScene',{value:d.scene});
  Object.defineProperty(window,'awMotionReview',{value:async(group:string,o:Options={})=>{if(busy)throw Error('busy');busy=true;try{return await sheet(group,o);}finally{busy=false;d.setReduced(false);}}});
}
