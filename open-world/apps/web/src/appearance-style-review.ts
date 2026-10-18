import './ui/tokens.css';
import './appearance-style-review.css';
import profileSource from '../../../assets/mini-hero/navy/profile.json';
import skeletonSource from '../../../assets/mini-hero/navy/runtime/Character.json';
import {MiniNativePreview,type MiniNativeProfile} from './mini-native-renderer.ts';
import {appearanceSlots,type ResolvedAppearance} from '../../../packages/contracts/appearance.ts';

const skins=skeletonSource.skins.map(s=>s.name).filter(n=>n.startsWith('BODY/')&&n!=='BODY/base');
const families:Record<string,string>={archer:'弓手',cleric:'疗愈',knight:'守卫',rogue:'游侠',warrior:'近战',wizard:'法师'};
const label=(skin:string)=>{const name=skin.slice(5),family=name.split('_')[0],index=skins.filter(s=>s.startsWith('BODY/'+family+'_')).indexOf(skin)+1;return `${families[family]??family} · 款式 ${index}`;};
const presets=[{title:'初始人物 · 参照',skin:'BODY/knight_rare1',weapon:'100011',locked:true},{title:'荒野旅装 · 同源候选',skin:'BODY/warrior_common1',weapon:'100011'},{title:'拳师旅装 · 同源候选',skin:'BODY/rogue_common1',weapon:'100011',unarmed:true},{title:'深渊法袍 · 同源候选',skin:'BODY/wizard_rare1',weapon:'400105'}];
document.querySelector('#review')!.innerHTML=`<header><p class="eyebrow">深渊行者 / 外观统一</p><h1>同一人物比例，同一套画风</h1><p>左侧保留初始人物。其余展示同源原生衣装，可切换候选，比较待机、奔跑和朝向。</p><div class="controls"><button id="idle" aria-pressed="true">待机</button><button id="move" aria-pressed="false">奔跑</button><button id="facing">切换朝向</button><button id="playing">暂停</button></div></header><section class="lineup">${presets.map((p,i)=>`<article><h2>${p.title}</h2><div class="stage"><canvas id="figure-${i}" width="320" height="360" aria-label="${p.title}"></canvas><i></i></div><select id="skin-${i}" aria-label="${p.title}衣装" ${p.locked?'disabled':''}>${skins.map(s=>`<option value="${s}" ${s===p.skin?'selected':''}>${label(s)}</option>`).join('')}</select><p class="status" id="status-${i}">正在读取原生资源…</p></article>`).join('')}</section><footer><strong>真实骨骼动态预览 · 尚未替换游戏外观</strong><p>候选复用初始人物同源资源，保留相同头身比、五官、描边与动作。正式接入还需适配七部位混搭、武器及预览缩略图。</p></footer>`;
type Entry={painter?:MiniNativePreview;generation:number;url?:string};
const entries:Entry[]=presets.map(()=>({generation:0}));let action:'idle'|'move'='idle',facing=-1,playing=true,clock=0,last=0;
async function choose(index:number,skin:string){
 const entry=entries[index],generation=++entry.generation,preset=presets[index],profile=structuredClone(profileSource) as unknown as MiniNativeProfile;
 profile.skinNames=[skin,'HEAD/headA2','HAIR/hairA_a2'];
 if(preset.unarmed)profile.weapons[preset.weapon].skinNames=[];
 const url=URL.createObjectURL(new Blob([JSON.stringify(profile)],{type:'application/json'}));
 const canvas=document.querySelector<HTMLCanvasElement>(`#figure-${index}`)!,status=document.querySelector(`#status-${index}`)!;
 const painter=new MiniNativePreview(canvas,{profileUrl:url,height:165,footX:.5,footY:.8});
 const appearance={rig:'modular-hero',styleProfile:'v2-soft',family:profile.weapons[preset.weapon].family,revision:1,parts:Object.fromEntries(appearanceSlots.map(slot=>[slot,{setId:slot==='weapon'?preset.weapon:'100011'}]))} as ResolvedAppearance;
 status.textContent='正在读取原生资源…';
 try{if(!await painter.setAppearance(appearance))throw Error(painter.diagnostics().errors.join('; '));if(entry.generation!==generation){painter.destroy();URL.revokeObjectURL(url);return;}
  painter.render({action,clock:0,facing});entry.painter?.destroy();if(entry.url)URL.revokeObjectURL(entry.url);entry.painter=painter;entry.url=url;canvas.dataset.skin=skin;canvas.dataset.ready='true';status.textContent=index===0?'初始资源原样展示':`同源资源 · ${label(skin)}`;
 }catch(error){painter.destroy();URL.revokeObjectURL(url);const reason=(error instanceof Error?error.message:String(error)).replace(/^(?:Error:\s*)+/,'');status.textContent=(entry.painter?'加载失败，保留上一衣装：':'预览失败：')+reason;canvas.dataset.ready=String(Boolean(entry.painter?.ready));}
}
const reload=document.createElement('button');reload.textContent='重新加载';reload.id='reload';document.querySelector('.controls')!.append(reload);
let loading=false;
async function reloadPreviews(){if(loading)return;loading=true;reload.disabled=true;try{for(let i=0;i<presets.length;i++)await choose(i,document.querySelector<HTMLSelectElement>(`#skin-${i}`)!.value);}finally{loading=false;reload.disabled=false;}}
reload.addEventListener('click',()=>void reloadPreviews());
for(let i=0;i<presets.length;i++)document.querySelector<HTMLSelectElement>(`#skin-${i}`)!.addEventListener('change',event=>void choose(i,(event.target as HTMLSelectElement).value));
for(const name of ['idle','move'] as const)document.querySelector('#'+name)!.addEventListener('click',()=>{action=name;clock=0;for(const id of ['idle','move'])document.querySelector('#'+id)!.setAttribute('aria-pressed',String(id===name));});
document.querySelector('#facing')!.addEventListener('click',()=>{facing=-facing;});
document.querySelector('#playing')!.addEventListener('click',event=>{playing=!playing;(event.target as HTMLButtonElement).textContent=playing?'暂停':'播放';});
function frame(time:number){requestAnimationFrame(frame);if(document.hidden||time-last<50)return;const delta=Math.min(.1,(time-last)/1000);last=time;if(playing)clock+=delta;for(const entry of entries)if(entry.painter?.ready){const duration=entry.painter.actionDuration(action)??1;entry.painter.render({action,clock:clock%duration,facing});}}
requestAnimationFrame(frame);
window.addEventListener('pagehide',()=>{for(const e of entries){e.painter?.destroy();if(e.url)URL.revokeObjectURL(e.url);}});
void reloadPreviews();
