// CONTENT-G01: preserve workbook schemas and styles, export with config:export.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=process.cwd(),work=path.join(root,'.runtime/content-g01');
await fs.mkdir(work,{recursive:true});
const modules=process.env.AW_ARTIFACT_NODE_MODULES;
if(!modules)throw Error('Set AW_ARTIFACT_NODE_MODULES to bundled dependencies.');
try{await fs.symlink(modules,path.join(work,'node_modules'),'junction');}catch(e){if(e.code!=='EEXIST')throw e;}
const require=createRequire(path.join(work,'package.json'));
const {FileBlob,SpreadsheetFile}=await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
const load=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const clean=x=>Object.fromEntries(Object.entries(x).filter(([k])=>k!=='_row'));
const before=new Map();
async function book(name){const file=path.join(root,'config/excel',name),bytes=await fs.readFile(file);before.set(name,bytes);try{await fs.writeFile(path.join(work,'before-'+name),bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}return SpreadsheetFile.importXlsx(await FileBlob.load(file));}
async function save(wb,name){wb.recalculate();const file=path.join(root,'config/excel',name);if(!before.get(name).equals(await fs.readFile(file)))throw Error('Concurrent workbook change: '+name);await(await SpreadsheetFile.exportXlsx(wb)).save(path.join(work,name));await fs.copyFile(path.join(work,name),file);}
function patchRows(wb,sheetName,rows,idKey='id'){
 const sh=wb.worksheets.getItem(sheetName),v=sh.getUsedRange().values,keys=v[1],types=v[2];
 for(const item of rows){const existing=v.findIndex((r,i)=>i>=3&&r[keys.indexOf(idKey)]===item[idKey]);const row=existing<0?v.length:existing;const data=existing<0?Array(keys.length).fill(null):[...v[row]];
  for(const[k,val]of Object.entries(item)){if(k==='_row')continue;const col=keys.indexOf(k);if(col<0)throw Error(sheetName+' missing field '+k);data[col]=val===undefined?null:types[col]==='json'?JSON.stringify(val):types[col]==='list'?val.join('|'):val;}
  if(existing<0)sh.getRangeByIndexes(row,0,1,keys.length).copyFrom(sh.getRangeByIndexes(3,0,1,keys.length),'all');
  sh.getRangeByIndexes(row,0,1,keys.length).values=[data];if(existing<0)v.push(data);else v[row]=data;
 }
}
if(process.argv.includes('--bounty')){const p=await load(path.join(work,'bounty-derivation.json')),wb=await book('任务.xlsx');patchRows(wb,'任务',p.filter(r=>r.cur!==r.next).map(r=>({id:r.id,reward_gold:r.next})));await save(wb,'任务.xlsx');console.log('P55 envelope applied from existing derivation');process.exit(0);}
if(process.argv.includes('--verify-views')){
 for(const[name,sheet,range,file]of [['航图.xlsx','节点','A24:F28','chart-final'],['任务.xlsx','任务','A70:H74','tasks-final'],['对话.xlsx','对话','A637:D640','dialogue-final'],['港口收益.xlsx','派遣','A1:C9','dock-final']]){const wb=await book(name);console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',options:{useRegex:true,maxResults:5},summary:name})).ndjson);const p=await wb.render({sheetName:sheet,range,scale:1});await fs.writeFile(path.join(work,file+'.png'),new Uint8Array(await p.arrayBuffer()));}process.exit(0);
}
if(process.argv.includes('--economy')){
 const plan=await load(path.join(work,'economy-plan.json')),wb=await book('港口收益.xlsx');
 patchRows(wb,'派遣',plan.rows.map(r=>r.dockRate),'region');patchRows(wb,'配方',plan.rows.flatMap(r=>r.recipeOffers));await save(wb,'港口收益.xlsx');
 for(const r of plan.rows)if(!r.checks.nodeRates||!r.checks.dailyGoldWithin40||r.checks.dockHourlyShare>.25+1e-9||r.checks.dockDayOnlineHours>1+1e-9)throw Error('Unverified regional economy '+r.region);
 const cw=await book('航图.xlsx');patchRows(cw,'节点',plan.rows.flatMap(r=>r.nodes.map(n=>({id:n.id,reward:n.reward,budgetReady:true,dropCountScale:n.g}))));await save(cw,'航图.xlsx');
 console.log('C7 verified formula budgets and dock/recipe offers applied together; natural combat validation remains pending.');process.exit(0);
}
if(process.argv.includes('--tasks')){
 const plan=await load(path.join(work,'task-plan.json'));
 const wb=await book('任务.xlsx');patchRows(wb,'任务',plan.tasks);
 await save(wb,'任务.xlsx');
 const dw=await book('对话.xlsx'),sh=dw.worksheets.getItem('对话'),values=sh.getUsedRange().values,keys=values[1];
 for(const row of plan.lines){const at=values.findIndex((v,i)=>i>=3&&v[keys.indexOf('group')]===row.group&&v[keys.indexOf('seq')]===row.seq);const index=at<0?values.length:at,data=keys.map(k=>row[k]??null);if(at<0)sh.getRangeByIndexes(index,0,1,keys.length).copyFrom(sh.getRangeByIndexes(3,0,1,keys.length),'all');sh.getRangeByIndexes(index,0,1,keys.length).values=[data];if(at<0)values.push(data);}
 await save(dw,'对话.xlsx');console.log('C2 task rows',plan.tasks.length,'dialogue additions',plan.lines.length);process.exit(0);
}
const chart=await book('航图.xlsx');
if(process.argv.includes('--chart-patch')){const patch=await load(path.join(work,'chart-patch.json'));patchRows(chart,'节点',patch);await save(chart,'航图.xlsx');console.log('Targeted chart patches',patch.length);process.exit(0);}
if(process.argv.includes('--preview')){console.log((await chart.inspect({kind:'sheet',include:'id,name'})).ndjson);const pic=await chart.render({sheetName:'节点',range:'A1:F8',scale:1});await fs.writeFile(path.join(work,'chart-before.png'),new Uint8Array(await pic.arrayBuffer()));process.exit(0);}
const plan=await load(path.join(work,'authored-plan.json'));
patchRows(chart,'节点',plan.nodes);patchRows(chart,'航区',plan.regions);
await save(chart,'航图.xlsx');
const preview=await chart.render({sheetName:'节点',range:'A24:F33',scale:1});await fs.writeFile(path.join(work,'chart-after.png'),new Uint8Array(await preview.arrayBuffer()));
console.log('C1 workbook rows written:',plan.nodes.length,'source SHA256',createHash('sha256').update(await fs.readFile('config/excel/航图.xlsx')).digest('hex'));
