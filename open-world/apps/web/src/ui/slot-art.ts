/** Small inner guides only. Existing E7 quality frames and item artwork stay intact. */
export type SlotArtKind='empty'|'tip';
const stroke='stroke="var(--color-border-strong)" stroke-width="var(--border-width)" vector-effect="non-scaling-stroke"';
const highlight='stroke="var(--color-primary-top)" stroke-width="var(--border-edge)" vector-effect="non-scaling-stroke"';
const art:Record<SlotArtKind,{viewBox:string;body:string}>={
 empty:{viewBox:'0 0 64 64',body:`
  <path d="M7 20v-8q0-5 5-5h8m24 0h8q5 0 5 5v8M7 44v8q0 5 5 5h8m24 0h8q5 0 5-5v-8" ${stroke}/>
  <path d="M12 10h7m26 44h7" ${highlight}/>
  <path d="M27 7h10m-10 50h10" ${stroke}/>`},
 tip:{viewBox:'0 0 320 180',body:`
  <path d="M5 23V12q0-7 7-7h16m264 0h16q7 0 7 7v11M5 157v11q0 7 7 7h16m264 0h16q7 0 7-7v-11" ${stroke}/>
  <path d="M13 9h14m266 162h14" ${highlight}/>`},
};
export function slotArtHtml(kind:SlotArtKind){const item=art[kind];return `<svg xmlns="http://www.w3.org/2000/svg" class="ui-slot-art ui-slot-art--${kind}" viewBox="${item.viewBox}" preserveAspectRatio="none" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round">${item.body}</svg>`;}
