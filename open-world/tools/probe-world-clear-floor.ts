// 数值来源已迁到 tools/spine；本文件保留历史探针，正式派生请使用 pnpm spine:check 与主干CLI。
import {mkdir,writeFile} from 'node:fs/promises';
import {worldTables} from '../packages/content/world-tables.ts';
import {regionById} from '../packages/content/index.ts';
import {versions} from '../packages/contracts/index.ts';
import {standard} from './standard-player-model.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {campSpawns} from '../packages/rules/world-camps.ts';
import {minimumClearMs,clearFloorTolerance} from '../apps/api/src/clear-floor.ts';
import {World,walkable} from '../packages/simulation/index.ts';
import {starseaIslands} from '../packages/content/starsea/index.ts';
const rows=[];
for(const zone of worldTables.zones.filter(z=>starseaIslands.includes(z.region))){const camp=worldTables.camps.find(c=>c.zone===zone.id)!,region=regionById(zone.region),state=standard(Math.ceil((zone.levelBand[0]+zone.levelBand[1])/2)),build=resolveBuild(state),spawns=campSpawns(region,worldTables,camp,1),floor=minimumClearMs(state,region.id,camp,spawns);
 let position;for(const radius of [5,4,3])for(let n=0;n<16&&!position;n++){const p={x:camp.x+Math.cos(n*Math.PI/8)*radius,y:camp.y+Math.sin(n*Math.PI/8)*radius};if(walkable(region,p,1))position=p;}if(!position)throw Error('No legal camp probe position');
 const w=new World({...region,safe:position},build.stats,build.resolvedSkills,spawns,[],41);w.setMode('auto');while(w.enemies.some(e=>e.alive)&&w.hero.hp>0&&w.tick<90*30)w.step();const completed=w.enemies.every(e=>!e.alive),ms=w.tick/30*1000,wouldFlag=completed&&ms<floor*clearFloorTolerance;rows.push({zone:zone.id,camp:camp.id,level:state.level,kills:w.kills.length,seconds:ms/1000,completed,dead:w.hero.hp<=0,floorMs:floor,thresholdMs:floor*clearFloorTolerance,wouldFlag,requestedSkills:state.skills,actualSkills:build.resolvedSkills.map(s=>s.id)});
}
await mkdir('docs/reviews/open-world-m2-m4/W10',{recursive:true});await writeFile('docs/reviews/open-world-m2-m4/W10/clear-floor.json',JSON.stringify({versions,seed:41,rows,passed:rows.every(r=>!r.wouldFlag),policy:'Existing service floor/tolerance unchanged. Unsupported source effects deliberately disable the lower-bound check instead of risking a false penalty.',limits:['Actual authored camp encounters and standard builds; failed/dead encounters stay in the report.','No punishment rules, authentication or version gates are modified. This is a conservative false-positive probe, not a human kill-rate distribution.']},null,2));console.log(JSON.stringify({samples:rows.length,falseFlags:rows.filter(r=>r.wouldFlag).length,skippedUnsupported:rows.filter(r=>r.floorMs===0).length}));
