import {join} from 'node:path';import {boot,load,group,json} from './pipeline.mjs';
const ctx=await boot(),result={};
function uvAt(g,p){for(let i=0;i<g.triangles.length;i+=3){const ids=g.triangles.slice(i,i+3),[a,b,c]=ids.map(n=>g.vertices.slice(n*2,n*2+2)),den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]),u=((b[1]-c[1])*(p[0]-c[0])+(c[0]-b[0])*(p[1]-c[1]))/den,v=((c[1]-a[1])*(p[0]-c[0])+(a[0]-c[0])*(p[1]-c[1]))/den,w=1-u-v;if(u>=-1e-5&&v>=-1e-5&&w>=-1e-5)return [0,1].map(k=>g.uvs[ids[0]*2+k]*u+g.uvs[ids[1]*2+k]*v+g.uvs[ids[2]*2+k]*w);}throw Error('Eye outside body mesh');}
try{for(const stage of ['a','c','d']){const info=await load(ctx,'D1',stage);const g=await ctx.page.evaluate(()=>window.petGeometry('idle',0)),closed=[];
 for(const action of ['idle','idle2'])for(let i=0;i<info.actions[action].count;i++){const q=await ctx.page.evaluate(({action,t})=>window.petGeometry(action,t),{action,t:i/30});if(!q.eyeVisible)closed.push(q.eyePoints.map(p=>uvAt(q,p)));}
 if(!closed.length)throw Error('No blink samples');const eyeUV=[0,1].map(j=>[0,1].map(k=>closed.reduce((sum,points)=>sum+points[j][k],0)/closed.length));
 result[stage]={eyeUV,restEyeUV:g.eyePoints.map(p=>uvAt(g,p)),eyeBone:g.eyeBone,calibration:'mean body UV corresponding to unchanged yan centres during all native idle/idle2 closed-eye frames',closedFrameSamples:closed.length};console.log(stage,result[stage]);}}finally{await ctx.close();}
await json(join(group,'sources/eye-alignment.json'),result);
