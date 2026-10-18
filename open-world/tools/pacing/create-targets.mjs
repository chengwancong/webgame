// Execute a copy in a conversation-owned directory linked to bundled artifact-tool.
import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const root=resolve(process.argv[2]),out=resolve(root,'docs/reviews/pacing-tool-20261010'),data=JSON.parse(await fs.readFile(resolve(out,'P1-target-inputs.json'),'utf8'));
const wb=Workbook.create();
const sheets=Object.fromEntries(['升级段里程碑','巅峰段完成度','BD强弱表','说明','导出'].map(name=>[name,wb.worksheets.add(name)]));
wb.comments.setSelf({displayName:'User'});
function table(name,headers,keys,types,rows,widths){
 const s=sheets[name],last=String.fromCharCode(64+headers.length),end=rows.length+3;s.showGridLines=false;
 s.getRange(`A1:${last}${end}`).values=[headers,keys,types,...rows];s.getRange(`A1:${last}${end}`).format.font={name:'Arial',size:11,color:'#283941'};
 s.getRange(`A1:${last}1`).format={fill:'#3F514A',font:{bold:true,color:'#FFFFFF'},rowHeight:32,wrapText:true,horizontalAlignment:'center',verticalAlignment:'center'};
 s.getRange(`A2:${last}3`).format={fill:'#F1EDDF',font:{color:'#697A7B',size:10},rowHeight:22};
 s.getRange(`A4:${last}${end}`).format={rowHeight:28,verticalAlignment:'center'};
 s.freezePanes.freezeRows(3);s.freezePanes.freezeColumns(2);
 for(let i=0;i<headers.length;i++){const c=String.fromCharCode(65+i);s.getRange(`${c}1:${c}${end}`).format.columnWidthPx=widths[i]??140;wb.notes.add({id:name+':'+c+'1',target:{cell:{sheetName:name,sheetId:s.sheetId,address:c+'1'}},authorId:'',createdAt:'',body:{plainText:`${headers[i]}；字段 ${keys[i]}；类型 ${types[i]}。第4行起数据。数值单位以表头为准。`}});}
 return s;
}
const mainGoalRow=4;
const levelRows=[...data.levels,...data.bosses].map(r=>[r.id,r.kind,r.name,r.level,r.currentMinutes,null,r.wallMinutes,r.method,r.bossKillSeconds??null,r.baselineKillSeconds??null,r.inferredDps??null,r.enemyHp??null,r.template??null]);
const levels=table('升级段里程碑',['里程碑ID','类别','里程碑','等级','当前虚拟分钟','目标虚拟分钟','墙目标分钟','跨越方式','首领目标秒','基线击杀秒','基线推算输出/秒','基线首领生命','怪物模板'],['id','kind','name','level','currentMinutes','targetMinutes','wallMinutes','method','bossKillSeconds','baselineKillSeconds','inferredDps','enemyHp','template'],['string','string','string','int','number','number','number','string','number','number','number','number','string'],levelRows,[125,75,155,65,120,120,110,240,110,110,140,120,180]);
for(let i=0;i<levelRows.length;i++)levels.getRange('F'+(i+4)).formulas=[[`=E${i+4}/${data.baselineMinutes}*'说明'!$B$${mainGoalRow}`]];
levels.getRange('E4:G'+(levelRows.length+3)).setNumberFormat('0.00');levels.getRange('F4:G'+(levelRows.length+3)).format.fill='#FFF1C2';
const ending=table('巅峰段完成度',['目标ID','养成线','总量','目标完成度','校准产出/虚拟分','目标预算分钟','单位','测量口径','消耗键','说明'],['id','name','total','target','rate','minutes','unit','measure','costKey','notes'],['string','string','int','number','number','number','string','string','string','string'],data.endgame.map(r=>[r.id,r.name,r.total,r.target,r.rate,r.minutes,r.unit,r.measure,r.costKey,r.notes]),[155,165,70,115,145,130,75,155,140,420]);ending.getRange('D4:D'+(data.endgame.length+3)).setNumberFormat('0%');ending.getRange('D4:F'+(data.endgame.length+3)).format.fill='#FFF1C2';ending.getRange('E4:E'+(data.endgame.length+3)).setNumberFormat('0.0000');
const bdRows=[['weights','用户指定权重',...data.weights,null,.05,null],...data.bd.map(r=>[r.id,r.name,...r.targets,null,.05,JSON.stringify(r.profile)])];
const bd=table('BD强弱表',['构筑ID','代表构筑','单体首领','群怪清图','持续生存','精英爆发','机动安全','加权预算','预算容差','实际构筑声明'],['id','name','single','clear','survival','elite','safety','budget','tolerance','profile'],['string','string','number','number','number','number','number','number','number','json'],bdRows,[115,155,115,115,115,115,115,115,110,440]);
for(let r=5;r<=12;r++)bd.getRange('H'+r).formulas=[[`=SUMPRODUCT(C${r}:G${r},$C$4:$G$4)`]];
bd.getRange('C4:H12').setNumberFormat('0.000');bd.getRange('I4:I12').setNumberFormat('0%');bd.getRange('C5:G12').format.fill='#FFF1C2';bd.getRange('C4:G4').format.fill='#DFE8E2';
const guide=table('说明',['参数ID','值','用途'],['id','value','notes'],['string','json','string'],data.settings.map(([id,value,notes])=>[id,typeof value==='number'||typeof value==='boolean'?value:JSON.stringify(value),notes]),[190,450,560]);guide.getRange('B4:B'+(data.settings.length+3)).format.fill='#FFF1C2';
const exp=sheets['导出'];exp.getRange('A1:B6').values=[['输出文件','pacing-targets.json'],['页签','导出键'],['升级段里程碑','milestones'],['巅峰段完成度','completion'],['BD强弱表','builds'],['说明','settings']];exp.getRange('A1:B6').format.font={name:'Arial',size:11};exp.getRange('A1:B6').format.columnWidthPx=240;exp.showGridLines=false;
wb.recalculate();
const inspection=await wb.inspect({kind:'table',range:'BD强弱表!A4:I12',include:'values,formulas',tableMaxRows:9,tableMaxCols:9,maxChars:6000});await fs.writeFile(resolve(out,'P1-workbook-inspect.txt'),inspection.ndjson);
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:30},maxChars:2000});await fs.writeFile(resolve(out,'P1-workbook-errors.txt'),errors.ndjson);
for(const [name,range] of [['升级段里程碑','A1:I15'],['巅峰段完成度','A1:I22'],['BD强弱表','A1:I12'],['说明','A1:C13'],['导出','A1:B6']]){const image=await wb.render({sheetName:name,range,scale:1,format:'png'});await fs.writeFile(resolve(out,'P1-'+name+'.png'),new Uint8Array(await image.arrayBuffer()));}
await (await SpreadsheetFile.exportXlsx(wb)).save(resolve(root,'config/excel/节奏目标.xlsx'));
console.log('Saved target workbook and five sheet previews.');
