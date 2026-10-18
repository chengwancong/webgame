import type {EliteAffix} from '../contracts/monsters.ts';
import {eliteAffixContentSchema} from '../contracts/monsters.ts';
import source from './elite-affixes.json';

/** Field elite affixes (grind-feel §2.4). Durations: 30 Hz ticks.
 * - swift: frozen into the spawn's AI (move speed up, attack interval down).
 * - shielded: engaged elites raise a shield worth a share of max HP, absorbed before HP.
 * - frost_nova: adds the self-centred `frost_nova` monster skill (expanding ground warning). */
export const eliteAffixes=eliteAffixContentSchema.parse(source) satisfies Record<EliteAffix,{name:string}>;
