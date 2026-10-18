/** S9仅升规则声明一次；保留实际测量版本，不伪造V4或新战斗样本。 */
import {readFile,writeFile} from 'node:fs/promises';
import {readJson,save,review,data,sha,evidence} from './io.ts';
const file='packages/contracts/index.ts',source=await readFile(file,'utf8');
if(!source.includes("rules:'ow-70'"))throw Error('本期只能执行一次ow-70→ow-71声明升号');
const player=await readJson(data+'/spine-player.json'),flow=await readJson(data+'/spine-flow.json');
const playerBefore=await evidence(data+'/spine-player.json'),flowBefore=await evidence(data+'/spine-flow.json'),beforeMetrics=JSON.stringify(player.points);
for(const model of [player,flow]){
 if(model.versions.rules!=='ow-70'||model.measuredVersions)throw Error('模型版本已变化，拒绝重复升号');
 model.measuredVersions={...model.versions};model.versions={...model.versions,rules:'ow-71'};
 model.versionBridge={kind:'declaration-only',from:'ow-70',to:'ow-71',basis:'S8后仅文案/测试驱动修复；数值与V3相同。实际测量仍是ow-70，S8未通过项不因此变为通过。'};
}
if(JSON.stringify(player.points)!==beforeMetrics)throw Error('版本声明不得修改测量值');
flow.measuredPlayerSha256=flow.playerSha256;flow.playerSha256=sha(JSON.stringify(player));
await writeFile(file,source.replace("rules:'ow-70'","rules:'ow-71'"));
await save(data+'/spine-player.json',player);await save(data+'/spine-flow.json',flow);
await save(review+'/S9/version-summary.json',{from:'ow-70',to:'ow-71',client:'0.11.26',protocol:35,db:16,measurementsRepeated:false,measuredRules:'ow-70',playerBefore,flowBefore,playerAfter:await evidence(data+'/spine-player.json'),flowAfter:await evidence(data+'/spine-flow.json'),acceptance:'S8仍有未通过项，版本声明不代表验收完成'});
