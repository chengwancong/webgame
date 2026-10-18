// Editable vector additions in each ORIGINAL attachment's UV canvas.
// Geometry is clipped by the existing texture silhouette and native mesh hull.
export function tierArt(p,n,r,w,h,c,stage){
 if(p.tier==='free'||['eye','mouth','softDetail','effect'].includes(r))return '';
 const shape=(d,fill,stroke='',sw=1)=>`<path d="${d}" fill="${fill}" ${stroke?`stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"`:''}/>`;
 const path=(d,fill,stroke='',sw=1)=>shape(d.replace(/([\d.]+),([\d.]+)/g,(_,x,y)=>`${(+x*w).toFixed(2)} ${(+y*h).toFixed(2)}`),fill,stroke,sw);
 let s='<g clip-path="url(#p)">';
 if(p.tier==='light'){
  s+=path('M0.08,0.18 Q0.4,0.04 0.76,0.18 L0.62,0.32 Q0.35,0.21 0.14,0.36Z',c[9]);
  if(r!=='head'&&r!=='jaw')s+=path('M0.22,0.18 L0.34,0.25 L0.3,0.53 L0.2,0.41Z M0.48,0.14 L0.6,0.2 L0.55,0.48 L0.45,0.35Z M0.73,0.2 L0.83,0.28 L0.76,0.51 L0.68,0.4Z',c[2]);
  return s+'</g>';
 }
 // Five large, hard-edged value planes. Face stays one light plane under eyelid overlays.
 if(r!=='head')s+=path('M0,0.82 Q0.55,0.7 1,0.86 L1,1 L0,1Z',c[8]);
 s+=path('M0,0.13 Q0.42,0.01 1,0.18 L0.92,0.3 Q0.5,0.18 0.1,0.32Z',c[9]);
 s+=path('M0,0.07 Q0.4,0 1,0.1 L1,0.16 Q0.4,0.08 0,0.18Z',c[10]);
 const membrane=n==='shenti'||/^(pu\d|qi|jiao1|bi3|bi6)$/.test(n);
 if(membrane){
  const d=n==='shenti'?(stage==='c'?'M0,0.2 L1,0.02 L0.89,0.47 Q0.44,0.7 0,0.39Z':'M0,0 L1,0 L1,0.48 Q0.66,0.71 0.36,0.59 Q0.24,0.2 0,0.34Z'):'M0,0 L1,0 L1,0.65 L0.58,0.78 L0.05,0.42Z';
  s+=path(d,c[2]);
  s+=path('M0,0.24 Q0.42,0.62 1,0.25 L1,0.4 Q0.52,0.8 0,0.39Z',c[3]);
  for(const [x,y]of [[.18,.12],[.4,.05],[.64,.02],[.86,.1]])s+=path(`M${x},${y} Q${x+.07},0.32 0.55,0.62`,'none',c[5],1.1);
  s+=path('M0,0.06 Q0.34,0.01 0.47,0.32 M0.65,0.08 Q0.88,0.15 0.94,0.4','none',c[10],2.3);
 }
 if(n==='shenti'){
  s+=path('M0.78,0.5 Q0.88,0.7 0.89,1 L1,1 L1,0.35Z',c[4]);
  for(const y of [.61,.73,.85])s+=path(`M0.81,${y} Q0.9,${y+.04} 1,${y-.03}`,'none',c[1],1.5);
  s+=path('M0.22,0.58 L0.3,0.62 L0.35,0.56 L0.4,0.65 L0.48,0.62 L0.52,0.7','none',c[9],3);
 }
 if(r==='head'){
  // Original crown filaments remain, cut into broad colored + light segments.
  s+=path('M0,0 L0.76,0 L0.63,0.51 L0.3,0.65 L0,0.38Z',c[2]);
  s+=path('M0,0.05 L0.68,0.05 L0.58,0.37 L0.47,0.48 L0.6,0.12 L0.13,0.12Z',c[10]);
  s+=path('M0.08,0.2 Q0.32,0.39 0.55,0.49 M0.13,0.42 Q0.36,0.48 0.56,0.56','none',c[3],1.4);
  // Restore the entire face patch before the calibrated eyes are drawn.
  s+=path(stage==='c'?'M0.6,0.44 Q0.82,0.39 1,0.56 L1,1 L0.59,1Z':'M0.64,0.61 Q0.88,0.56 1,0.76 L1,1 L0.66,1Z',c[0]);
 }
 if(p.style==='B'){
  const armor=(d)=>path(d,c[11],c[5],1.2);
  if(r==='head'){
   // Crown above and behind eyes, never across their UV rectangle.
   s+=armor(stage==='c'?'M0.31,0.2 L0.44,0.3 L0.62,0.18 L0.69,0.41 L0.51,0.51 L0.34,0.4Z':'M0.36,0.34 L0.49,0.46 L0.61,0.31 L0.7,0.53 L0.62,0.66 L0.43,0.58Z');
   s+=path(stage==='c'?'M0.36,0.23 L0.45,0.35 L0.62,0.23 L0.64,0.3 L0.44,0.42Z':'M0.4,0.39 L0.5,0.51 L0.61,0.37 L0.63,0.44 L0.5,0.57Z',c[13]);
   const x=stage==='c'?.53:.57,y=stage==='c'?.37:.53;
   s+=path(`M${x},${y-.075} L${x+.055},${y} L${x},${y+.075} L${x-.055},${y}Z`,c[14],c[12],1.1)+path(`M${x-.025},${y} L${x},${y-.05} L${x+.02},${y-.01}Z`,c[15]);
  }else if(n==='shenti'){
   s+=armor('M0.72,0.54 L0.84,0.46 L0.97,0.58 L0.98,0.85 L0.85,0.98 L0.72,0.85Z');
   s+=path('M0.74,0.79 L0.85,0.86 L0.96,0.77 L0.96,0.86 L0.85,0.96 L0.74,0.84Z',c[12]);
   s+=path('M0.75,0.58 L0.84,0.5 L0.94,0.59 L0.91,0.63 L0.84,0.57 L0.77,0.63Z',c[13]);
   s+=path('M0.85,0.61 L0.92,0.71 L0.85,0.82 L0.78,0.71Z',c[14],c[12],1.2)+path('M0.85,0.63 L0.88,0.69 L0.83,0.73 L0.81,0.7Z',c[15]);
   s+=armor('M0.16,0.42 L0.24,0.47 L0.22,0.68 L0.14,0.63Z');
   s+=path('M0.17,0.43 L0.2,0.45 L0.18,0.64 L0.15,0.62Z',c[13]);
  }else if(membrane||/^(jia\d|bi[1245])$/.test(n)){
   s+=armor('M0,0.05 Q0.5,0.02 1,0.2 L1,0.38 Q0.4,0.15 0,0.25Z');
   s+=path('M0,0.08 Q0.5,0.06 1,0.24 L1,0.29 Q0.4,0.12 0,0.18Z',c[13]);
   s+=path('M0.66,0.19 L0.74,0.16 L0.81,0.26 L0.74,0.31Z',c[14],c[12],.8);
  }else if(/^xv|jijiao/.test(n)){
   s+=armor('M0,0.54 L1,0.54 L1,0.72 L0,0.72Z')+path('M0,0.55 L1,0.55 L1,0.6 L0,0.6Z',c[13]);
  }
 }
 return s+'</g>';
}
