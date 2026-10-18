/**
 * 开场「坠星觉醒」受控授予构筑（docs/opening-hook-design.md O1）。
 * 用数值主干的标准人（standardState）在授予等级装配三种武器倾向，换上开场展示用的四个群攻技能，
 * 解析成冻结构筑写进 packages/content/starsea/prologue.json；客户端开场沙盒只读这份冻结结果，
 * 不进角色存档、不发奖励。巨兽血量推导一次、验证一次：初值 = 授予构筑实测单体秒伤 × 目标秒数；用客户端开场实际跑的那一场
 * （apps/web/src/prologue-battle.ts，带刷怪节奏、潮能和回响爆发）实跑一遍，按实跑秒数等比修正；再按定稿血量重推爆发伤害并验证。
 * 用法：npx tsx tools/prologue-build.ts [--check]
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {World} from '../packages/simulation/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {regionById} from '../packages/content/index.ts';
import {standardState} from './spine/player.ts';
import {SCHEDULE} from './standard-player-model.ts';
import {skillSchema} from '../packages/contracts/index.ts';
import {playPrologue,type PrologueConfig} from '../apps/web/src/prologue-battle.ts';

const file=resolve(import.meta.dirname,'../packages/content/starsea/prologue.json');
const families={
 sword:{blurb:'刃光绕身旋转，卷走身边的一切。',echo:'剑刃风暴',weaponTemplate:'standard-sword-t1-weapon',starterSkills:['cut'],grantedSkills:['whirl','blade_fury','vortex_blade','leap_strike']},
 staff:{blurb:'星辰法阵落下星雨，砸穿成片的敌人。',echo:'星辰法阵',weaponTemplate:'standard-staff-t1-weapon',starterSkills:['staff_strike'],grantedSkills:['meteor','nova','chain','barrage']},
 hidden:{blurb:'飞刃向四面八方齐射，穿透一整排敌人。',echo:'飞刃之雨',weaponTemplate:'standard-hidden-t1-weapon',starterSkills:['throwing_knife'],grantedSkills:['fan_of_knives','death_lotus','night_veil','explosive_kunai']},
} as const;
type Family=keyof typeof families;
const grantLevel=40,map='ss-map-wind',waves=[10,15,20],mob={template:'ss-mon-wind-hound',level:1},boss={template:'ss-boss-port-vanguard',name:'星潮巨兽',level:1};
/** 巨兽从出现到倒下的目标秒数；验证窗口 20–25 秒（验收 D1）。 */
const targetBossSeconds=22.5,bossWindow=[20,25],bossHitShare=.04,seed=41;
/** 开场镜头舒适度：L40 标准人移速约 15.9，镜头跟不稳；授予构筑移速封顶（只影响开场沙盒）。 */
const maxSpeed=9;
/** 回响爆发：从授予构筑里同名基础技能克隆，只改范围/段数/伤害；伤害按「一发打掉巨兽 bossShare 血量」推导。
 * 潮能 burstKills 次击杀充满；巨兽血量降到 bossUnlock 以下时直接充满，作为收尾。 */
const burst={kills:20,bossShare:.35,bossUnlock:.3};
const burstShapes={
 sword:{base:'blade_fury',patch:{radius:9,cooldown:9000,cost:0,windup:4,duration:60},mechanics:{schedule:{hits:5,interval:12,followCaster:true,interruptOnMove:false}}},
 staff:{base:'meteor',patch:{radius:8,range:14,cooldown:9000,cost:0,windup:10,duration:60},mechanics:{zone:{mode:'periodic',hits:4,interval:12,firstDelay:0,pullSpeed:0,budget:'per_tick'}}},
 hidden:{base:'fan_of_knives',patch:{range:13,radius:.5,cooldown:9000,cost:0,windup:4,projectiles:15,projectileSpread:Math.round(Math.PI*2/15*1e4)/1e4},mechanics:{targeting:'enemy',projectile:{collisionRadius:1,penetrations:20,turnRate:0,explosionRadius:0}}},
} as const;

