import Phaser from 'phaser';
import './ui-entry.css';
import './world-art-qa.css';
import {World} from '../../../packages/simulation/index.ts';
import {regions,regionById} from '../../../packages/content/index.ts';
import {storyNpcs} from '../../../packages/content/story-campaign.ts';
import {WorldScene,type ViewBridge} from './scene.ts';
import type {StoryObject} from '../../../packages/contracts/story.ts';
import type {ResolvedAppearance} from '../../../packages/contracts/appearance.ts';
import {buttonHtml,esc} from './ui-components.ts';
const panel=document.getElementById('world-art-qa')!;
panel.innerHTML=`<h1>方案2 · 实际地图渲染</h1><p>复用正式地图与渲染器；此页不连接存档，也不代表剧情通关。</p><label for="art-region">地图</label><select id="art-region">${regions.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select><nav>${buttonHtml('回到安全点',{action:'art-home'})}${buttonHtml('暂停',{action:'art-pause'})}</nav><output role="status" id="art-status">正在加载</output>`;
const parts=['head','body','hands','legs','feet','back','weapon'] as const;
const appearance:ResolvedAppearance={rig:'modular-hero',family:'sword',styleProfile:'v2-soft',revision:0,parts:Object.fromEntries(parts.map(p=>[p,{setId:'100011'}])) as ResolvedAppearance['parts']};
const stats={hp:300,attack:20,armor:4,speed:6,mana:100,regen:10,effects:[]};
const bridge:ViewBridge={world:new World(regionById('town'),stats,[],[]),rewards:[],panel:'',loggedIn:true,motionReduced:false,resolvedAppearance:appearance,
 step(){this.world.step();},interact(){},cast(){},pause(){this.world.paused=!this.world.paused;},open(){},pick(){},sound(){},
 storyObjects(){return this.world.region.id==='town'?storyNpcs.map(n=>({id:'art-'+n.id,npcId:n.id,kind:'npc',name:n.name,label:'造型对照',position:{...n.camp},enabled:true,reason:''} satisfies StoryObject)):[];}
};
const scene=new WorldScene(bridge);
const game=new Phaser.Game({type:Phaser.WEBGL,parent:'game',width:1280,height:720,scene:[scene],audio:{noAudio:true},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH}});
panel.querySelector('select')!.addEventListener('change',event=>{bridge.world=new World(regionById((event.target as HTMLSelectElement).value),stats,[],[]);});
panel.addEventListener('click',event=>{const b=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b)return;if(b.dataset.action==='art-home')bridge.world=new World(bridge.world.region,stats,[],[]);if(b.dataset.action==='art-pause'){bridge.pause();b.querySelector('.ui-button__label')!.textContent=bridge.world.paused?'继续':'暂停';b.setAttribute('aria-label',bridge.world.paused?'继续':'暂停');}});
const status=document.getElementById('art-status')!;
 const timer=setInterval(()=>{const metrics=scene.metrics();if(!metrics.frames)return;const objects=scene.children.list.filter(o=>o.type==='Image'&&o.getData('occluder'));const report={region:bridge.world.region.id,name:bridge.world.region.name,hero:{...bridge.world.hero.position},paused:bridge.world.paused,...metrics,props:objects.length,visibleProps:objects.filter(o=>(o as Phaser.GameObjects.Image).visible).length};status.dataset.diagnostics=JSON.stringify(report);status.textContent=`${bridge.world.region.name} · ${metrics.chunks} 地块 · ${objects.length} 摆件 · 帧耗时 P95 ${metrics.p95.toFixed(1)}ms（含切图）`;},500);
addEventListener('pagehide',()=>{clearInterval(timer);game.destroy(true);},{once:true});
