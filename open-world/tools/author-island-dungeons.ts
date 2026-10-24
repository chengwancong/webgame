import {readFile,writeFile} from 'node:fs/promises';
import '../packages/content/open-world/index.ts';
import {registerDungeonRegion,regionById} from '../packages/content/index.ts';
import {resolveDungeonContent} from '../packages/content/dungeons.ts';
import {generateFieldDungeonStage} from './generate-field-dungeon.ts';
import {measureWallBasis} from './wall-probe.ts';
import {standard} from './standard-player-model.ts';
import {calibratedWallScale} from './apply-dungeon-walls.ts';
const n=Number(process.argv[2]??1),island=['wind','mist','forge','frost','rift','dragon'][n-1];if(!island)throw Error('Island1–6 required');
const root='packages/content/',stages=JSON.parse(await readFile(root+'field-dungeon-stages.json','utf8')),dungeons=JSON.parse(await readFile(root+'dungeons.json','utf8')),flow=JSON.parse(await readFile('.design/numeric-flow-20261006/flow.json','utf8'));
const catalogues=await Promise.all(['open-world.v1.json','open-world-five.v1.json'].map(async f=>JSON.parse(await readFile('packages/asset-manifest/'+f,'utf8')))),assets=catalogues.flatMap(c=>c.assets).filter(a=>a.island===island||a.island==='shared'),chests=assets.filter(a=>a.category==='chest'),region='ss-map-'+island;
const levels=[[4,6,8],[10,12,15],[16,18,21],[23,25,27],[29,31,32],[34,36,37]][n-1],names=[['风车地窖','沉船货舱','船坞遗址'],['雾铃树穴','废弃邮站','军需暗库'],['输能检修道','冷却井','炉心遗构'],['冻舰底舱','观测冰窟','星盘残室'],['沉星密仓','裂隙炮台','界桥地窖'],['龙骨洞穴','旧祭遗堂','航网机库']][n-1];
stages.stages=stages.stages.filter((s:any)=>s.artIsland!==island);dungeons.definitions=dungeons.definitions.filter((d:any)=>!d.id.startsWith('field-'+island+'-'));
const added=[];
for(let d=1;d<=3;d++){
 const ids=[];let finalRegion:ReturnType<typeof generateFieldDungeonStage>['region']|undefined;
 for(let s=1;s<=3;s++){
  const id=`ss-dg-${island}-${d}-${s}`,pack=s===3?[{template:`ow-boss-${island}-${d}`,rank:'boss',count:1,center:{x:27,y:24},radius:1},{template:`ow-mon-${island}-1`,rank:'normal',count:2,center:{x:25,y:21},radius:2}]:[{template:`ow-mon-${island}-1`,rank:'normal',count:8,center:{x:21,y:24},radius:4},{template:`ow-mon-${island}-2`,rank:'normal',count:4,center:{x:28,y:25},radius:4},{template:`ow-elite-${island}`,rank:'elite',count:2,center:{x:30,y:18},radius:2}];
  const spec={id,name:names[d-1]+`·${s===3?'深处':'入口'+s}`,island:region,artIsland:island,chapter:n,stage:s,seed:900+n*100+d*10+s,level:levels[d-1],safe:{x:7,y:24},portal:{x:6,y:24},pack,boss:s===3,chests:s===1?[{id:'cache',name:'遗落的地城宝箱',x:15,y:30,resource:chests[0].id,openResource:chests[1].id}]:[],rockCount:8,backdrop:'ss-scene-sky'};
  stages.stages.push(spec);ids.push(id);const produced=generateFieldDungeonStage(spec,catalogues);if(s===3)finalRegion=produced.region;if(!(()=>{try{return regionById(id)}catch{return null}})())registerDungeonRegion(produced.region,region);
 }
 const definition={id:`field-${island}-${d}`,name:names[d-1],kind:'normal',profiles:['realtime'],area:region,stages:ids,numericStage:(n-1)*3+d,bossBudgetSeconds:240,level:levels[d-1],worldDrops:true,policy:{feature:'field-dungeon' as const,monsterLevel:levels[d-1],timeLimitSeconds:1800,returnRegion:'ss-map-port',normalGoals:{killCount:1,eliteCount:1},enemyScale:{hp:1,attack:1,hpPerStage:0,attackPerStage:0}},reward:{gold:20,xp:40,material:0}};
 dungeons.definitions.push(definition);
 const resolved=resolveDungeonContent(dungeons).definitions.find(x=>x.id===definition.id)!,basis=measureWallBasis({definition:resolved,region:finalRegion!,character:standard(levels[d-1]),stage:definition.numericStage,seed:41,seeds:[41],samplesPerRatio:1,maxSeconds:240,worldLine:'starsea'}),target=flow.stages[definition.numericStage-1],scale=calibratedWallScale(target,basis);
 definition.policy.enemyScale={...definition.policy.enemyScale,...scale};added.push({definition:definition.id,level:levels[d-1],stage:definition.numericStage,basis,scale});
}
await writeFile(root+'field-dungeon-stages.json',JSON.stringify(stages,null,2)+'\n');await writeFile(root+'dungeons.json',JSON.stringify(dungeons,null,2)+'\n');await writeFile(`docs/reviews/open-world-m2-m4/W${n+3}/dungeon-authoring.json`,JSON.stringify({island,added,source:'actual30s World boss basis and numeric flow; final stageHP/attack declared before entry'},null,2)+'\n');console.log(JSON.stringify({island,dungeons:added}));
