import {resolvedToken} from './tokens.ts';

/** Canvas text must wait for the bundled font, then rasterize above display size. */
export async function loadWorldFont(){
  await Promise.all((['Font.Weight.Regular','Font.Weight.Medium','Font.Weight.Semibold'] as const).map(weight=>
    document.fonts.load(`${resolvedToken(weight)} ${resolvedToken('Font.Size.Body')} WorldSans`,'深渊行者装备')));
}
export const worldTextResolution=()=>Math.max(2,Math.min(3,window.devicePixelRatio||1));
