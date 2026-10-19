import type {GearQuality} from '../../../packages/contracts/index.ts';
import {qualityColors} from './components/gear-metadata.ts';

// HEX rune icons (U-07): hexagon plate + mechanic glyph, hand-inked like the rune marks elsewhere.
// Glyphs cover the 12 first-batch mechanics (design.md §3); content icon keys map onto them.
export const hexGlyphs=['chain','quake','mark','reaper','thorns','spring','frost','phantom','rift','sigil','siphon','echo'] as const;
export type HexGlyph=typeof hexGlyphs[number];

// Content-pack `icon` key → glyph. Only the HEX-01 sample is real data; batch keys get added with B03.
const iconGlyphs:Record<string,HexGlyph>={'hex-chain-lightning':'chain'};
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
const fallbackGlyph='<path d="M25 15v20M17 21l16 8M17 29l16-8" fill="none"/>';

// Pointy-top hexagon in a 50×50 box; outer plate takes the quality colour, inner plate stays parchment.
const outer='M25 2 45 13.5v23L25 48 5 36.5v-23Z',inner='M25 7 40.5 16v18L25 43 9.5 34V16Z';
export function hexRuneIconSvg(glyph:HexGlyph|undefined,quality:GearQuality,label?:string){
 const color=qualityColors[quality]??qualityColors.common;
 const a11y=label?`role="img" aria-label="${label.replace(/[&<>"]/g,'')}"`:'aria-hidden="true"';
 return `<svg class="hex-rune-icon quality-${quality}" viewBox="0 0 50 50" ${a11y} focusable="false" style="--quality-glyph:${color}" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${outer}" fill="${color}"/><path d="${inner}" fill="var(--color-icon-paper)" stroke-width="1.5"/>${glyph?glyphPaths[glyph]:fallbackGlyph}</svg>`;
}
