// 制作数值主干的唯一金币写入器；由 crafting-flow --apply-gold 调用。
import assert from 'node:assert/strict';
import {readFile,copyFile,writeFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const [out,modules]=process.argv.slice(2);
assert(out&&modules,'必须指定本轮目录与工作区依赖目录');
const require=createRequire(join(modules,'crafting-authoring.cjs'));
const {SpreadsheetFile,FileBlob}=await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
const derivation=JSON.parse(await readFile(join(out,'derivation.json'),'utf8'));
assert(derivation.goldPlan.length===6,'必须具备六章完整推导');
const marker=join(out,'gold-written.json');
try{await access(marker);throw Error('本轮金币已经应用，禁止重复写入');}catch(e){if(e.code!=='ENOENT')throw e;}
await copyFile('config/excel/制作.xlsx',join(out,'制作-定价前.xlsx'));
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load('config/excel/制作.xlsx'));
const recipes=wb.worksheets.getItem('配方'),rows=recipes.getUsedRange().values;
for(const chapter of derivation.goldPlan)for(const change of chapter.recipes){const row=rows.slice(3).find(r=>r[0]===change.id);assert(row,'配方不存在 '+change.id);const cost=JSON.parse(row[8]);assert.equal(cost.gold,change.before,'配方初价已变化');cost.gold=change.after;row[8]=JSON.stringify(cost);}
recipes.getRangeByIndexes(0,0,rows.length,rows[0].length).values=rows;
const facilities=wb.worksheets.getItem('设施'),facilityRows=facilities.getUsedRange().values;
for(const chapter of derivation.goldPlan.slice(0,5))for(const row of facilityRows.slice(3).filter(r=>r[2]===chapter.level)){const cost=JSON.parse(row[3]);assert.equal(cost.gold,chapter.facilityFee,'设施初价已变化');cost.gold=chapter.facilityGold;row[3]=JSON.stringify(cost);}
facilities.getRangeByIndexes(0,0,facilityRows.length,facilityRows[0].length).values=facilityRows;
const rules=wb.worksheets.getItem('规则'),policy=JSON.parse(rules.getRange('B4').values[0][0]),last=derivation.goldPlan[5];
policy.facilityGoldByIsland=[{island:last.island,level:last.level,gold:last.facilityGold}];
rules.getRange('B4').values=[[JSON.stringify(policy)]];
const guide=wb.worksheets.getItem('说明');
guide.getRange('A8:B8').values=[['金币定价','2026-10-15裁决；六章收入×30%，三类同比缩放；六级设施末章覆盖在规则facilityGoldByIsland，材料不变。']];
wb.recalculate();
await(await SpreadsheetFile.exportXlsx(wb)).save('config/excel/制作.xlsx');
await writeFile(marker,JSON.stringify({chapters:derivation.goldPlan.map(({chapter,factor,facilityGold})=>({chapter,factor,facilityGold}))},null,2)+'\n');
console.log('六章金币单次应用完成，材料成本保持不变。');
