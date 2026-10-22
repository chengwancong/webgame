import {test,expect} from 'vitest';
import {hexGlyphForCategory,hexGlyphForIcon,hexRuneIconSvg,hexCategoryGlyphs} from '../apps/web/src/hex-rune-icon.ts';

const body=(svg:string)=>svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');

test('六类各有不同的类别占位字形，未登记 icon + 类别走类别字形',()=>{
 const legacy=body(hexRuneIconSvg(undefined,'common'));
 const bodies=hexCategoryGlyphs.map(c=>body(hexRuneIconSvg(hexGlyphForIcon('hex-unregistered'),'common',undefined,c)));
 expect(new Set(bodies).size).toBe(6);
 for(const b of bodies){expect(b).not.toBe(legacy);expect(b).toContain('var(--quality-glyph)');}
});
test('别名与未知类别：survival→defense，未知/缺省回到旧 fallback',()=>{
 expect(hexGlyphForCategory('survival')).toBe('defense');
 expect(hexGlyphForCategory('weird')).toBeUndefined();expect(hexGlyphForCategory(undefined)).toBeUndefined();
 const legacy=hexRuneIconSvg(undefined,'rare');
 expect(hexRuneIconSvg(undefined,'rare',undefined,'weird')).toBe(legacy);
});
test('已登记 icon 不受类别影响',()=>{
 const g=hexGlyphForIcon('hex-chain-lightning');expect(g).toBe('chain');
 expect(hexRuneIconSvg(g,'magic','x','defense')).toBe(hexRuneIconSvg(g,'magic','x'));
});
