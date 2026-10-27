import {Pixels,ramps,source,crop,fit,resize,cleanup,provenance} from './harbor-source.mjs';
export async function harborProp(key,w,h,anchor,old){let file,im;
 if(/house|warehouse|wardrobe|postal-station/.test(key)){file='Buildings/Blue Buildings/House2.png';im=await source(file);}
 else if(/workshop/.test(key)){file='Buildings/Red Buildings/House3.png';im=await source(file);}
 else if(/ss-scene-tree/.test(key)){file='Terrain/Resources/Wood/Trees/Tree3.png';im=crop(await source(file),0,0,192,192);for(let i=0;i<im.data.length;i+=4)if(im.data[i+3]){const[r,g,b]=im.data.subarray(i,i+3);if(r>g&&r>b*1.2){const light=(r+g+b)/3,c=ramps.leaf[light>190?5:light>145?4:3];Buffer.from(c.slice(1),'hex').copy(im.data,i);}}im=resize(im,192,160);}
 else if(/ss-scene-rocks/.test(key)){file='Terrain/Decorations/Rocks/Rock1.png';im=await source(file);}
 else return;
 return{pixels:fit(im,w,h,anchor),provenance:provenance(file,['existing resource dimensions and footpoint retained'])};
}
/** Quiet 16px pavement: only two low-contrast seams, no wall-brick pattern. */
export function paving(key){const p=new Pixels(256,16),road=key==='ss-scene-road',ramp=[ramps.earth[3],ramps.earth[4],ramps.earth[5],ramps.ink[5]];
 for(let mask=0;mask<16;mask++)for(let y=0;y<16;y++)for(let x=0;x<16;x++){let c=road?ramps.earth[5]:ramps.ink[5];if(y===15||x===((y<8?0:8)))c=road?ramps.earth[4]:ramps.earth[5];if(y===14)c=road?ramps.ink[5]:ramps.ink[5];p.dot(mask*16+x,y,c);}
 return{pixels:p,terrain:{kind:'cobble',ramp},provenance:{method:'authored-pixels',reviewed:false,recipe:'tools/pixel/harbor-props.mjs#paving'}};
}
