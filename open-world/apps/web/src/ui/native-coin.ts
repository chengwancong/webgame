import native from '../../../../packages/asset-manifest/apk-native-ui.json';
import {resolvedToken} from './tokens.ts';
/** Native motion only reflects server-confirmed wallet changes; it cannot award gold. */
export function nativeCoinHtml(){return `<span class="apk-native-coin" aria-hidden="true"><img src="${native.image}" alt="" draggable="false" style="--apk-frame-count:${native.frames}" width="${native.frames*native.cell}" height="${native.cell}"></span>`;}
export function updateNativeCoin(wallet:HTMLElement,gold:number,reduced:boolean){
 const previous=wallet.dataset.balance,image=wallet.querySelector<HTMLImageElement>('.apk-native-coin img');wallet.dataset.balance=String(gold);if(!image)return;
 if(reduced||matchMedia('(prefers-reduced-motion:reduce)').matches){image.getAnimations().forEach(a=>a.cancel());return;}
 if(previous===undefined||!Number.isFinite(gold)||gold<=Number(previous))return;
 image.getAnimations().forEach(a=>a.cancel());
 image.animate([{transform:'translateX(0)'},{transform:'translateX(-100%)'}],{duration:parseFloat(resolvedToken('Motion.NativeCoinCycle')),easing:`steps(${native.frames},end)`,iterations:1});
}
