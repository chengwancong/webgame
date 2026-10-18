import type {MonsterContent} from '../packages/content/monsters.ts';
type RoleChange={template:string;before:'normal';after:'swarm';basis:{rank:'normal';gameplayBehaviour:MonsterContent['templates'][number]['kind']};unchanged:{art:string;skills:string[];ai:MonsterContent['templates'][number]['ai']}};
/** Starter role proposals use authored gameplay rank/behaviour, never art IDs.
 * Existing ranged/swarm declarations and special behaviours are retained. */
export function proposeStarterSwarmRoles(source:MonsterContent,roster:readonly {id:string;rank:string}[]){
 const result=structuredClone(source),normal=new Set(roster.filter(r=>r.rank==='normal').map(r=>r.id)),changes:RoleChange[]=[];
 if(result.templates.some(t=>t.role==='swarm'))return {content:result,changes,limits:['Existing authored swarm templates are present. Their declarations are retained; this starter proposal does not reclassify additional ordinary templates.']};
 for(const template of result.templates)if(normal.has(template.id)&&template.role==='normal'&&!template.bossKey&&['melee','charger','assassin'].includes(template.kind)){
  template.role='swarm';changes.push({template:template.id,before:'normal',after:'swarm',basis:{rank:'normal',gameplayBehaviour:template.kind},unchanged:{art:template.art,skills:[...template.skills],ai:structuredClone(template.ai)}});
 }
 return {content:result,changes,limits:['Starter assignments only cover authored ordinary melee/charger/assassin templates. Remaining new island templates stay owned by the formal content integration.','No IDs, assets, skills, AI profiles, populations or mandatory template quantities are removed or replaced. The derived one-shot curve is applied separately.']};
}
