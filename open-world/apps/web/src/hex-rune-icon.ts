import type {GearQuality} from '../../../packages/contracts/index.ts';
import {qualityColors} from './quality-colors.ts';

// HEX rune icons (U-07): hexagon plate + mechanic glyph, hand-inked like the rune marks elsewhere.
// Glyphs cover the 12 first-batch mechanics (design.md §3); content icon keys map onto them.
export const hexGlyphs=['chain','quake','mark','reaper','thorns','spring','frost','phantom','rift','sigil','siphon','echo',
 'star-shards','cast-echo','last-stand','riposte','shadow-veil','cornered-will',
 'bee-volley','cast-hit-relay','control-to-shield','footfall-heal','cycle-reset','awakening-quest','mark-relay','undying-grip','dark-harvest','first-blood','fearless-soul','fury-undying','endless-devour','spellflow','missile-escalation','prism-bolt','quantum-slash','pinball-mark',
 'freeze-pulse','gravity-well','silence-touch','petrify-gaze','terror-wave',
 'dash-embers','kinetic-charge','landing-quake','blink-strike','phase-swap',
 'mana-surge','blood-contract','free-incantation','finisher-refund',
 'weak-point','plague-spread','lingering-flame','shatter-ice','executioner','pair-resonance','knockback-wave','void-servant','stack-burst','decoy',
] as const;
export type HexGlyph=typeof hexGlyphs[number];

