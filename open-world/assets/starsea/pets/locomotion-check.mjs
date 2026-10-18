import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {group,out,root,json,record} from './pipeline.mjs';
const manifest=JSON.parse(await readFile(join(group,'manifest.json'),'utf8')),results=[];
for(const a of manifest.assets){
 const p=a.runtime,dir=join(out,a.id),ev=JSON.parse(await readFile(join(group,'evidence',a.id+'-frames.json'),'utf8')).filter(f=>f.action==='move'),diag=JSON.parse(await readFile(join(group,'evidence',a.id+'-diagnostics.json'),'utf8'));
 const s=JSON.parse(await readFile(join(dir,'sockets.json'),'utf8')),factor=p.actions.move.bakedPresentationScale,worldScale=256/diag.camera.span*p.scale*factor;
 const names=Object.keys(ev[0].bones).filter(n=>/^IK\d+$/i.test(n));
 let mode=names.length?'native foot IK':'native body locomotion';if(p.family==='D1')mode='无足绒团，原生弹跳';if(p.family==='D3')mode='无足软泥，原生接地伸缩';if(p.family==='C8')mode='原生振翅悬浮，无支撑脚锁定';if(p.family==='C4'&&p.stage==='a')mode='轮式幼体，原生轮滚动';
 const yMin=Object.fromEntries(names.map(n=>[n,Math.min(...ev.map(f=>f.bones[n].y))]));
 const tolerance=p.referenceHeight*.09,steps=[];
 for(let i=0;i<ev.length;i++){
  const next=ev[(i+1)%ev.length];const contacts=names.filter(n=>{const b=ev[i].bones[n],c=next.bones[n];return b.y<=yMin[n]+tolerance&&c.y<=yMin[n]+tolerance&&c.x-b.x<-.00001;});
  const dx=contacts.length?-contacts.reduce((sum,n)=>sum+next.bones[n].x-ev[i].bones[n].x,0)/contacts.length:null;
  steps.push({index:i,contacts,dx,footDeltas:contacts.map(n=>({bone:n,dx:next.bones[n].x-ev[i].bones[n].x,dy:next.bones[n].y-ev[i].bones[n].y}))});
 }
 const known=steps.filter(s=>s.dx!==null),mean=known.length?known.reduce((s,x)=>s+x.dx,0)/known.length:0;
 let travel=0,maxSlip=0,contactIntervals=0;const samples=[];
 for(const step of steps){const dx=(step.dx??mean)*worldScale;const slips=step.footDeltas.map(f=>Math.abs(f.dx*worldScale+dx));maxSlip=Math.max(maxSlip,...slips);contactIntervals+=slips.length;samples.push({frame:step.index,travelPx:travel,deltaPx:dx,contacts:step.contacts,maxHorizontalSlipPx:Math.max(0,...slips)});travel+=dx;}
 const duration=p.actions.move.duration,range=[1,1.3,1.6].map(speed=>({playbackSpeed:speed,cycleSeconds:duration/speed,suggestedTravelPxPerSecond:travel/duration*speed,maxContactHorizontalSlipPerSourceIntervalPx:maxSlip}));
 const notes=names.length?'以原生低位且后移的 IK 目标判定支撑段；同段多足取平均反向位移，悬空段沿均值；仅作为预览步幅标定数据，未实现跟随 AI。':'无足/悬浮/轮式动作不伪造足骨或锁脚；检查完整原生循环和固定深度锚。';
 const result={id:a.id,mode,contactBones:names,contactIntervals,maxHorizontalContactSlipPx:maxSlip,stridePx:travel,range,notes,pass:maxSlip<=1.25};
 if(!result.pass)throw Error('Native stance inconsistent '+a.id+' '+maxSlip);
 p.locomotion={...p.locomotion,mode,contactBones:names,contactIntervals,calibratedStridePx:travel,calibration:notes,recommendedPlaybackRange:[1,1.6],calibratedPlayback:range,footSlipLimitPx:1.25,maxMeasuredContactSlipPx:maxSlip,previewTravel:samples};
 await json(join(dir,'profile.json'),p);a.files[a.files.findIndex(f=>f.path.endsWith('/profile.json'))]=await record(join(dir,'profile.json'));
 results.push(result);console.log(a.id,mode,'contacts',contactIntervals,'slip',maxSlip.toFixed(3),'px');
}
await json(join(group,'evidence/locomotion-validation.json'),{pass:results.every(r=>r.pass),method:'Native stance IK trajectory analysis; horizontal travel calibrated to original stance; time reparameterization 1.0/1.3/1.6 preserves path; no AI or gameplay changes',results});
await json(join(group,'manifest.json'),manifest);await json(join(out,'manifest.json'),manifest);