function granted(family:Family){
 const state=standardState(grantLevel,family),f=families[family],rank=SCHEDULE.skillRank(grantLevel);
 state.skills=[...f.grantedSkills];state.skillRanks=Object.fromEntries(state.skills.map(id=>[id,rank]));
 state.progression!.skillAwakenings=Object.fromEntries(rank>=5&&SCHEDULE.skillAwaken(grantLevel)?state.skills.map(id=>[id,'power']):[]);
 const b=resolveBuild(state);assert.deepEqual(b.resolvedSkills.map(s=>s.id),state.skills,family+' 授予技能必须全部可用');assert.equal(b.stats.weapon,family);
 return {stats:{...b.stats,speed:Math.min(maxSpeed,b.stats.speed)},skills:b.resolvedSkills};
}
function echoSkill(family:Family,build:ReturnType<typeof granted>,damage?:number){
 const shape=burstShapes[family],base=build.skills.find(s=>s.id===shape.base)!;assert(base,family+' 回响爆发缺少基础技能');
 const skill:any={...structuredClone(base),...shape.patch,id:'echo_'+family,name:'回响·'+families[family].echo,description:'刻片回响爆发（开场受控授予）',mechanics:{...structuredClone(base.mechanics),...structuredClone(shape.mechanics)}};
 delete skill.resolution;if(damage!==undefined){const k=damage/skill.damage;skill.damage=damage;for(const x of skill.mechanics?.statuses??[])if(x.total)x.total=Math.round(x.total*k);}skillSchema.parse(skill);return skill as typeof base;
}
/** 回响爆发对巨兽的单发伤害：只放爆发一招，巨兽站桩，跑 4 秒收齐多段与灼烧。 */
function echoBossDamage(family:Family,build:ReturnType<typeof granted>,skill:ReturnType<typeof echoSkill>){
 const w=new World({...regionById(map),spawns:[]},build.stats,[skill],[],[],seed);w.setMode('manual');const at=w.hero.position,target=bossSpawn(1e6,1e-6);target.monster!.ai.speed=0;w.addSpawns([{...target,x:at.x+2.5,y:at.y}]);
 const e=w.enemies[0];let cast=false;for(let i=0;i<120;i++){if(!cast)cast=w.cast(skill.id,e,e.position);w.step();}assert(cast,family+' 回响爆发放不出来');return e.maxHp-e.hp;
}
function bossSpawn(hp:number,attack:number){const s=resolveMonsterSpawn({id:'prologue-boss',template:boss.template,level:boss.level,rank:'boss',x:27,y:24},undefined,{hp,attack,armor:1});return s;}
/** 单体秒伤：在落风坡开场位置放一只打不死的巨兽（会走位冲撞），跑满目标击杀秒数（含开局爆发与回蓝），用这段平均秒伤。 */
function singleDps(build:ReturnType<typeof granted>){
 const w=new World({...regionById(map),spawns:[]},build.stats,build.skills,[],[],seed);w.setMode('auto');const at=w.hero.position,target=bossSpawn(1e6,1e-6);w.addSpawns([{...target,x:at.x+4,y:at.y}]);
 for(let i=0;i<targetBossSeconds*30;i++)w.step();const e=w.enemies[0];return (e.maxHp-e.hp)/targetBossSeconds;
}
const out:any={version:1,generator:'tools/prologue-build.ts',grantLevel,map,waves,/** 杂兵分批从远处涌来，割草段长度由节奏决定，不靠加血。 */waveCadence:{groupSize:5,everySeconds:1.6,spawnRadius:11},burst,mob,boss:{...boss,targetSeconds:targetBossSeconds},families:{},
 /** 开场演出字幕（只影响表现）；{key} 换成玩家的交互键。waves 按第 2、3 波顺序。 */
 lines:{fall:'天幕裂开一道光缝，你从光里坠了下来。手里的刻片在发亮。',choose:'刻片投出三道回响。选一道唤醒它——它会决定你手里的武器。',skipNote:'跳过开场前，先选一把初始武器。',land:'脚下……是星潮？',waves:['又来了一群——它们是被光引来的。','更多了！'],energyFull:'潮能满了，按 {key} 放出回响爆发',boss:'岛缘下的星潮翻涌起来，有什么东西爬上来了。',bossUnlock:'刻片在发烫——按 {key} 放出回响爆发！',fade:'刻片「咔」地裂开一道缝，光一格一格熄灭了。'}};
