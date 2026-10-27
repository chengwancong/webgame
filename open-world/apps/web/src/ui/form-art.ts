/** Decoration for native form controls. Values, focus and interaction remain HTML-owned. */
export type FormArtKind='field'|'toggle'|'range'|'chevron';
export const staticFormArtKinds=['chevron'] as const;
const accent='var(--form-accent,var(--color-border-strong))';
const line='stroke-width="var(--border-width)" vector-effect="non-scaling-stroke"';
const edge='stroke-width="var(--border-edge)" vector-effect="non-scaling-stroke"';
const shapes:Record<FormArtKind,{box:string;body:string}>={
 field:{box:'0 0 240 36',body:`
  <path d="M13 5h214q8 0 8 8v10q0 8-8 8H13q-8 0-8-8V13q0-8 8-8Z" fill="none" stroke="${accent}" ${line}/>
  <path d="M14 8h31m6 0h8M228 13v6" fill="none" stroke="var(--color-panel-raised)" ${edge}/>`},
 toggle:{box:'0 0 44 24',body:`
  <path d="M12 3h20a9 9 0 0 1 0 18H12a9 9 0 0 1 0-18Z" fill="none" stroke="${accent}" ${line}/>
  <path d="M11 5h19" fill="none" stroke="var(--color-panel-raised)" ${line}/>
  <path d="m8 12 3 3 5-6M29 12h6" fill="none" stroke="var(--color-text-primary)" ${line}/>`},
 range:{box:'0 0 240 12',body:`
  <rect x="1" y="2" width="238" height="8" rx="4" fill="var(--color-panel-inset)" stroke="${accent}" ${line}/>
  <path d="M6 4h228" fill="none" stroke="var(--color-panel-raised)" ${line}/>
  <path d="M7 8h226" fill="none" stroke="var(--color-border-subtle)" ${line}/>`},
 chevron:{box:'0 0 16 16',body:`
  <path d="m3 5 5 6 5-6" fill="none" stroke="${accent}" ${edge}/>
  <path d="m5 5 3 3 3-3" fill="none" stroke="var(--color-panel-raised)" ${line}/>`},
};
export function formArtHtml(kind:FormArtKind):string{
 const art=shapes[kind];
 return `<svg${kind==='chevron'?' data-pixel-icon="inline:form:chevron"':''} xmlns="http://www.w3.org/2000/svg" class="ui-form-art ui-form-art--${kind}" viewBox="${art.box}" preserveAspectRatio="${kind==='field'||kind==='range'?'none':'xMidYMid meet'}" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round">${art.body}</svg>`;
}