// Content-pack `icon` key → glyph. Real data so far: HEX-01 chain, A2 aftershock, S1 sigil; batch keys get added with B03.
const iconGlyphs:Record<string,HexGlyph>={
 'hex-chain-lightning':'chain','hex-aftershock':'quake','hex-detonation-sigil':'sigil',
 // reuse entries (11 total, 2 already above)
 'hex-storm-reaper':'reaper','hex-void-rift':'rift','hex-thorned-heart':'thorns','hex-overflow-spring':'spring',
 'hex-frost-armor':'frost','hex-phantom-step':'phantom','hex-mana-siphon':'siphon','hex-resonance-echo':'echo','hex-hunter-mark':'mark',
 // markup entries (48 new glyphs)
 'hex-star-shards':'star-shards','hex-cast-echo':'cast-echo',
 'hex-last-stand':'last-stand','hex-riposte':'riposte','hex-shadow-veil':'shadow-veil','hex-cornered-will':'cornered-will',
 'hex-bee-volley':'bee-volley','hex-cast-hit-relay':'cast-hit-relay','hex-control-to-shield':'control-to-shield','hex-footfall-heal':'footfall-heal','hex-cycle-reset':'cycle-reset','hex-awakening-quest':'awakening-quest','hex-mark-relay':'mark-relay','hex-undying-grip':'undying-grip','hex-dark-harvest':'dark-harvest','hex-first-blood':'first-blood','hex-fearless-soul':'fearless-soul','hex-fury-undying':'fury-undying','hex-endless-devour':'endless-devour','hex-spellflow':'spellflow','hex-missile-escalation':'missile-escalation','hex-prism-bolt':'prism-bolt','hex-quantum-slash':'quantum-slash','hex-pinball-mark':'pinball-mark',
 'hex-freeze-pulse':'freeze-pulse','hex-gravity-well':'gravity-well','hex-silence-touch':'silence-touch','hex-petrify-gaze':'petrify-gaze','hex-terror-wave':'terror-wave',
 'hex-dash-embers':'dash-embers','hex-kinetic-charge':'kinetic-charge','hex-landing-quake':'landing-quake','hex-blink-strike':'blink-strike','hex-phase-swap':'phase-swap',
 'hex-mana-surge':'mana-surge','hex-blood-contract':'blood-contract','hex-free-incantation':'free-incantation','hex-finisher-refund':'finisher-refund',
 'hex-weak-point':'weak-point','hex-plague-spread':'plague-spread','hex-lingering-flame':'lingering-flame','hex-shatter-ice':'shatter-ice','hex-executioner':'executioner','hex-pair-resonance':'pair-resonance','hex-knockback-wave':'knockback-wave','hex-void-servant':'void-servant','hex-stack-burst':'stack-burst','hex-decoy':'decoy',
};
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
 'star-shards':'<path d="M25 19 28 24 34 25 29 29 30 35 25 32 20 35 21 29 16 25 22 24Z" fill="var(--quality-glyph)"/><path d="M25 12 23 16M12 18 16 21M38 18 34 21" fill="none"/>',
 'cast-echo':'<path d="M14 21 20 25 14 29Z" fill="var(--quality-glyph)"/><path d="M23 17Q33 25 23 33M29 12Q39 25 29 38" fill="none"/>',
 'last-stand':'<path d="M22 23H28V37H22Z" fill="var(--quality-glyph)"/><path d="M13 14 35 30M12 32H18M32 36H38M16 38H34M29 12 35 18M35 12 29 18" fill="none"/>',
 'riposte':'<path d="M14 16 25 13 28 25 20 32 13 27Z" fill="var(--quality-glyph)"/><path d="M22 24H37M32 19 37 24 32 29M29 30 25 37" fill="none"/>',
 'shadow-veil':'<path d="M34 13Q20 17 29 36Q13 34 14 24Q15 15 26 13Z" fill="var(--quality-glyph)"/><path d="M34 23Q38 26 35 31M30 37H37M12 18H16" fill="none"/>',
 'cornered-will':'<path d="M15 20V14H20V20H29V14H34V32H15Z" fill="var(--quality-glyph)"/><path d="M12 37H38M12 34H18M24 23V29M21 26H27" fill="none"/>',
 'bee-volley':'<ellipse cx="25" cy="27" rx="5" ry="7" fill="var(--quality-glyph)"/><path d="M22 22Q12 12 13 23L20 27M28 22Q38 12 37 23L30 27M21 27H29M22 31H28M25 34V38M21 17 19 13M29 17 31 13" fill="none"/>',
 'cast-hit-relay':'<circle cx="18" cy="19" r="5" fill="var(--quality-glyph)"/><path d="M29 16H36V23M36 16 30 22M33 27 25 37M29 27 35 31M20 35H13V28M13 35 19 29" fill="none"/>',
 'control-to-shield':'<path d="M26 25 37 27V32Q35 36 31 38Q27 36 26 32Z" fill="var(--quality-glyph)"/><path d="M18 13V18M13 18H23M13 13V25Q18 31 23 25V13M19 32 23 34" fill="none"/>',
 'footfall-heal':'<path d="M29 30Q29 18 38 17Q38 29 29 30Z" fill="var(--quality-glyph)"/><path d="M16 17Q20 16 21 21L20 28Q16 31 13 27L13 23ZM14 34Q18 31 20 35L20 38H14ZM27 37 32 25" fill="none"/>',
 'cycle-reset':'<path d="M20 30 25 25 30 30V34H20Z" fill="var(--quality-glyph)"/><path d="M18 13H32M18 37H32M20 13V19L30 30V37M30 13V19L20 30V37M14 20Q11 25 14 30M36 30Q39 25 36 20" fill="none"/>',
 'awakening-quest':'<path d="M17 19Q25 12 33 19Q25 26 17 19Z" fill="var(--quality-glyph)"/><path d="M13 37H20V32H27V27H36M25 16V22M15 12 18 14M35 12 32 14" fill="none"/>',
 'mark-relay':'<path d="M20 16H29V25H20Z" fill="var(--quality-glyph)"/><path d="M13 12V20H17M25 25V33H37M33 29 37 33 33 37M13 28V37H22" fill="none"/>',
 'undying-grip':'<path d="M25 23Q20 17 18 22Q17 26 25 31Q33 26 32 22Q30 17 25 23Z" fill="var(--quality-glyph)"/><path d="M13 26V19M17 18V14M22 16V12M28 16V13M36 21V29Q35 37 25 38Q16 37 13 31" fill="none"/>',
 'dark-harvest':'<path d="M28 15Q38 13 37 23L33 21 29 24 28 20Z" fill="var(--quality-glyph)"/><path d="M14 37 25 15Q17 12 13 23M21 34Q28 37 33 30M24 28H30" fill="none"/>',
 'first-blood':'<path d="M28 22Q36 30 32 34Q28 38 24 34Q20 30 28 22Z" fill="var(--quality-glyph)"/><path d="M13 13H37V17H13ZM16 34 31 19M12 30 19 37" fill="none"/>',
 'fearless-soul':'<path d="M18 31V24L21 21 24 24 27 20 30 23 33 22 36 26 32 35H22Z" fill="var(--quality-glyph)"/><path d="M14 30Q11 20 18 14M18 14H13M18 14V19M24 12V16M31 13 29 17" fill="none"/>',
 'fury-undying':'<path d="M24 13Q29 22 33 17Q39 29 30 36Q32 29 26 26Q26 33 20 36Q11 29 19 20Q18 27 24 13Z" fill="var(--quality-glyph)"/><path d="M12 37H20L24 32 27 37H38" fill="none"/>',
 'endless-devour':'<path d="M13 20Q15 36 29 37L24 31 29 27 20 26 22 21Z" fill="var(--quality-glyph)"/><circle cx="33" cy="16" r="4" fill="none"/><path d="M37 24 31 26M24 13 26 18" fill="none"/>',
 'spellflow':'<path d="M16 33 28 18 37 15 32 25 23 34Z" fill="var(--quality-glyph)"/><path d="M13 20Q17 14 23 15M12 27Q16 21 21 22M25 37 33 30M23 29 30 22" fill="none"/>',
 'missile-escalation':'<path d="M12 32 17 27 17 37Z" fill="var(--quality-glyph)"/><path d="M22 26 27 21V31ZM32 20 37 15V25ZM12 23H17M22 17H27M32 12H37M22 36H27M32 30H37" fill="none"/>',
 'prism-bolt':'<path d="M23 17 31 25 23 33 18 25Z" fill="var(--quality-glyph)"/><path d="M12 22H17M12 28H17M32 18 36 14M33 25H38M32 32 36 36M23 17V33" fill="none"/>',
 'quantum-slash':'<path d="M25 12Q38 13 38 25Q36 19 29 18Z" fill="var(--quality-glyph)"/><path d="M36 29Q30 38 18 35Q11 29 14 19M18 18 32 32M18 25H25V32" fill="none"/>',
 'pinball-mark':'<circle cx="34" cy="33" r="4" fill="var(--quality-glyph)"/><path d="M13 14 31 18 15 30 29 33M27 14 31 18 26 21" fill="none"/><circle cx="14" cy="14" r="2" fill="none"/><circle cx="15" cy="30" r="2" fill="none"/>',
 'freeze-pulse':'<path d="M25 14 30 25 25 36 20 25Z" fill="var(--quality-glyph)"/><path d="M16 16Q11 25 16 34M34 16Q39 25 34 34M25 20V30" fill="none"/>',
 'gravity-well':'<circle cx="25" cy="25" r="3" fill="var(--quality-glyph)"/><path d="M29 25Q30 17 23 17Q14 17 15 27Q16 38 28 36Q39 34 37 22M12 17 18 15 17 21M32 13 35 18 29 18" fill="none"/>',
 'silence-touch':'<path d="M23 34V18Q26 14 29 18V29L33 26Q38 25 36 30L31 37H24Z" fill="var(--quality-glyph)"/><path d="M13 19Q18 22 13 25M15 13 35 13M20 18 14 30" fill="none"/>',
 'petrify-gaze':'<path d="M25 19 29 23 25 27 21 23Z" fill="var(--quality-glyph)"/><path d="M12 23Q25 11 38 23Q25 33 12 23ZM22 32 19 37M29 32 32 37M25 31V38" fill="none"/>',
 'terror-wave':'<path d="M20 15Q25 12 30 15L32 27 25 33 18 27Z" fill="var(--quality-glyph)"/><path d="M21 21 23 23M29 21 27 23M24 28H26M14 16Q11 25 14 33M36 16Q39 25 36 33" fill="none"/>',
 'dash-embers':'<path d="M27 18 32 20 31 29 38 32V36H25L24 29Z" fill="var(--quality-glyph)"/><path d="M14 34Q11 30 16 26Q15 31 20 31Q22 36 17 37M13 16H24M16 22H22" fill="none"/>',
 'kinetic-charge':'<path d="M27 13 37 18 33 25 23 20Z" fill="var(--quality-glyph)"/><path d="M28 23 19 37M13 31V37M17 26V31M21 21V26M12 18 18 13" fill="none"/>',
 'landing-quake':'<path d="M22 18H29V26L34 29V32H20V25Z" fill="var(--quality-glyph)"/><path d="M25 12V16M12 34 18 33 15 38M38 34 32 33 35 38M24 35 22 38M28 35 29 38" fill="none"/>',
 'blink-strike':'<path d="M33 20 35 26 38 28 35 30 33 36 31 30 27 28 31 26Z" fill="var(--quality-glyph)"/><path d="M12 21H18M22 21H26M12 31H16M21 31H23M22 15 26 21 22 26" fill="none"/>',
 'phase-swap':'<path d="M14 19Q19 13 23 19V29H14Z" fill="var(--quality-glyph)"/><path d="M28 25Q33 19 37 25V35H28ZM14 13H32L29 16M36 38H18L21 35" fill="none"/>',
 'mana-surge':'<path d="M22 31Q19 26 25 21Q31 26 28 31Z" fill="var(--quality-glyph)"/><path d="M20 13H30V18L35 26V35H15V26L20 18ZM12 20V14H16M38 29V36H34" fill="none"/>',
 'blood-contract':'<path d="M20 13Q30 25 25 31Q20 37 15 31Q11 25 20 13Z" fill="var(--quality-glyph)"/><path d="M29 17Q39 22 35 31L31 35M31 29V35H37M17 27 20 30" fill="none"/>',
 'free-incantation':'<path d="M25 24 29 29 25 34 21 29Z" fill="var(--quality-glyph)"/><path d="M25 18Q18 13 12 16V33Q18 30 25 36Q32 30 38 33V16Q32 13 25 18ZM25 18V21M16 20H20M30 20H34" fill="none"/>',
 'finisher-refund':'<path d="M29 12 36 15 31 25 27 22Z" fill="var(--quality-glyph)"/><path d="M28 25Q18 19 13 27Q11 36 20 38Q30 38 30 31M13 21V27H19M21 28V33L25 35" fill="none"/>',
 'weak-point':'<path d="M12 18 33 25 12 29 18 24Z" fill="var(--quality-glyph)"/><path d="M29 13 37 18V32L29 37M28 17 25 21M26 30 29 33" fill="none"/>',
 'plague-spread':'<circle cx="24" cy="25" r="5" fill="var(--quality-glyph)"/><path d="M20 21 16 16M28 21 34 16M24 30V35M21 24H25M25 24V27" fill="none"/><circle cx="14" cy="14" r="2" fill="none"/><circle cx="36" cy="14" r="2" fill="none"/><circle cx="24" cy="36" r="2" fill="none"/>',
 'lingering-flame':'<path d="M13 26Q16 20 24 23L32 17 30 24 38 22Q33 32 24 30Q17 34 13 26Z" fill="var(--quality-glyph)"/><path d="M15 16H24M15 12H20M19 34V38M27 33V36M35 30V34" fill="none"/>',
 'shatter-ice':'<path d="M18 19 25 15 32 20 31 30 24 35 18 30Z" fill="var(--quality-glyph)"/><path d="M25 16 22 23 28 26 24 34M12 13 15 16M35 13 33 16M12 34 15 31M38 35 34 32" fill="none"/>',
 'executioner':'<path d="M21 14Q31 12 37 20L31 27Q27 20 21 21Z" fill="var(--quality-glyph)"/><path d="M24 13 16 33M12 37H38M12 34H18M21 30 26 34" fill="none"/>',
 'pair-resonance':'<path d="M13 18 20 14 25 18V29L20 33 13 29Z" fill="var(--quality-glyph)"/><path d="M27 18 33 14 38 18V29L33 33 27 29ZM20 22H33M20 26H33M21 37H32" fill="none"/>',
 'knockback-wave':'<path d="M13 18 18 15V35L13 32Z" fill="var(--quality-glyph)"/><path d="M22 18Q28 25 22 32M28 15Q37 25 28 35M33 25H38M35 21 38 25 35 29" fill="none"/>',
 'void-servant':'<path d="M20 26 25 20 30 26 32 37H18Z" fill="var(--quality-glyph)"/><circle cx="25" cy="16" r="4" fill="none"/><path d="M14 21Q11 28 14 36M36 21Q39 28 36 36M33 29 36 25" fill="none"/>',
 'stack-burst':'<path d="M17 30 25 34 33 30 33 35 25 38 17 35Z" fill="var(--quality-glyph)"/><path d="M17 24 25 28 33 24M17 18 25 22 33 18M25 12V17M13 13 18 17M37 13 32 17" fill="none"/>',
 'decoy':'<path d="M19 21H31L33 29 25 33 17 29Z" fill="var(--quality-glyph)"/><circle cx="25" cy="16" r="4" fill="none"/><path d="M13 24H37M25 33V38M15 37 21 34M35 37 29 34M13 16 17 19" fill="none"/>',
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
 return `<svg data-pixel-icon="hex:${glyph??categoryGlyph??'generic'}" class="hex-rune-icon quality-${quality}" viewBox="0 0 50 50" ${a11y} focusable="false" style="--quality-glyph:${color}" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${outer}" fill="${color}"/><path d="${inner}" fill="var(--color-icon-paper)" stroke-width="1.5"/>${glyph?glyphPaths[glyph]:categoryGlyph?categoryPaths[categoryGlyph]:fallbackGlyph}</svg>`;
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
