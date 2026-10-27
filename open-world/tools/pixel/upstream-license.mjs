/** Permit only explicitly reviewed sources; a free download must not be mislabeled CC0. */
export function validPixelLicense(upstream){
 if(upstream?.license==='CC0-1.0')return true;
 return upstream?.license==='LicenseRef-PixelFrog-GameUse'&&upstream.author==='Pixel Frog'&&upstream.package==='Tiny Swords Free Pack, upload 15971141'&&upstream.url==='https://pixelfrog-assets.itch.io/tiny-swords'&&upstream.archiveSha256==='764a511f6cd5d0b844d93dc02cf39f9ea3f5f3b9b0f19afbba2dfab6bd2a0464';
}
