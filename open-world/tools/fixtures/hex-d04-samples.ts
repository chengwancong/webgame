/** Test/tool selector after D05 promotion. Runtime hex-runes.json is the only source. */
import {hexRunes} from '../../packages/content/hex-runes.ts';
export const hexD04Samples=['hex-aftershock','hex-detonation-sigil'].map(id=>{
 const rune=hexRunes.find(r=>r.id===id);if(!rune)throw Error('Missing D05 sample '+id);return rune;
});
