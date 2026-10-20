import manifest from '../../../packages/asset-manifest/ui.v2.json';
import {hexRuneDataUri} from './hex-rune-icon.ts';

type Asset = {kind: string; path: string; size: number[]; sha256: string; icon?:{path:string;size:number[];sha256:string}};
type Manifest = {version: string; chrome: string; colors: Record<string, string>; assets: Record<string, Asset>};

const data = manifest as Manifest;
// Collection equipment uses its stable gear-base ID to resolve the same artwork
// in inventory, equipment, travel previews and transparent ground loot.
/** Single resolver for the game and the showcase. Paths come only from ui.v2.json. */
export function art(id: string): string {
  const item = data.assets[id];
  // HEX runes are drawn in code (hex-rune-icon.ts), not shipped as manifest art.
  if (!item?.path && id.startsWith('gear-hex-')) return hexRuneDataUri(id.slice(5));
  if (!item?.path) throw new Error(`缺少界面资源：${id}`);
  return item.path;
}

/** For content whose artwork may still be pending (e.g. new crafting materials); callers pick a fallback. */
export function hasArt(id:string):boolean{return Boolean(data.assets[id]?.path);}

export function artSize(id: string): [number, number] {
  const item = data.assets[id];
  if (!item) throw new Error(`缺少界面资源：${id}`);
  return [item.size[0], item.size[1]];
}

/** Pre-filtered small artwork, generated from the same approved transparent source. */
export function smallArt(id:string):string {
  const item=data.assets[id];
  if(!item?.icon)throw new Error(`缺少小尺寸道具资源：${id}`);
  return item.icon.path;
}

/** Every published skill has its own formal artwork, checked during content validation. */
export function skillArt(id:string):string{
  return art('skill-'+id);
}

export const uiColors = data.colors;
export const uiManifestVersion = data.version;
