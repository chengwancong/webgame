import {createHero} from '/art/starsea/pets/sources/hero-preview.js';
const canvas=document.getElementById('sheet'),ctx=canvas.getContext('2d'),q=new URLSearchParams(location.search),mode=q.get('mode')??'sample';
const assets=new Map(),titles=['','样稿 1 · 极简平涂','样稿 2 · 平涂毛边','样稿 3 · 柔和色面','PA1 · 原版对照'];
let hero,grass,road,style=+(q.get('style')??1),action='idle',time=0,paused=false,mirror=false,last=0;
const image=async url=>{const i=new Image();i.src=url;await i.decode();return i;};
async function loadActor(p){assets.set(p.id,{p,image:await image(p.image),atlas:await(await fetch(p.atlas)).json()});}
async function init(){const m=await(await fetch('/art/starsea/pets/repaint/manifest.json')).json();for(const a of m.assets)await loadActor(a.runtime);
 const pa1=await(await fetch('/art/starsea/pets/manifest.json')).json();for(const a of pa1.assets.filter(a=>/^ss-pet-wind-(young|adult|awakened)$/.test(a.id)))await loadActor(a.runtime);
 for(const id of ['ss-mon-dock-scavenger','ss-mon-wind-hound'])await loadActor(await(await fetch('/art/starsea/monsters/'+id+'/profile.json')).json());
 hero=await createHero();hero.render(0);grass=await image('/art/open-world/textures/ow-art-grass.png');road=await image('/art/open-world/five-islands/textures/ow-road-dirt.png');
 await document.fonts.load('20px WorldSans');await document.fonts.ready;
 window.pa2={ready:true,set(s,a='idle',t=0,m=false){style=s;action=a;time=t;mirror=m;draw();},state(){return {style,action,time,paused,mirror,loaded:assets.size,rendered:window.pa2Frames};},pause(v){paused=v;},draw};draw();
 if(mode==='preview')requestAnimationFrame(tick);
}
function text(s,x,y,size=20,color='#293940',align='left'){ctx.font=`${size}px WorldSans`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(s,x,y);}
function ground(x,y,w,h,baseline){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle=ctx.createPattern(grass,'repeat');ctx.fillRect(x,y,w,h);ctx.fillStyle=ctx.createPattern(road,'repeat');ctx.beginPath();ctx.moveTo(x-10,baseline-26);ctx.bezierCurveTo(x+w*.2,baseline-48,x+w*.6,baseline-5,x+w+10,baseline-32);ctx.lineTo(x+w+10,baseline+30);ctx.bezierCurveTo(x+w*.6,baseline+42,x+w*.2,baseline+20,x-10,baseline+38);ctx.closePath();ctx.fill();ctx.restore();}
function actor(id,x,y,z=1,a=action,t=time){const o=assets.get(id);if(!o)throw Error('Missing '+id);const p=o.p,m=p.actions[a];if(!m){text('无',x,y-12,16,'#293940','center');return;}
 const n=Math.min(m.count-1,Math.floor((t%m.duration)*p.fps)),f=o.atlas.frames[m.frames[n]],b=f.frame,s=f.spriteSourceSize;
 ctx.save();ctx.translate(x,y);if(mirror)ctx.scale(-1,1);ctx.scale(p.scale*z,p.scale*z);ctx.drawImage(o.image,b.x,b.y,b.w,b.h,s.x-p.anchor[0]*256,s.y-p.anchor[1]*256,b.w,b.h);ctx.restore();
 window.pa2Frames.push({id,frame:n,action:a});}
