import type {CharacterState} from '../contracts/index.ts';
import type {StarseaState} from '../contracts/starsea.ts';
import {conditions,tasks,questParameters} from '../content/task-tables.ts';
import {worldTables} from '../content/world-tables.ts';
import {hexRuneById} from '../content/hex-runes.ts';
import {resolveHexActive} from './hex-runes.ts';
export const conditionGroups=new Map<string,Map<number,typeof conditions>>();
for(const row of conditions){const byGroup=conditionGroups.get(row.target)??new Map();const group=byGroup.get(row.group)??[];group.push(row);byGroup.set(row.group,group);conditionGroups.set(row.target,byGroup);}
export function conditionMet(s:Pick<CharacterState,'level'|'starsea'>&Partial<Pick<CharacterState,'gear'|'equipment'>>,target:string,visiting=new Set<string>()):boolean{
 const st=s.starsea as StarseaState|undefined;if(!st)return false;if(visiting.has(target))return false;
 const groups=conditionGroups.get(target);if(!groups)return false;const next=new Set(visiting).add(target);
 const fact=(c:typeof conditions[number]):boolean=>{const v=c.value;switch(c.kind){
  case 'task':return st.done.includes(v);case 'task_active':return Boolean(st.quests[v]&&!st.done.includes(v));case 'task_ready':return !st.done.includes(v)&&!st.quests[v]&&questEligible(s,v,next);case 'level':return s.level>=Number(v);case 'island':return st.islands.includes(v)||conditionMet(s,'island:'+v,next);
  case 'feature':return st.features.includes(v)||conditionMet(s,'feature:'+v,next);case 'boss':return v==='all-6'?Array.from({length:6},(_,i)=>'ss-map-boss-'+(i+1)).every(id=>st.bosses.includes(id)):st.bosses.includes(v);
  case 'zone':return st.discovered.includes(v);case 'gate':return st.gates.includes(v);case 'waypoint':return v==='any'?st.waypoints.length>0:v==='any-outpost'?worldTables.waypoints.some(w=>w.kind==='outpost'&&st.waypoints.includes(w.id)):st.waypoints.includes(v);
  case 'island_visited':return st.seen.some(f=>f.startsWith('hub-node:'+v.replace('ss-map-','')+'-'))||worldTables.zones.some(zone=>zone.region===v&&st.discovered.includes(zone.id));
  case 'npc_met':return st.npcs.includes(v)||conditionMet(s,'npc:'+v,next);case 'hardmode':return st.hardmode;
  case 'hex_playstyle':{
   const style=resolveHexActive({level:s.level,gear:s.gear??[],equipment:s.equipment??{}}).filter(row=>row.active).map(row=>hexRuneById.get(row.rune)?.playstyle).find(Boolean)??'';
   return v.startsWith('not:')?!v.slice(4).split('|').includes(style):style===v;
  }
  case 'threads':{const match=/^(isle-\d)>=([1-3])$/.exec(v);if(!match)return false;const ends=['A','B','C'].map(thread=>tasks.filter(t=>t.series===match[1]&&t.thread===thread).sort((a,b)=>b.order-a.order)[0]).filter(Boolean);return ends.filter(t=>st.done.includes(t.id)).length>=Number(match[2]);}
 }};
 return [...groups.values()].some(group=>group.every(fact));
}
export function questEligible(s:Pick<CharacterState,'level'|'starsea'>,id:string,visiting=new Set<string>()):boolean{const t=tasks.find(t=>t.id===id);if(!t||t.frozen||t.hub_return||t.campaign!=='starsea')return false;
 if(!t.hub_node&&s.starsea?.seen.some(f=>f.startsWith('hub-node:'))&&/^ss-c0[3-6]$/.test(t.chapter??''))return false;
 if(t.hub_node){const i=['wind','mist','forge','frost','rift','dragon'].indexOf(t.hub_node.split('-')[0]);return s.starsea?.prologue?.done!==false&&(i===0||i>0&&Boolean(s.starsea?.bosses.includes('ss-map-boss-'+i)));}
 if(id==='ss-c01-n01')return s.starsea?.prologue?.done!==false;
 if(id==='hub-first-return')return Boolean(s.starsea?.seen.includes('hub-node:wind-story-1'));
 if(id.startsWith('hub-gate-wind-'))return Boolean(s.starsea?.seen.includes('hub-node:wind-story-1'));
 if(id.startsWith('hub-gate-mist-'))return Boolean(s.starsea?.bosses.includes('ss-map-boss-1'));
 return Boolean((!t.pre||s.starsea?.done.includes(t.pre))&&conditionMet(s,id,visiting));}
export function evaluateUnlocks(s:Pick<CharacterState,'level'|'starsea'>){const st=s.starsea as StarseaState|undefined;if(!st)return [];const added:string[]=[];for(let pass=0;pass<conditionGroups.size+1;pass++){let changed=false;for(const target of conditionGroups.keys()){const [kind,...rest]=target.split(':'),id=rest.join(':');if(!['feature','island','npc','hardmode'].includes(kind)||!conditionMet(s,target))continue;const arr=kind==='feature'?st.features:kind==='island'?st.islands:st.npcs;if(kind==='hardmode'){if(!st.hardmode){st.hardmode=true;changed=true;added.push(target);}}else if(!arr.includes(id)){arr.push(id);changed=true;added.push(target);}}if(!changed)break;}return added;}
export function conditionTargets(s:Pick<CharacterState,'level'|'starsea'>){return [...conditionGroups.keys()].filter(id=>conditionMet(s,id));}
export const maxActiveQuests=Number(questParameters.max_active??20);
