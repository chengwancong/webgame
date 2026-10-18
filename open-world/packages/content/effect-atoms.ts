import source from './effect-atoms.json';
import {effectRuleSchema} from '../contracts/effects.ts';
export const effectAtoms=source.map(r=>effectRuleSchema.parse(r));
export const effectAtomById=new Map(effectAtoms.map(r=>[r.id,r]));
if(effectAtomById.size!==50||effectAtoms.length!==50)throw Error('Expected 50 distinct effect atoms');
for(const r of effectAtoms)for(const path of r.scale){let value:unknown=r;for(const key of path.split('.'))value=value&&typeof value==='object'?(value as Record<string,unknown>)[key]:undefined;if(typeof value!=='number')throw Error('Invalid atom scale path '+r.id+':'+path);}
