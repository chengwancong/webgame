// 数值来源已迁到 tools/spine；原算法保留作历史参考，不再形成第二个写入入口。
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import source from '../packages/content/legacy-dungeon-calibration.json';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {regionById} from '../packages/content/index.ts';
import {dungeonSpawns} from '../packages/rules/dungeon-build.ts';
import {versions} from '../packages/contracts/index.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {World,walkable} from '../packages/simulation/index.ts';
import {legacySpineEntry} from './spine/legacy.ts';
if(process.argv[1]?.replaceAll('\\','/').endsWith('/recalibrate-legacy-dungeons.ts'))await legacySpineEntry('recalibrate-legacy-dungeons');
/** 历史算法仅保留源代码；当前CLI只执行上面的主干校验。 */
async function historicalCalibration(){
const p=z.number().positive(),cfg=z.object({source:z.string(),targetSeconds:z.object({normal:p,trial:p,high:p,nightmare:p,raid:p}).strict(),raidSupportWeight:p.max(1),bossEfficiency:p.max(1),basicHitHpRatio:p.max(1)}).strict().parse(source);
const raw=JSON.parse(await readFile('packages/content/dungeons.json','utf8')),bytes=await readFile('.design/standard-player-20261005/model.json'),model=JSON.parse(bytes.toString()),changes=[];
for(const d of dungeonContent.definitions.filter(d=>d.feature!=='field-dungeon')){
 const stage=d.stages.length-1,region=regionById(d.stages[stage]),spawns=dungeonSpawns(region.spawns,d.policy,d.policy.minTier,stage,[],monsterContent,'starsea'),boss=spawns.find(e=>e.boss);if(!boss?.monster)throw Error('Legacy dungeon lacks an executable boss '+d.id);
 const level=Math.min(60,Math.max(d.level,boss.monster.level)),row=model.rows.find((r:any)=>r.level===level),roles=d.policy.party.roles,party=d.kind==='raid'?Object.entries(roles).reduce((sum,[role,n])=>sum+n*(role==='damage'?1:cfg.raidSupportWeight),0):1;
 if(!row||party<=0)throw Error('Missing actual standard model or independent party composition '+d.id);
 const hp=d.policy.enemyScale.hp*(row.full.dps1*cfg.bossEfficiency*cfg.targetSeconds[d.kind as keyof typeof cfg.targetSeconds]*party)/boss.hp,attack=d.policy.enemyScale.attack*(row.full.hp*cfg.basicHitHpRatio)/boss.attack;
 const declared=raw.definitions.find((entry:any)=>entry.id===d.id);declared.policy??={};declared.policy.enemyScale={...declared.policy.enemyScale,hp,attack};
 let point;for(const radius of [1.25,2,3,4])for(let n=0;n<16&&!point;n++){const q={x:boss.x+Math.cos(n*Math.PI/8)*radius,y:boss.y+Math.sin(n*Math.PI/8)*radius};if(walkable(region,q,1))point=q;}if(!point)throw Error('No stationary measurement position '+d.id);
 const w=new World({...region,safe:point},{hp:1e15,attack:0,armor:0,speed:0,mana:0,regen:0,effects:[]},[],[boss],[],41);w.setMode('manual');let damage=0,hits=0;for(let tick=0;tick<900;tick++){w.step();for(const e of w.events)if(e.type==='hit_resolved'&&e.id===w.playerId){damage+=e.amount??0;hits++;}}
 changes.push({dungeon:d.id,level,party,stage,before:d.policy.enemyScale,after:{hp,attack},basis:{bossHp:boss.hp,basicAttack:boss.attack,bossRawDps:damage/30,hits,seconds:w.tick/30,standardDps:row.full.dps1,standardHp:row.full.hp},targetSeconds:cfg.targetSeconds[d.kind as keyof typeof cfg.targetSeconds]});
}
const folder='docs/reviews/open-world-m2-m4/W10';await mkdir(folder,{recursive:true});await writeFile(folder+'/legacy-dungeon-calibration.json',JSON.stringify({versions,seed:41,modelSha256:createHash('sha256').update(bytes).digest('hex'),parameters:cfg,changes,limits:['Actual dungeonSpawns and full-health stationary World damage; target TTK and basic-hit life share remain the declared spreadsheet design, not player success-rate evidence.','Independent party role weighting is an expected DPS budget. It does not replace multiplayer runtime verification.','Only new content declarations are written. Existing frozen instances retain old parameters.']},null,2));await writeFile('packages/content/dungeons.json',JSON.stringify(raw,null,2)+'\n');console.log(JSON.stringify({recalibrated:changes.length}));

}
