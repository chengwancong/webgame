import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {versions} from '../packages/contracts/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {starseaMaps,starseaCampaign} from '../packages/content/starsea/index.ts';
import {monsterContent} from '../packages/content/monsters.ts';
const out='docs/reviews/open-world-m2-m4/W0';await mkdir(out,{recursive:true});
const rawStatus=execFileSync('git',['status','--porcelain=v1','-z'],{encoding:'utf8',maxBuffer:8e6});
await writeFile(out+'/pre-existing-worktree.json',JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),capturedAt:new Date().toISOString(),porcelain:rawStatus.split('\0').filter(Boolean)},null,2)+'\n');
const json=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const tasks=await json('config/json/tasks.json'),npcs=await json('config/json/npcs.json'),dungeons=await json('packages/content/dungeons.json');
const counts=Object.fromEntries(Object.entries(worldTables).filter(([key])=>key!=='source').map(([key,rows])=>[key,(rows as unknown[]).length]));
const islands=starseaMaps.filter(m=>m.kind==='island').map(m=>({island:m.id,name:m.name,size:[m.width,m.height],production512:false,counts:Object.fromEntries(Object.entries(worldTables).filter(([key])=>key!=='source').map(([key,rows])=>[key,(rows as {region:string}[]).filter(x=>x.region===m.id).length])),tasks:tasks.tasks.filter((x:any)=>x.campaign==='starsea'&&x.chapter===starseaCampaign.chapters.find(c=>c.map===m.id)?.id).length}));
let live:unknown;try{live=await(await fetch('http://127.0.0.1:8611/api/health')).json();}catch(e){live={error:String(e)};}
const report={versions,live,counts,islands,monsterTemplates:monsterContent.templates.length,ranks:monsterContent.ranks,dungeons:dungeons.definitions?.length??dungeons.dungeons?.length,starseaTasks:tasks.tasks.filter((x:any)=>x.campaign==='starsea').length,regionalNpcs:npcs.npcs.length,art:(await Promise.all(['open-world.v1.json','open-world-five.v1.json'].map(async path=>{const m=await json('packages/asset-manifest/'+path);return {path,assets:m.assets.length,gameplayIntegrated:m.gameplayIntegrated};}))),limits:'Counts are runtime table/monster loaders and existing production maps. No completion is inferred from file presence.'};
await writeFile(out+'/baseline.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
