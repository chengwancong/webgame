/** Static marks inside the shared graphic controls. Numbers and actions remain native HTML. */
export type GraphicArtKind='pip'|'diamond-pip'|'bar-pip'|'meter'|'empty-slot'|'timer'|'page'|'page-prev'|'page-next'|'help';
export const staticGraphicArtKinds=['empty-slot','timer','page-prev','page-next','help'] as const;
const fine='stroke-width="var(--border-width)" vector-effect="non-scaling-stroke"';
const edge='stroke-width="var(--border-edge)" vector-effect="non-scaling-stroke"';
const pipFill='var(--graphic-pip-fill,var(--color-panel-raised))';
const pipLine='var(--graphic-pip-line,var(--color-border-strong))';
const artwork:Record<GraphicArtKind,{viewBox:string;body:string}>={
 pip:{viewBox:'0 0 24 24',body:`<circle cx="12" cy="12" r="9" fill="${pipFill}" stroke="${pipLine}" ${fine}/><path d="M7 9q2-4 6-3" fill="none" stroke="var(--color-bevel-light)" ${fine}/>`},
 'diamond-pip':{viewBox:'0 0 24 24',body:`<path d="m12 2 10 10-10 10L2 12Z" fill="${pipFill}" stroke="${pipLine}" ${fine}/><path d="m6 12 6-6 4 4" fill="none" stroke="var(--color-bevel-light)" ${fine}/>`},
 'bar-pip':{viewBox:'0 0 32 16',body:`<rect x="1" y="1" width="30" height="14" rx="4" fill="${pipFill}" stroke="${pipLine}" ${fine}/><path d="M5 4h19" fill="none" stroke="var(--color-bevel-light)" ${fine}/>`},
 meter:{viewBox:'0 0 240 16',body:`<path d="M8 2h224q6 0 6 6t-6 6H8q-6 0-6-6t6-6Z" fill="none" stroke="var(--color-border-strong)" ${fine}/><path d="M10 4h220" fill="none" stroke="var(--color-bevel-light)" ${fine}/><path d="M6 7v2m228-2v2" fill="none" stroke="var(--meter-ink,var(--color-highlight))" ${fine}/>`},
 'empty-slot':{viewBox:'0 0 64 64',body:`<path d="M16 5H9q-4 0-4 4v7m43-11h7q4 0 4 4v7M5 48v7q0 4 4 4h7m32 0h7q4 0 4-4v-7" fill="none" stroke="var(--color-border-strong)" ${edge}/><path d="m32 12 20 20-20 20-20-20Z" fill="none" stroke="var(--color-border-subtle)" ${fine}/><path d="M11 22v-9q0-2 2-2h9" fill="none" stroke="var(--color-panel-raised)" ${fine}/>`},
 timer:{viewBox:'0 0 32 32',body:`<path d="M12 2h8v4h-8Z" fill="var(--color-primary-top)" stroke="var(--color-border-strong)" ${fine}/><circle cx="16" cy="18" r="12" fill="var(--color-panel-raised)" stroke="var(--color-primary-border)" ${fine}/><circle cx="16" cy="18" r="9" fill="var(--color-panel-selected)" stroke="var(--color-border-subtle)" ${fine}/><path d="M16 11v7l5 3" fill="none" stroke="currentColor" ${edge}/><path d="m6 6-2 2m22-2 2 2" fill="none" stroke="var(--color-primary-border)" ${fine}/>`},
 page:{viewBox:'0 0 24 24',body:`<path d="m12 2 8 4 2 6-2 6-8 4-8-4-2-6 2-6Z" fill="var(--graphic-page-fill,var(--color-panel-raised))" stroke="var(--graphic-page-line,var(--color-border-strong))" ${fine}/><path d="m6 10 6-4 4 2" fill="none" stroke="var(--color-bevel-light)" ${fine}/>`},
 'page-prev':{viewBox:'0 0 32 32',body:`<circle cx="16" cy="16" r="13" fill="var(--color-panel-raised)" stroke="var(--color-border-strong)" ${fine}/><path d="m18 9-7 7 7 7" fill="none" stroke="currentColor" ${edge}/>`},
 'page-next':{viewBox:'0 0 32 32',body:`<circle cx="16" cy="16" r="13" fill="var(--color-panel-raised)" stroke="var(--color-border-strong)" ${fine}/><path d="m14 9 7 7-7 7" fill="none" stroke="currentColor" ${edge}/>`},
 help:{viewBox:'0 0 32 32',body:`<circle cx="16" cy="16" r="13" fill="var(--color-panel-raised)" stroke="var(--color-primary-border)" ${fine}/><path d="M10 12c0-7 13-7 13 0 0 4-7 3-7 8" fill="none" stroke="var(--color-highlight)" ${edge}/><circle cx="16" cy="25" r="1.5" fill="var(--color-highlight)"/><path d="M7 8q4-4 8-4" fill="none" stroke="var(--color-primary-top)" ${fine}/>`},
};
export function graphicArtHtml(kind:GraphicArtKind){
 const art=artwork[kind];
 const pixel=(staticGraphicArtKinds as readonly GraphicArtKind[]).includes(kind)?` data-pixel-icon="inline:graphic:${kind}"`:'';
 return `<svg${pixel} xmlns="http://www.w3.org/2000/svg" class="ui-graphic-art ui-graphic-art--${kind}" viewBox="${art.viewBox}" preserveAspectRatio="${kind==='meter'||kind==='bar-pip'?'none':'xMidYMid meet'}" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round">${art.body}</svg>`;
}
