import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {rewards} from '../apps/api/src/economy.ts';
import {regions} from '../packages/content/index.ts';
import {resolveBossAccess} from '../packages/rules/boss-access.ts';

// Read-only design fixtures. No player data or game rule is written.
// Claim predicates correspond to the two guards in apps/api/src/app.ts /api/task/claim.
const specs=[
 {id:'initial',label:'首个任务未完成',kills:4,areaKills:4,elites:0,claimed:[],world:'town',selected:'first-six'},
 {id:'gate',label:'已领初识苍风，仍缺地区精英',kills:6,areaKills:6,elites:0,claimed:['first-six'],world:'meadow'},
 {id:'camp',label:'准入已满足，角色仍在营地',kills:6,areaKills:6,elites:1,claimed:['first-six'],world:'town'},
 {id:'field',label:'准入已满足，角色在苍风原野',kills:6,areaKills:6,elites:1,claimed:['first-six'],world:'meadow'},
 {id:'trial',label:'已进入试炼，首领未击败',kills:6,areaKills:6,elites:1,claimed:['first-six'],world:'meadow-boss'},
 {id:'trial_access_unknown',label:'已进入试炼，但准入信息暂缺',kills:6,areaKills:6,elites:1,claimed:['first-six'],world:'meadow-boss',unknownAccess:true},
 {id:'both_ready',label:'两项目标均达成，都尚未领取',kills:7,areaKills:6,elites:1,claimed:[],world:'town',cleared:true},
 {id:'ready',label:'首领已击败，任务奖励待领取',kills:7,areaKills:6,elites:1,claimed:['first-six'],world:'town',cleared:true},
 {id:'pending',label:'领取结果尚未确认',kills:7,areaKills:6,elites:1,claimed:['first-six'],world:'town',cleared:true,operation:'pending'},
 {id:'failed',label:'领取明确失败，目标状态保留',kills:7,areaKills:6,elites:1,claimed:['first-six'],world:'town',cleared:true,operation:'failed'},
 {id:'claimed',label:'当前两项任务均已领取',kills:7,areaKills:6,elites:1,claimed:['first-six','first-boss'],world:'forest',cleared:true},
 {id:'access_unknown',label:'任务已同步，准入信息缺失',kills:6,areaKills:6,elites:1,claimed:['first-six'],world:'meadow',unknownAccess:true},
 {id:'sync_unknown',label:'任务数据尚未同步',kills:0,areaKills:0,elites:0,claimed:[],world:'town',unknown:true}
];
function fixture(spec){
 const progress={kills:spec.kills,regionKills:{meadow:spec.areaKills},regionElites:{meadow:spec.elites},regions:['town','meadow',...(spec.cleared?['forest']:[])],bosses:spec.cleared?['meadow-boss']:[],safe:'town',tasks:spec.claimed};
 const access=resolveBossAccess(progress)['meadow-boss'];
 return {id:spec.id,label:spec.label,synced:!spec.unknown,world:{id:spec.world,name:regions.find(r=>r.id===spec.world).name},selected:spec.selected??'first-boss',access:spec.unknownAccess?null:access,forestOpen:progress.regions.includes('forest'),operation:spec.operation?{task:'first-boss',status:spec.operation}:null,receipts:{},tasks:spec.unknown?[]:[
  {id:'first-six',name:'初识苍风',goal:'累计击败 6 名敌人',goalScope:'累计击杀，不限地区',met:progress.kills>=6,current:Math.min(6,progress.kills),total:6,claimed:progress.tasks.includes('first-six'),place:{area:'苍风原野',site:'野外探索',entry:null,suggested:true},reward:{gold:rewards.taskGold,material:rewards.taskMaterial}},
  {id:'first-boss',name:'穿过结界',goal:'击败荒原守门人',goalScope:'仅击败该首领才算达成',met:progress.bosses.includes('meadow-boss'),current:progress.bosses.includes('meadow-boss')?1:0,total:1,claimed:progress.tasks.includes('first-boss'),place:{area:'苍风原野',site:'守门人试炼',entry:'首领结界',suggested:false},reward:{gold:rewards.taskGold,material:rewards.taskMaterial}}
 ]};
}
const out=resolve('../.design/inventory-categories/quests/task-fixtures.json');await mkdir(resolve(out,'..'),{recursive:true});await writeFile(out,JSON.stringify({source:'Read-only projections of current task claim predicates, economy and resolveBossAccess; progress values are demonstrations.',fixtures:specs.map(fixture)},null,2)+'\n');console.log(JSON.stringify({fixtures:specs.length,out}));
