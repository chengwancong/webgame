import {resumeRegion} from '../../../packages/rules/world-location.ts';
import type {Pool,PoolClient} from 'pg';
import type {CharacterState} from '../../../packages/contracts/index.ts';
import {migrateSlotRanks} from '../../../packages/rules/zhangjian-build.ts';
import {gatePet,gateKey,grantPet,explorePet,huntPet,regionExplore} from '../../../packages/rules/zhangjian.ts';
import {hubChartContent,hubNodeById} from '../../../packages/content/hub-chart.ts';
import {hubExplore,petFamilyById} from '../../../packages/content/zhangjian.ts';
import type {HubState} from '../../../packages/rules/hub-state.ts';
import {readHubState,saveHubState} from './hub-state.ts';

export function awardExplorePets(s:CharacterState,h:HubState,rewards:string[]=[]){
 let changed=false;
 for(const region of hubChartContent.regions){const id=explorePet(region.id);if(id&&regionExplore(h,region.id).percent===100&&grantPet(s,id)){rewards.push('获得宠物：'+petFamilyById.get(id)!.name);changed=true;}}
 return changed;
}
export function backfillZhangjian(s:CharacterState,h:HubState,rewards:string[]=[]){
 let changed=migrateSlotRanks(s);h.explore??={caches:[],doors:[],keys:[]};
 for(const nodeId of hubChartContent.nodes.filter(n=>h.chart.cleared[n.id]).map(n=>n.id)){
  const node=hubNodeById.get(nodeId),key=gateKey(nodeId);
  if(key&&!h.explore.keys.includes(key)){h.explore.keys.push(key);rewards.push('获得关口钥匙：'+hubExplore.keys[key]!.name);changed=true;}
  const id=node?.kind==='gate'?gatePet(node.region):undefined;if(id&&grantPet(s,id)){rewards.push('获得宠物：'+petFamilyById.get(id)!.name);changed=true;}
 }
 for(const region of hubChartContent.regions){const id=huntPet(region.id,h.chart.cleared);if(id&&grantPet(s,id)){rewards.push('获得宠物：'+petFamilyById.get(id)!.name);changed=true;}}
 return awardExplorePets(s,h,rewards)||changed;
}
/** Caller holds the character row lock. Persist only this batch's fields. */
export async function migrateZhangjianState(c:PoolClient,s:CharacterState){
 const h=await readHubState(c,s.id);if(!backfillZhangjian(s,h))return;
 const patch={slotRanks:s.slotRanks,...(s.pets?{pets:s.pets}:{}),build:s.build};
 await c.query('UPDATE ow_characters SET state=state || $1::jsonb WHERE id=$2',[JSON.stringify(patch),s.id]);await saveHubState(c,s.id,h);
}
export async function zhangjianSwitchBlock(c:Pool|PoolClient,s:CharacterState){
 if(s.dungeon?.instance)return '副本中不能切换方案';
 const active=await c.query("SELECT 1 FROM ow_dungeon_members m JOIN ow_dungeons d ON d.id=m.instance WHERE m.character=$1 AND m.active AND d.status IN ('preparing','loading','running') UNION ALL SELECT 1 FROM ow_field_activities WHERE character=$1 AND status='running' LIMIT 1",[s.id]);
 if(active.rowCount)return '副本中不能切换方案';
 const field=await c.query("SELECT 1 FROM ow_permits p WHERE p.character=$1 AND p.region=$2 AND p.expires>now() AND EXISTS (SELECT 1 FROM jsonb_array_elements(p.data->'spawns') e WHERE NOT EXISTS (SELECT 1 FROM ow_kills k WHERE k.character=p.character AND k.source=e->>'id')) LIMIT 1",[s.id,resumeRegion(s)]);return field.rowCount?'副本中不能切换方案':undefined;
}
