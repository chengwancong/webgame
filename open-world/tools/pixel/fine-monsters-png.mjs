/** Exact indexed PNG encoder: libimagequant may merge close master colors even below its color limit. */
import fs from 'node:fs';import {deflateSync} from 'node:zlib';
const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(data){let c=0xffffffff;for(const b of data)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),size=Buffer.alloc(4),check=Buffer.alloc(4);size.writeUInt32BE(data.length);check.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([size,name,data,check]);}
export function writeExactPalettePNG(file,pixels,colors){if(colors.length>255)throw Error('Indexed palette too large');const map=new Map(colors.map((c,i)=>[parseInt(c.slice(1),16),i+1])),palette=Buffer.concat([Buffer.alloc(3),...colors.map(c=>Buffer.from(c.slice(1),'hex'))]),alpha=Buffer.alloc(colors.length+1,255);alpha[0]=0;const raw=Buffer.alloc((pixels.width+1)*pixels.height);
 for(let y=0;y<pixels.height;y++)for(let x=0;x<pixels.width;x++){const i=(y*pixels.width+x)*4;if(!pixels.data[i+3])continue;const c=pixels.data[i]*65536+pixels.data[i+1]*256+pixels.data[i+2],index=map.get(c);if(!index)throw Error('Unregistered RGB '+c.toString(16));raw[y*(pixels.width+1)+x+1]=index;}
 const header=Buffer.alloc(13);header.writeUInt32BE(pixels.width);header.writeUInt32BE(pixels.height,4);header[8]=8;header[9]=3;fs.writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('PLTE',palette),chunk('tRNS',alpha),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]));
}
