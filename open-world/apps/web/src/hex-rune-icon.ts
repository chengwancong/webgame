import type {GearQuality} from '../../../packages/contracts/index.ts';
import {qualityColors} from './quality-colors.ts';

// HEX rune icons (U-07): hexagon plate + mechanic glyph, hand-inked like the rune marks elsewhere.
// Glyphs cover the 12 first-batch mechanics (design.md §3); content icon keys map onto them.
export const hexGlyphs=['chain','quake','mark','reaper','thorns','spring','frost','phantom','rift','sigil','siphon','echo'] as const;
export type HexGlyph=typeof hexGlyphs[number];

// Content-pack `icon` key → glyph. Real data so far: HEX-01 chain, A2 aftershock, S1 sigil; batch keys get added with B03.
const iconGlyphs:Record<string,HexGlyph>={'hex-chain-lightning':'chain','hex-aftershock':'quake','hex-detonation-sigil':'sigil'};
export function hexGlyphForIcon(icon:string|undefined):HexGlyph|undefined{return icon?iconGlyphs[icon]:undefined;}

const ink='var(--color-chrome-ink)';
const glyphPaths:Record<HexGlyph,string>={
 chain:'<path d="m27 10-9 14h8l-6 16 13-19h-8l5-11Z" fill="var(--quality-glyph)"/><circle cx="13" cy="33" r="2.5"/><circle cx="37" cy="17" r="2.5"/>',
 quake:'<path d="M9 34h32" /><path d="m25 12-3 9 5 4-4 9m-9-4 4-6m16 6-4-7" fill="none"/><path d="m21 34 4-6 4 6Z" fill="var(--quality-glyph)"/>',
 mark:'<circle cx="25" cy="25" r="10" fill="none"/><circle cx="25" cy="25" r="3.5" fill="var(--quality-glyph)"/><path d="M25 9v7m0 18v7M9 25h7m18 0h7" fill="none"/>',
 reaper:'<path d="M15 39 33 13" fill="none"/><path d="M31 14q-12-3-17 6 8-3 14 1Z" fill="var(--quality-glyph)"/><path d="m22 31 8 4-4-8" fill="none"/>',
 thorns:'<path d="M25 37q-11-7-11-15 0-6 6-6 3 0 5 3 2-3 5-3 6 0 6 6 0 8-11 15Z" fill="var(--quality-glyph)"/><path d="m12 15-3-4m29 4 3-4M10 28l-4 1m34-1 4 1M25 37v5" fill="none"/>',
 spring:'<path d="M25 11q-10 12-10 19a10 10 0 0 0 20 0q0-7-10-19Z" fill="var(--quality-glyph)"/><path d="M21 30q0 4 4 5" fill="none"/>',
 frost:'<path d="M25 10v30M12 17l26 16M12 33l26-16" fill="none"/><path d="m21 13 4 4 4-4m-8 24 4-4 4 4" fill="none"/><circle cx="25" cy="25" r="3.5" fill="var(--quality-glyph)"/>',
 phantom:'<path d="M29 13q-9 0-11 11l-2 13 5-3 3 4 3-4 4 3-1-13q0-6-1-11Z" fill="var(--quality-glyph)"/><path d="M8 20h7M6 27h8M9 34h5" fill="none"/>',
 rift:'<ellipse cx="25" cy="25" rx="7" ry="13" fill="var(--quality-glyph)"/><path d="M14 16q-5 9 0 18m22-18q5 9 0 18" fill="none"/>',
 sigil:'<circle cx="25" cy="25" r="12" fill="none"/><path d="m25 15 3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="var(--quality-glyph)"/>',
 siphon:'<path d="M14 14q11 4 11 11t11 11" fill="none"/><path d="m31 37 5-1-1-5" fill="none"/><circle cx="15" cy="34" r="5" fill="var(--quality-glyph)"/><circle cx="35" cy="15" r="3"/>',
 echo:'<path d="M25 13a12 12 0 1 1-11 7" fill="none"/><path d="m11 14 3 6 6-2" fill="none"/><path d="M25 19v7l5 3" fill="none" stroke="var(--quality-glyph)" stroke-width="3"/>',
};
// Category placeholders (attack/defense/control/mobility/resource/synergy): used when a rune's icon key has no registered glyph yet.
export const hexCategoryGlyphs=['attack','defense','control','mobility','resource','synergy'] as const;
export type HexCategoryGlyph=typeof hexCategoryGlyphs[number];
const categoryAlias:Record<string,HexCategoryGlyph>={survival:'defense',sustain:'defense'};
const categoryPaths:Record<HexCategoryGlyph,string>={
 attack:'<path d="m25 9 5 21h-10Z" fill="var(--quality-glyph)"/><path d="M17 33h16M25 33v8" fill="none"/>',
 defense:'<path d="M25 10 37 15v9q0 10-12 16-12-6-12-16v-9Z" fill="var(--quality-glyph)"/><path d="M25 17v15" fill="none"/>',
 control:'<circle cx="25" cy="25" r="12" fill="none"/><path d="M25 13v24M13 25h24" fill="none"/><circle cx="25" cy="25" r="4" fill="var(--quality-glyph)"/>',
 mobility:'<path d="M10 25h20m-6-8 8 8-8 8" fill="none"/><path d="M12 17h9M12 33h9" fill="none"/><circle cx="37" cy="25" r="3" fill="var(--quality-glyph)"/>',
 resource:'<path d="M25 11 36 25 25 39 14 25Z" fill="var(--quality-glyph)"/><path d="M25 11v28M14 25h22" fill="none"/>',
 synergy:'<circle cx="19" cy="25" r="8" fill="var(--quality-glyph)"/><circle cx="31" cy="25" r="8" fill="none"/>',
};
/** Category key (case/alias tolerant) → placeholder glyph; undefined for unknown or missing categories. */
export function hexGlyphForCategory(category:string|undefined):HexCategoryGlyph|undefined{
 if(!category)return undefined;const k=categoryAlias[category]??category;
 return (hexCategoryGlyphs as readonly string[]).includes(k)?k as HexCategoryGlyph:undefined;
}
const fallbackGlyph='<path d="M25 15v20M17 21l16 8M17 29l16-8" fill="none"/>';

