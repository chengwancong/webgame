import {readJson,save,review,data,sha,stamp} from './io.ts';
import {auditSpinePlayer} from '../numeric-source-audit.ts';
import {spineSchemas} from './schemas.ts';
export function worldPlayerInputs(player:any){const point=(p:any)=>Object.fromEntries(['level','family','D1','DN','NT','EHP','AV','hp','armor'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]]));return {points:player.points.map(point),parity:player.parity.map(point),targetArmors:player.targetArmors};}
/** 旧入口复用已应用的主干推导，验证来源和结果；不进行第二轮独立写入或重复测量。 */
export async function legacySpineEntry(tool:string){
 const pointer=await readJson(data+'/spine-world-source.json').catch((e:NodeJS.ErrnoException)=>{if(e.code!=='ENOENT')throw e;return null;}),player=await readJson(data+'/spine-player.json'),audit=auditSpinePlayer(player),worldSummary=pointer?.summary??review+'/S7/correction-2/world/world-summary.json',worldPlan=pointer?.plan??review+'/S7/correction-2/world/world-plan.json',world=await readJson(worldSummary),current=await readJson('packages/content/dungeons.json'),monsters=await readJson('packages/content/monsters.json');
 const measured=structuredClone(player);if(measured.measuredVersions){measured.versions=measured.measuredVersions;delete measured.measuredVersions;delete measured.versionBridge;}
 let compatible=world.playerSha256===sha(JSON.stringify(measured))||world.playerInputsSha256===sha(JSON.stringify(worldPlayerInputs(player)));
 if(!compatible){const proof=await readJson(worldSummary.replace(/world-summary\.json$/,'model-compat-summary.json')).catch(()=>null);compatible=proof?.worldSummarySha256===sha(JSON.stringify(world))&&proof?.originalPlayerSha256===world.playerSha256&&proof?.numericInputsSha256===sha(JSON.stringify(worldPlayerInputs(player)));}
 if(!compatible){const proof=await readJson(review+'/S8/measurement-repair/world-input-compat-summary.json').catch(()=>null);compatible=proof?.originalPlayerSha256===world.playerSha256&&proof?.unchangedInputsSha256===sha(JSON.stringify(worldPlayerInputs(player)));}
 if(!compatible||!world.applied||world.contentSha256!==sha(JSON.stringify(current))||world.monsterSha256!==sha(JSON.stringify(monsters)))throw Error('主干来源或地城声明已漂移，请先pnpm spine:monsters --world --apply生成最新计划');
 spineSchemas['packages/content/dungeons.json'].parse(current);spineSchemas['packages/content/monsters.json'].parse(await readJson('packages/content/monsters.json'));spineSchemas['packages/content/world-tiers.json'].parse(await readJson('packages/content/world-tiers.json'));
 const result={...stamp(),tool,source:data+'/spine-player.json',audit,reusedAppliedPlan:worldPlan,measurements:world.measurements.length,residuals:world.residuals,independentLegacyWrite:false};await save(review+'/S9/'+tool+'-summary.json',result);console.log(JSON.stringify(result));return result;
}
