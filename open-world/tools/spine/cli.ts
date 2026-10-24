import {resolve} from 'node:path';
import {measureCore,measured} from './measure.ts';
import {measureContent,measureSources,measureWeights,writeAudit} from './audit.ts';
import {deriveNormalization} from './normalize.ts';
import {completeBuildStructure,measureBuildElasticities,solveBuilds} from './solve.ts';
import {remeasureStandard,measureEfficiencies,deriveMonsters} from './monsters.ts';
import {naturalTimeline,deriveProgression} from './progression.ts';
import {validateSpine} from './validate.ts';
import {checkSpine,freezeCraftingSources} from './check.ts';
import {deriveWorld} from './world.ts';
import {measureScenes} from './scenes.ts';
import {applySpinePlan} from './apply.ts';
import {spineSchemas} from './schemas.ts';
import {pacingProfiles} from '../pacing/profiles.ts';
import {referencePlayer} from './player.ts';
import {readJson,review,data} from './io.ts';
const [command,...args]=process.argv.slice(2),get=(key:string,fallback:string)=>args.find(a=>a.startsWith('--'+key+'='))?.slice(key.length+3)??fallback,apply=args.includes('--apply'),plan=get('plan',''),out=get('out',review+'/'+({bench:'S2',audit:'S2',normalize:'S3','solve-builds':'S4',monsters:'S5',progression:'S6',validate:'S7/V1',check:'S9'} as Record<string,string>)[command]);
if(args.includes('--help')||!command){console.log('数值主干命令：targets、bench、audit、normalize、solve-builds、monsters、progression、validate、check、hub-rewards、content-g01、pet-r1-verify。通用 --out=目录；写入必须 --apply --plan=计划路径；运行前确认没有其他重任务。bench支持 --builds / --player / --content；monsters支持 --player / --efficiencies；progression支持 --timeline-only；validate支持 --suite=all|builds|calendar|walls|field|budget。');}
else if(command==='check'&&args.some(a=>a.startsWith('--roguelike-removal-repair='))){const {runRoguelikeRemovalRepair}=await import('./roguelike-removal.ts');await runRoguelikeRemovalRepair(args);}
else if(command==='check'&&args.some(a=>a.startsWith('--roguelike-removal='))){const {runRoguelikeRemoval}=await import('./roguelike-removal.ts');await runRoguelikeRemoval(args);}
else if(command==='pet-r1-verify'){const {verifyPetR1}=await import('./pet-r1-verify.ts');await verifyPetR1();}
else if(command==='content-g01'){const {runContentEconomy}=await import('./content-g01-economy.ts');await runContentEconomy(args);}
else if(command==='hub-rewards'){const {runHubRewards}=await import('./hub-rewards.ts');await runHubRewards(args);}
else if(apply&&plan){const value=await readJson(plan);if(value.kind==='roguelike-removal-v1'){const {assertDungeonOnlyChanges}=await import('./roguelike-removal.ts');assertDungeonOnlyChanges(value.changes);}await applySpinePlan('.',value.changes,spineSchemas,{apply:true,output:out});}
else switch(command){
 case 'targets':await import('./targets-cli.ts');break;
 case 'bench':{
  const levelsText=get('levels',''),levels=levelsText?levelsText.split(',').map(Number):undefined;if(levels&&(levels.some(n=>!Number.isInteger(n))||new Set(levels).size!==levels.length))throw Error('--levels要求不重复的整数，用逗号分隔');
  if(args.includes('--content'))await measureContent(out);
  else if(args.includes('--stats'))await measureWeights(out);
  else if(args.includes('--sources'))await measureSources(out);
  else if(levelsText||args.includes('--player'))await remeasureStandard(out,levels);
  else if(args.includes('--builds')){const anchor=(await readJson(data+'/spine-anchor.json')).anchor;for(const p of pacingProfiles)await measured(out,p.id,referencePlayer(p.id).player,anchor.r50*20);}
  else if(args.includes('--scenes'))await measureScenes(out);
  else{try{await readJson(data+'/spine-anchor.json');const model=await remeasureStandard(out),anchor=(await readJson(data+'/spine-anchor.json')).anchor,hp=model.points.find((p:any)=>p.level===50)!.hp;for(const p of pacingProfiles)await measured(out,p.id,referencePlayer(p.id).player,hp);await measureScenes(out);}catch(e){if(!String(e).includes('ENOENT'))throw e;await measureCore(out);}}
  break;
 }
 case 'audit':await writeAudit((await readJson(get('from',review+'/S2/content-measurements.json'))).rows,out);break;
 case 'normalize':if(args.includes('--structure'))await completeBuildStructure(out,apply);else await deriveNormalization(out,apply,get('from',review+'/S2/audit-summary.json'));break;
 case 'solve-builds':if(args.includes('--measure-elasticities'))await measureBuildElasticities(out);else await solveBuilds(out,Number(get('steps','3')),args.some(a=>a.startsWith('--correction='))?(await readJson(get('correction',''))):undefined);break;
 case 'monsters':if(args.includes('--player'))await remeasureStandard(out);else if(args.includes('--efficiencies'))await measureEfficiencies(out);else if(args.includes('--world'))await deriveWorld('all',apply,out+'/world');else await deriveMonsters(out,apply);break;
 case 'progression':if(args.includes('--timeline-only'))await naturalTimeline(out);else await deriveProgression(out,apply,get('calendar',out+'/calendar-summary.json'));break;
 case 'validate':{const result=await validateSpine(get('suite','all'),out);console.log(JSON.stringify({accepted:result.accepted,checks:result.checks}));if(!result.accepted)process.exitCode=1;break;}
 case 'check':{const result=args.includes('--freeze-crafting')?await freezeCraftingSources(out):await checkSpine(out,args.includes('--freeze'));console.log(JSON.stringify(result));if('passed'in result&&!result.passed)process.exitCode=1;break;}
 case 'crafting-flow':{const module=await import('./crafting-flow.ts');if(args.includes('--derive'))await module.deriveCraftingFlow(out);else if(args.includes('--apply-gold'))await module.applyCraftingGold(out);else if(args.includes('--verify')){const result=await module.verifyCraftingFlow(out);if(!result.keyAccepted||!result.timeAccepted||!result.goldAccepted)process.exitCode=1;}else throw Error('制作数值必须显式选择 --derive、--apply-gold 或 --verify');break;}
 default:throw Error('未知主干命令 '+command);
}
