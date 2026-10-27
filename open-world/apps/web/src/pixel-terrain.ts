/** Classifies the reference, then paints authored tiles. Original RGB never enters the output. */
import mapping from '../../../packages/asset-manifest/pixel-terrain.json';
export type TerrainBank={key:string;reference:[number,number,number];tag:[number,number,number];pixels:Uint8ClampedArray;width:number;ramp:number[]};
export type TerrainPixels={data:Uint8ClampedArray;width:number;height:number;worldX:number;worldY:number;tiles:Uint16Array;tileWidth:number;counts:number[]};
const mod=(n:number,d:number)=>((n%d)+d)%d;
const distance=(r:number,g:number,b:number,p:readonly number[])=>2*(r-p[0])**2+3*(g-p[1])**2+(b-p[2])**2;
export function terrainTag(index:number):[number,number,number]{return [32+index%4*64,32+Math.floor(index/4)%4*64,64+Math.floor(index/16)%3*64];}
export function nearestTerrain(r:number,g:number,b:number,banks:readonly TerrainBank[],tag=false){let best=0,d=Infinity;for(let n=0;n<banks.length;n++){const delta=distance(r,g,b,tag?banks[n].tag:banks[n].reference);if(delta<d){d=delta;best=n;}}return best;}
export function wangMask(types:Uint16Array,width:number,height:number,x:number,y:number,id:number){return (y>0&&types[(y-1)*width+x]===id?1:0)|(x+1<width&&types[y*width+x+1]===id?2:0)|(y+1<height&&types[(y+1)*width+x]===id?4:0)|(x>0&&types[y*width+x-1]===id?8:0);}
/** One 16px band per step keeps classification outside the frame's hot path. */
export function* classifyTerrain(source:{data:Uint8ClampedArray;width:number;height:number},banks:readonly TerrainBank[],options:{worldX:number;worldY:number;tags?:Uint8ClampedArray;map?:string}):Generator<void,TerrainPixels>{
 if(!banks.length)throw Error('Pixel terrain has no authored tile bank');
 const px=mod(options.worldX,2),py=mod(options.worldY,2),width=Math.ceil((source.width+px)/2),height=Math.ceil((source.height+py)/2),worldX=options.worldX-px,worldY=options.worldY-py,types=new Uint16Array(width*height),alpha=new Uint8Array(width*height),counts=banks.map(()=>0);
 for(let y=0;y<height;y++){
  const sy=y*2+1-py;if(sy<0||sy>=source.height)continue;
  for(let x=0;x<width;x++){
   const sx=x*2+1-px;if(sx<0||sx>=source.width)continue;const i=(sy*source.width+sx)*4,n=y*width+x;if(source.data[i+3]<mapping.alphaThreshold)continue;
   const tags=options.tags,useTag=tags&&tags[i+3]>=128,id=nearestTerrain(useTag?tags![i]:source.data[i],useTag?tags![i+1]:source.data[i+1],useTag?tags![i+2]:source.data[i+2],banks,Boolean(useTag));types[n]=id;alpha[n]=1;counts[id]++;
  }if(y%16===15)yield;
 }
 const tileX=Math.floor(worldX/32),tileY=Math.floor(worldY/32),offsetX=mod(worldX/2,16),offsetY=mod(worldY/2,16),tileWidth=Math.ceil((width+offsetX)/16),tileHeight=Math.ceil((height+offsetY)/16),tiles=new Uint16Array(tileWidth*tileHeight),shades=new Int8Array(tileWidth*tileHeight),votes=new Uint32Array(banks.length),luma=new Float64Array(banks.length);
 const overrides=mapping.overrides as Record<string,Record<string,string>>;
 for(let ty=0;ty<tileHeight;ty++)for(let tx=0;tx<tileWidth;tx++){
  votes.fill(0);luma.fill(0);for(let y=Math.max(0,ty*16-offsetY);y<Math.min(height,(ty+1)*16-offsetY);y++)for(let x=Math.max(0,tx*16-offsetX);x<Math.min(width,(tx+1)*16-offsetX);x++)if(alpha[y*width+x]){const id=types[y*width+x],i=((y*2+1-py)*source.width+x*2+1-px)*4;votes[id]++;luma[id]+=(source.data[i]*2+source.data[i+1]*3+source.data[i+2])/6;}
  let id=0;for(let n=1;n<votes.length;n++)if(votes[n]>votes[id])id=n;
  const override=overrides[options.map??'']?.[`${tileX+tx},${tileY+ty}`],forced=override?banks.findIndex(b=>b.key===override):-1;tiles[ty*tileWidth+tx]=forced>=0?forced:id;
  if(votes[id]&&/wall|cliff|coast/.test(banks[id].key)){const r=banks[id].reference,delta=luma[id]/votes[id]-(r[0]*2+r[1]*3+r[2])/6;shades[ty*tileWidth+tx]=delta< -64?-2:delta< -28?-1:delta>40?1:0;}
 }
 const data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++){
  for(let x=0;x<width;x++){
   const n=y*width+x;if(!alpha[n])continue;const gx=Math.floor((x+offsetX)/16),gy=Math.floor((y+offsetY)/16),majority=tiles[gy*tileWidth+gx],override=overrides[options.map??'']?.[`${tileX+gx},${tileY+gy}`],id=override?majority:types[n],bank=banks[id],mask=id===majority?wangMask(tiles,tileWidth,tileHeight,gx,gy,id)|(gy===0?1:0)|(gx===tileWidth-1?2:0)|(gy===tileHeight-1?4:0)|(gx===0?8:0):15;
   const sx=mask*16+mod(worldX/2+x,16),sy=mod(worldY/2+y,16),s=(sy*bank.width+sx)*4,i=n*4,original=(bank.pixels[s]<<16)|(bank.pixels[s+1]<<8)|bank.pixels[s+2],rampIndex=bank.ramp.indexOf(original),border=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height&&alpha[(y+dy)*width+x+dx]&&types[(y+dy)*width+x+dx]!==id),color=border&&bank.ramp.length?bank.ramp[0]:rampIndex>=0&&id===majority?bank.ramp[Math.max(0,Math.min(bank.ramp.length-1,rampIndex+shades[gy*tileWidth+gx]))]:original;data[i]=color>>16;data[i+1]=color>>8&255;data[i+2]=color&255;data[i+3]=255;
  }if(y%16===15)yield;
 }
 return {data,width,height,worldX,worldY,tiles,tileWidth,counts};
}
