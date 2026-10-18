import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {group,root,out,json,record} from './pipeline.mjs';
const manifest=JSON.parse(await readFile(join(group,'manifest.json'),'utf8'));
const r=n=>Math.round(n*1e6)/1e6;
const local=(b,p)=>{const x=p[0]-b.x,y=p[1]-b.y,d=b.a*b.d-b.b*b.c;return [(b.d*x-b.b*y)/d,(b.a*y-b.c*x)/d];};
const world=(b,p)=>[b.a*p[0]+b.b*p[1]+b.x,b.c*p[0]+b.d*p[1]+b.y];
for(const a of manifest.assets){
 const p=a.runtime,dir=join(out,a.id),s=JSON.parse(await readFile(join(dir,'sockets.json'),'utf8')),ev=JSON.parse(await readFile(join(group,'evidence',a.id+'-frames.json'),'utf8')),diag=JSON.parse(await readFile(join(group,'evidence',a.id+'-diagnostics.json'),'utf8')),defPath=join(group,'sources',a.id+'.json'),def=JSON.parse(await readFile(defPath,'utf8'));
 const rest=ev.find(f=>f.action==='idle'&&f.index===0).bones,names=Object.keys(rest),cam=diag.camera;
 const choose=patterns=>{for(const pattern of patterns){const n=names.find(n=>pattern.test(n));if(n)return n;}throw Error('No anatomical bone '+a.id);};
 const body=choose([/^body1$/,/^shenti$/,/^sehnti$/,/^shent$/,/^shen$/,/\/qugan$/,/\/tou$/,/^body$/]);
 const head=choose([/^tou$/,/\/tou$/,/^body2$/,/^shenti2$/,/^sehnti2$/,/^guan$/,/^shenti$/,/^shent$/,/^shen$/]);
 const emit=choose([/^pao$/,/^pao1$/,/^zui$/,/^zui1$/,/^xiaba$/,/^tou$/,/\/tou$/,/^body2$/,/^shenti2$/,/^sehnti2$/]);
 const selected={body,head,emit,accessory:body};
 for(const [key,bone] of Object.entries(selected)){
  const screen=s.actions.idle[0][key],point=[cam.cx+(screen[0]/256-.5)*cam.span,cam.cy-(screen[1]/256-.5)*cam.span];
  s.bindings[key]={...s.bindings[key],bone,local:local(rest[bone],point).map(r)};
 }
 for(const frame of ev){const points=s.actions[frame.action][frame.index],factor=p.actions[frame.action].bakedPresentationScale;
  for(const key of Object.keys(selected)){const bind=s.bindings[key],w=world(frame.bones[bind.bone],bind.local),v=[256*(.5+(w[0]-cam.cx)/cam.span),256*(.5-(w[1]-cam.cy)/cam.span)];points[key]=v.map((n,j)=>r(p.anchor[j]*256+(n-p.anchor[j]*256)*factor));points.mirrored[key]=[r(2*p.anchor[0]*256-points[key][0]),points[key][1]];}
 }
 s.emitNote=p.family==='D1'?'无明显嘴部，取正面中心偏上；绑定 '+emit:'正面嘴/喙/发射口附近校准；绑定 '+emit;
 def.bindings=s.bindings;await json(join(dir,'sockets.json'),s);await json(defPath,def);
 for(let i=0;i<a.files.length;i++)if(a.files[i].path.endsWith('/sockets.json')||a.files[i].path.endsWith('/'+a.id+'.json'))a.files[i]=await record(join(root,a.files[i].path));
 console.log(a.id,JSON.stringify(selected));
}
await json(join(group,'manifest.json'),manifest);await json(join(out,'manifest.json'),manifest);
