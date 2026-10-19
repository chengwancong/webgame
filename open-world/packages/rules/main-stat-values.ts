import type {Gear} from '../contracts/index.ts';
import {combatNumerics} from './combat-numerics.ts';
/** The same resolved contribution is displayed on cards and returned by the gear API. */
export function mainStatValues(g:Pick<Gear,'mainStat'|'rank'>){
 if(!g.mainStat)return;
 const enhancement=Math.round(g.mainStat.value*combatNumerics.reinforcement.primaryRatioPerRank*g.rank*1e6)/1e6;
 return {stat:g.mainStat.stat,base:g.mainStat.value,enhancement,effective:Math.round((g.mainStat.value+enhancement)*1e6)/1e6};
}
