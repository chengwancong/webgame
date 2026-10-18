import './ui/tokens.css';
import './ui/controls.css';
import './scene-style-review.css';
import {HeroPreview} from './hero-appearance.ts';
import {buttonHtml} from './ui-components.ts';
import {art} from './ui-assets.ts';
import type {ResolvedAppearance} from '../../../packages/contracts/appearance.ts';
import type {WardrobeAction} from './wardrobe-renderer.ts';

// Visual direction only. Backgrounds are concept images, not playable map tiles.
// No World, API, combat event, reward, or save-writing code is used here.
const root=document.querySelector<HTMLDivElement>('#review')!;
root.innerHTML=`<header><div><h1>场景美术适配</h1><p>营地与草原方向样稿 · 真实角色 94px · 未替换正式地图</p></div><nav aria-label="场景样稿">${buttonHtml('营地样稿',{action:'scene',id:'camp',variant:'primary'})}${buttonHtml('草原样稿',{action:'scene',id:'meadow'})}${buttonHtml('实机改前',{action:'scene',id:'before'})}</nav></header><main><div class="scene-review-stage"><img class="scene-review-bg" alt="营地场景方向样稿"><div class="scene-review-shadow"></div><canvas width="256" height="256" class="scene-review-hero" aria-label="原骨骼动态角色"></canvas><div class="scene-review-drops" aria-label="真实手绘道具图标"><div><img src="${art('gear-blade')}" alt="苍风之刃"><span>苍风之刃</span></div><div><img src="${art('gear-coat')}" alt="守望轻甲"><span>守望轻甲</span></div></div></div><footer><nav aria-label="角色对照动作">${buttonHtml('待机',{action:'motion',id:'idle'})}${buttonHtml('行走',{action:'motion',id:'move'})}${buttonHtml('挥剑',{action:'motion',id:'attack'})}${buttonHtml('左右朝向',{action:'flip'})}${buttonHtml('暂停',{action:'pause'})}</nav><output role="status" aria-live="polite">正在加载原骨骼角色…</output></footer><p class="scene-review-note">地表减少碎纹与亮点，树木和建筑统一大轮廓与色面。角色和道具为实际资源；背景为整体风格样稿，尚未拆分地块、摆件或验证地图碰撞。</p></main>`;
const stage=root.querySelector<HTMLDivElement>('.scene-review-stage')!,background=root.querySelector<HTMLImageElement>('.scene-review-bg')!,canvas=root.querySelector<HTMLCanvasElement>('canvas')!,status=root.querySelector<HTMLOutputElement>('output')!;
const preview=new HeroPreview(canvas,{height:94,footX:.5,footY:.75});
const parts=['head','body','hands','legs','feet','back','weapon'] as const;
const appearance:ResolvedAppearance={rig:'modular-hero',family:'sword',styleProfile:'v2-soft',revision:0,parts:Object.fromEntries(parts.map(part=>[part,{setId:'100011'}])) as ResolvedAppearance['parts']};
let current='camp',action:WardrobeAction='idle',facing=-1,paused=matchMedia('(prefers-reduced-motion:reduce)').matches,clock=0,last=performance.now(),frame=0,ready=false;
function selectScene(id:string){current=id;stage.dataset.scene=id;background.src='/art/scene-review-20261002/'+(id==='before'?'current-camp':id+'-v1')+'.webp';background.alt=id==='before'?'当前游戏营地实机截图':(id==='camp'?'营地':'草原')+'场景方向样稿';for(const b of Array.from(root.querySelectorAll<HTMLButtonElement>('[data-action="scene"]')))b.setAttribute('aria-pressed',String(b.dataset.id===id));}
function updateStatus(){const errors=preview.diagnostics().errors??[];status.textContent=!ready?'角色尚未加载完成':errors.length?'角色播放异常：'+errors.join('；'):`原骨骼角色已加载 · ${paused?'已暂停':'动态播放'} · ${current==='before'?'历史实机截图':'场景方向样稿'}`;}
root.addEventListener('click',event=>{const b=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b)return;if(b.dataset.action==='scene')selectScene(b.dataset.id!);if(b.dataset.action==='motion'){action=b.dataset.id as WardrobeAction;clock=0;}if(b.dataset.action==='flip')facing*=-1;if(b.dataset.action==='pause'){paused=!paused;const label=paused?'继续':'暂停';b.querySelector('.ui-button__label')!.textContent=label;b.setAttribute('aria-label',label);}updateStatus();});
selectScene('camp');void preview.setAppearance(appearance).then(ok=>{ready=ok;updateStatus();});
function animate(now:number){if(!paused)clock+=Math.min(.1,(now-last)/1000);last=now;if(ready){preview.render({action,clock,facing});if(frame%60===0)updateStatus();}frame++;requestAnimationFrame(animate);}requestAnimationFrame(animate);
addEventListener('pagehide',()=>preview.destroy(),{once:true});
if(paused){const b=root.querySelector<HTMLButtonElement>('[data-action="pause"]')!;b.querySelector('.ui-button__label')!.textContent='继续';b.setAttribute('aria-label','继续');}
