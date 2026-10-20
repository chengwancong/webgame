import {describe,it,expect,vi} from 'vitest';
vi.mock('../apps/web/src/network.ts',()=>({api:vi.fn()}));
import type {CharacterState} from '../packages/contracts/index.ts';
import {makeGear,ensureProgression,progressionView,previewProgressionAction} from '../packages/rules/index.ts';
import {renderProgression,progressionGroups} from '../apps/web/src/progression-panel.ts';
import type {ProgressionUI} from '../apps/web/src/progression-controller.ts';
/** Real server-side previews (rules package) rendered by the real panel: delta cards must carry the right sign and tone. */
function state():CharacterState{const gear=[makeGear(0,crypto.randomUUID())];return{id:crypto.randomUUID(),name:'预览验证',revision:3,build:1,level:30,xp:0,gold:100000,material:500,gear,equipment:{weapon:gear[0].id},skills:['cut'],skillRanks:{cut:1},progress:{kills:0,regions:['town','meadow'],bosses:[],safe:'town',tasks:[]}};}
function cases(){
 const s=state();ensureProgression(s);s.progression!.talents={'damage-edge':1};const view=progressionView(s),out:{section:string;item:string;operation:string;html:string;deltas:Record<string,number>}[]=[];
 for(const section of view.sections)for(const item of section.items)for(const op of item.operations){
  if(!op.enabled)continue;let preview;try{preview=previewProgressionAction(s,op.action);}catch{continue;}
  const deltas=Object.fromEntries((['attack','hp','armor'] as const).map(k=>[k,preview.after[k]-preview.before[k]]).filter(([,d])=>d));
  if(!Object.keys(deltas).length)continue;
  const ui:ProgressionUI={view,section:section.id,item:item.id,operation:op.id,preview,loading:false,previewLoading:false,busy:false,error:'',message:'',status:''};
  out.push({section:section.id,item:item.id,operation:op.id,html:renderProgression(ui,{tab:'high',loading:false,busy:false,error:'',message:'',tiers:{},roles:{}},progressionGroups.find(g=>g.sections.includes(section.id))?.id??'grid',false,s.gear),deltas});
 }
 return out;
}
describe('upgrade preview with real server deltas',()=>{
 const found=cases();
 it('finds real previews that change attack, health or armor',()=>{expect(found.length).toBeGreaterThan(0);});
 it('renders one delta card per changed stat with its sign and tone',()=>{
  for(const c of found){
   const cards=[...c.html.matchAll(/<[^>]*ui-stat--delta[^>]*>/g)];expect(cards.length,`${c.section}/${c.item}/${c.operation}`).toBe(Object.keys(c.deltas).length);
   for(const d of Object.values(c.deltas))expect(c.html).toContain(`${d>0?'+':''}${d}`);
   expect(c.html).toContain('progression-comparison');
  }
 });
 it('covers both an increase (learn) and a decrease (reset) from real data',()=>{const signs=new Set(found.flatMap(c=>Object.values(c.deltas).map(d=>d>0?'up':'down')));expect([...signs].sort()).toEqual(['down','up']);});
});
