import type {CharacterState} from '../contracts/index.ts';
import type {HubNodeDefinition} from '../content/hub-chart.ts';
import {challengeContent} from '../content/progression-challenges.ts';
import {challengeAvailability,consumeChallenge,ensureChallengeProgress} from './progression-challenges.ts';
/** Reuse the existing challenge's gates, limits and multipliers with its new region coordinate. */
export function hubChallengeDefinition(node:HubNodeDefinition,kind:'high'|'nightmare'){
 if(kind==='nightmare'&&node.kind!=='gate'||kind==='high'&&!['nest','hunt','gate'].includes(node.kind))return;
 const legacy=({wind:'meadow',mist:'forest',forge:'rift',frost:'tundra',rift:'abyss',dragon:'dragonbone'} as Record<string,string>)[node.region];if(!legacy)return;
 const found=challengeContent.entries.find(d=>d.kind===kind&&d.region===legacy+'-boss');return found?{...found,region:`ss-map-${node.region}`} : undefined;
}
const regionalState=(s:CharacterState):CharacterState=>({...s,progress:{...s.progress,regions:[...new Set([...s.progress.regions,...s.starsea?.islands??[]])]}});
export function hubChallengeAvailability(s:CharacterState,node:HubNodeDefinition,kind:'high'|'nightmare',now=Date.now()){
 const definition=hubChallengeDefinition(node,kind);return definition?{...challengeAvailability(regionalState(s),definition,now-5*3600000),definition}:{eligible:false,reason:'该节点不支持所选挑战档。',definition:undefined};
}
export function consumeHubChallenge(s:CharacterState,node:HubNodeDefinition,kind:'high'|'nightmare',now=Date.now()){
 const definition=hubChallengeDefinition(node,kind);if(!definition)throw Error('该节点不支持所选挑战档。');ensureChallengeProgress(s);consumeChallenge(regionalState(s),definition,now-5*3600000);
}
export function hubChallengeChoices(s:CharacterState,node:HubNodeDefinition,now=Date.now()){return (['high','nightmare'] as const).filter(kind=>hubChallengeAvailability(s,node,kind,now).eligible);}


