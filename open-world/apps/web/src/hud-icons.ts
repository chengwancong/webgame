// Compact silhouettes for inline controls; the toolbar uses shaded adventure illustrations below.
export function hudMenuIcon(name:'bag'|'build'|'growth'|'appearance'|'goal'|'settings'|'combat'){
 const fill=(color:string)=>`var(--color-icon-${color})`;
 const leather=fill('leather'),bright=fill('leather-light'),dark=fill('leather-dark'),paper=fill('paper'),steel=fill('steel'),steelLight=fill('steel-light'),steelDark=fill('steel-dark');
 const pictures={
 bag:`<path d="M17 14V9c0-7 16-7 16 0v5" fill="none" stroke="${bright}" stroke-width="4"/><path d="M12 17 7 41q1 6 18 6t18-6l-5-24Z" fill="${leather}"/><path d="m13 19-3 22q7 6 13 5V19Z" fill="${bright}" stroke="none"/><path d="m34 19 6 24-8 3-3-26Z" fill="${dark}" stroke="none"/><path d="m12 14 26 0 2 12q-15 8-30 0Z" fill="${bright}"/><path d="M20 23h10v11H20Z" fill="${paper}"/><path d="M24 23v8" fill="none"/><path d="m10 33-6 1v9l5 1m31-11 6 1v9l-5 1" fill="${dark}"/>`,
 build:`<path d="M4 11q12-5 21 1 9-6 21-1l-1 31q-11-4-20 2-9-6-20-2Z" fill="${fill('purple-dark')}"/><path d="M7 8q9-4 18 2 9-6 18-2v30q-9-3-18 3-9-6-18-3Z" fill="${paper}"/><path d="M10 10q8-2 13 2v23q-6-3-13-1Z" fill="${fill('purple')}"/><path d="M27 12q6-4 13-2v24q-7-2-13 1Z" fill="${fill('purple')}"/><path d="m16 16 2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Zm17 0 2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z" fill="${paper}" stroke="none"/><path d="M25 10v31" fill="none"/>`,
 growth:`<path d="M25 4q10 9 19 10l-3 21q-6 10-16 13-10-3-16-13L6 14q10-1 19-10Z" fill="${paper}"/><path d="m25 10 13 7-2 15q-3 6-11 10-8-4-11-10l-2-15Z" fill="${leather}"/><path d="m25 15 12 13h-8v12h-8V28h-8Z" fill="${fill('blue')}"/><path d="M25 17v20" stroke="${steelLight}" fill="none" stroke-width="1.5"/>`,
 appearance:`<path d="m16 8-12 9 6 12 7-4-2 19q10 5 20 0l-2-19 7 4 6-12-12-9q-9 7-18 0Z" fill="${steel}"/><path d="m16 8 1 14 8 8 8-8 1-14q-9 7-18 0Z" fill="${steelLight}"/><path d="M25 30v17M16 35h18" fill="none" stroke="${steelDark}"/><path d="m4 17 6 12 7-4-4-10Zm42 0-6 12-7-4 4-10Z" fill="${steelDark}"/><path d="m19 25 6 6 6-6-6 13Z" fill="${steelDark}" stroke="none"/>`,
 goal:`<path d="M10 8h29q6 0 6 6t-6 6H17L14 40q0 5-5 5t-5-5q0-4 7-4Z" fill="${leather}"/><path d="M12 8h25q-5 3-5 9l-2 25H9q5-3 5-8Z" fill="${paper}"/><path d="M18 18h7m-8 6h7m-8 6h5" fill="none" stroke="${bright}"/><path d="m27 15 7 0-2 16h-4Z" fill="${fill('orange')}"/><circle cx="29" cy="36" r="3" fill="${fill('orange')}"/>`,
 settings:`<path d="m21 4 8 0 2 7 5 3 7-2 4 7-5 5v6l5 5-4 7-7-2-5 3-2 6h-8l-2-6-5-3-7 2-4-7 5-5v-6l-5-5 4-7 7 2 5-3Z" fill="${steel}"/><path d="m21 4 8 0 2 7 5 3 7-2 4 7-5 5" fill="none" stroke="${steelLight}" stroke-width="3"/><circle cx="25" cy="27" r="10" fill="${steelDark}"/><circle cx="25" cy="27" r="7" fill="var(--color-panel-inset)"/>`,
 combat:`<path d="M43 5l-6 1-25 25 4 4L42 10Z" fill="${steel}"/><path d="m19 37-8-8-3 3 8 8Z" fill="${fill('orange')}"/><path d="m13 37-6 6" stroke="${dark}" stroke-width="5"/><circle cx="6" cy="45" r="3" fill="${steelDark}"/><path d="M7 5l6 1 25 25-4 4L8 10Z" fill="${steelLight}"/><path d="M11 9l24 24" stroke="${steel}" stroke-width="1.5"/><path d="m31 37 8-8 3 3-8 8Z" fill="${fill('orange')}"/><path d="m37 37 6 6" stroke="${leather}" stroke-width="5"/><circle cx="44" cy="45" r="3" fill="${steelDark}"/>`,
 };
 return `<svg class="hud-menu-illustration" viewBox="0 0 50 52" aria-hidden="true" fill="none" stroke="var(--color-chrome-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pictures[name]}</svg>`;
}
export function hudIcon(name:'bag'|'build'|'growth'|'appearance'|'goal'|'settings'|'coin'|'pause'|'play'|'more'){
 const paths={
 growth:'<path d="M25 14v14M12 29h26M12 29v9M38 29v9M25 29v10" fill="none" stroke="currentColor" stroke-width="3"/><path d="m25 4 8 8-8 8-8-8Z"/><circle cx="12" cy="42" r="6"/><circle cx="25" cy="43" r="5"/><circle cx="38" cy="42" r="6"/>',
 appearance:'<path d="m16 7-12 8 6 12 6-4v23h18V23l6 4 6-12-12-8c-1 8-17 8-18 0Z"/><path d="M17 34h16M17 40h16" fill="none"/><path d="m25 20 5 6-5 6-5-6Z" fill="var(--color-panel-inset)" stroke="none"/>',
 more:'<circle cx="10" cy="26" r="4" stroke="none"/><circle cx="25" cy="26" r="4" stroke="none"/><circle cx="40" cy="26" r="4" stroke="none"/>',
 bag:'<path d="M14 19c-2 6-5 17-4 22 1 5 8 6 15 6s14-1 15-6c1-5-2-16-4-22Z"/><path d="M18 17v-4c0-7 14-7 14 0v4M14 19c5 5 17 5 22 0M13 28l-4 3M37 28l4 3" fill="none"/><rect x="21" y="21" width="8" height="12" rx="3"/>',
 build:'<path d="m6 12 2 31c6-3 11-2 17 2 6-4 11-5 17-2l3-31c-8-3-14-2-20 2-6-4-12-5-19-2Z"/><path d="M25 14v29M8 39c6-2 11-1 17 3 6-4 11-5 17-3" fill="none"/><path d="m17 20 4 6-2 8-3-5-5-5 5 1ZM30 19l-2 15 8-12-5 4Z" fill="var(--color-panel-inset)" stroke="none"/>',
 goal:'<circle cx="25" cy="25" r="16" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="25" cy="25" r="5" stroke="none"/><path d="M25 3v12M25 35v12M3 25h12M35 25h12" fill="none" stroke="currentColor" stroke-width="5"/>',
 settings:'<path d="m21 4 8 0 2 7 5 3 7-2 4 7-5 5v6l5 5-4 7-7-2-5 3-2 6h-8l-2-6-5-3-7 2-4-7 5-5v-6l-5-5 4-7 7 2 5-3Z" stroke="none"/><circle cx="25" cy="27" r="8" fill="var(--color-panel-inset)" stroke="none"/>',
 coin:'<circle cx="25" cy="25" r="22" fill="var(--color-resource-gold-icon)" stroke="var(--color-resource-gold-border)" stroke-width="2"/><circle cx="25" cy="25" r="17" fill="var(--color-resource-gold-icon)" stroke="var(--color-resource-gold-shade)"/><path d="m25 11 4 9 10 1-8 7 2 10-8-5-8 5 2-10-8-7 10-1Z" fill="var(--color-resource-gold-light)" stroke="var(--color-resource-gold-shade)"/>',
 pause:'<rect x="14" y="11" width="8" height="28" rx="2" stroke="none"/><rect x="29" y="11" width="8" height="28" rx="2" stroke="none"/>',
 play:'<path d="m18 10 23 15-23 15Z" stroke="none"/>'
 };
 return `<svg class="hud-symbol" viewBox="0 0 50 52" aria-hidden="true" focusable="false" fill="currentColor" stroke="var(--color-panel-inset)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}
