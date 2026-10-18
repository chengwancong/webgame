import type {Vec} from '../contracts/index.ts';
/** Browser/server shared byte encoding, no Node Buffer dependency. */
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function encodeExploration(bytes:Uint8Array){let out='';for(let i=0;i<bytes.length;i+=3){const n=(bytes[i]<<16)|((bytes[i+1]??0)<<8)|(bytes[i+2]??0);out+=alphabet[n>>>18]+alphabet[(n>>>12)&63]+(i+1<bytes.length?alphabet[(n>>>6)&63]:'=')+(i+2<bytes.length?alphabet[n&63]:'=');}return out;}
export function decodeExploration(value:string,length:number){
 if(value==='')return new Uint8Array(length);
 if(value.length!==4*Math.ceil(length/3)||!(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/).test(value))throw Error('探索位图编码或长度不正确');
 const bytes=new Uint8Array(length);let j=0;for(let i=0;i<value.length;i+=4){const n=(alphabet.indexOf(value[i])<<18)|(alphabet.indexOf(value[i+1])<<12)|(Math.max(0,alphabet.indexOf(value[i+2]))<<6)|Math.max(0,alphabet.indexOf(value[i+3]));for(const shift of [16,8,0])if(j<length)bytes[j++]=(n>>>shift)&255;}
 if(encodeExploration(bytes)!==value)throw Error('探索位图编码不规范');return bytes;
}
export function explorationGrid(width:number,height:number){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>2048||height>2048)throw Error('探索地图尺寸不正确');const columns=Math.ceil(width/8),rows=Math.ceil(height/8);return {columns,rows,bytes:Math.ceil(columns*rows/8)};}
export function revealExploration(current:string,width:number,height:number,p:Vec){
 const grid=explorationGrid(width,height);if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>=width||p.y>=height)throw Error('探索位置越界');
 const bytes=decodeExploration(current,grid.bytes),index=Math.floor(p.y/8)*grid.columns+Math.floor(p.x/8);bytes[index>>>3]|=1<<(index&7);return encodeExploration(bytes);
}
export function mergeExploration(current:string,incoming:string,width:number,height:number){const grid=explorationGrid(width,height),old=decodeExploration(current,grid.bytes),added=decodeExploration(incoming,grid.bytes);for(let i=0;i<old.length;i++)old[i]|=added[i];const count=grid.columns*grid.rows;if(count%8&&old.at(-1)!>>>(count%8))throw Error('探索位图有越界位');return encodeExploration(old);}
export function exploredAt(value:string,width:number,height:number,p:Vec){if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>=width||p.y>=height)return false;const grid=explorationGrid(width,height),bytes=decodeExploration(value,grid.bytes),index=Math.floor(p.y/8)*grid.columns+Math.floor(p.x/8);return !!(bytes[index>>>3]&(1<<(index&7)));}
