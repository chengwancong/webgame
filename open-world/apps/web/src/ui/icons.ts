import {escapeHtml,type StatusTone} from './primitives.ts';
const utilityPaths={
 lock:'<rect x="7" y="14" width="18" height="15" rx="3"/><path d="M11 14V9a5 5 0 0 1 10 0v5M16 20v4"/>',
 check:'<path d="m6 16 7 7L27 8"/>',plus:'<path d="M16 6v20M6 16h20"/>',minus:'<path d="M6 16h20"/>',
 'chevron-right':'<path d="m12 6 10 10-10 10"/>','chevron-left':'<path d="m20 6-10 10 10 10"/>',
 diamond:'<path d="m16 3 13 13-13 13L3 16z"/>',star:'<path d="m16 3 4 8 9 2-7 6 2 10-8-5-8 5 2-10-7-6 9-2z"/>',
 clock:'<circle cx="16" cy="16" r="12"/><path d="M16 8v9l6 3"/>',hourglass:'<path d="M8 4h16M8 28h16M10 4v7l12 10v7M22 4v7L10 21v7"/>',
 alert:'<path d="m16 3 13 25H3zM16 11v8m0 4v1"/>',info:'<circle cx="16" cy="16" r="12"/><path d="M16 14v10m0-16v1"/>',
 chest:'<path d="M4 14h24v14H4zM5 14V9c0-5 22-5 22 0v5M4 19h24M10 14v14m12-14v14"/><rect x="14" y="16" width="4" height="6" rx="1"/>',
 people:'<circle cx="12" cy="10" r="5"/><path d="M3 28v-5c0-8 18-8 18 0v5M23 5a5 5 0 0 1 0 10m3 5c4 1 4 5 4 8"/>',seat:'<path d="M9 5h14v13H9zM5 15v9h22v-9M8 24v5m16-5v5"/>',
 refresh:'<path d="M26 11A11 11 0 1 0 27 21M26 4v8h-8"/>',rotate:'<path d="M7 12a10 10 0 1 1-1 10M7 4v9h9"/>',
 play:'<path d="m10 5 18 11-18 11z"/>',pause:'<path d="M10 6h3v20h-3zM19 6h3v20h-3z"/>',
 skull:'<path d="M8 21a12 12 0 1 1 16 0v7H8zM12 24v4m4-4v4m4-4v4"/><circle cx="11" cy="14" r="2"/><circle cx="21" cy="14" r="2"/>',
 auto:'<path d="m16 3 3 5 6 1 1 6 4 4-4 5-6 1-4 5-5-4-6-1-1-6-3-4 4-5 6-1z"/><path d="m13 10 9 6-9 6z"/>',
 book:'<path d="M16 8C10 4 5 6 3 7v20c4-2 9-1 13 2 4-3 9-4 13-2V7c-2-1-7-3-13 1zm0 0v21M7 12l5 1m-5 5 5 1m8-6 5-1m-5 7 5-1"/>',
 compass:'<circle cx="16" cy="16" r="12"/><path d="m22 10-4 8-8 4 4-8zM16 1v4m0 22v4M1 16h4m22 0h4"/>',
 link:'<path d="m13 10 4-4a7 7 0 0 1 10 10l-4 4M19 22l-4 4A7 7 0 0 1 5 16l4-4M10 22l12-12"/>',
 projectiles:'<path d="m5 25 18-18m-6 0h6v6M12 28l15-15m-6 0h6v6M3 17 16 4m-6 0h6v6"/>',effectChain:'<circle cx="6" cy="8" r="4"/><circle cx="26" cy="9" r="4"/><circle cx="16" cy="26" r="4"/><path d="M10 8h12M8 11l6 11m4 0 6-10"/>',
 cold:'<path d="M16 2v28M4 9l24 14M4 23 28 9M12 5l4 4 4-4m-8 22 4-4 4 4M4 14l5-1-1-5m20 10-5 1 1 5"/>',
 lightning:'<path d="M18 2 5 19h10l-1 11 13-18H17z"/>',poison:'<path d="M11 3h10m-8 0v9L5 24c-3 6 25 6 22 0l-8-12V3M8 20h16"/>',
 arcane:'<path d="m16 2 4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/>',shadow:'<path d="M24 4A13 13 0 1 0 28 25 13 13 0 0 1 24 4z"/>',
 area:'<ellipse cx="16" cy="20" rx="13" ry="8"/><path d="M16 2v18m-5-6 5 6 5-6"/>',
 multiply:'<path d="m7 7 18 18M7 25 25 7"/>',search:'<circle cx="13" cy="13" r="9"/><path d="m20 20 9 9"/>',
 salvage:'<path d="M5 9h22M12 9V5h8v4M8 9l1.5 19h13L24 9M13 14v10M19 14v10"/>',warehouse:'<path d="M3 12 16 4l13 8v16H3zM8 28V16h16v12M8 21h16"/>',
 house:'<path d="M4 15 16 4l12 11v13H4zM13 28v-9h6v9"/>',hammer:'<path d="m5 27 12-12m-4-10 8-2 8 8-2 8-6-1-9-9z"/>'
} as const;
const aliases={'role-tank':'armor','role-healer':'regen','role-damage':'swords',attack:'swords',physical:'swords',melee:'swords',spell:'arcane',projectile:'projectiles',dot:'poison',skillDamage:'fire',skillCost:'mana',skillCooldown:'cdr',executeBonus:'skull',executeThreshold:'hp',
 // 2026-10-07 天赋四树的属性图标（无专属图形时借用同义图标）。
 tagDamage:'multiply',vsLow:'skull',vsHealthy:'hp',vsControlled:'lock',vsElite:'skull',vsBoss:'skull',allResist:'armor',blockChance:'armor',damageReduction:'armor',thorns:'swords',healingReceived:'regen',lifeOnKill:'hp',castSpeed:'clock',manaOnKill:'mana',cooldownOnKill:'cdr',
 igniteChance:'fire',chillChance:'cold',shockChance:'lightning',poisonChance:'poison',bleedChance:'swords',statusDuration:'hourglass',dotCrit:'critChance',vulnerableBonus:'multiply'} as const;
