import {CombatAudio} from './combat-audio.ts';
import {installPhysicalQA} from './physical-vfx-qa.ts';
import {installMotionReview} from './vfx-motion-review.ts';
import type {SoundDispatch} from './audio/combat-sound-events.ts';
import {galleryMarkup,GalleryReplay} from './skill-gallery.ts';
import {visualSignature} from './vfx-motifs.ts';
import Phaser from 'phaser';
import './style.css';
import {World,distance} from '../../../packages/simulation/index.ts';
import {regionById,skillCatalog,bodyCollision} from '../../../packages/content/index.ts';
import {WorldScene,type ViewBridge} from './scene.ts';
import {SkillEffects as BeforeEffects} from './skill-effects-before.ts';
import {chapterBossSkills} from '../../../packages/content/chapter-combat.ts';
import {vfxProfiles} from './vfx-profiles.ts';
import type {Spawn} from '../../../packages/contracts/index.ts';
import type {ResolvedAppearance} from '../../../packages/contracts/appearance.ts';
import {statusEffectSchema} from '../../../packages/contracts/index.ts';
const ids=skillCatalog.map(skill=>skill.id);
const galleryAudio=new CombatAudio();let galleryReplay:GalleryReplay|undefined;
const stats={hp:10000,attack:0,armor:0,speed:6,mana:1000,regen:0,effects:[]};
const region={...regionById('meadow'),safe:{x:12,y:12},landmarks:[],obstacles:[]};
const spawn=(id:string,x:number,y:number):Spawn=>({id,x,y,name:'接触测试',kind:'ranged',hp:10000,attack:1,elite:false,boss:false,art:'raider'});
let selected='cut',casting=false,release=0,impacts=0,minContact=Infinity;let bossSelected='',benchmark=0,report:any=null,autopause=false,pauseBoss=false,compare=false,batchRunning=false;
const beforeFactory:NonNullable<ViewBridge['effectFactory']>=(s,a,p)=>new BeforeEffects(s,()=>bridge.motionReduced,a,p);
function scenario(id:string){
 galleryReplay=undefined;selected=id;casting=false;release=0;impacts=0;minContact=Infinity;bossSelected='';benchmark=0;
 const skill=skillCatalog.find(s=>s.id===id)!,far=['projectile','zone','chain','dash'].includes(skill.kind)||['snipe','petrify'].includes(id),r=far?Math.min(5,skill.range*.65):1.8;
 bridge.world=new World(region,stats,[skillCatalog.find(s=>s.id===id)!],[spawn('one',12+r,12),spawn('two',12+r+.5,13.5),spawn('three',12+r-1.5,14)]);bridge.world.mode='manual';bridge.world.enemies.forEach(e=>e.cooldown=999999);
 if(skill.kind==='heal')bridge.world.hero.hp=5000;
 if(id==='cleanse')bridge.world.applyStatus('hero',statusEffectSchema.parse({kind:'slow',duration:120,strength:.3,scope:'hit',cleanse:true}),'one','frost_bolt');
 document.querySelector('#label')!.textContent=skillCatalog.find(s=>s.id===id)!.name;
}
const parts=['head','body','hands','legs','feet','back','weapon'] as const;
const appearance=(family:ResolvedAppearance['family']):ResolvedAppearance=>({rig:'modular-hero',family,styleProfile:'v2-soft',revision:1,parts:Object.fromEntries(parts.map(part=>[part,{setId:part==='weapon'?family==='bow'?'400104':family==='magic'?'400105':family==='fist'?'100061':'100011':'100011'}])) as ResolvedAppearance['parts']});
const bridge={playbackRate:1,stepFrames:0,effectFactory:undefined as ViewBridge['effectFactory'],motionReduced:false,resolvedAppearance:appearance('sword') as ResolvedAppearance|undefined,world:new World(region,stats,[],[]),rewards:[],panel:'',loggedIn:true,
 step(){this.world.step();galleryReplay?.step(this.world);for(const e of this.world.enemies)if(e.alive)minContact=Math.min(minContact,distance(e.position,this.world.hero.position));for(const event of this.world.events){if(event.type==='cast_released'&&event.id==='hero')release=this.world.tick;if(event.type==='hit_resolved')impacts++;}
 if(autopause&&release>0&&this.world.tick>=release+1)this.world.paused=true;
 if(pauseBoss&&this.world.bossCasts.some(c=>!c.resolved)){this.world.paused=true;pauseBoss=false;}
 if(benchmark){while(this.world.projectiles.length<benchmark){const n=this.world.projectiles.length,a=n*2.3999+this.world.tick*.01,r=4+n%6,origin={x:12+Math.cos(a)*r,y:12+Math.sin(a)*r},keys=['bolt','fireball','frost_bolt','arcane_missile','lightning_bolt'];this.world.projectiles.push({id:100000+this.world.tick*1000+n,position:{...origin},previous:{...origin},origin,target:{x:12,y:12},direction:{x:-Math.cos(a),y:-Math.sin(a)},damage:0,life:40,enemy:false,pierce:false,hit:new Set(),skill:keys[n%keys.length],vfxKey:'player/'+keys[n%keys.length],owner:'hero',radius:.2});}}
 if(this.world.tick%15===0)refreshDiagnostics();},
 interact(){},cast(){casting=selected==='blink'?this.world.cast(selected,undefined,{x:this.world.hero.position.x+3,y:this.world.hero.position.y-2}):this.world.cast(selected);},pause(){this.world.paused=!this.world.paused;},open(){},pick(){},sound(kind:string){galleryAudio.play(kind,this.world.tick,.7);},skillSound(cue:SoundDispatch,pan:number,visible:boolean){galleryAudio.skill(cue.key,cue.stage,cue.tick,.7,{pan,visible,thickness:cue.thickness,boss:cue.boss});}};
