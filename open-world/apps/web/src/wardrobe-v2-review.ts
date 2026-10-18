import './ui/tokens.css';
import './ui/controls.css';
import './wardrobe-v2-review.css';
import {buttonHtml,itemSlot,tabsHtml,statusBadgeHtml,stateBlockHtml,esc} from './ui-components.ts';
import {MiniNativePreview,type MiniNativeProfile} from './mini-native-renderer.ts';
import profileSource from '../../../assets/mini-hero/navy/profile.json';
import {appearanceSlots,type ResolvedAppearance} from '../../../packages/contracts/appearance.ts';
import type {NativeSkinRoles} from './native-skin-composition.ts';
import thumbManifest from '../../../assets/mini-hero/thumbs/manifest.json';

type Slot='weapon'|'armor'|'boots';
const outfits=[{id:'knight_rare1',name:'藏蓝旅装',owned:true},{id:'warrior_common1',name:'远行轻甲',owned:true},{id:'rogue_common1',name:'黑棕轻装',owned:true},{id:'archer_uncommon2',name:'密林猎装',owned:true},{id:'wizard_rare1',name:'深渊法袍',owned:false},{id:'cleric_rare1',name:'晨光祭袍',owned:false}];
const bootOutfits=outfits.map((o,i)=>({...o,name:['藏蓝腿装','远行护腿','黑棕护腿','密林轻靴','深渊长靴','晨光短靴'][i]}));
const weapons=[{id:'Sword_OneHand_Rare1',name:'霜纹长剑',owned:true},{id:'Sword_OneHand_Common2',name:'旅人长剑',owned:true},{id:'Sword_OneHand_Legendary1',name:'古纹长剑',owned:false}];
const slotNames:Record<Slot,string>={weapon:'武器',armor:'衣服',boots:'鞋子'};
const equipment={weapon:'霜纹长剑',armor:'守望皮甲',boots:'旅人短靴'};
const hairStyles=[{id:'hairA_a',name:'短碎发'},{id:'hairA_b',name:'侧分短发'},{id:'hairA_c',name:'上翘短发'},{id:'hairB_a',name:'柔顺短发'},{id:'hairB_b',name:'长刘海'},{id:'hairB_c',name:'偏分短发'}];
const colorNames=['白','黑','深棕','浅棕','金','橙','红','灰','银','蓝','绿','粉','紫'];
type Draft={face:'A'|'B';tone:number;hair:string;color:number;overrides:Partial<Record<Slot,string>>};
let draft:Draft={face:'A',tone:2,hair:'hairA_a',color:2,overrides:{}},saved=structuredClone(draft),tab='equipment',slot:Slot='armor',action:'idle'|'move'|'attack'|'skill'='idle',facing=-1,clock=0,playing=true,last=0;
let painter:MiniNativePreview|undefined,painterURL:string|undefined,generation=0;const images=new Map<string,string>();
const faceSkin=()=>`HEAD/head${draft.face}${draft.tone||''}`;
const hairSkin=()=>`HAIR/${draft.hair}${draft.color||''}`;
function roles():NativeSkinRoles{const equippedBoots:string|undefined='knight_rare1';return {face:faceSkin(),hair:hairSkin(),top:'BODY/'+(draft.overrides.armor??'knight_rare1'),legs:'BODY/'+(draft.overrides.boots??equippedBoots??draft.overrides.armor??'knight_rare1'),right:'RIGHTHAND/'+(draft.overrides.weapon??'Sword_OneHand_Rare1')};}
function resolvedName(s:Slot){const id=draft.overrides[s];return id?(s==='weapon'?weapons:s==='boots'?bootOutfits:outfits).find(o=>o.id===id)?.name??id:'跟随装备';}
const root=document.querySelector('#wardrobe-review')!;
root.innerHTML=`<p class="review-notice">外观 V2 布局预览 · 使用真实原生分件 · 示例装备与收集状态 · 保存只保留本页草稿</p><section class="review-window"><header><h1>外观</h1><span>换装保留人物形象</span></header><div class="review-layout"><section class="review-preview" aria-label="角色预览"><canvas id="v2-character" width="320" height="384"></canvas><p id="render-status" role="status">正在加载原生角色…</p><div class="review-motion">${(['idle','move','attack','skill'] as const).map((id,i)=>buttonHtml(['待机','奔跑','攻击','施法'][i],{action:'motion',id,size:'compact',pressed:id==='idle'})).join('')}${buttonHtml('转向',{action:'facing',size:'compact'})}${buttonHtml('暂停',{action:'playing',size:'compact'})}</div><p class="preview-caption">形象与装备独立</p></section><section class="review-selection"><div id="v2-tabs"></div><div id="v2-content"></div></section></div><footer><span id="draft-status" role="status">跟随装备，形象未调整</span><div>${buttonHtml('撤销调整',{action:'undo',variant:'secondary'})}${buttonHtml('保存外观',{action:'save',variant:'primary'})}</div></footer></section>`;
function tile(id:string,name:string,selected:boolean,owned=true,actionName='select'){return itemSlot({action:actionName,id,label:name+(owned?'':'，未收集'),pressed:selected,disabled:!owned,className:'review-tile',extra:`<span class="review-thumb" data-thumb="${esc(actionName==='select'?slot+':'+id:id)}"></span><b>${esc(name)}</b>${owned?'':statusBadgeHtml('未收集','neutral',{variant:'inline'})}`});}
function renderContent(){
 document.querySelector('#v2-tabs')!.innerHTML=tabsHtml({label:'外观分类',action:'tab',selected:tab,items:[{id:'equipment',label:'装备外观'},{id:'identity',label:'形象'}],controls:'v2-content'});
 const host=document.querySelector('#v2-content')!;
 if(tab==='equipment'){
  const catalog=slot==='weapon'?weapons:slot==='boots'?bootOutfits:outfits;
  host.innerHTML=`<div class="equipment-summary"><div class="summary-heading"><span>部位</span><span>穿着的装备</span><span>显示为</span></div>${(['weapon','armor','boots'] as Slot[]).map(s=>`<button type="button" class="summary-row ${s===slot?'selected':''}" data-action="slot" data-id="${s}"><b>${slotNames[s]}</b><span>${equipment[s]}</span><span>${draft.overrides[s]?`幻化 · ${esc(resolvedName(s))}`:'跟随装备'}</span></button>`).join('')}</div><div class="catalog-heading"><h2>${slotNames[slot]}${slot==='weapon'?' · 单手剑':''}</h2><span>已收集 ${catalog.filter(x=>x.owned).length}/${catalog.length}</span></div><div class="review-catalog" role="group" aria-label="${slotNames[slot]}外观">${itemSlot({action:'follow',id:slot,label:'跟随装备',pressed:!draft.overrides[slot],className:'review-tile follow-tile',extra:'<span class="follow-mark">↻</span><b>跟随装备</b>'})}${catalog.map(o=>tile(o.id,o.name,draft.overrides[slot]===o.id,o.owned)).join('')}</div><p class="catalog-note">${slot==='boots'?'鞋子外观包括裤腿和鞋；没有鞋子时，腿部跟随衣服。':'幻化会在换装备后保持，选择“跟随装备”即可恢复。'}</p>`;
 }else{
  host.innerHTML=`<div class="identity-group"><h2>脸型与肤色</h2><div class="identity-pair"><div class="identity-row">${tile('A','脸型一',draft.face==='A',true,'face')}${tile('B','脸型二',draft.face==='B',true,'face')}</div><div><span class="identity-label">肤色</span><div class="swatches">${Array.from({length:7},(_,i)=>itemSlot({action:'tone',id:String(i),label:'肤色'+(i+1),pressed:draft.tone===i,className:'tone-tile',extra:`<span data-thumb="tone-${i}"></span>`})).join('')}</div></div></div></div><div class="identity-group"><h2>发型与发色</h2><div class="hair-options">${hairStyles.map(h=>tile(h.id,h.name,draft.hair===h.id,true,'hair')).join('')}</div><span class="identity-label">发色</span><div class="swatches hair-colors">${colorNames.map((name,i)=>itemSlot({action:'color',id:String(i),label:name+'发色',pressed:draft.color===i,className:'tone-tile',extra:`<span data-thumb="color-${i}"></span>`})).join('')}</div></div><p class="catalog-note">形象全部免费，随时可改，不受装备影响。</p>`;
 }
 applyImages();
}
function applyImages(){for(const node of Array.from(document.querySelectorAll<HTMLElement>('[data-thumb]'))){const image=images.get(node.dataset.thumb!);if(image)node.innerHTML=`<img src="${image}" alt="">`;}}
function profileFor(r:NativeSkinRoles){const profile=structuredClone(profileSource) as unknown as MiniNativeProfile;profile.skinRoles=r;profile.skinNames=[r.face,r.hair].filter(Boolean) as string[];return profile;}
function legacyInput():ResolvedAppearance{return {rig:'modular-hero',family:'sword',styleProfile:'v2-soft',revision:0,parts:Object.fromEntries(appearanceSlots.map(s=>[s,{setId:'100011'}]))} as ResolvedAppearance;}
async function make(canvas:HTMLCanvasElement,r:NativeSkinRoles,height:number){const url=URL.createObjectURL(new Blob([JSON.stringify(profileFor(r))],{type:'application/json'})),candidate=new MiniNativePreview(canvas,{profileUrl:url,height,footX:.5,footY:.83});if(!await candidate.setAppearance(legacyInput())){candidate.destroy();URL.revokeObjectURL(url);throw Error(candidate.diagnostics().errors.join('; '));}return {candidate,url};}
async function updatePreview(){const ticket=++generation,status=document.querySelector('#render-status')!;status.textContent='正在更新预览…';try{const resolvedRoles=roles(),next=await make(document.querySelector<HTMLCanvasElement>('#v2-character')!,resolvedRoles,180);if(ticket!==generation){next.candidate.destroy();URL.revokeObjectURL(next.url);return;}next.candidate.render({action,clock:0,facing});painter?.destroy();if(painterURL)URL.revokeObjectURL(painterURL);painter=next.candidate;painterURL=next.url;document.querySelector('#v2-character')!.setAttribute('data-ready','true');document.querySelector('#v2-character')!.setAttribute('data-roles',JSON.stringify(resolvedRoles));status.textContent='真实原生骨骼预览';}catch(e){status.innerHTML=stateBlockHtml({kind:'error',title:'预览未能加载',message:String(e),compact:true,action:{label:'重新加载',action:'retry'}});}}
async function buildThumbs(){
 const entries=new Map(thumbManifest.items.map(item=>[item.id,'/art/mini-hero/thumbs/'+item.file]));
 const add=(key:string,id:string)=>{const path=entries.get(id);if(!path)throw Error('Missing registered thumbnail '+id);images.set(key,path);};
 for(const o of outfits){add('armor:'+o.id,'armor/'+o.id);add('boots:'+o.id,'boots/'+o.id);}
 for(const w of weapons)add('weapon:'+w.id,'weapon/'+w.id);
 for(const f of ['A','B'])add(f,'face/head'+f+'2');
 for(let i=0;i<7;i++)add('tone-'+i,'face/headA'+(i||''));
 for(const h of hairStyles)add(h.id,'hair/'+h.id+'2');
 for(let i=0;i<13;i++)add('color-'+i,'hair/hairA_a'+(i||''));
 applyImages();document.querySelector('#wardrobe-review')!.setAttribute('data-thumbs','ready');
}
root.addEventListener('click',event=>{const target=(event.target as Element).closest<HTMLElement>('[data-action]');if(!target||target instanceof HTMLButtonElement&&target.disabled)return;const a=target.dataset.action,id=target.dataset.id!;
 if(a==='motion'){action=id as typeof action;clock=0;for(const b of Array.from(document.querySelectorAll('[data-action="motion"]')))b.setAttribute('aria-pressed',String((b as HTMLElement).dataset.id===id));return;}
 if(a==='facing'){facing=-facing;return;}if(a==='playing'){playing=!playing;target.outerHTML=buttonHtml(playing?'暂停':'播放',{action:'playing',size:'compact'});return;}
 if(a==='tab'){tab=id;renderContent();return;}if(a==='slot'){slot=id as Slot;renderContent();return;}
 if(a==='save'){saved=structuredClone(draft);document.querySelector('#draft-status')!.textContent='示意搭配已保留在本页，未写入游戏存档';return;}
 if(a==='undo')draft=structuredClone(saved);else if(a==='select')draft.overrides[slot]=id;else if(a==='follow')delete draft.overrides[slot];else if(a==='face')draft.face=id as 'A'|'B';else if(a==='tone')draft.tone=Number(id);else if(a==='hair')draft.hair=id;else if(a==='color')draft.color=Number(id);else if(a!=='retry')return;
 document.querySelector('#draft-status')!.textContent='有未保存的外观调整';renderContent();void updatePreview();
});
function frame(time:number){requestAnimationFrame(frame);if(document.hidden||time-last<50)return;const delta=Math.min(.1,(time-last)/1000);last=time;if(playing)clock+=delta;if(painter?.ready)painter.render({action,clock:clock%(painter.actionDuration(action)??1),facing});}
renderContent();await updatePreview();await buildThumbs();requestAnimationFrame(frame);
window.addEventListener('pagehide',()=>{generation++;painter?.destroy();if(painterURL)URL.revokeObjectURL(painterURL);});
