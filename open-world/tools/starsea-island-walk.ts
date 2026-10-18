// 星潮海野外走图模型：期望角色从落点走到首领门，遇到怪物就停下战斗（真实战斗核心、真实野外怪群）。
// 运行：npx tsx tools/starsea-island-walk.ts
import {World} from '../packages/simulation/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {starseaRegions,islandBands} from '../packages/content/starsea/index.ts';
import {character} from './starsea-power-model.ts';
const islands=['ss-map-wind','ss-map-mist','ss-map-forge','ss-map-frost','ss-map-rift','ss-map-dragon'];
islands.forEach((id,i)=>{
 const r:any=starseaRegions.find(r=>r.id===id)!,[low,high]=islandBands[i],gate=r.landmarks.find((l:any)=>l.name==='gate'),dest={x:gate.x,y:gate.y};
 for(const L of [low,Math.round((low+high)/2),high]){
  const s=character(L,'normal',Math.max(1,L-2));s.skills=[...new Set([...s.skills,'cut','bolt','ward'])];for(const k of s.skills)s.skillRanks[k]??=1;
  const b=resolveBuild(s),w=new World(r,b.stats,b.resolvedSkills,r.spawns,[],5);w.setMode('semi');
  let t=0,minHp=1;for(;t<30*300;t++){
   const threat=w.enemies.some(e=>e.alive&&e.engaged&&Math.hypot(e.position.x-w.hero.position.x,e.position.y-w.hero.position.y)<9);
   if(threat&&w.isWalkingTo(dest))w.cancelWalk();else if(!threat&&!w.isWalkingTo(dest))w.go(dest);
   w.step();minHp=Math.min(minHp,w.hero.hp/b.stats.hp);if(w.hero.hp<=0||Math.hypot(w.hero.position.x-dest.x,w.hero.position.y-dest.y)<1)break;}
  console.log(id,'L'+L,w.hero.hp<=0?'DIED':t>=30*300?'TIMEOUT':'ok',(t/30).toFixed(0)+'s','minHp',(minHp*100).toFixed(0)+'%','kills',w.enemies.filter(e=>!e.alive).length+'/'+w.enemies.length);
 }
});
