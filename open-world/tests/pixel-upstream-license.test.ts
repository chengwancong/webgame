import {it,expect} from 'vitest';
// @ts-expect-error Production art pipeline is directly executable ESM.
import {validPixelLicense} from '../tools/pixel/upstream-license.mjs';
it('keeps the reviewed game-use free pack distinct from CC0 and rejects unreviewed custom packs',()=>{
 const source={license:'LicenseRef-PixelFrog-GameUse',author:'Pixel Frog',package:'Tiny Swords Free Pack, upload 15971141',url:'https://pixelfrog-assets.itch.io/tiny-swords',archiveSha256:'764a511f6cd5d0b844d93dc02cf39f9ea3f5f3b9b0f19afbba2dfab6bd2a0464'};
 expect(validPixelLicense(source)).toBe(true);
 expect(validPixelLicense({...source,archiveSha256:'a'.repeat(64)})).toBe(false);
 expect(validPixelLicense({...source,package:'Enemy Pack'})).toBe(false);
 expect(validPixelLicense({license:'free download'})).toBe(false);
 expect(validPixelLicense({license:'CC0-1.0'})).toBe(true);
});
