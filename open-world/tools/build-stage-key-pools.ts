import {stageKeyDescription} from './stage-key-copy.ts';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const basisIndex=process.argv.indexOf('--basis'),basisPath=basisIndex>=0?process.argv[basisIndex+1]:'docs/reviews/open-world-m2-m4/W3/key-source-basis.json',directory=basisPath.slice(0,basisPath.lastIndexOf('/'));
const flow=JSON.parse(await readFile('.design/numeric-flow-20261006/flow.json','utf8')),basis=JSON.parse(await readFile(basisPath,'utf8'));
const gear=(slot:string,quality:string,count=1,series='standard')=>({kind:'gear',slot,quality,count,series}),skill=(rank:number,scope='aoe')=>({kind:'skill',rank,scope}),enhance=(rank:number)=>({kind:'enhance',rank}),codex=(rank:number)=>({kind:'codex',rank}),summon=(stat:string,level:number,uncap=0)=>({kind:'summon',stat,level,uncap}),cores=(total:number)=>({kind:'cores',total}),uncap=(rank:number)=>({kind:'weapon_uncap',rank});
const specs:[string,unknown[],string,unknown[]][]=[
 ['蓝色主手',[gear('weapon','magic')],'蓝色防具',[gear('armor','magic')]],
 ['群攻技能二级书',[skill(2)],'攻坚技能二级书',[skill(2,'single')]],
 ['稀有护甲',[gear('armor','rare')],'稀有头盔',[gear('helmet','rare')]],
 ['稀有主手',[gear('weapon','rare')],'二档强化札',[enhance(2)]],
 ['稀有饰品',[gear('accessory','rare')],'二档强化札',[enhance(2)]],
 ['群攻技能三级书',[skill(3)],'四档强化札',[enhance(4)]],
 ['稀有套件主手',[gear('weapon','rare')],'稀有套件防具',[gear('armor','rare')]],
 ['稀有套件饰品',[gear('accessory','rare')],'六档强化札',[enhance(6)]],
 ['群攻技能四级书',[skill(4)],'六档强化札',[enhance(6)]],
 ['传奇主手与两件套',[gear('weapon','legendary'),gear('armor','rare',2)],'传奇防具与配套主手',[gear('armor','legendary'),gear('helmet','rare'),gear('weapon','rare')]],
 ['武器盘稀有武器',[gear('weapon','rare')],'攻坚威能载体',[gear('accessory','legendary')]],
 ['七档强化札',[enhance(7)],'武器盘稀有武器',[gear('weapon','rare')]],
 ['传奇护甲载体',[gear('armor','legendary')],'苍风召唤石',[summon('attack',50)]],
 ['传奇饰品载体',[gear('accessory','legendary')],'翠林召唤石',[summon('hp',50)]],
 ['欧米伽武器',[gear('weapon','rare',1,'omega'),enhance(8)],'五级主技能书',[skill(5)]],
 ['传奇头盔载体',[gear('helmet','legendary')],'法典二阶书',[codex(2)]],
 ['武器一阶突破与九档强化',[uncap(1),enhance(9)],'法典二阶书',[codex(2)]],
 ['四件套锻造组',[gear('armor','rare',4)],'四件套精工组',[gear('armor','rare',4),enhance(9)]],
 ['七枚星核共鸣',[cores(7)],'原初主手',[gear('weapon','legendary',1,'primal')]],
 ['八枚星核共鸣',[cores(8)],'传奇战靴载体',[gear('boots','legendary')]],
 ['九枚星核共鸣',[cores(9)],'十一档强化札',[enhance(11)]],
 ['十枚星核共鸣',[cores(10)],'传奇戒指与法典研习',[gear('ring','legendary'),codex(3)]],
 ['十一枚星核与武器二阶',[cores(11),uncap(2)],'召唤石突破',[summon('attack',80,1)]],
 ['十二枚星核与法典五阶',[cores(12),codex(5)],'传奇饰品与精工强化',[gear('accessory','legendary'),enhance(12)]],
];
if(specs.length!==24||basis.rows.length!==24)throw Error('Expected complete24 key pools and actual source samples');
const pools=flow.stages.map((s:any,i:number)=>{const rate=basis.rows.find((r:any)=>r.stage===s.index)?.elitePerMinute;if(!Number.isFinite(rate)||rate<=0||!Number.isFinite(s.lam)||s.lam<=0)throw Error('Missing actual positive source rate '+s.index);const [a,oa,b,ob]=specs[i],required=Math.max(1,Math.ceil(s.push*1.4*rate));const endgameChoices=s.index===24?[{id:'endgame-paragon',name:'巅峰领悟',description:'取得3个真实巅峰点，可在巅峰盘分配。',weight:1,outputs:[{kind:'paragon',points:3}]},{id:'endgame-glyph',name:'雕文研习',description:'本职业已镶嵌或对应雕文提升1级，最高21级，溢出等级转为巅峰点。',weight:1,outputs:[{kind:'glyph',levels:1}]},{id:'endgame-codex',name:'裂星法典',description:'对应武器的法典威能升至5阶，已满阶时转为巅峰点。',weight:1,outputs:[{kind:'codex',rank:5}]}]:undefined;return {...(endgameChoices?{endgameChoices}:{}),stage:s.index,level:Math.max(1,Math.ceil(s.level)),dropProbability:1-Math.exp(-s.lam/rate),chestLoot:'field-chest',materialsPerSource:{elite:1,rare:3,chest:4},required,choices:[{id:'stage-'+s.index+'-a',name:a,description:a+'，只由本阶段地城掉落或制作。',weight:1,outputs:oa},{id:'stage-'+s.index+'-b',name:b,description:b+'，只由本阶段地城掉落或制作。',weight:1,outputs:ob}],basis:{elitePerMinute:rate,lambdaPerMinute:s.lam,targetMinutes:s.push,materialTargetMinutes:s.push*1.4}};});
for(const pool of pools)for(const choice of [...pool.choices,...(pool.endgameChoices??[])])choice.description=stageKeyDescription(choice.name,choice.outputs as Parameters<typeof stageKeyDescription>[1],pool.stage);
const result={version:1,source:'numeric-flow stage targets + '+basisPath+' actual World source frequency',pools};await mkdir(directory,{recursive:true});await writeFile('apps/api/src/stage-key-pools.json',JSON.stringify(result,null,2)+'\n');await writeFile(directory+'/key-pool-derivation.json',JSON.stringify({versions:basis.versions,limits:basis.limits,pools:pools.map((p:any)=>({stage:p.stage,dropProbability:p.dropProbability,required:p.required,basis:p.basis}))},null,2));console.log(JSON.stringify({stages:pools.length,choices:pools.reduce((n:any,p:any)=>n+p.choices.length,0),earlyKeys:0}));
