import type {Receipt,Snapshot} from '../../../packages/contracts/index.ts';
import {worldTables} from '../../../packages/content/world-tables.ts';
import {distance,type World} from '../../../packages/simulation/index.ts';
import {starseaAsset,type StarseaSceneObject} from './starsea-runtime-assets.ts';
import {islandOrder,materialName} from './crafting-model.ts';

/** Server limit for both manual and route gathering (packages/rules/crafting-gather.ts). */
export const gatherReach=2;
type Write=(path:string,body:object)=>Promise<'success'|'rejected'|'pending'|'busy'|undefined>;
type Deps={world:()=>World;snapshot:()=>Snapshot|undefined;ready:()=>boolean;write:Write;notice:(text:string)=>void;lastReceipt:()=>Receipt|undefined};
type Node=(typeof worldTables.objects)[number];

/** Placeholder world art per island until dedicated gather props ship: ore → split rocks, plant → berry bush. */
const prefix=(region:string)=>{const island=region.replace(/^ss-map-/,'');return islandOrder.indexOf(region)>0?`ow-art-${island}-`:'ow-art-';};
export function gatherArt(node:Pick<Node,'region'|'material'>){
 const ore=node.material?.endsWith('_ore'),p=prefix(node.region),names=ore?['rocks-split','rocks-stack','rocks']:['bush-berry','flowers-gold','flowers'];
 for(const name of names)for(const id of [p+name,'ow-art-'+name])if(starseaAsset(id))return id;
 return ore?'ow-art-rocks':'ow-art-flowers';
}

/**
 * Field gather nodes (docs/crafting-system-design.md §4). The server decides reach, once-per-entry and yield;
 * the client only shows ungathered nodes, sends E-key gathers and, in full auto, gathers nodes the route passes.
 */
export class GatherNodes{
 /** Nodes already tried by route gathering in this world; route mode never retries or detours. */
 private tried=new Set<string>();private world?:World;private pending=false;
 constructor(private deps:Deps){}
 /** Visible, ungathered gather rows in the current region. */
 nodes():Node[]{
  const s=this.deps.snapshot(),w=this.deps.world();if(!s)return [];
  const region=w.region.id,visible=s.worldView?new Set(s.worldView.objects.filter(o=>o.kind==='gather').map(o=>o.id)):undefined,field=s.field;
  const done=new Set(field?.region===region?field.gathered:[]);
  return worldTables.objects.filter(o=>o.kind==='gather'&&o.region===region&&o.material&&(visible?visible.has(o.id):!o.when&&!o.until)&&!done.has(o.id));
 }
 objects():StarseaSceneObject[]{return this.nodes().map(n=>({id:'gather:'+n.id,artId:gatherArt(n),position:{x:n.x,y:n.y},name:materialName(n.material!),label:'采集',enabled:true}));}
 /** Remaining / total for the current region, for the minimap caption. */
 count(){const w=this.deps.world(),total=worldTables.objects.filter(o=>o.kind==='gather'&&o.region===w.region.id).length;return {left:total?this.nodes().length:0,total};}
 nearest(){const p=this.deps.world().hero.position;return this.nodes().filter(n=>distance(n,p)<=gatherReach).sort((a,b)=>distance(a,p)-distance(b,p))[0];}

 /** Full auto: gather whatever the route already passes within reach; never steers the hero. */
 step(){
  const w=this.deps.world();if(w!==this.world){this.world=w;this.tried.clear();}
  if(w.mode!=='auto'||w.paused||this.pending||!this.deps.ready())return;
  const p=w.hero.position,node=this.nodes().find(n=>!this.tried.has(n.id)&&distance(n,p)<=gatherReach);
  if(node){this.tried.add(node.id);void this.gather(node.id,'route');}
 }
 async gather(id:string,mode:'manual'|'route'){
  const w=this.deps.world(),node=this.nodes().find(n=>n.id===id||'gather:'+n.id===id);if(!node||this.pending)return;
  if(distance(node,w.hero.position)>gatherReach){if(mode==='manual')this.deps.notice('再走近一点采集。');return;}
  this.pending=true;
  try{
   const result=await this.deps.write('field/gather',{region:w.region.id,node:node.id,position:{x:Math.round(w.hero.position.x*10)/10,y:Math.round(w.hero.position.y*10)/10},mode});
   const delta=result==='success'?this.deps.lastReceipt()?.delta:undefined,gained=Object.entries(delta?.materials??{}).filter(([,n])=>n>0);
   if(gained.length)this.deps.notice('采集 '+gained.map(([m,n])=>`${materialName(m)} ×${n}`).join('、'));
  }finally{this.pending=false;}
 }
}
