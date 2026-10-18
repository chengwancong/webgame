import {resolveBuild} from '../packages/rules/index.ts';
import type {CharacterState} from '../packages/contracts/index.ts';

/** A measurement must execute the requested build, never silently filter it. */
export function resolveMeasuredBuild(state:CharacterState){
 const build=resolveBuild(state),requested=state.skills;
 if(!requested.length||requested.length>4||new Set(requested).size!==requested.length)throw Error('Invalid measurement loadout');
 const missing=requested.filter(id=>!build.resolvedSkills.some(sk=>sk.id===id));
 if(missing.length)throw Error('Measurement has inactive or unknown skills: '+missing.join(', '));
 if(!build.resolvedSkills.some(sk=>!['heal','shield'].includes(sk.kind)&&sk.damage>0))throw Error('Solo combat measurement has no offensive skill');
 if(Object.values(build.stats).some(v=>typeof v==='number'&&!Number.isFinite(v)))throw Error('Non-finite measured stats');
 return build;
}
