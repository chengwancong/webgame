import {createHero} from '../sources/hero-preview.js';
const el=id=>document.getElementById(id),canvas=el('preview'),ctx=canvas.getContext('2d');
const keys=['wind','mist','forge','frost','dragon','star'],islands=['风栖岛','雾铃岛','赤炉岛','霜镜岛','龙眠岛','沉星岛'];
const assets=new Map();let hero,time=0,last=0,paused=false,mirrored=false,loaded=false,fixedTime=null,lastFrames=[];
async function load(){const manifest=await(await fetch('../manifest.json')).json();
 for(const a of manifest.assets){const p=a.runtime,atlas=await(await fetch(p.atlas)).json(),sockets=await(await fetch(p.sockets)).json(),image=new Image();image.src=p.image;await image.decode();assets.set(p.id,{p,atlas,sockets,image});}
 hero=await createHero();loaded=true;el('status').textContent=`已加载 ${assets.size} 套宠物资源 · 主角来自现有 navy-traveler 正式资源`;
 window.pa1={ready:true,setTime(t){fixedTime=t;draw(0);},resume(){fixedTime=null;},state(){return {action:el('action').value,variant:el('variant').value,speed:+el('speed').value,mirrored,loaded:assets.size,time,paused,frames:lastFrames,canvas:[canvas.width,canvas.height]};},draw};
 requestAnimationFrame(tick);
}
function draw(dt){if(!loaded)return;const action=el('action').value,zoom=+el('zoom').value,speed=+el('speed').value;
 if(canvas.width!==1200*zoom){canvas.width=1200*zoom;canvas.height=540*zoom;}
 ctx.setTransform(zoom,0,0,zoom,0,0);ctx.clearRect(0,0,1200,540);ctx.fillStyle='#293940';ctx.font='16px WorldSans';ctx.textAlign='center';
 keys.forEach((k,i)=>ctx.fillText(islands[i],270+i*165,30));
 const rows=[el('variant').value,'adult','awakened'];const heights=[44,56,68],labels=[el('variant').selectedOptions[0].textContent,'成年','觉醒'];
 const at=fixedTime??time;lastFrames=[];
 for(let row=0;row<3;row++){
  const y=150+row*170;ctx.strokeStyle='#cec5b3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(16,y+.5);ctx.lineTo(1184,y+.5);ctx.stroke();
  ctx.setLineDash([3,4]);ctx.strokeStyle='#d8d1c3';ctx.beginPath();ctx.moveTo(180,y-75);ctx.lineTo(1184,y-75);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#65747c';ctx.font='13px WorldSans';ctx.textAlign='left';ctx.fillText(labels[row]+' · '+heights[row]+'px',16,y+24);
  if(row===0){const heroCanvas=hero.render(dt);ctx.save();ctx.translate(85,y);if(mirrored)ctx.scale(-1,1);ctx.drawImage(heroCanvas,-128,-204.8);ctx.restore();ctx.fillText('主角 · 100px',40,y+46);}
  else{ctx.strokeStyle='#9a6e24';ctx.beginPath();ctx.moveTo(85,y);ctx.lineTo(85,y-100);ctx.stroke();ctx.fillText('100px 参照',40,y+46);}
  for(let col=0;col<6;col++){
   const id='ss-pet-'+keys[col]+'-'+rows[row],a=assets.get(id),x=270+col*165;
   if(!a){ctx.fillStyle='#65747c';ctx.textAlign='center';ctx.fillText('尚未导出',x,y-35);continue;}
   const {p,atlas,image,sockets}=a,m=p.actions[action];ctx.textAlign='center';ctx.fillStyle='#293940';ctx.font='13px WorldSans';
   if(!m){ctx.fillText('无',x,y-35);ctx.fillText(p.name,x,y+24);continue;}
   const index=Math.min(m.count-1,Math.floor((at*speed%m.duration)*p.fps)),f=atlas.frames[m.frames[index]],b=f.frame,ss=f.spriteSourceSize;
   lastFrames.push({id,index,action});
   if(action==='move'&&el('stride').checked&&p.locomotion.calibratedStridePx>0){const stride=p.locomotion.calibratedStridePx,travel=Math.floor(at*speed/m.duration)*stride+p.locomotion.previewTravel[index].travelPx;ctx.save();ctx.beginPath();ctx.rect(x-65,y-3,130,10);ctx.clip();ctx.strokeStyle='#9a6e24';ctx.beginPath();for(let n=-10;n<=10;n++){const tx=x+n*12-(mirrored?-1:1)*(travel%12);ctx.moveTo(tx,y);ctx.lineTo(tx,y+5);}ctx.stroke();ctx.restore();}
   ctx.save();ctx.translate(x,y);if(mirrored)ctx.scale(-1,1);ctx.scale(p.scale,p.scale);ctx.drawImage(image,b.x,b.y,b.w,b.h,ss.x-p.anchor[0]*256,ss.y-p.anchor[1]*256,b.w,b.h);ctx.restore();
   if(el('sockets').checked){const points=sockets.actions[action][index],colors=['#9a6e24','#286b96','#b35b83','#b6473a','#327356'];['ground','body','head','emit','accessory'].forEach((key,i)=>{const v=points[key];ctx.fillStyle=colors[i];ctx.beginPath();ctx.arc(x+(mirrored?-1:1)*(v[0]-p.anchor[0]*256)*p.scale,y+(v[1]-p.anchor[1]*256)*p.scale,2.2,0,Math.PI*2);ctx.fill();});}
   ctx.fillStyle='#293940';ctx.fillText(p.name+' · '+p.family+p.stage,x,y+24);
  }
 }
 el('details').textContent=`${action} · ${speed.toFixed(1)}× · ${mirrored?'朝左（镜像）':'朝右（原生）'} · ${zoom===1?'实际显示大小':'放大检视'}${paused?' · 已暂停':''}`;
}
function tick(t){const dt=Math.min((t-last)/1000||0,.05);last=t;if(!paused)time+=dt;draw(paused?0:dt);requestAnimationFrame(tick);}
el('pause').onclick=()=>{paused=!paused;el('pause').setAttribute('aria-pressed',String(paused));el('pause').textContent=paused?'播放':'暂停';};
el('mirror').onclick=()=>{mirrored=!mirrored;el('mirror').setAttribute('aria-pressed',String(mirrored));};
for(const id of ['action','variant'])el(id).onchange=()=>{time=0;fixedTime=null;};
load().catch(e=>{el('status').textContent='资源加载失败：'+e.message;window.pa1Error=e.stack;console.error(e);});
