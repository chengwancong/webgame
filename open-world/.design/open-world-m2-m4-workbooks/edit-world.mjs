import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile,Workbook} from '@oai/artifact-tool';
const root='G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world',dir=root+'/.design/open-world-m2-m4-workbooks';
const path=root+'/config/excel/世界.xlsx';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(path));
if(process.argv.includes('--feature-labels')){
 const book=await SpreadsheetFile.importXlsx(await FileBlob.load(root+'/config/excel/章节.xlsx')),sheet=book.worksheets.getItem('功能解锁'),used=sheet.getUsedRange().values,ids=new Set(used.slice(3).map(r=>r[0]));
 const rows=[['sprint','疾跑','feature:sprint','完成落点求生或达到2级。','完成落点求生或达到2级。'],['waypoint','航标传送','feature:waypoint','先触碰任意航标。','先触碰任意航标。'],['outpost','前哨补给','feature:outpost','先到达任意前哨。','先到达任意前哨。'],['events','世界事件','feature:events','完成抢救船台或达到5级。','完成抢救船台或达到5级。'],['bounty','悬赏板','feature:bounty','完成抢救船台，或到达前哨且达到5级。','完成抢救船台，或到达前哨且达到5级。'],['field-dungeon','野外地城','feature:field-dungeon','完成落点求生或达到3级。','完成落点求生或达到3级。']].filter(r=>!ids.has(r[0]));
 if(rows.length){sheet.getRangeByIndexes(used.length,0,rows.length,5).values=rows;sheet.getRangeByIndexes(used.length,0,rows.length,5).format.font={name:'Arial',size:11};}
 book.recalculate();await fs.writeFile(dir+'/feature-labels.png',new Uint8Array(await(await book.render({sheetName:'功能解锁',range:'A10:E18',scale:1})).arrayBuffer()));await(await SpreadsheetFile.exportXlsx(book)).save(dir+'/章节-feature-labels.xlsx');console.log('Authored six system feature labels');process.exit(0);
}
if(process.argv.includes('--phases')){
 const phaseFields=[['出现条件','when','string','任务.xlsx条件页target；空为始终出现。'],['移除条件','until','string','任务.xlsx条件页target；命中后隐藏，保留已有回执和冻结轮次。']];
 const placed=[['定义ID','id','string','稳定世界物件编号。'],['地图','region','string','所属正式岛。'],['分区','zone','string','所属分区编号。'],['横坐标','x','number','世界导航格坐标。'],['纵坐标','y','number','世界导航格坐标。']];
 const additions={
  '前哨':['outposts',[...placed,['名称','name','string','前哨显示名称。'],['资源','resource','string','正式资源清单编号。'],['航标','waypoint','string','可选传送点编号。'],...phaseFields]],
  '物件':['objects',[...placed,['名称','name','string','世界物件名称。'],['类型','kind','string','物件用途。'],['资源','resource','string','正式资源清单编号。'],['地标','landmark','string','可选地标编号。'],...phaseFields]],
  '商人':['merchants',[...placed,['人物','npc','string','NPC表编号。'],['名称','name','string','商人显示名称。'],['资源','resource','string','正式角色资源编号。'],['服务','service','string','服务入口显示名称。'],...phaseFields]],
 };
 const add=(book,name,fields)=>{let sh;try{sh=book.worksheets.getItem(name);}catch{sh=book.worksheets.add(name);sh.freezePanes.freezeRows(3);}const old=sh.getRange('A2:AZ2').values[0].filter(v=>v!==null&&v!=='');fields=fields.filter(f=>!old.includes(f[1]));if(!fields.length)return;const start=old.length;sh.getRangeByIndexes(0,start,3,fields.length).values=[fields.map(f=>f[0]),fields.map(f=>f[1]),fields.map(f=>f[2])];sh.getRangeByIndexes(0,start,3,fields.length).format.columnWidth=22;sh.getRangeByIndexes(0,start,3,fields.length).format.font={name:'Arial',size:11,color:'#293940'};sh.getRangeByIndexes(0,start,1,fields.length).format.fill='#EFCF85';fields.forEach((f,i)=>{let n=start+i+1,col='';while(n){n--;col=String.fromCharCode(65+n%26)+col;n=Math.floor(n/26);}book.notes.add({id:name+':'+col+'1',target:{cell:{sheetName:name,sheetId:sh.sheetId,address:col+'1'}},authorId:'',createdAt:'',body:{plainText:f[3]}});});};
 await fs.writeFile(dir+'/phase-before-world.png',new Uint8Array(await(await wb.render({sheetName:'营地',range:'G1:J6',scale:1})).arrayBuffer()));
 for(const name of ['营地','传送点','地标','门'])add(wb,name,phaseFields);
 add(wb,'事件',[['状态图标','markerResource','string','小地图和全图使用正式world-state资源。'],['活动物件','activeResource','string','进行中使用正式event-prop资源。'],['冷却物件','cooldownResource','string','冷却中使用正式event-prop或world-state资源。'],['开始特效','startEffect','string','开始实例时播放正式event-effect资源。'],['成功特效','successEffect','string','服务端判定成功时播放正式event-effect资源。'],['失败特效','failureEffect','string','服务端判定失败时播放正式event-effect资源。']]);
 add(wb,'营地',[['群体预算','budget','json','可选{count,health,roles,healthWeights}；人数和总生命由服务端按角色配比分配，未声明则按pack。']]);
 const ex=wb.worksheets.getItem('导出'),bindings=ex.getUsedRange().values,existing=bindings.filter(r=>r[0]).map(r=>r[0]);let row=bindings.length;
 for(const [name,[key,fields]]of Object.entries(additions)){add(wb,name,fields);if(!existing.includes(name))ex.getRangeByIndexes(row++,0,1,2).values=[[name,key]];}
 wb.recalculate();await(await SpreadsheetFile.exportXlsx(wb)).save(dir+'/世界-phase.xlsx');
 const npc=await SpreadsheetFile.importXlsx(await FileBlob.load(root+'/config/excel/NPC.xlsx'));await fs.writeFile(dir+'/phase-before-npc.png',new Uint8Array(await(await npc.render({sheetName:'NPC',range:'A1:H6',scale:1})).arrayBuffer()));
 add(npc,'NPC',phaseFields);add(npc,'站位',[['站位ID','id','string','同人物各相位站位的独立编号。'],['人物','npc','string','NPC表编号。'],['地图','map','string','所属地图。'],['地标','landmark','string','可选世界地标编号。'],['横坐标','x','number','世界导航格坐标。'],['纵坐标','y','number','世界导航格坐标。'],...phaseFields]);
 const ne=npc.worksheets.getItem('导出'),nb=ne.getUsedRange().values;if(!nb.some(r=>r[0]==='站位'))ne.getRangeByIndexes(nb.length,0,1,2).values=[['站位','positions']];npc.recalculate();await(await SpreadsheetFile.exportXlsx(npc)).save(dir+'/NPC-phase.xlsx');
 for(const [book,name,file,range]of [[wb,'前哨','phase-after-outposts.png','A1:J6'],[wb,'商人','phase-after-merchants.png','A1:K6'],[npc,'站位','phase-after-positions.png','A1:H6']])await fs.writeFile(dir+'/'+file,new Uint8Array(await(await book.render({sheetName:name,range,scale:1})).arrayBuffer()));
 console.log('Authored world phase and NPC phase workbooks');process.exit(0);
}
if(process.argv.includes('--inspect')){console.log((await wb.inspect({kind:'sheet',include:'id,name',maxChars:5000})).ndjson);await fs.writeFile(dir+'/before-zones.png',new Uint8Array(await(await wb.render({sheetName:'分区',range:'A1:I7',scale:1})).arrayBuffer()));process.exit(0);}
if(process.argv.includes('--fixture')){
 const data=JSON.parse(await fs.readFile(dir+'/two-zone.json','utf8')),fixture=Workbook.create(),guide=fixture.worksheets.add('说明'),exports=fixture.worksheets.add('导出');if(process.argv.includes('--variant')){data.zones[0].rect.w=240;data.zones[1].rect.x=240;data.zones[1].rect.w=272;data.camps[0].pack[0].count=6;data.roads[0].points[1].y=280;}guide.getRange('A1:B2').values=[['用途','配置管线真实数据库测试输入'],['格式','前三行为中文名、字段键、类型；第四行起数据']];exports.getRange('A1:B2').values=[['输出文件','world.json'],[null,null]];
 const bindings=wb.worksheets.getItem('导出').getUsedRange().values.slice(2).filter(r=>r[0]);exports.getRangeByIndexes(2,0,bindings.length,2).values=bindings.map(r=>r.slice(0,2));
 for(const [name,key] of bindings){const template=wb.worksheets.getItem(name),headers=template.getUsedRange().values.slice(0,3),cols=headers[1].length,sh=fixture.worksheets.add(name);sh.getRangeByIndexes(0,0,3,cols).values=headers;const rows=(data[key]??[]).map(r=>headers[1].map((k,i)=>r[k]===undefined?null:headers[2][i]==='json'?JSON.stringify(r[k]):r[k]));if(rows.length)sh.getRangeByIndexes(3,0,rows.length,cols).values=rows;sh.getRangeByIndexes(0,0,3+rows.length,cols).format.font={name:'Arial',size:11};sh.getRangeByIndexes(0,0,3,cols).format.fill='#EFCF85';sh.getRangeByIndexes(0,0,3+rows.length,cols).format.columnWidth=24;sh.freezePanes.freezeRows(3);}
 fixture.recalculate();await fs.writeFile(dir+'/fixture-zones'+(process.argv.includes('--variant')?'-variant':'')+'.png',new Uint8Array(await(await fixture.render({sheetName:'分区',range:'A1:I5',scale:1})).arrayBuffer()));await(await SpreadsheetFile.exportXlsx(fixture)).save(root+'/tests/fixtures/production-two-zone'+(process.argv.includes('--variant')?'-variant':'')+'.xlsx');console.log('Saved two-zone workbook fixture');process.exit(0);
}
const field=(key,type,name,description)=>({key,type,name,description});
const phase=[field('when','string','出现条件','任务条件页target；空为始终出现；由服务端按角色进度解析。'),field('until','string','移除条件','任务条件页target；命中后移除；不重置已冻结战斗。')];
const sheets={
 '岛屿':{key:'islands',fields:[field('id','string','定义ID','稳定编号，不与其他行重复。'),field('region','string','正式地图','512正式区域编号；远航和营地服务注册到此地图。'),field('island','string','原岛编号','既有岛屿的经济与开放条件编号。'),field('artIsland','string','资源主题','资源清单island字段；风栖原包由包scope归属。'),field('chapter','int','章节','1–6，只决定内容章节，不决定玩家可否进入。'),field('name','string','岛名','正式地图显示名。'),field('width','int','宽度','512导航格。'),field('height','int','高度','512导航格。'),field('seed','int','种子','生成器随机种子；同表同种子输出一致。'),field('landing','json','登陆点','坐标对象{x,y}，必须在可走陆地内。'),field('landRadius','json','陆地半径','椭圆半径[x,y]；生成后可走比例55–65%。'),field('rockCount','int','碰撞摆件数','按资源清单选取；避开所有玩法点和道路。'),field('decorationsPerZone','int','每区植被数','按本岛nature分类选取，确定性散布。'),field('backdrop','string','背景资源','正式资源清单编号。')]},
 '道路':{key:'roads',fields:[field('id','string','道路ID','稳定道路编号。'),field('region','string','地图','所属正式岛。'),field('points','json','道路骨架','坐标对象数组，至少两点，顺序连接。'),field('widthCells','number','道路宽度','导航格，必须大于0。'),field('theme','string','道路主题','可选资源theme筛选；不硬编码素材ID。'),field('resource','string','道路资源','在本岛/共用道路资源池里选择，不在执行器中写资源ID。')]},
 '分区':{key:'zones',fields:[field('banner','string','分区横幅','正式资源清单横幅图标编号。')]},
 '营地':{key:'camps',fields:[field('budget','json','群体预算','可选对象{count,health,roles,healthWeights}。count为实际总人数；health为难度倍率前的总生命；roles为swarm/normal/ranged人数权重；healthWeights可覆盖各角色生命份额。填写时pack里的count只作为同角色模板的选择权重。未填写时pack保持固定人数。数值工具回写，服务端分配并冻结。')]},
 '巡逻':{key:'patrols',fields:[field('speed','number','移动速度','导航格/秒，沿path循环移动。'),field('respawnSeconds','int','清空后刷新','至少90秒且玩家距中心超过36格。'),field('radius','number','巡逻营地半径','营地制刷新与接近范围。')]},
 '稀有':{key:'rares',fields:[field('name','string','独立名','地图与怪物名牌显示名。'),field('affixes','json','词缀数','[最少,最多]，均为2–3。'),field('resource','string','角色资源','正式rare演员资源编号。'),field('loot','string','私有掉落表','只写服务端私有表引用，不写概率或随机状态。')]},
 '入口':{key:'dungeonEntrances',fields:[field('stage','int','阶段','1–24，本岛三个入口对应三个阶段。')]},
 '事件':{key:'events',fields:[field('name','string','事件名','地图和事件进度显示名。'),field('resource','string','事件物件','正式event-prop资源编号。'),field('radius','number','活动半径','导航格；离开即失败并重置。'),field('cooldownSeconds','int','冷却秒','600–900秒，角色独立冷却。'),field('durationSeconds','number','时限秒','事件战斗时限，断线继续。'),field('waveIntervalSeconds','number','波次间隔秒','依战斗时钟触发。'),field('waves','json','波次','数组，每波[{template,rank,count}]；怪潮三波。'),field('objectiveHp','number','守护生命','defend必填，其他类型留空。'),field('loot','string','私有掉落表','保证2–4件装备，概率只在服务端。')]},
 '宝箱':{key:'chests',fields:[field('openResource','string','开启资源','宝箱对应开启状态的正式资源编号。')]},
};
function addFields(book,sheetName,fields,newSheet=false){let sh;try{sh=book.worksheets.getItem(sheetName);newSheet=false;}catch{sh=book.worksheets.add(sheetName);newSheet=true;}const old=newSheet?[]:sh.getRange('A2:AZ2').values[0].filter(v=>v!==null&&v!==''),start=old.length;
 fields=fields.filter(f=>!old.includes(f.key));if(!fields.length)return sh;
 sh.getRangeByIndexes(0,start,3,fields.length).values=[fields.map(f=>f.name),fields.map(f=>f.key),fields.map(f=>f.type)];
 sh.getRangeByIndexes(0,start,3,fields.length).format.font={name:'Arial',size:11,color:'#293940'};sh.getRangeByIndexes(0,start,1,fields.length).format.fill='#EFCF85';if(newSheet)sh.freezePanes.freezeRows(3);
 sh.getRangeByIndexes(0,start,3,fields.length).format.columnWidth=22;sh.getRangeByIndexes(0,start,3,fields.length).format.wrapText=false;
 fields.forEach((f,i)=>{let n=start+i+1,col='';while(n){n--;col=String.fromCharCode(65+n%26)+col;n=Math.floor(n/26);}book.notes.add({id:sheetName+':'+col+'1',target:{cell:{sheetName,sheetId:sh.sheetId,address:col+'1'}},authorId:'',createdAt:'',body:{plainText:f.description}});});return sh;}
for(const [name,def] of Object.entries(sheets)){addFields(wb,name,[...def.fields,...phase],['岛屿','道路'].includes(name));}
for(const name of ['营地','传送点','地标','门'])addFields(wb,name,phase);
const ex=wb.worksheets.getItem('导出');ex.getRange('A13:B14').values=[['岛屿','islands'],['道路','roads']];
wb.recalculate();await fs.writeFile(dir+'/world-workbook-inspect.ndjson',(await wb.inspect({kind:'sheet',include:'id,name',maxChars:5000})).ndjson);
for(const name of ['岛屿','道路','分区','巡逻','稀有','入口','事件','宝箱','营地','传送点','地标','门','导出'])await fs.writeFile(dir+'/after-'+name+'.png',new Uint8Array(await(await wb.render({sheetName:name,range:'A1:H6',scale:1})).arrayBuffer()));
const output=await SpreadsheetFile.exportXlsx(wb);await output.save(dir+'/世界.xlsx');
console.log(JSON.stringify({saved:dir+'/世界.xlsx',changedSheets:Object.keys(sheets)}));
