/** SP33 native pixel creatures, explicit family silhouettes and form adornments. */
import fs from 'node:fs';import path from 'node:path';import {Pixels,ramps,root,publicRoot,approve,frameTimes} from './px0-art.mjs';
const source=JSON.parse(fs.readFileSync(path.join(publicRoot,'art/starsea/pets/v3/manifest.json'),'utf8'));
const candidate={schemaVersion:1,stage:[1280,720],canvas:[640,360],palette:'/art-pixel/palette.json',assets:{}},contact=new Pixels(9*80,6*80);
function creature(r,action,index){
 const p=new Pixels(64,64),h=Math.round(r.displayHeight/2),unit=h/48,attack=action==='attack',bob=action==='move'?[0,-2,-1,0,1,0][index]:action==='idle'||action==='idle2'?[0,0,-1,0][index%4]:0,lean=attack?[0,-2,-3,4,2,0][index]:0;
 const pt=([x,y])=>[32+(x-32)*unit+lean,60+(y-60)*unit+bob],poly=(v,c)=>p.poly(v.map(pt),c),rect=(x,y,w,h,c)=>{const q=pt([x,y]);p.rect(...q,Math.max(1,w*unit),Math.max(1,h*unit),c);},ellipse=(x,y,rx,ry,c)=>{const pts=[];for(let a=0;a<24;a++)pts.push([x+Math.cos(a*Math.PI/12)*rx,y+Math.sin(a*Math.PI/12)*ry]);poly(pts,c);};
 const f=r.family,color=/wind/.test(r.id)?ramps.copper:/mist/.test(r.id)?ramps.leaf:/forge/.test(r.id)?ramps.fire:/frost/.test(r.id)?ramps.water:/star/.test(r.id)?ramps.arcane:ramps.leaf,edge=color[0],light=ramps.earth;
 const head=(x,y,rx=10)=>{ellipse(x,y,rx,10,edge);ellipse(x-1,y-1,rx-2,8,color[3]);rect(x+3,y-2,3,3,ramps.ink[0]);rect(x+3,y-3,2,1,light[5]);};
 const leg=(x,y,dx)=>{poly([[x-4,y],[x+4,y],[x+4+dx,57],[x+10+dx,58],[x+10+dx,60],[x-5+dx,60]],edge);poly([[x-2,y+2],[x+2,y+2],[x+2+dx,56],[x+7+dx,58],[x-2+dx,58]],color[2]);};
 const stride=action==='move'?[-4,-2,2,4,2,-2][index]:0;
 if(['xiaoyuniguai','yuniguai','xiaoyuanling'].includes(f)){
  if(f==='xiaoyuanling'){poly([[18,24],[3,11],[8,33],[17,40],[24,37]],edge);poly([[15,25],[6,17],[11,31],[19,36]],color[3]);poly([[45,24],[57,12],[60,35],[46,41]],edge);}
  ellipse(30,41,24,18,edge);ellipse(28,39,22,16,color[2]);ellipse(21,33,11,8,color[4]);head(42,35,11);rect(35,47,10,2,color[1]);
  if(f==='xiaoyuniguai')for(const [x,y]of [[15,23],[24,19],[35,23]]){ellipse(x,y,8,7,edge);ellipse(x-1,y-1,6,5,ramps.ink[5]);}
  if(f==='yuniguai'){poly([[9,44],[1,49],[2,57],[14,56],[19,60],[33,57],[46,59],[58,52],[51,43]],color[1]);rect(16,52,6,2,color[4]);}
  if(f==='xiaoyuanling'){poly([[25,16],[32,5],[39,16],[34,25],[28,24]],color[0]);poly([[28,16],[32,9],[33,21]],color[5]);}
 }else if(f==='xiaozhizhu'){
  for(let n=0;n<4;n++){const y=28+n*6,s=n%2?stride:-stride;poly([[23,y],[10,y-5],[2,y+11+s],[7,y+13+s],[15,y+1],[24,y+5]],edge);poly([[36,y],[50,y-5],[62,y+9-s],[57,y+12-s],[46,y+1],[36,y+6]],edge);}
  ellipse(26,34,17,18,edge);ellipse(24,31,14,14,color[3]);head(40,46,13);rect(38,43,3,4,ramps.fire[3]);rect(47,44,3,4,ramps.fire[3]);poly([[38,53],[37,60],[41,55],[45,55],[49,60],[49,52]],light[4]);
 }else if(['bingren','xiaoemo','emo'].includes(f)){
  const demon=f!=='bingren';if(demon)for(const side of [-1,1])poly([[32+side*6,30],[32+side*27,18],[32+side*23,39],[32+side*12,47]],edge);
  leg(24,43,-stride);leg(39,43,stride);poly([[18,29],[31,23],[44,28],[45,46],[34,51],[20,46]],edge);poly([[21,30],[30,27],[40,30],[40,43],[33,46],[23,43]],color[2]);head(33,18,12);
  poly([[23,12],[17,1],[28,8],[37,7],[46,1],[43,15]],demon?ramps.earth[3]:color[4]);rect(21,33,4,10,color[4]);poly([[40,32],[48,30],[53,41],[45,43]],color[1]);
  if(f==='bingren'){poly([[47,12],[52,4],[55,15],[54,47],[49,51]],color[0]);poly([[50,14],[52,8],[52,44],[50,47]],color[5]);}
  if(demon){poly([[23,24],[29,27],[39,24],[35,31],[30,31]],light[4]);poly([[18,43],[7,43],[3,35],[8,40],[21,39]],color[1]);}
 }else{
  const multi=['jiutoushe','shenyuanjiutoulong','diyusantouquan'].includes(f),serpent=['jiutoushe','ejiao'].includes(f),bone=f==='gulong_1',dragon=f!=='diyusantouquan',body=bone?ramps.earth:color;
  poly([[23,49],[8,52],[1,43],[4,36],[6,44],[20,44]],body[0]);poly([[20,48],[8,49],[5,44],[19,46]],body[3]);
  leg(23,43,-stride);leg(43,42,stride);ellipse(28,39,20,15,body[0]);ellipse(27,37,17,12,body[2]);ellipse(33,41,10,11,bone?ramps.earth[4]:body[4]);
  if(dragon&&!serpent){const flap=action==='move'?[0,-3,-1,2,3,0][index]:index%2;poly([[25,33],[9,8+flap],[2,12+flap],[3,34],[17,42]],body[0]);poly([[22,32],[10,14+flap],[7,17+flap],[7,30],[17,36]],bone?ramps.earth[3]:body[3]);poly([[29,29],[31,8-flap],[43,4],[45,20],[38,34]],body[0]);poly([[32,27],[34,12-flap],[40,9],[41,19],[36,30]],body[3]);}
  if(multi)for(const [x,y]of [[21,19],[35,12],[48,22]]){poly([[26,37],[x-4,y+5],[x+3,y+2],[36,36]],body[0]);head(x,y,8);}
  else{poly([[38,39],[37,22],[43,16],[48,22],[49,41]],body[0]);head(46,22,12);poly([[43,26],[61,24],[60,34],[47,35]],body[0]);poly([[44,27],[58,27],[57,31],[47,32]],body[3]);rect(52,29,6,1,body[1]);}
  if(bone){for(let n=0;n<3;n++)poly([[18+n*6,31],[15+n*6,39],[18+n*6,49],[21+n*6,48],[19+n*6,39],[22+n*6,32]],ramps.earth[4]);rect(47,20,5,5,ramps.ink[0]);}
  else if(serpent){poly([[19,43],[8,41],[2,51],[10,59],[30,59],[42,54],[34,48],[16,53],[8,51],[13,47]],body[0]);poly([[17,44],[10,44],[6,51],[11,56],[28,56],[36,53],[31,51],[16,55],[10,53]],body[3]);}
  if(['jinlong','lvlongwang'].includes(f))poly([[38,12],[35,2],[44,7],[49,1],[53,9],[62,4],[58,15]],ramps.copper[3]);
  if(['bailong','ejiao'].includes(f)){poly([[37,13],[32,2],[41,8],[48,5],[54,1],[54,13]],ramps.ink[5]);}
 }
 if(r.form==='adult')poly([[16,25],[12,18],[22,22],[25,28]],color[4]);
 if(r.form==='awakened'){poly([[14,27],[8,12],[20,19],[26,29]],ramps.copper[2]);poly([[20,44],[30,40],[37,44],[31,50]],ramps.copper[1]);poly([[24,44],[30,42],[33,44],[30,47]],ramps.water[4]);}
 if(action==='knock'){rect(2,27,7,2,ramps.copper[4]);rect(5,24,2,7,ramps.copper[4]);}
 const src=Buffer.from(p.data);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4;if(!src[i+3])continue;let n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&x+dx<64&&y+dy>=0&&y+dy<64&&src[((y+dy)*64+x+dx)*4+3])n++;if(!n)p.dot(x,y,null);}
 return p;
}
for(let n=0;n<source.assets.length;n++){
 const {id,runtime:r}=source.assets[n],sheet=new Pixels(64*6,64*5),actions={},frames={};let row=0;
 for(const [name,src]of Object.entries(r.actions)){const count=name==='idle'?4:name==='knock'?2:6,duration=src.duration,impactTime=src.impactTime??0,timing=frameTimes(count,duration,impactTime),sockets=[];
  for(let i=0;i<count;i++){sheet.stamp(creature(r,name,i),i*64,row*64);sockets.push({feet:[32,60],chest:[32,Math.round(60-r.displayHeight/4)],hand:[44,42],weapon:[48,40],muzzle:[51,38]});}
  actions[name]={row,count,duration,impactTime,...timing,sockets,loop:src.loop};for(let i=0;i<src.frames.length;i++){const t=src.times?.[i]??i/src.fps;let frame=0;while(frame+1<count&&timing.frameTimes[frame+1]<=t)frame++;frames[src.frames[i]]={x:frame*64,y:row*64,w:64,h:64};}row++;
 }
 const file=r.image.replace('/art/','/art-pixel/').replace('actor.webp',r.form==='young'?'actor.png':'actor-'+r.form+'.png');const a=await approve(id,sheet,{file,original:[r.image,r.materials.image],batch:'PX7',kind:'actor',frame:[64,64],anchor:[32,60],actions,recipe:'tools/pixel/px7-art.mjs#'+r.family},candidate);a.frames=frames;a.displayHeight=r.displayHeight;a.bodyHeight=Math.round(r.displayHeight/2);a.family=r.family;a.form=r.form;
 contact.stamp(creature(r,'idle',0),n%9*80,Math.floor(n/9)*80);
}
fs.writeFileSync(path.join(root,'.runtime/pixel-redraw/px7-candidates.json'),JSON.stringify(candidate,null,2)+'\n');await contact.save(path.join(root,'.runtime/pixel-redraw/px7-contact.png'));console.log(JSON.stringify({candidates:Object.keys(candidate.assets).length}));