const style=document.createElement('style');style.textContent='#game{position:fixed;inset:0}#qa{position:fixed;top:12px;left:12px;z-index:100;background:#102b40f2;padding:12px;border:1px solid #68819b;border-radius:8px;width:272px;max-height:calc(100vh - 24px);overflow:auto}#qa{color:#f4e8ce}#qa button{margin:2px;padding:5px 8px;font-size:11px;color:#f4e8ce;background:#214358;border:1px solid #536d83;border-radius:4px}#qa .skill-list{max-height:112px;overflow:auto;margin-top:8px}#label{font-size:18px;margin:8px 3px}#diagnostics{font:11px monospace;white-space:pre-wrap;max-height:170px;overflow:auto;color:#d8e2cc}#qa .qa-row{margin-top:7px;padding-top:6px;border-top:1px solid #547080}';document.head.append(style);
const panel=document.createElement('div');panel.id='qa';panel.innerHTML=`<b>战斗表现验收 · 独立场景</b><div class="skill-list">${ids.map(id=>`<button data-skill="${id}">${skillCatalog.find(s=>s.id===id)!.name}</button>`).join('')}</div><div id="label"></div><button id="cast">释放技能</button><button id="pause">暂停 / 继续</button><button id="flip">左右朝向</button><button id="crowd">重叠出生测试</button><button id="boss">首领技能表现</button><div><button data-model="legacy">原角色</button><button data-model="sword">换装剑</button><button data-model="bow">换装弓</button><button data-model="magic">换装法术</button><button data-model="fist">换装徒手</button><button id="run">释放后移动</button><button id="dead">死亡事件检查</button></div>`;document.body.append(panel);
const gallery=document.createElement('section');gallery.id='skill-gallery';gallery.innerHTML='<h2>技能画廊</h2><p>点击播放声音与特效；可切换减少动态。</p>'+galleryMarkup()+'<output id=gallery-signature aria-live=polite></output>';panel.prepend(gallery);
const galleryStyle=document.createElement('style');galleryStyle.textContent='#qa{background:#fffaf0f2;color:#4e4031;border-color:#cdb784;width:340px}#qa button{background:#f5eddf;color:#554531;border-color:#d2bf98}#skill-gallery h2{font-size:18px;margin:0 0 8px}#skill-gallery p{font-size:12px}#skill-gallery details{border-top:1px solid #d2bf98;padding:8px 0}#skill-gallery summary{cursor:pointer;font-weight:600}#skill-gallery .gallery-list{max-height:180px;overflow:auto}#gallery-signature{display:block;font-size:11px;overflow-wrap:anywhere;padding:8px;background:#efe5cf}';document.head.append(galleryStyle);
gallery.addEventListener('click',event=>{const key=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-gallery]')?.dataset.gallery;if(!key)return;galleryAudio.unlock();const p=vfxProfiles[key];document.querySelector('#gallery-signature')!.textContent=key+' · '+visualSignature(p);if(key.startsWith('player/')){scenario(key.split('/')[1]);const skill=bridge.world.skills[0];casting=bridge.world.cast(skill.id,bridge.world.enemies[0],skill.mechanics?.targeting==='direction'?{x:12,y:15}:undefined);}else{scenario('cut');bridge.world=new World(region,stats,[],[{...spawn('gallery-source',12,12),attack:0},{...spawn('gallery-target',17,12),attack:0}]);bridge.world.mode='manual';bridge.world.enemies.forEach(e=>e.cooldown=999999);galleryReplay=new GalleryReplay(key,bridge.world.tick);}});
const extras=document.createElement('div');extras.innerHTML='<div class="qa-row"><button id="frame">前进一帧</button><button id="slow">慢放 0.25x</button><button id="autopause">释放后暂停</button><button id="boss-pause">前摇自动暂停</button><button id="compare">切换整改前</button><button id="reduced">减少动态</button></div><div class="qa-row"><button data-boss="frost_queen">暴风雪标杆</button><button data-boss="abyss_lord">仪式标杆</button><button data-boss="ancient_dragon_king">吐息标杆</button><button id="interrupt">攻击打断</button></div><div class="qa-row"><button data-theme="meadow">草地背景</button><button data-theme="tundra">雪地背景</button><button data-theme="abyss">暗色背景</button><button data-theme="dragonbone">荒漠背景</button></div><div class="qa-row"><button id="bench">20敌人 / 30弹体</button><button id="stress">60敌人 / 100弹体</button><button id="batch">全量验收</button><button id="reel">播放标杆集</button><button id="video">开始录像</button><button id="save-video" disabled>停止并下载录像</button><button id="report">下载验收结果</button></div><pre id="diagnostics" aria-label="验收诊断"></pre><label>导出数据<textarea id="export-data" aria-label="导出数据" readonly style="width:100%;height:38px;font-size:10px"></textarea></label><div id="export-status" role="status"></div>';panel.append(extras);
panel.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest('button');if(!button)return;const id=button.dataset.skill,model=button.dataset.model;if(button.dataset.theme){region.theme=button.dataset.theme;region.id='vfx-qa-'+region.theme;scenario(selected);return;}if(button.dataset.boss){bossScenario(button.dataset.boss);return;}if(handleExtra(button))return;if(model)bridge.resolvedAppearance=model==='legacy'?undefined:appearance(model as ResolvedAppearance['family']);else if(id)scenario(id);else if(button.id==='cast')bridge.cast();else if(button.id==='pause')bridge.pause();else if(button.id==='run')bridge.world.go({x:19,y:19});else if(button.id==='dead')bridge.world.hero.hp=0;else if(button.id==='flip'){const h=bridge.world.hero.position;bridge.world.enemies.forEach(e=>e.position={x:h.x*2-e.position.x,y:e.position.y});bridge.world.hero.facing*=-1;}else if(button.id==='crowd'){scenario('cut');bridge.world.enemies.forEach(e=>e.position={...bridge.world.hero.position});}else if(button.id==='boss')bossScenario('frost_queen');});
const scene=new WorldScene(bridge);new Phaser.Game({type:Phaser.WEBGL,parent:'game',width:1280,height:720,scene:[scene],render:{antialias:true},audio:{noAudio:true}});scenario('cut');
Object.defineProperty(window,'awCombatQA',{value:()=>({selected,casting,tick:bridge.world.tick,paused:bridge.world.paused,alive:bridge.world.hero.hp>0,release,impacts,minContact,requiredContact:bodyCollision.heroRadius+bodyCollision.enemyRadius,hero:bridge.world.hero.position,facing:bridge.world.hero.facing,model:bridge.resolvedAppearance?.family??'legacy',enemies:bridge.world.enemies.map(e=>({position:e.position,hp:e.hp})),metrics:scene.metrics(),attachments:scene.attachmentDiagnostics()})});


