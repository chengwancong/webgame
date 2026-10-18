import {World} from '../../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../../packages/content/index.ts';
export const stats={hp:900,attack:30,armor:5,speed:6,mana:100,regen:10,effects:[],critChance:.35,critMultiplier:1.5};
export function trace(){
 const w=new World(regionById('meadow'),stats,skillCatalog.filter(s=>['cut','bolt','ward'].includes(s.id)),regionById('meadow').spawns,[],41);
 w.radius=100;w.setMode('auto');const hits=[];
 for(let i=0;i<600;i++){w.step();hits.push(...w.events.filter(e=>e.type==='hit_resolved').map(e=>({tick:e.tick,id:e.id,amount:e.amount,skill:e.skill})));}
 return {hits,hero:w.hero,kills:w.kills,randomState:(w.exportCheckpoint().data as any).randomState};
}