const round3=(n:number)=>Math.max(.001,Math.round(n*1000)/1000);
for(const family of Object.keys(families) as Family[]){
 const build=granted(family),dps=singleDps(build),base=bossSpawn(1,1),attack=round3(build.stats.hp*bossHitShare/base.attack);
 /** 按巨兽血量推导回响爆发伤害（一发打掉 bossShare），返回这一家在开场里要用的整套配置。 */
 const derive=(hp:number,measured:Record<string,number>)=>{const probe=echoSkill(family,build),dealt=echoBossDamage(family,build,probe),bossHp=bossSpawn(hp,attack).hp,echo=echoSkill(family,build,Math.max(1,Math.round(probe.damage*bossHp*burst.bossShare/dealt)));
  const share=Math.round(echoBossDamage(family,build,echo)/bossHp*1000)/1000;assert(share>=burst.bossShare*.9&&share<=burst.bossShare*1.3,family+' 回响爆发验证偏离推导 '+share);
  const entry={...families[family],bossDifficulty:{hp,attack},measured:{singleDps:Math.round(dps),...measured,echoBossShare:share},granted:build,burst:echo};
  return {entry,config:{...out,families:{[family]:entry}} as PrologueConfig};};
 // 推导：初值血量实跑一遍（eager），巨兽用时与血量成正比（爆发伤害也随血量缩放），等比修正一次。
 const hp0=round3(dps*targetBossSeconds/base.hp),probe=playPrologue(family,'eager',derive(hp0,{}).config);assert(probe.finished&&probe.bossSeconds,family+' 推导实跑没打完：'+probe.stalledIn);
 const hp=round3(hp0*targetBossSeconds/probe.bossSeconds);
 // 验证：定稿血量重推爆发伤害，再实跑 eager（验收口径）与 hold（爆发留到巨兽战，只记录）。
 const draft=derive(hp,{}).config,eager=playPrologue(family,'eager',draft),hold=playPrologue(family,'hold',draft);
 assert(eager.finished&&hold.finished,family+' 验证实跑没打完：'+eager.stalledIn+' / '+hold.stalledIn);assert(eager.lowestHeroHp>0,family+' 开场授予构筑不应倒下');
 assert(eager.bossSeconds!>=bossWindow[0]&&eager.bossSeconds!<=bossWindow[1],family+' 巨兽实跑 '+eager.bossSeconds+' 秒，不在 '+bossWindow.join('–')+' 秒内');
 out.families[family]=derive(hp,{probeBossSeconds:probe.bossSeconds,bossSeconds:eager.bossSeconds!,bossSecondsHold:hold.bossSeconds!,openingSeconds:eager.openingSeconds!,lowestHeroHp:eager.lowestHeroHp}).entry;
}
const text=JSON.stringify(out,null,1)+'\n';
if(process.argv.includes('--check')){const old=await readFile(file,'utf8').catch(()=>'');assert.equal(old,text,'prologue.json 与授予构筑推导不一致，请运行 npx tsx tools/prologue-build.ts');console.log('prologue.json ok');}
else{await writeFile(file,text);for(const [k,v] of Object.entries(out.families) as any)console.log(k,JSON.stringify(v.bossDifficulty),JSON.stringify(v.measured));}
