// Decorative result marks only. These flags do not represent equipment durability or a new reward.
const stroke='stroke="var(--color-panel-inset)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"';
export const victory=`<svg viewBox="0 0 120 120" aria-hidden="true" class="flag-art">
 <ellipse cx="60" cy="104" rx="36" ry="6" fill="var(--color-background)" opacity=".25"/>
 <path d="M37 101C18 89 12 65 21 42M83 101c19-12 25-36 16-59" fill="none" stroke="var(--color-primary-pressed)" stroke-width="3" stroke-linecap="round"/>
 <path d="M23 79C8 78 8 66 10 61c9 1 17 9 13 18M21 63C8 55 12 42 15 39c9 6 11 13 6 24M24 48C14 35 21 24 26 22c6 10 6 17-2 26M31 93C15 93 14 84 15 78c10 0 16 5 16 15M97 79c15-1 15-13 13-18-9 1-17 9-13 18M99 63c13-8 9-21 6-24-9 6-11 13-6 24M96 48c10-13 3-24-2-26-6 10-6 17 2 26M89 93c16 0 17-9 16-15-10 0-16 5-16 15" fill="var(--color-primary)" ${stroke}/>
 <path d="M43 18 40 103" fill="none" stroke="var(--color-primary-pressed)" stroke-width="8" stroke-linecap="round"/><path d="M43 19 40 101" fill="none" stroke="var(--color-primary-top)" stroke-width="3" stroke-linecap="round"/>
 <path d="M44 25c13-5 29 6 48-1l-8 19 7 20c-18 8-33-6-48 0z" fill="var(--color-primary-top)" ${stroke}/>
 <path d="M44 56c17-7 31 8 46 1l1 6c-18 8-33-6-48 0z" fill="var(--color-primary)"/>
 <path d="M44 25c13-5 29 6 48-1l-8 19" fill="none" stroke="var(--color-text-primary)" stroke-width="2" stroke-linecap="round" opacity=".7"/>
 <path d="m67 32 5 8 9 2-7 5-1 9-6-7-9 1 4-9z" fill="var(--color-panel-raised)" stroke="var(--color-primary-pressed)" stroke-width="1.6"/>
 <path d="m44 10 6 7-7 7-6-7z" fill="var(--color-primary-top)" ${stroke}/>
 <path d="m60 90 5 7 8 2-8 2-5 7-5-7-8-2 8-2z" fill="var(--color-primary-top)" ${stroke}/>
</svg>`;
export const defeat=`<svg viewBox="0 0 120 120" aria-hidden="true" class="flag-art">
 <ellipse cx="58" cy="103" rx="34" ry="6" fill="var(--color-background)" opacity=".35"/>
 <path d="M75 16 57 65M52 77l-10 27" fill="none" stroke="var(--color-text-disabled)" stroke-width="7" stroke-linecap="round"/><path d="M75 16 57 65M52 77l-10 27" fill="none" stroke="var(--color-border-strong)" stroke-width="2" stroke-linecap="round"/>
 <path d="M73 30c13 1 20 15 35 15L94 57l2 14-13-6-8 12-9-12c-7-2-11-3-14-8z" fill="var(--color-negative)" ${stroke}/>
 <path d="M61 47c10 7 22 8 35 14l0 10-13-6-8 12-9-12c-7-2-11-3-14-8z" fill="var(--color-danger)" opacity=".5"/>
 <path d="m79 39-7 9 10 2-7 12" fill="none" stroke="var(--color-panel-inset)" stroke-width="3" stroke-linecap="round"/>
 <path d="m74 9 6 7-8 6-6-7z" fill="var(--color-border-strong)" ${stroke}/>
 <path d="m21 77 18 3-4 9-10-4zM74 94l12-5 10 8-14 3z" fill="var(--color-negative)" opacity=".6" ${stroke}/>
 <path d="m48 69 7-2 6 6-7 3z" fill="var(--color-border-strong)" ${stroke}/>
</svg>`;
export const pending=`<svg viewBox="0 0 120 120" aria-hidden="true" class="flag-art"><ellipse cx="60" cy="104" rx="28" ry="5" fill="var(--color-background)" opacity=".3"/><path d="M43 18v86" fill="none" stroke="var(--color-border-strong)" stroke-width="7" stroke-linecap="round"/><path d="M45 26c14-5 23 4 36-2l-6 16 5 18c-14 6-24-4-35 2z" fill="var(--color-panel-secondary)" ${stroke}/><path d="m62 34 7 9-7 9-7-9z" fill="var(--color-text-secondary)"/><path d="m43 11 5 6-5 6-5-6z" fill="var(--color-border-strong)" ${stroke}/></svg>`;
