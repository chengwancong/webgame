import type {Gear,GearQuality,Snapshot} from '../../../packages/contracts/index.ts';
import type {HexActive} from '../../../packages/contracts/hex-runes.ts';
import {hexBadgeSvg} from './hex-rune-icon.ts';
import type {SlotMark} from './ui/graphics.ts';
import {hexInactiveReasonText,renderHexAffixRow,type HexRuneView} from './hex-rune-tip.ts';
import {esc} from './ui-components.ts';
import {qualityLabels} from './components/gear-metadata.ts';

// HEX is an affix on ordinary gear (d13): `gear.hex = {rune,tier}`. Whether it takes effect (duplicate / same exclusive group)
// is decided by the server and published as snapshot.hexActive; the client only looks the verdict up and never recomputes it.
export type HexAffixView={runeId:string;tier:GearQuality;active:boolean;reason?:string;rune?:HexRuneView;/** true when the server listed this gear in hexActive (i.e. it is worn). */worn:boolean};

export function hexCatalogById(runes:readonly HexRuneView[]|undefined){return Object.fromEntries((runes??[]).map(rune=>[rune.id,rune])) as Record<string,HexRuneView>;}

/** HEX affix of a gear piece with the server's active verdict; undefined when the piece carries no HEX. Unworn gear has no verdict yet, so it is shown as neutral (active) rather than guessed. */
export function hexAffixOf(gear:Pick<Gear,'id'|'hex'>,hexActive:readonly HexActive[]|undefined,catalog:Record<string,HexRuneView>):HexAffixView|undefined{
 const hex=gear.hex;if(!hex)return undefined;
 const entry=hexActive?.find(item=>item.gear===gear.id);
 return {runeId:hex.rune,tier:hex.tier,active:entry?entry.active:true,reason:entry?.reason,rune:Object.hasOwn(catalog,hex.rune)?catalog[hex.rune]:undefined,worn:Boolean(entry)};
}

/** Resonance multiplier published by the server (hexActive[].resonance > 1 on active entries); undefined when none. */
export function hexResonanceOf(hexActive:readonly HexActive[]|undefined){
 const scale=Math.max(1,...(hexActive??[]).filter(item=>item.active).map(item=>item.resonance??1));
 return scale>1?scale:undefined;
}

// Equipment tips are rendered from a server tip payload without the snapshot; presentation keeps this context current.
let context:{catalog:Record<string,HexRuneView>;hexActive?:readonly HexActive[]}={catalog:{}};
export function setHexContext(catalog:Record<string,HexRuneView>,hexActive:readonly HexActive[]|undefined){context={catalog,hexActive};}
export function hexContext(){return context;}

/** HEX row for equipment tips and detail cards; empty for gear without a HEX. Pass the snapshot's hexActive, or omit to use the synced context. */
export function hexAffixSectionHtml(gear:Pick<Gear,'id'|'hex'>,hexActive:readonly HexActive[]|undefined=context.hexActive){
 const hex=hexAffixOf(gear,hexActive,context.catalog);
 return hex?renderHexAffixRow(hex.rune,hex.tier,{active:hex.active,reason:hex.reason,fallbackName:hex.runeId}):'';
}

/** Corner badge for a slot / bag cell; empty when the gear carries no HEX. */
export function hexMarks(gear:Pick<Gear,'id'|'hex'>,snapshot:Pick<Snapshot,'hexActive'>):SlotMark[]{
 const hex=hexAffixOf(gear,snapshot.hexActive,context.catalog);
 return hex?[{corner:'tr',kind:'hex',label:hex.active?'带海克斯词缀':'海克斯词缀未生效',iconHtml:hexBadgeSvg(hex.tier,hex.active)}]:[];
}

export type HexPreviewChange={gear:string;rune:string;tier:GearQuality;change:'activate'|'deactivate'|'unchanged';reason?:string};
const changeText={activate:'将生效',deactivate:'将失效',unchanged:'不变'} as const;
/** Compare block for the equip quote: shows only the server's changes (no client-side dedupe). Empty when the server sent no hexPreview. */
export function hexPreviewHtml(preview:{changes:readonly HexPreviewChange[]}|undefined,catalog:Record<string,HexRuneView>=context.catalog){
 if(!preview?.changes.length)return '';
 const rows=preview.changes.map(item=>{
  const rune=Object.hasOwn(catalog,item.rune)?catalog[item.rune]:undefined,name=rune?.name??item.rune,need=rune?.tiers[item.tier]?.requiredLevel;
  const why=item.change!=='deactivate'?'':hexInactiveReasonText(item.reason,need);
  return `<li class="hex-preview-row is-${item.change}" data-change="${item.change}"><b class="quality-${item.tier}">${esc(name)} <small>${qualityLabels[item.tier]}</small></b><span class="hex-preview-state">${changeText[item.change]}${why?'：'+esc(why):''}</span></li>`;
 }).join('');
 return `<section class="hex-preview" aria-label="六角印变化"><h4>六角印变化</h4><ul>${rows}</ul></section>`;
}
