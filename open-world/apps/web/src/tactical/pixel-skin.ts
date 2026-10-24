/**
 * 像素风对照皮肤（2026-10-24 试验，`?skin=pixel`）。只换表现：地面、障碍物和单位贴图换成
 * Kenney Tiny Dungeon（CC0，16×16）。规则、意图、预览、界面结构都不变，用来和现风格并排比较。
 * 素材只放在本地 public/art/third-party/，不进 Git，也不进游戏 bundle。
 */
import type {TacticalUnitView} from './contract.ts';

export const pixelSkin=typeof location!=='undefined'&&new URLSearchParams(location.search).get('skin')==='pixel';
const BASE='/art/third-party/kenney-tiny-dungeon/';
export const pixelTile=(n:number)=>`${BASE}tile_${String(n).padStart(4,'0')}.png`;

/** 稳定散列：同一格、同一单位每次都取同一张图。 */
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};

/** 地面：以 48 为主，少量带纹理的变体。 */
export function pixelFloor(x:number,y:number){
 const r=hash(`${x},${y}`)%20;
 return pixelTile(r<12?48:r<15?49:r<17?50:r<19?51:42);
}
/** 障碍物：这套素材没有树，按地牢语义替换（柱子 / 砖墙 / 木桶）。 */
export const PIXEL_DRESSING:Record<string,{tile:number;label:string}>={
 tree:{tile:57,label:'石柱'},rocks:{tile:40,label:'砖墙'},boulder:{tile:82,label:'木桶'},
};
const ENEMY_TILES=[111,109,110,121,122,123,108];
export function pixelUnitTile(unit:Pick<TacticalUnitView,'id'|'side'|'name'>){
 if(unit.side==='hero')return /暗器|dagger/i.test(unit.name)?112:97;
 return ENEMY_TILES[hash(unit.id)%ENEMY_TILES.length];
}
export const PIXEL_PET_TILE=120;
