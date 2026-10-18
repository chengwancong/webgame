import {statDefinition} from '../../packages/contracts/stats.ts';
import {readJson,save,review,decision} from './io.ts';
import {spineSchemas} from './schemas.ts';
import {applySpinePlan,type SpineChange} from './apply.ts';
const file='packages/content/gear-affixes.json',raw=await readJson(file),changes:SpineChange[]=[];
for(const [i,row]of raw.pool.entries())if(statDefinition(row.stat)?.unit==='flat')for(const key of ['minValue','maxValue'])if(!Number.isSafeInteger(row[key]))changes.push({file,path:['pool',i,key],before:row[key],after:Math.max(1,Math.round(row[key])),basis:'修复S3闭式结果的整数域投影：flat正式发放使用crypto.randomInt，必须整数上下界；不改变随机算法和正式奖励逻辑'});
await save(review+'/S3/flat-repair-plan.json',{changes});await applySpinePlan('.',changes,spineSchemas,{apply:true,output:review+'/S3/flat-repair'});await decision('S6临时库自然日程在生成flat速度词缀时返回500','根因S3将flat下界归一为0.65，正式crypto.randomInt只接收整数。统一flat按1取整并经apply修复；原自然日程断言保持，失败证据和临时库清理保留。加强配置schema提前拦截非法flat范围','S3/flat-repair-plan.json、packages/rules/affix-generator.ts');
