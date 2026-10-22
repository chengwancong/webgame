import type {GearQuality} from '../../../packages/contracts/index.ts';
/** 品质配色（叶子模块：供 hex-rune-icon 与 gear-metadata 共用，避免 ui-assets ↔ ui-components 循环依赖）。 */
export const qualityColors:Record<GearQuality,string>={common:'var(--color-rarity-common)',magic:'var(--color-rarity-magic)',rare:'var(--color-rarity-rare)',legendary:'var(--color-rarity-legendary)'};