// Adventure illustrations share the HUD's material palette. Closed silhouettes,
// separate shade planes and sparse highlights stay readable inside 20–24px nodes.
// Utility marks keep their compact, inherited-color treatment below.
const pigment=(name:string)=>`var(--color-icon-${name})`;
const steel=pigment('steel'),light=pigment('steel-light'),dark=pigment('steel-dark'),gold=pigment('leather-light'),leather=pigment('leather'),paper=pigment('paper'),blue=pigment('blue'),purple=pigment('purple'),purpleDark=pigment('purple-dark'),orange=pigment('orange');
const sword=`<path d="m12 20 2-7L26 3l3 1-1 4-11 12Z" fill="${light}"/><path d="m14 19 13-14-10 15Z" fill="${steel}" stroke="none"/><path d="m10 19 4-4 7 7-4 4Z" fill="${gold}"/><path d="m11 23 3 3-5 5-3-3Z" fill="${leather}"/><path d="m5 27 4 4" fill="none"/>`;
const heart=`<path d="M16 28 5 18C-2 10 6 2 12 6l4 4 4-4c6-4 14 4 7 12Z" fill="var(--color-danger)"/><path d="m16 28-2-7c7 0 12-7 12-13 5 4 4 8 1 10Z" fill="${orange}" stroke="none"/><path d="M7 11q0-3 3-2" fill="none" stroke="${paper}"/>`;
const shield=`<path d="m16 3 12 5-2 13q-3 5-10 9-7-4-10-9L4 8Z" fill="${gold}"/><path d="m16 7 8 3-1 10q-2 4-7 7-5-3-7-7L8 10Z" fill="${steel}"/><path d="m16 7 8 3-1 10q-2 4-7 7Z" fill="${dark}" stroke="none"/><path d="M16 10v12" fill="none" stroke="${light}"/><path d="m8 10 8-3" fill="none" stroke="${paper}"/>`;
const gem=`<path d="m10 4 12 0 7 9-13 17L3 13Z" fill="${blue}"/><path d="m10 4 6 9-13 0Z" fill="${light}" stroke="none"/><path d="m22 4-6 9 13 0-13 17Z" fill="${steel}" stroke="none"/><path d="M3 13h26M10 4l6 9 6-9M16 13v17" fill="none"/>`;
const bow=`<path d="M10 3q24 13 0 26l3-5q14-8 0-16Z" fill="${leather}"/><path d="m10 3 5 13-5 13" fill="none" stroke="${paper}"/><path d="M3 16h23" fill="none"/><path d="m24 12 6 4-6 4Z" fill="${light}"/><path d="m4 13 4 3-4 3" fill="none" stroke="${gold}"/>`;
const illustrations={
 swords:sword,
 hp:heart,
 armor:shield,
 mana:gem,
 lifesteal:`<path d="M16 3C13 9 6 13 6 20a10 10 0 0 0 20 0C26 13 19 9 16 3Z" fill="var(--color-danger)"/><path d="M16 3c5 10 10 17 1 25 6 0 9-4 9-8C26 13 19 9 16 3Z" fill="${orange}" stroke="none"/><path d="M11 16q-3 5 0 8" fill="none" stroke="${paper}"/>`,
 cdr:`<path d="M12 3h8v4h-8Z" fill="${gold}"/><path d="m24 8 3-3 3 3-3 3Z" fill="${leather}"/><circle cx="16" cy="19" r="11" fill="${gold}"/><circle cx="16" cy="19" r="8" fill="${paper}"/><path d="M16 11v8l5 3" fill="none"/><circle cx="16" cy="19" r="1.5" fill="${dark}" stroke="none"/>`,
 regen:`<path d="M23 6a12 12 0 1 0 4 18" fill="none" stroke="${leather}"/><path d="m22 2 6 6-8 1Z" fill="${gold}"/><path d="M13 10h6v6h6v6h-6v6h-6v-6H7v-6h6Z" fill="${paper}"/><path d="M16 14v10" fill="none" stroke="${gold}"/>`,
 speed:`<path d="m15 3 9 3-2 13 7 4v6H10v-9Z" fill="${leather}"/><path d="m15 3 9 3-1 5-10-3Z" fill="${gold}"/><path d="M10 25h19v4H10Z" fill="${paper}"/><path d="m17 15 5 1m-7 4 6 1M3 12h6m-8 7h5" fill="none"/>`,
 critChance:`<circle cx="16" cy="16" r="11" fill="${gold}"/><circle cx="16" cy="16" r="7" fill="${paper}"/><circle cx="16" cy="16" r="3" fill="${orange}"/><path d="M16 2v6m0 16v6M2 16h6m16 0h6" fill="none"/>`,
 critMultiplier:`<path d="m17 2 2 8 9-4-4 10 7 4-10 2-4 9-4-8-11 3 5-10-5-5 10 1Z" fill="${orange}"/><path d="m18 9-8 9h6l-1 7 8-10h-6Z" fill="${paper}" stroke="none"/>`,
 dodge:`<path d="m18 5 11 11-11 11-4-4 7-7-7-7Z" fill="${blue}"/><path d="m7 8 8 8-8 8-4-4 4-4-4-4Z" fill="${steel}"/><path d="M1 6h5m-5 20h5" fill="none" stroke="${gold}"/>`,
 penetration:`<path d="m15 3 11 5-1 12q-2 5-10 10-8-5-10-10L4 8Z" fill="${steel}"/><path d="m15 6 7 3-1 10q-1 4-6 7Z" fill="${dark}" stroke="none"/><path d="M2 16h20" fill="none" stroke="${paper}" stroke-width="3"/><path d="m21 11 9 5-9 5Z" fill="${gold}"/>`,
 skillRadius:`<ellipse cx="16" cy="23" rx="13" ry="7" fill="${purple}"/><ellipse cx="16" cy="23" rx="8" ry="3" fill="${paper}"/><path d="m16 2 3 6 6 2-6 3-3 7-3-7-6-3 6-2Z" fill="${blue}"/><path d="M16 7v6" fill="none" stroke="${light}"/>`,
 fire:`<path d="M17 2c0 8 9 10 9 19a10 10 0 0 1-20 0c0-5 4-7 4-13l5 6c3-3 3-7 2-12Z" fill="${orange}"/><path d="M17 15c0 6 4 5 4 9a5 5 0 0 1-10 0c0-3 4-5 6-9Z" fill="${paper}" stroke="none"/>`,
 'spec-warrior':`<g transform="translate(3 -1) scale(.9)">${sword}</g><path d="m11 13 10 4-2 8q-2 4-8 6-6-2-8-6l-2-8Z" fill="${gold}"/><path d="m11 17 6 2-1 5q-1 2-5 4-4-2-5-4l-1-5Z" fill="${steel}"/><path d="m11 17 6 2-1 5q-1 2-5 4Z" fill="${dark}" stroke="none"/><path d="M11 19v5" fill="none" stroke="${light}"/>`,
 'spec-mage':`<path d="m6 27 12-16 4 3L10 30Z" fill="${leather}"/><path d="m7 26 4 3" fill="none" stroke="${gold}"/><path d="m13 8 8-6 9 5-5 11-9-2Z" fill="${purpleDark}"/><path d="m14 8 7-4 6 4-4 7-7-1Z" fill="${purple}"/><path d="m21 4 2 5-7 5Z" fill="${paper}" stroke="none"/><path d="M5 7v4M3 9h4" fill="none" stroke="${gold}"/>`,
 'spec-ranger':bow,
 ranged:bow
} as const;
const paths={...utilityPaths,...illustrations} as const;
export type IconName=keyof typeof paths|keyof typeof aliases;
export const iconNames=Object.keys({...paths,...aliases}) as IconName[];
export function iconHtml(name:IconName,options:{size?:16|20|24|32;tone?:StatusTone|'inherit';className?:string;label?:string}={}){
 const key=(aliases as Record<string,string>)[name]??name,body=(paths as Record<string,string>)[key]??paths.diamond,illustration=(illustrations as Record<string,string>)[key];
 return `<svg class="ui-icon ui-icon--${options.size??20}${options.tone&&options.tone!=='inherit'?` ui-icon--${options.tone}`:''}${options.className?` ${escapeHtml(options.className)}`:''}" viewBox="0 0 32 32" data-icon="${escapeHtml(name)}" ${options.label?`role="img" aria-label="${escapeHtml(options.label)}"`:'aria-hidden="true"'} focusable="false" fill="none" stroke="${illustration?'var(--color-chrome-ink)':'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${illustration??`<g fill="currentColor" stroke="none" opacity=".18">${body}</g>${body}`}</svg>`;
}
export function statIcon(key:string,options:{size?:16|20|24|32;label?:string}={}){const name=(iconNames.includes(key as IconName)?key:key.replace(/Damage$/,'')) as IconName;return iconHtml(iconNames.includes(name)?name:'diamond',{...options,className:'ui-stat-icon ui-stat-icon--'+(iconNames.includes(name)?name:'generic')});}
/** Round plate behind a stat icon; the tone follows the stat family so rows stay scannable (bag card, equipment chips). */
const plateTone=(key:string)=>/resist|cold|frost/i.test(key)?(/fire/i.test(key)?'danger':/poison/i.test(key)?'success':/arcane|shadow/i.test(key)?'purple':'info'):/hp|life|regen|heal/i.test(key)?'danger':/armor|block|shield/i.test(key)?'icon-steel':/speed|dodge|mana|cdr|cooldown/i.test(key)?'icon-blue':/pickup|radius/i.test(key)?'icon-purple':/attack|crit|damage|penetration|execute/i.test(key)?'icon-orange':'icon-steel';
export function statPlateHtml(key:string,size:'chip'|'main'|'affix'='affix'){return `<span class="ui-stat-plate ui-stat-plate--${size}" style="--tone:var(--color-${plateTone(key)})">${statIcon(key,{size:size==='main'?32:24})}</span>`;}
/** Panel-head seal picture: the shared icon at seal size (2026-10-20). */
export const sealEmblem=(name:IconName)=>iconHtml(name,{size:32,className:'ui-seal-icon'});
