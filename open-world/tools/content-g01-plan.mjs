import fs from 'node:fs/promises';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const chart=await read('packages/content/hub-chart.json'),tasks=await read('config/json/tasks.json'),dialogue=await read('config/json/dialogue.json'),dungeons=await read('packages/content/dungeons.json');
const regions=['wind','mist','forge','frost','rift','dragon'];
const names={forge:['输能溯源','夺回控制','守住岛心','输能检修道','冷却井','炉心遗构','脱轨装载场','泄压前庭','废炉货仓','击败采能机'],frost:['冻舰搜查','进入舰桥','复原星图','冻舰底舱','观测冰窟','星盘残室','冰隙巡猎','观测站守夜','封冻储藏室','冻舰巡守'],rift:['要塞登陆','穿过前哨','断开界桥供能','沉星密仓','裂隙炮台','界桥地窖','前哨追猎','滩头守灯','撤离物资库','击败前线督军'],dragon:['龙裔会盟','进入航网中枢','稳定航网节点','龙骨洞穴','旧祭遗堂','航网机库','失控看守机','誓约守灯','旧约藏室','暮界提督']};
const descriptions={forge:['沿检修道切断搬运机的增援，回收输能零件。','穿过冷却井的三段通道，夺回阀门控制。','清理炉心遗构，让封存的设备重新见光。','打断雷桩充能，击败守着零件的失控装载机。','守住泄压前庭的信标，挡下四波追兵。','在警报结束前打开五箱，取回工坊的库存。'],frost:['清理冻舰底舱，找回冰封船员留下的物资。','穿过观测冰窟，拆掉巡守的阻截。','走到星盘残室深处，取回旧航约的零件。','留意雷桩护盾，击败冰隙里的稀有巡守。','守住观测站信标，让四轮求援信号发出去。','趁冰雾散开打开五箱，搜集遗失的记录。'],rift:['穿过沉星密仓，给撤离队找回补给。','逐段清除炮台守卫，打开滩头的退路。','深入界桥地窖，夺回供能器旁的物资。','先处理充能雷桩，再追击前哨精英。','守住滩头信标，撑过四波追兵。','赶在封锁前打开五箱，找回被扣的补给。'],dragon:['沿龙骨洞穴深入，清除封住旧路的巡守。','走过旧祭遗堂，找回应答者留存的器物。','清理航网机库，让停摆的设备重新运转。','摧毁充能雷桩，终止看守机的暴走。','守住誓约信标，挡住四波失控巡守。','在封存倒计时结束前打开五箱旧约物资。']};
const appearances={forge:'200331',frost:'300571',rift:'400105',dragon:'400108'};
const extra={'forge-story-3':['ss-c03-n02'],'frost-story-2':['ss-c04-n02'],'rift-story-1':['ss-c05-n02'],'dragon-story-2':['ss-c06-n02']};
const clean=x=>Object.fromEntries(Object.entries(x).filter(([k])=>k!=='_row'));
const nodes=[];
for(const region of regions.slice(2)){
 const chapter='ss-c0'+(regions.indexOf(region)+1),range=chart.regions.find(r=>r.id===region).levelRange;
 const template=chart.nodes.filter(n=>n.region==='mist');
 for(let i=0;i<template.length;i++){
  const source=template[i],suffix=source.id.slice(5),id=region+'-'+suffix;
  const ownTasks=source.kind==='story'?(suffix==='story-1'?[chapter+'-t01',chapter+'-t02']:suffix==='story-2'?[chapter+'-t03']:[chapter+'-t04']):source.kind==='gate'?[chapter+'-t05']:[];
  ownTasks.push(...(extra[id]??[]));
  const rawSteps=tasks.steps.filter(s=>ownTasks.includes(s.task));
  // NPC dialogue is background text. Actual encounters/interactions retain original content.
  const storySteps=rawSteps.filter(s=>s.op!=='talk'&&s.op!=='reach_waypoint').map(clean);
  if(id==='frost-story-1')for(const s of storySteps)if(s.task===chapter+'-t01')s.landmark='clue-b'; // Three recovered logs are inspected at the central record point.
  const dungeonId=source.kind==='nest'?'field-'+region+'-'+suffix.at(-1):source.kind==='story'?'story-'+region+'-'+suffix.at(-1):'hub-'+region+'-'+source.kind;
  const map=source.kind==='gate'?'ss-map-boss-'+(regions.indexOf(region)+1):source.kind==='story'?'ss-map-'+region:source.kind==='nest'?dungeons.definitions.find(d=>d.id===dungeonId).stages[0]:source.kind==='hunt'?'ss-dg-'+region+'-1-3':source.kind==='tide'?'ss-dg-'+region+'-2-1':'ss-dg-'+region+'-3-2';
  const line=ownTasks.length?dialogue.lines.find(l=>l.group===ownTasks[0]+':accept'&&l.seq===1)?.text:descriptions[region][i-3];
  const n={...clean(source),id,region,name:names[region][i],line,dungeonId,map,recommendedLevel:range[0]+Math.floor(i*(range[1]-range[0])/9),links:source.links.map(x=>x.replace(/^mist-/,region+'-')),storyTasks:ownTasks,storySteps,storyRoutes:tasks.routes.filter(r=>ownTasks.includes(r.task)).map(clean),firstClearReward:[],reward:{xp:0,gold:0,material:0,shards:0,rep:0},budgetReady:false,combatScale:{hp:1,attack:1},dropCountScale:1};
  delete n.appearance;delete n.recipe;
  if(source.kind==='gate'){n.appearance=appearances[region];n.firstClearReward=['关口首通伙伴','解锁地区外观',region==='dragon'?'开启深潮':'开启'+chart.regions[regions.indexOf(region)+1].name+'航区'];}
  if(source.kind==='hunt'){n.recipe=region+'-resist';n.firstClearReward=['生命星晶',chart.regions.find(r=>r.id===region).name+'配方'];}
  if(source.kind==='treasure')n.firstClearReward=['生命星晶'];
  if(source.kind==='nest')n.publicDropNote=['武器、鞋子；巢穴三段战利品','衣服、头盔；巢穴三段战利品','项链、戒指；巢穴三段战利品'][Number(suffix.at(-1))-1];
  nodes.push(n);
 }
}
await fs.mkdir('.runtime/content-g01',{recursive:true});
await fs.writeFile('.runtime/content-g01/authored-plan.json',JSON.stringify({nodes,regions:chart.regions.filter(r=>regions.slice(2).includes(r.id)).map(r=>({...clean(r),status:'open'}))},null,2)+'\n');
console.log('Authored',nodes.length,'nodes; numerical budgets deferred to C7 derivation.');
