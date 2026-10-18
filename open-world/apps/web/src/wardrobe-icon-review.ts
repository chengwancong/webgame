import './ui/tokens.css';
import './wardrobe-icon-review.css';
import manifest from '../../../assets/mini-hero/icons-v2/manifest.json';
import profileSource from '../../../assets/mini-hero/navy/profile.json';
import {MiniNativePreview,type MiniNativeProfile} from './mini-native-renderer.ts';
import type {NativeSkinRoles} from './native-skin-composition.ts';
import {appearanceSlots,type ResolvedAppearance} from '../../../packages/contracts/appearance.ts';
const families={sword:'剑',hammer:'锤',axe:'斧',staff:'法杖',hidden:'暗器',wand:'魔杖'},series={standard:'常规',omega:'方阵',primal:'原初'},parts={weapon:'武器',armor:'衣服',boots:'鞋子'};
let family='sword',collection='standard',tier=1,painter:MiniNativePreview|undefined,url:string|undefined,generation=0,last=0,clock=0;
const root=document.querySelector('#icon-review')!;root.innerHTML=`<header><h1>装备图标与形象对应</h1><p>162 张正式装备图标 · 390 张外观与形象缩略图 · 原生分件直接生成</p><div class="filters"><label>谱系<select id="family">${Object.entries(families).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><label>系列<select id="series">${Object.entries(series).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><label>阶段<select id="tier"><option value="1">T1</option><option value="2">T2</option><option value="3">T3</option></select></label></div></header><section class="comparison"><article class="figure"><h2>对应的原生形象</h2><canvas id="matching-hero" width="384" height="384"></canvas><p id="hero-status" role="status">正在读取资源…</p></article><div id="icons"></div></section><footer>此页展示 V2 资源包。正式图标随 V2 形象一起切换；斧、锤源图已备齐，原生佩戴挂载仍待校准。</footer>`;
const sourceItems=manifest.items;
async function show(){
 const ticket=++generation,items=sourceItems.filter(x=>x.family===family&&x.series===collection&&x.tier===tier);
 root.setAttribute('data-ready','false');
 document.querySelector('#icons')!.innerHTML=items.map(item=>`<article><h2>${parts[item.part as keyof typeof parts]} · ${item.name}</h2><div class="icon-large"><img src="/art/mini-hero/icons-v2/${item.id}.png" alt="${item.name}"></div><div class="actual-sizes">${[64,48,32].map(size=>`<div><img src="/art/mini-hero/icons-v2/${item.id}.png" width="${size}" height="${size}" alt="${size}像素图标"><small>${size}px</small></div>`).join('')}</div></article>`).join('');
 const armor=items.find(x=>x.part==='armor')!,boots=items.find(x=>x.part==='boots')!,weapon=items.find(x=>x.part==='weapon')!;
 const armorRoles=armor.roles as NativeSkinRoles,bootRoles=boots.roles as NativeSkinRoles,weaponRoles=weapon.roles as NativeSkinRoles;
 const profile=structuredClone(profileSource) as unknown as MiniNativeProfile;profile.skinRoles={face:'HEAD/headA2',hair:'HAIR/hairA_a2',...armorRoles,...bootRoles,...(weapon.sourceType==='native-render'?weaponRoles:{})};profile.skinNames=['HEAD/headA2','HAIR/hairA_a2'];
 const blob=URL.createObjectURL(new Blob([JSON.stringify(profile)],{type:'application/json'})),next=new MiniNativePreview(document.querySelector<HTMLCanvasElement>('#matching-hero')!,{profileUrl:blob,height:220,footX:.5,footY:.84});
 const input={rig:'modular-hero',family:'sword',styleProfile:'v2-soft',revision:0,parts:Object.fromEntries(appearanceSlots.map(s=>[s,{setId:'100011'}]))} as ResolvedAppearance;
 try{if(!await next.setAppearance(input))throw Error(next.diagnostics().errors.join('; '));await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>('#icons img'),image=>image.decode()));if(ticket!==generation){next.destroy();URL.revokeObjectURL(blob);return;}next.render({action:'idle',clock:0,facing:-1});painter?.destroy();if(url)URL.revokeObjectURL(url);painter=next;url=blob;document.querySelector('#hero-status')!.textContent=weapon.sourceType==='native-render'?'衣服、腿部与武器均取同一形象资源':'衣服与腿部为真实原生形象；斧／锤佩戴挂载待校准';root.setAttribute('data-ready','true');}catch(error){next.destroy();URL.revokeObjectURL(blob);if(ticket===generation)document.querySelector('#hero-status')!.textContent=String(error);}
}
for(const id of ['family','series','tier'])document.querySelector('#'+id)!.addEventListener('change',()=>{family=document.querySelector<HTMLSelectElement>('#family')!.value;collection=document.querySelector<HTMLSelectElement>('#series')!.value;tier=Number(document.querySelector<HTMLSelectElement>('#tier')!.value);root.removeAttribute('data-ready');void show();});
await show();function frame(time:number){requestAnimationFrame(frame);if(document.hidden||time-last<100)return;clock+=Math.min(.1,(time-last)/1000);last=time;if(painter?.ready)painter.render({action:'idle',clock:clock%(painter.actionDuration('idle')??1),facing:-1});}requestAnimationFrame(frame);
window.addEventListener('pagehide',()=>{generation++;painter?.destroy();if(url)URL.revokeObjectURL(url);});