function player(x,y,z){ctx.save();ctx.translate(x,y);if(mirror)ctx.scale(-1,1);ctx.scale(z,z);ctx.drawImage(hero.canvas,-128,-204.8);ctx.restore();}
function petId(s,form){return s===4?'ss-pet-wind-'+form:`ss-pet-repaint-style${s}-`+form;}
function draw(){window.pa2Frames=[];
 if(mode==='compare'){canvas.width=1120;canvas.height=660;ctx.fillStyle='#fcfaf5';ctx.fillRect(0,0,1120,660);text('风绒 PA2 · 四列对照',24,36,24);text('真实 Spine idle 第 0 帧 · 实际像素大小 · PA2 a/c/d，PA1 a/c/e',24,64,15);
  for(let c=0;c<4;c++){text(titles[c+1],140+c*280,104,18,'#293940','center');for(let r=0;r<3;r++){const y=230+r*175;ground(c*280,120+r*175,280,130,y);actor(petId(c+1,['young','adult','awakened'][r]),140+c*280,y,1,'idle',0);text(['幼年 44px','成年 56px','觉醒 68px'][r],140+c*280,y+43,14,'#293940','center');}}return;
 }
 if(mode==='preview'){canvas.width=1200;canvas.height=720;ctx.fillStyle='#fcfaf5';ctx.fillRect(0,0,1200,720);ground(0,0,1200,225,180);text(titles[style]+' · 1×实际大小',24,30,20,'#fff7e6');const xs=[130,310,505,720,910,1090];player(xs[0],180,1);actor('ss-mon-dock-scavenger',xs[1],180,1,'idle',0);actor('ss-mon-wind-hound',xs[2],180,1,'idle',0);['young','adult','awakened'].forEach((f,i)=>actor(petId(style,f),xs[i+3],180,1));['主角','港湾拾荒者','风栖猎犬','幼年 44px','成年 56px','觉醒 68px'].forEach((s,i)=>text(s,xs[i],250,16,'#293940','center'));ground(0,280,1200,390,625);text('4× 分件与五官检视',24,312,20,'#fff7e6');['young','adult','awakened'].forEach((f,i)=>actor(petId(style,f),230+i*370,625,4));text('当前动作 '+action+' · '+(mirror?'镜像':'原生朝向')+' · '+(style===4?'PA1 a/c/e':'PA2 a/c/d'),24,702,16);return;}
 canvas.width=2400;canvas.height=1040;ctx.fillStyle='#fcfaf5';ctx.fillRect(0,0,2400,1040);
 text('风栖岛 · '+titles[style],48,52,32);text('同一配色 / #3c2b23 细棕描边 / 实心点眼 · '+(style===4?'PA1 原版 a/c/e':'D1 a/c/d · 只换贴图，原生骨骼与动作不变'),48,90,20);
 const xs=[350,760,1180,1540,1850,2170],forms=['young','adult','awakened'],labels=['主角 · 约100px','港湾拾荒者 · 80px','风栖猎犬 · 80px','幼年 a · 44px','成年 c · 56px',style===4?'PA1 觉醒 e · 68px':'觉醒 d · 68px'];
 ground(0,130,2400,200,280);text('1× 实际显示大小',48,160,18,'#fff7e6');player(xs[0],280,1);actor('ss-mon-dock-scavenger',xs[1],280,1,'idle',0);actor('ss-mon-wind-hound',xs[2],280,1,'idle',0);for(let i=0;i<3;i++)actor(petId(style,forms[i]),xs[i+3],280,1);
 for(let i=0;i<6;i++)text(labels[i],xs[i],360,20,'#293940','center');
 ground(0,390,2400,550,870);text('4× 同排放大检视',48,425,22,'#fff7e6');player(xs[0],870,4);actor('ss-mon-dock-scavenger',xs[1],870,4,'idle',0);actor('ss-mon-wind-hound',xs[2],870,4,'idle',0);for(let i=0;i<3;i++)actor(petId(style,forms[i]),xs[i+3],870,4);
 text('地表：正式 ow-art-grass + ow-road-dirt。全部角色来自真实 Spine 渲染帧；放大仅用于检查描边、接缝和五官。',48,985,20);
 text('动作：'+action+'　'+(mirror?'镜像朝向':'原生朝向')+'　体积画法仅供比较，尚未选定。',48,1020,18);
}
function tick(t){const dt=Math.min(.05,(t-last)/1000||0);last=t;if(!paused)time+=dt;draw();requestAnimationFrame(tick);}
init().catch(e=>{window.pa2Error=e.stack;document.body.append(String(e));console.error(e);});
