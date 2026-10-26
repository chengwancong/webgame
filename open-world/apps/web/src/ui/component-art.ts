/** Decorative vector surfaces only. Content, sizing and interaction stay caller-owned. */
export type ComponentArtKind='seal'|'title'|'resource'|'tag'|'control'|'tab'|'toast'|'panel'|'well'|'stat'|'status'|'divider';

const accent='var(--component-accent,var(--color-primary-border))';
const surface='var(--component-fill,var(--color-panel-raised))';
const border='stroke-width="var(--border-width)" vector-effect="non-scaling-stroke"';
const edge='stroke-width="var(--border-edge)" vector-effect="non-scaling-stroke"';

const artwork:Record<ComponentArtKind,{viewBox:string;body:string}>={
 panel:{viewBox:'0 0 240 160',body:`
  <path d="M10 30V15q0-5 5-5h35m140 0h35q5 0 5 5v15M10 130v15q0 5 5 5h35m140 0h35q5 0 5-5v-15" fill="none" stroke="var(--color-primary-border)" ${border}/>
  <path d="M17 30V17h23m160 0h23v13M17 130v13h23m160 0h23v-13" fill="none" stroke="var(--color-primary-top)" ${border}/>`},
 well:{viewBox:'0 0 200 100',body:`
  <path d="M9 24V13q0-4 4-4h20m134 0h20q4 0 4 4v11M9 76v11q0 4 4 4h20m134 0h20q4 0 4-4V76" fill="none" stroke="var(--color-border-strong)" ${border}/>
  <path d="M15 13h30m110 0h30M15 87h170" fill="none" stroke="var(--color-bevel-light)" ${border}/>`},
 stat:{viewBox:'0 0 160 64',body:`
  <path d="M8 19v-7q0-4 4-4h20m96 0h20q4 0 4 4v7M8 45v7q0 4 4 4h20m96 0h20q4 0 4-4v-7" fill="none" stroke="var(--color-primary-border)" ${border}/>
  <path d="M16 11h27m74 0h27M58 56h16m12 0h16" fill="none" stroke="var(--color-primary-top)" ${border}/>
  <path d="m80 53 3 3-3 3-3-3Z" fill="var(--color-primary-border)"/>`},
 status:{viewBox:'0 0 120 24',body:`
  <path d="M13 4h23m-28 4q2-4 5-4m94 12q-2 4-5 4H86" fill="none" stroke="var(--color-bevel-light)" ${border}/>`},
 divider:{viewBox:'0 0 240 8',body:`
  <path d="M2 4h107m22 0h107" fill="none" stroke="var(--color-border)" ${border}/>
  <path d="m115 4 5-3 5 3-5 3Z" fill="var(--color-primary-top)" stroke="var(--color-primary-border)" ${border}/>`},
 seal:{viewBox:'0 0 64 64',body:`
  <circle cx="32" cy="34" r="28" fill="var(--color-secondary-edge)"/>
  <circle cx="32" cy="31" r="28" fill="var(--color-panel-raised)" stroke="var(--color-primary-border)" ${edge}/>
  <circle cx="32" cy="31" r="23" fill="var(--color-panel-selected)" stroke="var(--color-primary-top)" ${border}/>
  <path d="M12 40a23 23 0 0 0 40 0 24 24 0 0 1-40 0Z" fill="var(--color-primary-top)"/>
  <path d="M13 21a22 22 0 0 1 26-11M44 13l3 2" fill="none" stroke="var(--color-panel-raised)" ${edge}/>
  <path d="M10 31v5m44-5v5" fill="none" stroke="var(--color-primary-border)" ${border}/>`},
 title:{viewBox:'0 0 240 48',body:`
  <path d="M10 5h208q6 0 10 6l11 16-11 15q-4 6-10 6H10q-8 0-8-8V13q0-8 8-8Z" fill="var(--component-edge,var(--color-primary-edge))"/>
  <path d="M10 2h208q6 0 10 6l11 16-11 15q-4 6-10 6H10q-8 0-8-8V10q0-8 8-8Z" fill="var(--component-fill,var(--color-primary-top))" stroke="var(--component-accent,var(--color-primary-border))" ${border}/>
  <path d="M10 28h216l-6 9q-2 3-7 3H10q-3 0-3-3v-9Z" fill="var(--component-low,var(--color-primary))"/>
  <path d="M12 7h200q6 0 9 5l7 12-7 11" fill="none" stroke="var(--color-ribbon-highlight)" ${border}/>
  <path d="M18 11h25m5 0h7" fill="none" stroke="var(--color-panel-raised)" ${edge}/>`},
 resource:{viewBox:'0 0 160 48',body:`
  <rect x="1" y="5" width="158" height="42" rx="21" fill="${accent}"/>
  <rect x="1" y="1" width="158" height="42" rx="21" fill="${surface}" stroke="${accent}" ${edge}/>
  <rect x="5" y="5" width="150" height="34" rx="17" fill="none" stroke="var(--color-border-subtle)" ${border}/>
  <path d="M22 7h112q10 0 16 8" fill="none" stroke="var(--color-panel-raised)" ${edge}/>
  <path d="M12 16q4-7 12-7h13m-13 28h112" fill="none" stroke="var(--color-bevel-light)" ${border}/>`},
 tag:{viewBox:'0 0 60 24',body:`
  <path d="M6 3h48l5 5v11l-5 5H6l-5-5V8Z" fill="${accent}"/>
  <path d="M6 1h48l5 5v11l-5 5H6l-5-5V6Z" fill="${surface}" stroke="${accent}" ${border}/>
  <path d="M8 4h44l4 4M8 18h44" fill="none" stroke="var(--color-bevel-light)" ${border}/>
  <path d="M11 6h12" fill="none" stroke="var(--color-panel-raised)" ${edge}/>`},
 // CSS owns button fill, state colours and depth. This is an inset engraving only.
 control:{viewBox:'0 0 200 48',body:`
  <path d="M14 5h172q9 0 9 9v20q0 9-9 9H14q-9 0-9-9V14q0-9 9-9Z" fill="none" stroke="${accent}" ${border}/>
  <path d="M15 8h43m6 0h12M187 12q4 2 4 7" fill="none" stroke="var(--color-bevel-light)" ${edge}/>
  <path d="M8 31v3q0 6 6 6h7m158 0h7q6 0 6-6v-3" fill="none" stroke="${accent}" ${border}/>`},
 // Only the selected tab displays this inner contour; no second tab shadow.
 tab:{viewBox:'0 0 160 40',body:`
  <path d="M20 4h120a16 16 0 0 1 0 32H20a16 16 0 0 1 0-32Z" fill="none" stroke="${accent}" ${border}/>
  <path d="M20 7h34m6 0h9M12 11q-5 4-5 9" fill="none" stroke="var(--color-bevel-light)" ${edge}/>
  <path d="M141 30q6-1 8-6" fill="none" stroke="${accent}" ${border}/>`},
 toast:{viewBox:'0 0 320 48',body:`
  <path d="M12 2h294q6 0 10 6l3 8-4 8 4 8-3 8q-4 6-10 6H12l-8-8v-8l-3-6 3-6v-8Z" fill="${surface}" stroke="${accent}" ${border}/>
  <path d="M15 6h288q7 0 9 7M9 13v5l-3 6" fill="none" stroke="var(--color-bevel-light)" ${edge}/>
  <path d="M15 41h287q7 0 10-7" fill="none" stroke="var(--color-border-subtle)" ${border}/>
  <path d="M17 10h19m5 0h8" fill="none" stroke="var(--color-panel-raised)" ${border}/>`},
};

/** No global SVG IDs/defs: repeated component instances never reference one another. */
export function componentArtHtml(kind:ComponentArtKind){
 const art=artwork[kind];
 return `<svg xmlns="http://www.w3.org/2000/svg" class="ui-component-art ui-component-art--${kind}" viewBox="${art.viewBox}" preserveAspectRatio="${kind==='seal'?'xMidYMid meet':'none'}" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round">${art.body}</svg>`;
}
