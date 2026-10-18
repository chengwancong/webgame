import './ui/tokens.css';
import {MiniNativePreview,type MiniNativeProfile} from './mini-native-renderer.ts';
import type {NativeSkinRoles} from './native-skin-composition.ts';
import {appearanceSlots,type ResolvedAppearance} from '../../../packages/contracts/appearance.ts';
import source from '../../../assets/mini-hero/navy/profile.json';
import jobs from '../../../assets/mini-hero/icons-v2/bake-jobs.json';
const root=document.querySelector<HTMLDivElement>('#bake')!;root.style.cssText='font:14px sans-serif;padding:24px';root.innerHTML='<h1>从原生形象生成图标</h1><p id="progress" role="status">正在读取资源…</p><div id="output"></div>';
const input={rig:'modular-hero',family:'sword',styleProfile:'v2-soft',revision:0,parts:Object.fromEntries(appearanceSlots.map(s=>[s,{setId:'100011'}]))} as ResolvedAppearance;
const progress=document.querySelector('#progress')!,output=document.querySelector('#output')!;const size=jobs.size,padding=jobs.padding;
for(let index=0;index<jobs.jobs.length;index++){
 const job=jobs.jobs[index],roles=job.roles as NativeSkinRoles,profile=structuredClone(source) as unknown as MiniNativeProfile;
 profile.skinRoles=roles;profile.skinNames=[roles.face,roles.hair].filter(Boolean) as string[];
 const url=URL.createObjectURL(new Blob([JSON.stringify(profile)],{type:'application/json'}));
 const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
 const renderer=new MiniNativePreview(canvas,{profileUrl:url,height:300,footX:.5,footY:.82});
 try{
  if(!await renderer.setAppearance(input))throw Error(renderer.diagnostics().errors.join('; '));
  renderer.render({action:'idle',clock:0,facing:-1});
  if(!renderer.drawIcon(canvas,padding))throw Error('Native icon bounds missing '+job.key);
  const pixels=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;let x0=canvas.width,y0=canvas.height,x1=-1,y1=-1;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>8){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  if(x1<0)throw Error('Empty native icon '+job.key);
  if(x0===0||y0===0||x1===canvas.width-1||y1===canvas.height-1)throw Error('Clipped source icon '+job.key);
  const w=x1-x0+1,h=y1-y0+1;
  const row=document.createElement('a');row.className='baked';row.dataset.key=job.key;row.dataset.metadata=JSON.stringify({roles,frame:jobs.frame,sourceBounds:{x:x0,y:y0,width:w,height:h},size:[size,size],padding,rendering:'native parts fit directly at 256px'});row.href=canvas.toDataURL('image/png');row.textContent=job.key;row.style.display='inline-block';row.style.margin='4px';output.append(row);
 }catch(error){root.dataset.failed=job.key;progress.textContent='导出失败：'+String(error);throw error;}
 finally{renderer.destroy();URL.revokeObjectURL(url);}
 root.dataset.completed=String(index+1);progress.textContent=`已生成 ${index+1}/${jobs.jobs.length} · ${job.key}`;
 // Yield between assets and use one renderer/context at a time.
 await new Promise(resolve=>setTimeout(resolve,0));
}
root.dataset.done='true';progress.textContent=`全部 ${jobs.jobs.length} 张原生图标已生成，等待写入文件。`;
