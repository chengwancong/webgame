import sharp from 'sharp';
// 只做已生成材质的技术投影/平铺。石面像素来自原图；网格几何来自64×36契约。
export async function projectedFloor(path,w,h){
 const meta=await sharp(path).metadata(),sw=Math.round(meta.width*.04),sh=Math.round(meta.height*.04);
 // 找稳定的石面内部，避免把原图的砂浆交叉口/晶体再次烘到每块地砖中。
 const small=await sharp(path).resize(64,64,{fit:'fill'}).removeAlpha().raw().toBuffer(),mean=[0,0,0];
 for(let i=0;i<small.length;i++)mean[i%3]+=small[i]/4096;
 let best={x:20,y:20,score:Infinity};
 for(let y=3;y<56;y+=3)for(let x=3;x<56;x+=3){const sums=[0,0,0],squares=[0,0,0];for(let j=0;j<5;j++)for(let i=0;i<5;i++)for(let c=0;c<3;c++){const v=small[((y+j)*64+x+i)*3+c];sums[c]+=v/25;squares[c]+=v*v/25;}const score=sums.reduce((v,s,c)=>v+squares[c]-s*s+.7*(s-mean[c])**2,0);if(score<best.score)best={x,y,score};}
 const patch=await sharp(path).extract({left:Math.round(meta.width*(best.x+1.25)/64),top:Math.round(meta.height*(best.y+1.25)/64),width:sw,height:sh}).resize(32,32).removeAlpha().raw().toBuffer();
 const out=Buffer.alloc(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=x/64+y/36,v=y/36-x/64,fu=u-Math.floor(u),fv=v-Math.floor(v);
  const sx=Math.min(31,Math.floor(fu*32)),sy=Math.min(31,Math.floor(fv*32)),i=(sy*32+sx)*3,o=(y*w+x)*4;
  const edge=Math.min(fu,1-fu,fv,1-fv),factor=edge<.025?.72:edge<.055?.9:1;
  for(let c=0;c<3;c++)out[o+c]=Math.round(patch[i+c]*factor);out[o+3]=255;
 }
 return sharp(out,{raw:{width:w,height:h,channels:4}});
}
export async function mirroredTexture(path,w,h,{verticalOnly=false}={}){
 const tw=verticalOnly?w:w/2,th=h/2,tile=await sharp(path).resize(tw,th,{fit:'fill'}).removeAlpha().png().toBuffer();
 const layers=[{input:tile,left:0,top:0},{input:await sharp(tile).flip().toBuffer(),left:0,top:th}];
 if(!verticalOnly){layers.push({input:await sharp(tile).flop().toBuffer(),left:tw,top:0},{input:await sharp(tile).flip().flop().toBuffer(),left:tw,top:th});}
 return sharp({create:{width:w,height:h,channels:4,background:'#000000'}}).composite(layers);
}
