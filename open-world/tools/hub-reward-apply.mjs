// B4 writer only: numerical derivation belongs to hub-reward-derive.mjs.
// Usage: bundled-node --import tsx tools/hub-reward-apply.mjs --plan <local-plan.json>
//   --artifact-node-modules <bundled-node_modules>
// Writes workbook sources only. Run pnpm config:export and config:check serially afterward.
import fs from 'node:fs/promises';
import {hubRewardPlanSchema} from './spine/hub-reward-schema.ts';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const arg=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const planPath=arg('--plan'),modules=arg('--artifact-node-modules')??process.env.AW_ARTIFACT_NODE_MODULES;
if(!planPath||!modules)throw Error('Provide --plan and --artifact-node-modules from load_workspace_dependencies.');
const plan=hubRewardPlanSchema.parse(JSON.parse(await fs.readFile(path.resolve(planPath),'utf8')));
const integer=(value,label)=>{if(!Number.isSafeInteger(value)||value<0)throw Error(label+' must be a nonnegative integer.');};
const mapping=(value,label)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error(label+' must be an object.');return Object.entries(value);};
const nodeIds=['wind','mist'].flatMap(r=>['story-1','story-2','story-3','nest-1','nest-2','nest-3','hunt','tide','treasure','gate'].map(n=>r+'-'+n));
const gateIds=['hub-gate-wind-nests','hub-gate-wind-enhance','hub-gate-mist-hex','hub-gate-mist-talent','hub-gate-mist-dispatch'];
function exactIds(rows,ids,label){if(!Array.isArray(rows)||rows.length!==ids.length||new Set(rows.map(x=>x.id)).size!==ids.length||rows.some(x=>!ids.includes(x.id)))throw Error(label+' must contain every expected ID exactly once.');}
exactIds(plan.nodes,nodeIds,'nodes');exactIds(plan.gateQuests,gateIds,'gateQuests');
for(const row of plan.nodes){for(const key of ['xp','gold','material','shards','rep'])integer(row.reward?.[key],row.id+'.reward.'+key);if(row.reward.shardChance!==undefined&&(!Number.isFinite(row.reward.shardChance)||row.reward.shardChance<0||row.reward.shardChance>1))throw Error(row.id+' invalid shardChance');if(row.firstClearReward!==undefined&&(!Array.isArray(row.firstClearReward)||row.firstClearReward.some(x=>typeof x!=='string')))throw Error(row.id+' invalid firstClearReward');}
const materials=new Set(JSON.parse(await fs.readFile(path.join(root,'config/json/crafting-public.json'),'utf8')).materials.map(x=>x.id));
for(const row of plan.gateQuests){for(const key of ['gold','material','xp'])integer(row[key],row.id+'.'+key);for(const [id,n]of mapping(row.materials,row.id+'.materials')){if(!materials.has(id))throw Error('Unknown material '+id);integer(n,id);}}
const outside=plan.outside;if(!outside)throw Error('Missing outside numbers.');
for(const region of ['wind','mist']){const r=outside.dockRates?.[region];if(!r||!Number.isFinite(r.goldPerHour)||r.goldPerHour<0)throw Error('Invalid dock rate '+region);for(const [id,n]of mapping(r.materialsPerHour,region+'.materialsPerHour'))if(!materials.has(id)||!Number.isFinite(n)||n<0)throw Error('Invalid dock material '+id);}
for(const key of ['commissionRep','sideRep'])integer(outside[key],key);for(const key of ['craft','salvage','enhance','donate'])integer(outside.forgeRep?.[key],key);
for(const [id,offer]of mapping(outside.donationOffers??{},'donationOffers')){integer(offer.rep,id+'.rep');if(offer.rep<=0)throw Error('Donation reputation must be positive.');const costs=mapping(offer.materials,id+'.materials');if(!costs.length)throw Error('Donation requires costs.');for(const [material,n]of costs){integer(n,material);if(!materials.has(material)||n===0)throw Error('Invalid donation material '+material);}}
const recipes=new Set(JSON.parse(await fs.readFile(path.join(root,'config/json/crafting-public.json'),'utf8')).recipes.map(x=>x.id));
for(const [id,offer]of mapping(outside.recipeOffers??{},'recipeOffers')){if(!recipes.has(id)||!Number.isInteger(offer.tier)||offer.tier<1||offer.tier>4)throw Error('Invalid recipe offer '+id);for(const key of ['gold','material'])if(offer[key]!==undefined)integer(offer[key],id+'.'+key);}
const planIdentity=createHash('sha256').update(JSON.stringify(plan)).digest('hex');
const work=path.join(root,'.runtime/hub-b0-b4-20261021/b4-workbooks',planIdentity);await fs.mkdir(work,{recursive:true});
const moduleLink=path.join(work,'node_modules');try{await fs.symlink(path.resolve(modules),moduleLink,process.platform==='win32'?'junction':'dir');}catch(error){if(error.code!=='EEXIST')throw error;}
const resolve=createRequire(path.join(work,'package.json'));
const {FileBlob,SpreadsheetFile,Workbook}=await import(pathToFileURL(resolve.resolve('@oai/artifact-tool')).href);
// Artifact-tool threaded Comments survive XLSX import/export. They are field
// annotations required by AGENTS, not ordinary description cells or PNG text.
const annotatedWorkbooks=new WeakSet();
function annotate(wb,sheet,row,col,text){if(!annotatedWorkbooks.has(wb)){wb.comments.setSelf({displayName:'HUB 配置字段说明'});annotatedWorkbooks.add(wb);}wb.comments.addThread({cell:sheet.getRangeByIndexes(row,col,1,1)},text+' 唯一源：config/excel 工作簿；经 pnpm config:export 导出，服务端消费。数值来自经审核的 B4 推导计划，不在运行时另设第二份配置。');}
const workbookBefore=new Map(),digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const currentBytes=async file=>{try{return await fs.readFile(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}};
const backup=async name=>{const source=path.join(root,'config/excel',name),target=path.join(work,'before-'+name),bytes=await currentBytes(source);workbookBefore.set(name,bytes);if(bytes)try{await fs.writeFile(target,bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}};
await backup('航图.xlsx');await backup('任务.xlsx');await backup('港口收益.xlsx');
const stagedWorkbooks=[];
const save=async(wb,name)=>{wb.recalculate();const output=path.join(work,name);await(await SpreadsheetFile.exportXlsx(wb)).save(output);stagedWorkbooks.push({name,output});};
const render=async(wb,sheetName,range,file)=>{const blob=await wb.render({sheetName,range,scale:1});await fs.writeFile(path.join(work,file),new Uint8Array(await blob.arrayBuffer()));};
const chart=await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(root,'config/excel/航图.xlsx'))),nodes=chart.worksheets.getItem('节点'),nv=nodes.getUsedRange().values,nk=nv[1];
await render(chart,'节点','A1:F10','chart-before.png');for(const [key,type]of [['combatScale','json'],['dropCountScale','number'],['budgetReady','bool']])if(!nk.includes(key)){const col=nk.length;nk.push(key);nodes.getRangeByIndexes(0,col,3,1).values=[[key],[key],[type]];}
for(const [key,text]of Object.entries({combatScale:'局内敌人倍率，JSON {hp,attack}；单位为相对原曲线的倍数，均大于 0，缺省 1。出发冻结，仅调整样板遭遇强度，不改旧怪物曲线。',dropCountScale:'装备件数倍率，范围 0–1、缺省 1；无量纲。出发冻结，用于随机件数/普通掉装机会，不改品质权重、HEX 概率和首领保底。',budgetReady:'B4 数值就绪标志，布尔值，缺省 false。false 沿用旧击杀收入且节点追加奖励为零；true 使用冻结的全场预算，击杀与结算共用预算。只能在 B4 计划应用时设 true。',reward:'全场基础奖励 JSON：xp 为经验点、gold 为金币、material 为强化材料个数、shards 为残页张数、rep 为船台声望点，均为非负整数；shardChance 为额外 1 张残页的概率（0–1）。金币/经验/材料含击杀，结算只补余量；本日成功额外一份预算，残页和声望不翻倍。'}))annotate(chart,nodes,1,nk.indexOf(key),text);
for(const n of plan.nodes){const index=nv.findIndex((r,i)=>i>=3&&r[nk.indexOf('id')]===n.id);if(index<0)throw Error('Workbook node missing '+n.id);nodes.getRangeByIndexes(index,nk.indexOf('reward'),1,1).values=[[JSON.stringify(n.reward)]];if(n.estimatedMinutes)nodes.getRangeByIndexes(index,nk.indexOf('estimatedMinutes'),1,1).values=[[JSON.stringify(n.estimatedMinutes)]];nodes.getRangeByIndexes(index,nk.indexOf('combatScale'),1,1).values=[[JSON.stringify(n.combatScale??{hp:1,attack:1})]];nodes.getRangeByIndexes(index,nk.indexOf('dropCountScale'),1,1).values=[[n.dropCountScale??1]];nodes.getRangeByIndexes(index,nk.indexOf('budgetReady'),1,1).values=[[true]];nodes.getRangeByIndexes(index,nk.indexOf('firstClearReward'),1,1).values=[[JSON.stringify(n.firstClearReward)]];}
await save(chart,'航图.xlsx');await render(chart,'节点','A1:F10','chart-after.png');
const quests=await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(root,'config/excel/任务.xlsx'))),task=quests.worksheets.getItem('任务'),tv=task.getUsedRange().values,tk=tv[1];
if(!tk.includes('reward_materials')){const col=tk.length;tk.push('reward_materials');task.getRangeByIndexes(0,col,3,1).values=[['关口材料包'],['reward_materials'],['json']];}
annotate(quests,task,1,tk.indexOf('reward_materials'),'关口任务一次性材料包，JSON {materialId:非负整数数量}，单位为个；ID 必须属于 crafting-public 的材料表。写入角色 progression.materials，随任务完成档案幂等发放；缺省空对象，不改变旧任务。');
for(const q of plan.gateQuests){const index=tv.findIndex((r,i)=>i>=3&&r[tk.indexOf('id')]===q.id);if(index<0)throw Error('Workbook gate quest missing '+q.id);for(const [key,value]of Object.entries({reward_gold:q.gold,reward_xp:q.xp,reward_material:q.material,reward_materials:JSON.stringify(q.materials)}))task.getRangeByIndexes(index,tk.indexOf(key),1,1).values=[[value]];}
await save(quests,'任务.xlsx');
const wb=Workbook.create();
const fieldNotes={派遣:{region:'航区 ID，wind 或 mist；无单位。',goldPerHour:'单船派遣金币速率，单位金币/小时，可为非负小数；三船合计与快速收益需满足 M14 N6 上限。',materialsPerHour:'单船每小时材料速率，JSON {materialId:数量/小时}，数值非负；只允许本航区 T1 采集材料。'},声望:{id:'参数键：commissionRep、sideRep、craft、salvage、enhance、donate、commissionGoldScale 或 commissionXpShare。',value:'参数值：各声望参数为每次有效活动的非负整数声望点；commissionGoldScale 为旧 P55 金币倍率（0–1），commissionXpShare 为实际任务目标经验占比（0–0.5），倍率无量纲。'},捐献:{id:'服务端捐献方案 ID；无单位，须唯一。',materials:'一次捐献消耗，JSON {materialId:正整数个数}；必须为登记材料，服务端原子扣除，不能由客户端自报数量。',rep:'一次捐献所得工坊声望，单位点，正整数；同一命令重放不重复增加。'},配方:{id:'可学习配方 ID；必须引用 crafting-public 配方，不包含自动学会、图纸产出或修复配方。',tier:'要求的工坊阶级，整数 1–4；无单位。',gold:'学习一次消耗金币，非负整数金币数；缺省沿用既有 recipeLearn 成本。',material:'学习一次消耗强化材料，非负整数个数；缺省沿用既有 recipeLearn 成本，金币与材料总成本须大于零。'}};
const reputationNotes={commissionRep:'每完成一条合法委托的邮局声望点；每日完成上限不因本字段变化。',sideRep:'每首次完成一条真实 type=side 且非 hub-gate 任务的邮局声望点；节点/对白完成也适用，重放不重复。',craft:'每次实际成功制作的工坊声望点。',salvage:'每件实际成功分解装备的工坊声望点。',enhance:'每次实际成功强化的工坊声望点。',donate:'普通捐献行为的工坊声望单位；具体材料方案使用捐献页 rep，不额外重复计发。',commissionGoldScale:'委托金币乘数，无量纲 0–1；乘原 P55 任务金币后按服务端口径取整。',commissionXpShare:'委托目标经验占比，无量纲 0–0.5；节点任务按节点基础经验，击杀任务按实际目标口径。'};
function table(name,keys,types,rows){const sh=wb.worksheets.add(name);sh.getRange('A1').write([keys,keys,types,...rows.map(r=>keys.map((k,i)=>r[k]===undefined?null:types[i]==='json'?JSON.stringify(r[k]):r[k]))]);sh.getUsedRange().format.font={name:'Arial',size:10};sh.getUsedRange().format.columnWidth=24;sh.getRangeByIndexes(0,0,3,keys.length).format.fill='#DFE8F1';sh.freezePanes.freezeRows(3);for(const [col,key]of keys.entries())annotate(wb,sh,1,col,fieldNotes[name][key]);if(name==='声望')for(const [index,row]of rows.entries())annotate(wb,sh,index+3,keys.indexOf('value'),reputationNotes[row.id]);return sh;}
table('派遣',['region','goldPerHour','materialsPerHour'],['string','number','json'],Object.entries(outside.dockRates).map(([region,r])=>({region,...r})));
table('声望',['id','value'],['string','number'],[{id:'commissionGoldScale',value:outside.commissionGoldScale??1},{id:'commissionXpShare',value:outside.commissionXpShare??.5},{id:'commissionRep',value:outside.commissionRep},{id:'sideRep',value:outside.sideRep},...Object.entries(outside.forgeRep).map(([id,value])=>({id,value}))]);
table('捐献',['id','materials','rep'],['string','json','int'],Object.entries(outside.donationOffers??{}).map(([id,r])=>({id,...r})));
table('配方',['id','tier','gold','material'],['string','int','int','int'],Object.entries(outside.recipeOffers??{}).map(([id,r])=>({id,...r})));
wb.worksheets.add('导出').getRange('A1:B6').values=[['输出文件','hub-outside-numbers.json'],['页签','字段'],['派遣','dockRates'],['声望','reputation'],['捐献','donationOffers'],['配方','recipeOffers']];
wb.worksheets.add('说明').getRange('A1:B2').values=[['来源','tools/hub-reward-derive.mjs 推导计划'],['要求','所有数值来自推导计划。本工具不生成、不调整任何奖励数字。']];
await save(wb,'港口收益.xlsx');for(const name of ['派遣','声望','捐献','配方'])await render(wb,name,'A1:D10',`outside-${name}.png`);
const matches=(a,b)=>a===null||b===null?a===b:digest(a)===digest(b);
// Export/render all candidates before touching tracked files, then refuse
// concurrent edits. A partial filesystem failure rolls back only our bytes.
for(const {name}of stagedWorkbooks)if(!matches(await currentBytes(path.join(root,'config/excel',name)),workbookBefore.get(name)))throw Error('Workbook changed during B4 preparation: '+name);
const written=[];
try{for(const item of stagedWorkbooks){const target=path.join(root,'config/excel',item.name),temporary=path.join(root,'config/excel','.hub-'+randomUUID()+'.tmp');try{await fs.copyFile(item.output,temporary,fs.constants.COPYFILE_EXCL);if(!matches(await currentBytes(target),workbookBefore.get(item.name)))throw Error('Workbook changed before replacement: '+item.name);await fs.rename(temporary,target);written.push(item);}finally{await fs.unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}}}
catch(error){for(const item of written.reverse()){const target=path.join(root,'config/excel',item.name);if(!matches(await currentBytes(target),await fs.readFile(item.output)))throw new AggregateError([error], 'Workbook rollback refused because another editor changed '+item.name);const before=workbookBefore.get(item.name);if(before===null)await fs.unlink(target);else await fs.writeFile(target,before);}throw error;}
await fs.writeFile(path.join(work,'applied-workbooks.json'),JSON.stringify({planHash:digest(JSON.stringify(plan)),files:Object.fromEntries(await Promise.all(stagedWorkbooks.map(async({name})=>['config/excel/'+name,digest(await fs.readFile(path.join(root,'config/excel',name)))])))},null,2)+'\n');
console.log('HUB B4 workbooks applied: 20 nodes, 5 gate quests, port rates/offers. Raw previews and inspect files remain in .runtime.');



