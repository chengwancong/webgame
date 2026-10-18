import type {Stats} from '../contracts/index.ts';
import {statRegistry} from '../contracts/stats.ts';
import type {BuildSourceParts} from '../contracts/build-sources.ts';
/** The same declared source factors apply to permanent and frozen run builds.
 * Absence of factors preserves the old value and arithmetic order. */
export function applySourceStatMultipliers(stats:Stats,sources:Pick<BuildSourceParts,'statMultipliers'>[],definitions:typeof statRegistry=statRegistry):Stats{
 const result={...stats},integer=new Set(['attack','armor']);
 for(const source of sources)for(const [id,factor]of Object.entries(source.statMultipliers??{})){
  if(factor===undefined)continue;
  if(!Number.isFinite(factor)||factor<0)throw Error('Invalid source stat factor');
  const definition=definitions.find(s=>s.id===id);if(!definition)throw Error('Source stat is not registered');
  const current=(result as unknown as Record<string,unknown>)[id],value=(typeof current==='number'?current:definition.default)*factor;
  if(['hp','mana','speed'].includes(id)&&value<=0)throw Error('Source factor removes a positive stat');
  (result as unknown as Record<string,number>)[id]=integer.has(id)?Math.round(value):Math.round(value*1e6)/1e6;
 }
 return result;
}
