/** Small decorative state illustrations. Layout, labels and behavior stay in stateBlockHtml. */
export type StateArtKind='empty'|'loading'|'error'|'success';
export const stateArtKinds=['empty','loading','error','success'] as const;

const line='stroke="var(--color-border-strong)" stroke-width="var(--border-edge)"';
const fine='stroke-width="var(--border-width)"';
const artwork:Record<StateArtKind,string>={
 empty:`
  <ellipse cx="32" cy="56" rx="23" ry="4" fill="var(--color-panel-inset)"/>
  <path d="m10 29 22-9 22 9-4 23-18 7-18-7Z" fill="var(--color-primary-top)" ${line}/>
  <path d="m32 38 22-9-4 23-18 7Z" fill="var(--color-primary)" stroke="none"/>
  <path d="m10 29 22 9 22-9-22-9Z" fill="var(--color-panel-inset)" ${line}/>
  <path d="m10 29-6-10 20-9 8 10Zm22-9 8-10 20 9-6 10Z" fill="var(--color-panel-raised)" ${line}/>
  <path d="M32 38v20M18 43l6 2" fill="none" stroke="var(--color-primary-border)" ${fine}/>
  <path d="M30 8V3m-7 3-3-3m18 3 3-3" fill="none" stroke="var(--color-primary-border)" ${fine}/>` ,
 loading:`
  <circle cx="27" cy="31" r="23" fill="var(--color-secondary-edge)"/>
  <circle cx="27" cy="28" r="23" fill="var(--color-primary-top)" ${line}/>
  <circle cx="27" cy="28" r="17" fill="var(--color-panel-raised)" stroke="var(--color-primary-border)" ${fine}/>
  <path d="M27 13v4m-15 11h4m11 15v-4m15-11h-4" fill="none" stroke="var(--color-primary-border)" ${fine}/>
  <path d="m34 18-3 14-11 6 3-14Z" fill="var(--color-info)" ${line}/>
  <path d="m34 18-7 10-4-4Z" fill="var(--color-panel-raised)" stroke="none"/>
  <path d="M43 36h15v5l-5 6 5 6v5H43v-5l5-6-5-6Z" fill="var(--color-panel-raised)" ${line}/>
  <path d="m46 40 9 0-4.5 5Zm4.5 10 5 5h-10Z" fill="var(--color-primary)" stroke="none"/>
  <path d="M41 35h19M41 59h19" fill="none" stroke="var(--color-primary-border)" stroke-width="var(--border-edge)"/>`,
 error:`
  <ellipse cx="31" cy="57" rx="22" ry="4" fill="var(--color-panel-inset)"/>
  <path d="M16 6h24l11 11v36q0 3-3 3H16q-3 0-3-3V9q0-3 3-3Z" fill="var(--color-panel-raised)" ${line}/>
  <path d="M40 6v11h11" fill="var(--color-primary-top)" ${line}/>
  <path d="M21 19h9m-9 7h17m-17 7h11" fill="none" stroke="var(--color-border-strong)" ${fine}/>
  <circle cx="43" cy="44" r="15" fill="var(--color-panel-raised)" stroke="var(--color-danger)" stroke-width="var(--border-edge)"/>
  <path d="M43 35v10" fill="none" stroke="var(--color-danger)" stroke-width="var(--border-edge)"/>
  <circle cx="43" cy="51" r="1.5" fill="var(--color-danger)" stroke="none"/>`,
 success:`
  <path d="m19 37-5 23 12-6 6 6 6-23Z" fill="var(--color-primary-top)" ${line}/>
  <path d="m34 37 5 23 8-6 9 3-8-22Z" fill="var(--color-primary)" ${line}/>
  <circle cx="32" cy="27" r="23" fill="var(--color-primary-top)" stroke="var(--color-primary-border)" stroke-width="var(--border-edge)"/>
  <circle cx="32" cy="27" r="18" fill="var(--color-panel-raised)" stroke="var(--color-primary-border)" ${fine}/>
  <path d="m21 27 7 7 15-16" fill="none" stroke="var(--color-success)" stroke-width="var(--border-depth)"/>
  <path d="M11 8 8 5m46 7 4-3" fill="none" stroke="var(--color-primary-border)" ${fine}/>` ,
};

export function stateArtHtml(kind:StateArtKind):string{
 return `<svg data-pixel-icon="inline:state:${kind}" xmlns="http://www.w3.org/2000/svg" class="ui-state__icon ui-state-art" viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round">${artwork[kind]}</svg>`;
}