// Pointy-top hexagon in a 50×50 box; outer plate takes the quality colour, inner plate stays parchment.
const outer='M25 2 45 13.5v23L25 48 5 36.5v-23Z',inner='M25 7 40.5 16v18L25 43 9.5 34V16Z';
/** Unregistered icon (glyph undefined) falls back to the category placeholder when a category is known, else the old generic mark. */
export function hexRuneIconSvg(glyph:HexGlyph|undefined,quality:GearQuality,label?:string,category?:string){
 const color=qualityColors[quality]??qualityColors.common,categoryGlyph=glyph?undefined:hexGlyphForCategory(category);
 const a11y=label?`role="img" aria-label="${label.replace(/[&<>"]/g,'')}"`:'aria-hidden="true"';
 return `<svg class="hex-rune-icon quality-${quality}" viewBox="0 0 50 50" ${a11y} focusable="false" style="--quality-glyph:${color}" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${outer}" fill="${color}"/><path d="${inner}" fill="var(--color-icon-paper)" stroke-width="1.5"/>${glyph?glyphPaths[glyph]:categoryGlyph?categoryPaths[categoryGlyph]:fallbackGlyph}</svg>`;
}

/** Flat <img>-safe form for generic item slots (bag/loot/paperdoll resolve art by id); CSS variables can't reach into an <img>, so literals stand in and the slot's quality frame carries the rarity colour. */
export function hexRuneDataUri(icon:string|undefined){
 const svg=hexRuneIconSvg(hexGlyphForIcon(icon),'common').replace(/ style="[^"]*"/,'').replace(/xmlns=/,'').replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ')
  .replace(/var\(--color-chrome-ink\)/g,'#3a2a1a').replace(/var\(--quality-glyph\)/g,'#c9a24a').replace(/var\(--color-rarity-common\)/g,'#c9a24a').replace(/var\(--color-icon-paper\)/g,'#f4ead5');
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}

/** Small hexagon corner badge for paperdoll / bag cells; grey when the server says the HEX is not in effect. */
export function hexBadgeSvg(quality:GearQuality,active=true){
 const color=active?(qualityColors[quality]??qualityColors.common):'#9a9a9a';
 return `<svg class="hex-badge-icon${active?'':' is-inactive'}" viewBox="0 0 50 50" aria-hidden="true" focusable="false" fill="none" stroke="${ink}" stroke-width="3" stroke-linejoin="round"><path d="${outer}" fill="${color}"/><path d="${inner}" fill="var(--color-icon-paper)" stroke-width="2.5"/><path d="M25 15v20M17 21l16 8M17 29l16-8" stroke-width="3" stroke-linecap="round"/></svg>`;
}