function bossScenario(id:string){
 scenario('cut');bossSelected=id;const skillId=id==='frost_queen'?'blizzard':id==='abyss_lord'?'ritual':'ultimate',art=id==='ancient_dragon_king'?'dragon_king':id;
 bridge.world=new World(region,stats,[{...skillCatalog.find(s=>s.id==='cut')!,range:20,damage:400}],[{...spawn('qa-boss',18,12),art,boss:true,elite:true,hp:10000,attack:30}],[],19);bridge.world.mode='manual';
 const boss=bridge.world.enemies[0];boss.hp=1000;boss.skillCooldowns=new Map(chapterBossSkills[id as keyof typeof chapterBossSkills].skills.filter(s=>s.id!==skillId).map(s=>[s.id,999999]));document.querySelector('#label')!.textContent=skillId==='blizzard'?'暴风雪':skillId==='ritual'?'黑暗仪式':'毁灭吐息';autopause=false;refreshDiagnostics();
}
function inspect(){return {selected,bossSelected,mode:compare?'before':'after',tick:bridge.world.tick,paused:bridge.world.paused,release,impacts,hero:{...bridge.world.hero.position},hp:bridge.world.hero.hp,enemies:bridge.world.enemies.filter(e=>e.alive).length,projectiles:bridge.world.projectiles.length,metrics:scene.metrics(),effects:scene.attachmentDiagnostics().effects,bossCasts:bridge.world.bossCasts.map(c=>({id:c.id,skill:c.skill,started:c.started,ends:c.ends,interrupted:c.interrupted,resolved:c.resolved})),mechanicsGap:vfxProfiles['player/'+selected]?.mechanicsGap??null};}
function refreshDiagnostics(){const element=document.querySelector('#diagnostics');if(!element||!scene.sys?.isActive())return;const d=inspect(),gl=(scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl,ext=gl?.getExtension('WEBGL_debug_renderer_info');element.textContent=JSON.stringify({mode:d.mode,tick:d.tick,paused:d.paused,release:d.release,impacts:d.impacts,enemies:d.enemies,projectiles:d.projectiles,frameP95:d.metrics.p95,renderP95:d.metrics.scene_p95,pool:d.effects?.pool,warningCount:d.effects?.warningCount,beamSegments:d.effects?.beamSegments,errors:d.effects?.errors,gap:d.mechanicsGap,batch:report?{passed:report.passed,cases:report.cases?.length}:null,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable'},null,2);}
async function download(name:string,data:Blob){
 const status=document.querySelector('#export-status')!,field=document.querySelector('#export-data') as HTMLTextAreaElement;
 status.textContent='正在保存 '+name;field.value=data.type==='application/json'?await data.text():'录像正在保存…';
 try{const response=await fetch('/__capture/'+name,{method:'POST',body:data});if(!response.ok)throw Error('No capture server');const saved=await response.json();status.textContent='已保存 '+name+'（'+data.size+' 字节）';field.value=data.type==='application/json'?await data.text():JSON.stringify(saved);const link=document.createElement('a');link.href='/__capture/'+name;link.download=name;link.textContent='下载 '+name;status.append(link);}
 catch{const link=document.createElement('a');link.href=URL.createObjectURL(data);link.download=name;link.textContent='点击保存 '+name;status.textContent='已生成 '+name+'（'+data.size+' 字节）';status.append(link);if(data.type!=='application/json')field.value='录像已生成，请点击保存链接。';}
}
let recorder:MediaRecorder|undefined,videoChunks:Blob[]=[];
function handleExtra(button:HTMLButtonElement){
 const id=button.id;if(id==='frame'){bridge.world.paused=true;bridge.stepFrames++;return true;}
 if(id==='slow'){bridge.playbackRate=bridge.playbackRate===1?.25:1;button.textContent=bridge.playbackRate===1?'慢放 0.25x':'恢复正常速度';return true;}
 if(id==='autopause'){autopause=!autopause;button.textContent=autopause?'已开启释放暂停':'释放后暂停';return true;}
 if(id==='compare'){compare=!compare;bridge.effectFactory=compare?beforeFactory:undefined;button.textContent=compare?'切换整改后':'切换整改前';scenario(selected);return true;}
 if(id==='reduced'){bridge.motionReduced=!bridge.motionReduced;button.textContent=bridge.motionReduced?'恢复完整动态':'减少动态';return true;}
 if(id==='boss-pause'){pauseBoss=true;bridge.world.paused=false;return true;}
 if(id==='interrupt'){bridge.world.paused=false;release=0;autopause=true;casting=bridge.world.cast('cut',bridge.world.enemies[0]);return true;}
 if(id==='bench'||id==='stress'){scenario('bolt');const count=id==='bench'?20:60;bridge.world=new World({...region,width:64,height:64},stats,[...skillCatalog.filter(s=>['bolt','ember','chain','ward'].includes(s.id))],Array.from({length:count},(_,n)=>{const a=n*2.39996,r=3+Math.sqrt(n)*1.5;return spawn('load-'+n,12+Math.cos(a)*r,12+Math.sin(a)*r);}));bridge.world.mode='auto';benchmark=id==='bench'?30:100;autopause=false;bridge.playbackRate=1;document.querySelector('#label')!.textContent=count+' 敌人 / '+benchmark+' 弹体';return true;}
 if(id==='batch'){void batch();return true;}if(id==='reel'){void showreel();return true;}
 if(id==='video'){videoChunks=[];const mode=compare?'before':'after',speed=bridge.playbackRate===1?'normal':'slow';const stream=scene.game.canvas.captureStream(30);recorder=new MediaRecorder(stream,{mimeType:'video/webm',videoBitsPerSecond:2000000});recorder.ondataavailable=e=>{if(e.data.size)videoChunks.push(e.data);};recorder.onstop=()=>{void download('vfx-'+mode+'-'+speed+'.webm',new Blob(videoChunks,{type:'video/webm'}));stream.getTracks().forEach(t=>t.stop());};recorder.start();(document.querySelector('#save-video') as HTMLButtonElement).disabled=false;return true;}
 if(id==='save-video'){recorder?.stop();button.disabled=true;return true;}
 if(id==='report'){void download('vfx-acceptance.json',new Blob([JSON.stringify(report??inspect(),null,2)],{type:'application/json'}));return true;}
 return false;
}
async function batch(){
 if(batchRunning)return;batchRunning=true;autopause=false;pauseBoss=false;bridge.playbackRate=2;report={passed:false,cases:[] as any[]};
 try{for(const skill of skillCatalog){scenario(skill.id);bridge.cast();let sawRelease=false,maxActive=0;while(bridge.world.tick<skill.windup+45){await new Promise<void>(r=>requestAnimationFrame(()=>r()));const d=inspect();sawRelease||=d.release>0;maxActive=Math.max(maxActive,d.effects?.pool?.active??0);if(d.effects?.errors?.length)throw Error(d.effects.errors.join(','));}report.cases.push({id:skill.id,release:sawRelease,visibleNodes:maxActive,impacts,gap:vfxProfiles['player/'+skill.id]?.mechanicsGap??null});}report.passed=report.cases.every((c:any)=>c.release&&c.visibleNodes>0);}catch(e){report.error=String(e);}finally{bridge.playbackRate=1;batchRunning=false;bridge.world.paused=true;refreshDiagnostics();}
}


setInterval(refreshDiagnostics,250);
installPhysicalQA({scene,world:()=>bridge.world,scenario,cast:()=>bridge.cast(),step:()=>{bridge.stepFrames++;},release:()=>release,appearance:family=>{bridge.resolvedAppearance=appearance(family as ResolvedAppearance['family']);},stress:()=>{handleExtra(document.querySelector<HTMLButtonElement>('#stress')!);}});
installMotionReview({scene,world:()=>bridge.world,scenario,cast:()=>bridge.cast(),step:()=>{bridge.stepFrames++;},release:()=>release,setAppearance:a=>{bridge.resolvedAppearance=a;},base:()=>appearance('sword'),setReduced:on=>{bridge.motionReduced=on;}});


async function waitTicks(limit:number){while(bridge.world.tick<limit)await new Promise<void>(r=>requestAnimationFrame(()=>r()));}
async function showreel(){
 if(batchRunning)return;batchRunning=true;autopause=false;bridge.world.paused=false;const rate=bridge.playbackRate;
 const title=scene.add.text(1248,20,'',{fontFamily:'WorldSans',fontSize:'20px',color:'#fff3d2',backgroundColor:'#102b40dd',padding:{x:12,y:8}}).setOrigin(1,0).setScrollFactor(0).setDepth(12000);
 try{for(const id of ['cut','whirl','rush','bolt','fireball','chain','ember','nova','ward','mend']){scenario(id);bridge.cast();title.setText((compare?'整改前 · ':'整改后 · ')+skillCatalog.find(s=>s.id===id)!.name+' · '+rate+'x');await waitTicks(skillCatalog.find(s=>s.id===id)!.windup+60);}
 if(!compare)for(const boss of ['frost_queen','abyss_lord','ancient_dragon_king']){bossScenario(boss);title.setText((boss==='frost_queen'?'暴风雪':boss==='abyss_lord'?'黑暗仪式':'毁灭吐息')+' · '+rate+'x');await waitTicks(90);if(boss==='ancient_dragon_king')bridge.world.go({x:12,y:19});await waitTicks(boss==='frost_queen'?200:230);}
 }finally{title.destroy();batchRunning=false;bridge.world.paused=true;if(recorder?.state==='recording'){recorder.stop();(document.querySelector('#save-video') as HTMLButtonElement).disabled=true;}refreshDiagnostics();}
}
