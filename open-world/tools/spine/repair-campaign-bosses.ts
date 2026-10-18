/** 修复M8遗漏：旧区地图首领不能继承普通怪一刀线；按S2难度和新标准人比例独立推导。 */
import {regions} from '../../packages/content/index.ts';
import {resolveMonsterContent} from '../../packages/content/monsters.ts';
import {resolveMonsterSpawn,monsterLevelValues} from '../../packages/rules/monster-stats.ts';
import {interpolate} from './monsters.ts';
import {readJson,save,review,data,stamp,evidence} from './io.ts';
import {applySpinePlan,type SpineChange} from './apply.ts';
import {spineSchemas} from './schemas.ts';
const output=review+'/S8/runtime-repair/campaign-bosses',file='packages/content/monsters.json',raw=await readJson(file),oldPath=review+'/S0/source-before/'+file,old=resolveMonsterContent(await readJson(oldPath)),core=await readJson(review+'/S2/core-summary.json'),player=await readJson(data+'/spine-player.json'),changes:SpineChange[]=[],rows=[];
for(const [index,t] of raw.templates.entries())if(t.curve==='campaign'&&t.bossKey){
 const region=regions.find(r=>r.boss&&r.spawns.some(s=>s.boss&&s.monster?.template===t.id));if(!region)throw Error('旧区首领缺少原生地图 '+t.id);
 const spawn=region.spawns.find(s=>s.boss&&s.monster?.template===t.id)!,L=spawn.monster!.level,before=resolveMonsterSpawn({id:spawn.id,template:t.id,level:L,rank:'boss',x:spawn.x,y:spawn.y},old),at=monsterLevelValues(t.curve,L,raw),ref=monsterLevelValues(t.curve,t.referenceLevel,raw);
 const dpsRatio=interpolate(player.points,L,'D1')/interpolate(core.standards,L,'D1'),ehpRatio=interpolate(player.points,L,'EHP')/interpolate(core.standards,L,'EHP'),targetHp=before.hp*dpsRatio,targetAttack=before.attack*ehpRatio,after={...t.base,hp:Math.max(1,Math.round(targetHp/(at.hp/ref.hp*raw.ranks.boss.hp))),attack:Math.max(1,Math.round(targetAttack/(at.attack/ref.attack*raw.ranks.boss.attack)))};
 changes.push({file,path:['templates',index,'base'],before:t.base,after,basis:'S8修复M8旧区首领被普通怪一刀线压缩：保持S2实测标准人相对难度；目标HP=S2原生首领HP×新旧D1比，攻击=S2原生攻击×新旧EHP比，逆解模板/等级/档位。非自由调参。'});
 rows.push({template:t.id,region:region.id,level:L,original:{hp:before.hp,attack:before.attack},current:{hp:spawn.hp,attack:spawn.attack},dpsRatio,ehpRatio,targetHp,targetAttack,base:after,source:await evidence(oldPath)});
}
await save(output+'-plan.json',{...stamp(),changes,rows});await applySpinePlan('.',changes,spineSchemas,{apply:process.argv.includes('--apply'),output});await save(output+'-summary.json',{...stamp(),applied:process.argv.includes('--apply'),rows});console.log(JSON.stringify(rows));
