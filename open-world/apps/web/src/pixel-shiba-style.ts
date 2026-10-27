import palette from '../../../packages/asset-manifest/pixel-palette.json';
/** Shiba fur and eyes keep their identity; only the jacket's navy light clusters accept outfit dye. */
export function dyeShibaGarment(data:Uint8ClampedArray,target:readonly string[]){
 const map=new Map(palette.ramps.navy.slice(2).map((c,n)=>[parseInt(c.slice(1),16),target[Math.min(target.length-1,n+2)]]));
 for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;const color=map.get(data[i]*65536+data[i+1]*256+data[i+2]);if(!color)continue;const rgb=parseInt(color.slice(1),16);data[i]=rgb>>16;data[i+1]=rgb>>8&255;data[i+2]=rgb&255;}
 return data;
}
