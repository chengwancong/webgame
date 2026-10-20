// 扩展技能列表 - 将工程化技能转换为游戏实际格式
import type { SkillDefinition } from './index.ts';
import {skillCosts} from './skill-costs.ts';
import {skillMechanicsSchema,type SkillMechanics} from '../contracts/skill-mechanics.ts';

// 基于现有12个技能，扩展到50+个技能
// category（2026-10-07 分系）：melee／ranged＝武技（需对应主手），spell＝法术（任意主手），support＝辅助。
// 下方分段注释保留原编排顺序，不代表分类。
const definitions: SkillDefinition[] = [
  // ========== 近战技能 (15个) ==========
  {id:'cut',category:'melee',unlockLevel:1,name:'斩击',kind:'single',damage:29,range:3,radius:0,cooldown:24,cost:0,windup:3,duration:0,description:'近距离斩击'},
  {id:'whirl',category:'melee',unlockLevel:2,name:'旋风斩',kind:'area',damage:25,range:0,radius:4.5,cooldown:75,cost:15,windup:7,duration:0,description:'清剿身边敌群'},
  {id:'rush',category:'melee',unlockLevel:5,name:'破阵',kind:'dash',damage:35,range:6,radius:2,cooldown:110,cost:12,windup:3,duration:0,description:'突进并打击附近敌人'},
  {id:'cleave',category:'melee',unlockLevel:9,name:'裂地',kind:'area',damage:55,range:0,radius:4,cooldown:180,cost:25,windup:18,duration:0,description:'慢前摇的范围爆发'},
  
  // 新增近战技能
  {id:'dual_strike',category:'melee',unlockLevel:3,name:'双重打击',kind:'single',damage:28,range:3,radius:0,cooldown:35,cost:8,windup:4,duration:0,description:'快速连击两次'},
  {id:'ground_slam',category:'melee',unlockLevel:6,name:'重击',kind:'area',damage:42,range:0,radius:4,cooldown:90,cost:18,windup:12,duration:0,description:'震击地面造成范围伤害'},
  {id:'blade_fury',category:'melee',unlockLevel:8,name:'刀刃风暴',kind:'area',damage:15,range:0,radius:4,cooldown:120,cost:22,windup:5,duration:90,description:'持续旋转攻击周围'},
  {id:'execute',category:'melee',unlockLevel:10,name:'斩杀',kind:'single',damage:80,range:3,radius:0,cooldown:150,cost:20,windup:8,duration:0,description:'对低血量敌人造成额外伤害'},
  {id:'leap_strike',category:'melee',unlockLevel:11,name:'跳斩',kind:'dash',damage:48,range:8,radius:2.5,cooldown:95,cost:16,windup:4,duration:0,description:'跳跃至目标位置并攻击'},
  {id:'blood_rage',category:'melee',unlockLevel:12,name:'血怒',kind:'shield',damage:0,range:0,radius:0,cooldown:240,cost:30,windup:2,duration:180,description:'提升攻击力但持续消耗生命'},
  {id:'vortex_blade',category:'melee',unlockLevel:13,name:'漩涡之刃',kind:'area',damage:38,range:0,radius:4.5,cooldown:85,cost:24,windup:9,duration:0,description:'制造吸引敌人的漩涡'},
  {id:'counter_strike',category:'melee',unlockLevel:14,name:'反击',kind:'shield',damage:50,range:0,radius:3,cooldown:180,cost:15,windup:1,duration:60,description:'格挡并反弹伤害'},
  {id:'rampage',category:'melee',unlockLevel:15,name:'狂暴',kind:'area',damage:32,range:0,radius:4,cooldown:60,cost:20,windup:5,duration:0,description:'快速范围攻击'},
  {id:'berserker',category:'melee',unlockLevel:16,name:'狂战士',kind:'single',damage:65,range:3.2,radius:0,cooldown:120,cost:25,windup:10,duration:0,description:'牺牲防御换取巨额伤害'},
  {id:'war_cry',category:'melee',unlockLevel:17,name:'战吼',kind:'area',damage:20,range:0,radius:6,cooldown:150,cost:18,windup:3,duration:120,description:'降低周围敌人防御'},

  // ========== 远程技能 (18个) ==========
  {id:'bolt',category:'ranged',unlockLevel:1,name:'穿云箭',kind:'projectile',damage:22,range:12,radius:.35,cooldown:25,cost:4,windup:4,duration:0,description:'远程直线攻击'},
  {id:'ember',category:'spell',unlockLevel:6,activation:{type:'book',quantity:1},name:'燎原',kind:'zone',damage:13,range:8,radius:3.3,cooldown:130,cost:20,windup:10,duration:150,description:'持续燃烧区域'},
  {id:'chain',category:'spell',unlockLevel:7,activation:{type:'book',quantity:1},name:'雷链',kind:'chain',damage:26,range:10,radius:5,cooldown:95,cost:16,windup:6,duration:0,description:'依次跳跃三个目标'},
  {id:'lance',category:'spell',unlockLevel:10,name:'星矛',kind:'projectile',damage:48,range:15,radius:.5,cooldown:90,cost:18,windup:12,duration:0,description:'重型穿透弹'},
  
  // 新增远程技能
  {id:'multi_shot',category:'ranged',unlockLevel:3,name:'多重箭',kind:'projectile',damage:16,range:11,radius:.3,cooldown:40,cost:10,windup:5,duration:0,description:'同时发射三支箭'},
  {id:'pierce_arrow',category:'ranged',unlockLevel:4,name:'穿透箭',kind:'projectile',damage:32,range:14,radius:.4,cooldown:55,cost:12,windup:7,duration:0,description:'穿透多个敌人'},
  {id:'rain_of_arrows',category:'ranged',unlockLevel:8,name:'箭雨',kind:'zone',damage:18,range:10,radius:4,cooldown:110,cost:22,windup:15,duration:0,description:'在区域内降下箭雨'},
  {id:'explosive_shot',category:'ranged',unlockLevel:9,name:'爆破箭',kind:'projectile',damage:40,range:12,radius:2,cooldown:80,cost:20,windup:10,duration:0,description:'命中后爆炸'},
  {id:'snipe',category:'ranged',unlockLevel:11,name:'狙击',kind:'single',damage:75,range:18,radius:0,cooldown:120,cost:16,windup:20,duration:0,description:'超远距离精准打击'},
  {id:'poison_arrow',category:'ranged',unlockLevel:12,name:'毒箭',kind:'projectile',damage:28,range:11,radius:.35,cooldown:70,cost:14,windup:6,duration:90,description:'造成持续毒性伤害'},
  {id:'volley',category:'ranged',unlockLevel:13,name:'齐射',kind:'projectile',damage:20,range:10,radius:.3,cooldown:45,cost:18,windup:8,duration:0,description:'快速连续射击'},
  {id:'arcane_missile',category:'spell',unlockLevel:14,name:'奥术飞弹',kind:'projectile',damage:35,range:13,radius:.4,cooldown:60,cost:16,windup:5,duration:0,description:'追踪敌人的魔法飞弹'},
  {id:'meteor',category:'spell',unlockLevel:15,name:'陨石术',kind:'zone',damage:60,range:12,radius:3.5,cooldown:180,cost:35,windup:25,duration:0,description:'召唤陨石砸击地面'},
  {id:'barrage',category:'spell',unlockLevel:16,name:'弹幕',kind:'zone',damage:12,range:10,radius:5,cooldown:90,cost:25,windup:10,duration:60,description:'持续的远程打击'},
  {id:'frost_bolt',category:'spell',unlockLevel:17,name:'冰霜箭',kind:'projectile',damage:30,range:12,radius:.4,cooldown:50,cost:12,windup:6,duration:0,description:'减速敌人的冰箭'},
  {id:'lightning_bolt',category:'spell',unlockLevel:18,name:'闪电箭',kind:'projectile',damage:45,range:14,radius:.3,cooldown:75,cost:18,windup:8,duration:0,description:'快速的闪电攻击'},
  {id:'fireball',category:'spell',unlockLevel:19,name:'火球术',kind:'projectile',damage:50,range:11,radius:1.5,cooldown:85,cost:20,windup:10,duration:0,description:'造成范围爆炸的火球'},
  {id:'dark_arrow',category:'ranged',unlockLevel:20,name:'暗影箭',kind:'projectile',damage:38,range:15,radius:.35,cooldown:65,cost:15,windup:7,duration:0,description:'穿透护甲的暗影攻击'},

  // ========== 控制技能 (12个) ==========
  {id:'frost',category:'spell',unlockLevel:3,name:'寒霜阵',kind:'zone',damage:8,range:9,radius:3,cooldown:150,cost:18,windup:8,duration:120,description:'持续伤害并减速'},
  {id:'nova',category:'spell',unlockLevel:8,name:'冰环',kind:'area',damage:32,range:0,radius:5,cooldown:150,cost:22,windup:8,duration:45,description:'范围伤害与短暂减速'},
  
  // 新增控制技能
  {id:'stun_strike',category:'melee',unlockLevel:4,name:'震慑',kind:'single',damage:25,range:3,radius:0,cooldown:80,cost:12,windup:5,duration:30,description:'眩晕单个敌人'},
  {id:'gravity_well',category:'spell',unlockLevel:7,name:'重力陷阱',kind:'zone',damage:10,range:8,radius:3,cooldown:140,cost:24,windup:12,duration:90,description:'减速并拉扯敌人'},
  {id:'silence',category:'spell',unlockLevel:9,name:'沉默',kind:'area',damage:0,range:0,radius:5,cooldown:180,cost:20,windup:5,duration:60,description:'禁止敌人使用技能'},
  {id:'petrify',category:'spell',unlockLevel:11,name:'石化',kind:'single',damage:15,range:10,radius:0,cooldown:200,cost:28,windup:15,duration:90,description:'石化单个敌人'},
  {id:'slow_field',category:'spell',unlockLevel:12,name:'减速场',kind:'zone',damage:5,range:9,radius:4,cooldown:120,cost:18,windup:8,duration:150,description:'大范围减速区域'},
  {id:'fear',category:'spell',unlockLevel:13,name:'恐惧术',kind:'area',damage:0,range:0,radius:4,cooldown:160,cost:22,windup:10,duration:45,description:'使敌人逃跑'},
  {id:'root',category:'spell',unlockLevel:14,name:'束缚',kind:'zone',damage:8,range:10,radius:2.5,cooldown:100,cost:16,windup:7,duration:60,description:'固定敌人位置'},
  {id:'blind',category:'spell',unlockLevel:15,name:'致盲',kind:'area',damage:0,range:0,radius:5,cooldown:140,cost:18,windup:5,duration:75,description:'降低敌人命中率'},
  {id:'vortex',category:'spell',unlockLevel:16,name:'虚空漩涡',kind:'zone',damage:20,range:8,radius:3.5,cooldown:170,cost:30,windup:18,duration:90,description:'持续吸引并伤害'},
  {id:'time_stop',category:'spell',unlockLevel:18,name:'时间停滞',kind:'area',damage:0,range:0,radius:6,cooldown:300,cost:40,windup:20,duration:30,description:'短暂定身所有敌人'},

  // ========== 辅助技能 (10个) ==========
  {id:'ward',category:'support',unlockLevel:1,name:'护身印',kind:'shield',damage:45,range:0,radius:0,cooldown:240,cost:15,windup:1,duration:150,description:'吸收伤害'},
  {id:'mend',category:'support',unlockLevel:4,name:'回春',kind:'heal',damage:35,range:0,radius:0,cooldown:270,cost:25,windup:15,duration:0,description:'恢复生命'},
  
  // 新增辅助技能
  {id:'haste',category:'support',unlockLevel:5,name:'加速',kind:'shield',damage:0,range:0,radius:0,cooldown:180,cost:20,windup:2,duration:120,description:'提升移动速度'},
  {id:'regen',category:'support',unlockLevel:6,name:'再生',kind:'heal',damage:0,range:0,radius:0,cooldown:200,cost:18,windup:5,duration:180,description:'持续恢复生命'},
  {id:'blink',category:'support',unlockLevel:10,name:'闪现',kind:'dash',damage:0,range:10,radius:0,cooldown:120,cost:15,windup:1,duration:0,description:'瞬间移动'},
  {id:'barrier',category:'support',unlockLevel:11,name:'屏障',kind:'shield',damage:60,range:0,radius:0,cooldown:220,cost:22,windup:3,duration:180,description:'强力护盾'},
  {id:'cleanse',category:'support',unlockLevel:13,name:'净化',kind:'heal',damage:0,range:0,radius:0,cooldown:150,cost:16,windup:2,duration:0,description:'移除减益效果'},
  {id:'phase_shift',category:'support',unlockLevel:14,name:'相位转换',kind:'shield',damage:0,range:0,radius:0,cooldown:180,cost:20,windup:1,duration:90,description:'免疫物理伤害'},
  {id:'second_wind',category:'support',unlockLevel:16,name:'回气',kind:'heal',damage:50,range:0,radius:0,cooldown:300,cost:30,windup:10,duration:0,description:'大量恢复生命和能量'},
  {id:'guardian_angel',category:'support',unlockLevel:18,name:'守护天使',kind:'shield',damage:0,range:0,radius:0,cooldown:600,cost:0,windup:1,duration:300,description:'死亡时复活一次'},

  // ========== 暗器技能 (8个) ==========
  {id:'throwing_knife',category:'ranged',unlockLevel:1,name:'飞刀',kind:'projectile',damage:18,range:9,radius:.3,cooldown:18,cost:skillCosts.throwing_knife,windup:3,duration:0,description:'快速掷出一柄飞刀'},
  {id:'fan_of_knives',category:'ranged',unlockLevel:3,name:'扇刃',kind:'projectile',damage:30,range:8,radius:.3,cooldown:45,cost:10,windup:5,duration:0,description:'扇形掷出五柄飞刀'},
  {id:'venom_needle',category:'ranged',unlockLevel:4,name:'淬毒针',kind:'projectile',damage:26,range:11,radius:.25,cooldown:50,cost:10,windup:4,duration:90,description:'穿透两名敌人并使其中毒'},
  {id:'shadow_step',category:'melee',unlockLevel:5,name:'影袭',kind:'dash',damage:30,range:6,radius:1.8,cooldown:90,cost:12,windup:2,duration:0,description:'闪至目标身旁并割伤周围敌人'},
  {id:'blade_flurry',category:'melee',unlockLevel:7,name:'乱刃',kind:'single',damage:42,range:3,radius:0,cooldown:60,cost:14,windup:3,duration:0,description:'四段快速刺击'},
  {id:'explosive_kunai',category:'ranged',unlockLevel:9,name:'爆裂苦无',kind:'projectile',damage:44,range:10,radius:1.8,cooldown:85,cost:18,windup:8,duration:0,description:'命中后爆炸'},
  {id:'assassinate',category:'melee',unlockLevel:11,name:'暗杀',kind:'single',damage:70,range:3,radius:0,cooldown:140,cost:20,windup:10,duration:0,description:'对低血量敌人造成大量伤害'},
  {id:'death_lotus',category:'melee',unlockLevel:14,name:'死莲',kind:'area',damage:48,range:0,radius:4.5,cooldown:160,cost:26,windup:6,duration:0,description:'旋身挥刃三次并使敌人流血'},
  // RS 元素补全；同一执行器消费已声明的机制。
  {id:'frost_blade',category:'melee',unlockLevel:9,name:'霜刃',kind:'single',damage:34,range:3,radius:0,cooldown:45,cost:10,windup:5,duration:0,description:'以霜刃斩击并迟缓敌人'},
  {id:'thunder_dash',category:'melee',unlockLevel:12,name:'雷闪',kind:'dash',damage:38,range:7,radius:2,cooldown:110,cost:14,windup:3,duration:0,description:'突进并使命中的敌人感电'},
  {id:'magma_slam',category:'melee',unlockLevel:10,name:'熔岩重击',kind:'area',damage:40,range:0,radius:4,cooldown:110,cost:20,windup:12,duration:0,description:'震击地面并施加燃烧'},
  {id:'venom_cleave',category:'melee',unlockLevel:13,name:'腐蚀劈',kind:'area',damage:36,range:0,radius:3.5,cooldown:64,cost:18,windup:6,duration:0,description:'劈击敌群，直接伤害与中毒各占一半'},
  {id:'frost_quake',category:'melee',unlockLevel:18,name:'冰裂',kind:'area',damage:50,range:0,radius:4.5,cooldown:170,cost:26,windup:16,duration:0,description:'冰霜震裂地面并迟缓敌群'},
  {id:'fire_arrow',category:'ranged',unlockLevel:6,name:'火焰箭',kind:'projectile',damage:30,range:12,radius:0.35,cooldown:120,cost:14,windup:6,duration:0,description:'射出火焰箭并施加燃烧'},
  {id:'thunder_arrow',category:'ranged',unlockLevel:14,name:'雷鸣箭',kind:'chain',damage:28,range:12,radius:5,cooldown:95,cost:16,windup:7,duration:0,description:'闪电依次传导并施加感电'},
  {id:'night_volley',category:'ranged',unlockLevel:17,name:'夜袭齐射',kind:'projectile',damage:22,range:13,radius:0.3,cooldown:52,cost:18,windup:8,duration:0,description:'连续射出三段暗影箭，穿透护甲并致盲'},
  {id:'toxic_bomb',category:'ranged',unlockLevel:6,name:'毒雾弹',kind:'zone',damage:12,range:9,radius:3,cooldown:120,cost:18,windup:8,duration:120,description:'留下四段毒雾，每段命中刷新额外中毒'},
  {id:'shadow_blade',category:'melee',unlockLevel:10,name:'影刃',kind:'single',damage:40,range:3,radius:0,cooldown:55,cost:14,windup:4,duration:0,description:'两段暗影刺击，穿透部分护甲'},
  {id:'night_veil',category:'melee',unlockLevel:15,name:'夜幕',kind:'area',damage:41,range:0,radius:4.5,cooldown:120,cost:20,windup:5,duration:0,description:'以暗影笼罩周围敌人并致盲'},
  {id:'static_field',category:'spell',unlockLevel:10,name:'静电场',kind:'zone',damage:6,range:9,radius:3.5,cooldown:130,cost:20,windup:8,duration:120,description:'四段静电伤害，区域内敌人持续感电'},
  {id:'dark_grasp',category:'spell',unlockLevel:16,name:'暗影之握',kind:'single',damage:11,range:10,radius:0,cooldown:140,cost:22,windup:10,duration:0,description:'暗影攫取敌人，穿透护甲并施加恐惧'},
  {id:'miasma',category:'spell',unlockLevel:13,name:'瘴气',kind:'zone',damage:4,range:9,radius:3.5,cooldown:140,cost:20,windup:9,duration:150,description:'留下五段瘴气，每段命中刷新额外中毒'},
  // 2026-10-07 杖术：战杖（武技亲和）的物理武技，需主手法杖。
  {id:'staff_strike',category:'melee',unlockLevel:1,name:'杖击',kind:'single',damage:31,range:3.5,radius:0,cooldown:27,cost:0,windup:4,duration:0,description:'长杖点击，攻击距离略长'},
  {id:'staff_sweep',category:'melee',unlockLevel:3,name:'横扫',kind:'area',damage:30,range:0,radius:4,cooldown:90,cost:16,windup:8,duration:0,description:'抡杖横扫周身并短暂击晕'},
  {id:'pole_vault',category:'melee',unlockLevel:5,name:'撑杆跃击',kind:'dash',damage:36,range:6.5,radius:2.2,cooldown:115,cost:12,windup:4,duration:0,description:'撑杖跃起，落地砸击附近敌人'},
  {id:'staff_flurry',category:'melee',unlockLevel:8,name:'连环杖',kind:'single',damage:44,range:3.5,radius:0,cooldown:62,cost:14,windup:3,duration:0,description:'三段连击同一目标'},
  {id:'seismic_staff',category:'melee',unlockLevel:11,name:'震地杖',kind:'area',damage:52,range:0,radius:4.5,cooldown:175,cost:25,windup:16,duration:0,description:'重杖顿地，震裂敌群护甲'},
  {id:'staff_cyclone',category:'melee',unlockLevel:15,name:'回旋杖',kind:'area',damage:46,range:0,radius:4,cooldown:150,cost:24,windup:6,duration:0,description:'旋杖三周，把周围敌人卷向身前'},
];

// Formal mechanism source. Damage is a single-cast budget for new sequences,
// fans and DOT skills; the original ongoing zones retain their per-tick budget.
const status=(kind:string,duration:number,strength:number,scope='hit',extra:Record<string,unknown>={})=>({kind,duration,strength,scope,cleanse:!['attack_up','speed_up','counter','immunity','guardian','regen'].includes(kind),...extra});
const cleanable=['burn','poison','slow','stun','silence','petrify','fear','root','blind','time_stop'];
const overrides:Record<string,Record<string,unknown>>={
 dual_strike:{schedule:{hits:2,interval:5,followCaster:false,interruptOnMove:false}},
 blade_fury:{schedule:{hits:3,interval:30,followCaster:true,interruptOnMove:false}},
 execute:{execute:{threshold:.2,bonus:.5}},
 blood_rage:{statuses:[status('attack_up',180,.25,'self',{interval:30,hpDrainRatio:.02})]},
 vortex_blade:{},
 counter_strike:{statuses:[status('counter',60,1,'self')]},
 berserker:{statuses:[status('armor_down',60,.2,'self')]},
 war_cry:{statuses:[status('armor_down',120,.2)]},
 multi_shot:{},pierce_arrow:{},
 rain_of_arrows:{zone:{mode:'periodic',hits:3,interval:30,pullSpeed:0,budget:'total'}},
 poison_arrow:{damageType:'poison',statuses:[status('poison',90,0,'hit',{interval:30,total:14,damageType:'poison'})]},
 volley:{schedule:{hits:3,interval:3,followCaster:false,interruptOnMove:false}},
 arcane_missile:{damageType:'arcane'},meteor:{damageType:'fire',statuses:[status('burn',90,0,'hit',{interval:30,total:18,damageType:'fire'})]},
 lance:{damageType:'arcane'},barrage:{damageType:'arcane'},
 frost_bolt:{damageType:'cold',statuses:[status('slow',60,.3)]},
 fireball:{damageType:'fire',statuses:[status('burn',90,0,'hit',{interval:30,total:15,damageType:'fire'})]},dark_arrow:{damageType:'shadow',penetration:.3,statuses:[status('blind',60,.15)]},
 stun_strike:{statuses:[status('stun',30,1)]},
 gravity_well:{damageType:'arcane',zone:{mode:'periodic',hits:3,interval:30,pullSpeed:2,budget:'per_tick'},statuses:[status('slow',2,.3,'zone')]},
 silence:{damageType:'arcane',statuses:[status('silence',60,1)]},
 petrify:{damageType:'arcane',statuses:[status('petrify',90,1,'hit',{breakOnDamage:true})]},
 slow_field:{damageType:'arcane',zone:{mode:'periodic',hits:5,interval:30,pullSpeed:0,budget:'per_tick'},statuses:[status('slow',2,.3,'zone')]},
 fear:{damageType:'arcane',statuses:[status('fear',45,1)]},
 root:{damageType:'arcane',zone:{mode:'periodic',hits:2,interval:30,pullSpeed:0,budget:'per_tick'},statuses:[status('root',2,1,'zone')]},
 blind:{damageType:'arcane',statuses:[status('blind',75,.25)]},
 vortex:{damageType:'arcane',zone:{mode:'periodic',hits:3,interval:30,pullSpeed:2.5,budget:'per_tick'}},
 time_stop:{damageType:'arcane',statuses:[status('time_stop',30,1)]},
 haste:{statuses:[status('speed_up',120,.25,'self')]},
 regen:{statuses:[status('regen',180,0,'self',{interval:30,total:35})]},
 blink:{targeting:'direction'},
 cleanse:{cleanse:{kinds:cleanable,count:10}},
 phase_shift:{statuses:[status('immunity',90,1,'self',{immunityTypes:['physical']})]},
 second_wind:{restoreMana:50},
 guardian_angel:{statuses:[status('guardian',300,1,'self',{reviveRatio:.3})]},
 frost:{damageType:'cold',statuses:[status('slow',2,.55,'zone')]},
 nova:{damageType:'cold',statuses:[status('slow',45,.55)]},
 ember:{damageType:'fire'},chain:{damageType:'lightning',statuses:[status('shock',90,.12)]},lightning_bolt:{damageType:'lightning',statuses:[status('shock',90,.12)]},
 venom_needle:{damageType:'poison',statuses:[status('poison',90,0,'hit',{interval:30,total:12,damageType:'poison'})]},
 blade_flurry:{schedule:{hits:4,interval:4,followCaster:false,interruptOnMove:false}},
 assassinate:{execute:{threshold:.3,bonus:.8}},
 death_lotus:{schedule:{hits:3,interval:10,followCaster:true,interruptOnMove:false},statuses:[status('bleed',90,0,'hit',{interval:30,total:12,damageType:'physical'})]},
 frost_blade:{damageType:'cold',statuses:[status('slow',60,.3)]},
 thunder_dash:{damageType:'lightning',statuses:[status('shock',90,.12)]},
 magma_slam:{damageType:'fire',statuses:[status('burn',90,0,'hit',{interval:30,total:12,damageType:'fire'})]},
 venom_cleave:{damageType:'poison',statuses:[status('poison',90,0,'hit',{interval:30,total:18,damageType:'poison'})]},
 frost_quake:{damageType:'cold',statuses:[status('slow',60,.55)]},
 fire_arrow:{damageType:'fire',statuses:[status('burn',90,0,'hit',{interval:30,total:9,damageType:'fire'})]},
 thunder_arrow:{damageType:'lightning',statuses:[status('shock',90,.12)]},
 night_volley:{damageType:'shadow',schedule:{hits:3,interval:3,followCaster:false,interruptOnMove:false},penetration:.3,statuses:[status('blind',60,.15)]},
 toxic_bomb:{damageType:'poison',zone:{mode:'periodic',hits:4,interval:30,firstDelay:29,pullSpeed:0,budget:'per_tick'},statuses:[status('poison',90,0,'zone',{interval:30,total:8,damageType:'poison'})]},
 shadow_blade:{damageType:'shadow',schedule:{hits:2,interval:5,followCaster:false,interruptOnMove:false},penetration:.3},
 night_veil:{damageType:'shadow',statuses:[status('blind',75,.25)]},
 static_field:{damageType:'lightning',zone:{mode:'periodic',hits:4,interval:30,firstDelay:29,pullSpeed:0,budget:'per_tick'},statuses:[status('shock',2,.12,'zone')]},
 dark_grasp:{damageType:'shadow',penetration:.3,statuses:[status('fear',30,1)]},
 miasma:{damageType:'poison',zone:{mode:'periodic',hits:5,interval:30,firstDelay:29,pullSpeed:0,budget:'per_tick'},statuses:[status('poison',90,0,'zone',{interval:30,total:6,damageType:'poison'})]},
 staff_sweep:{statuses:[status('stun',20,1)]},
 staff_flurry:{schedule:{hits:3,interval:5,followCaster:false,interruptOnMove:false}},
 seismic_staff:{statuses:[status('armor_down',120,.15)]},
 staff_cyclone:{schedule:{hits:3,interval:10,followCaster:true,interruptOnMove:false}},

};
import {skillWeapons} from './skill-weapons.ts';
export const expandedSkills:SkillDefinition[]=definitions.map(base=>{
 if(!(base.id in skillWeapons))throw Error('Missing skill weapon binding '+base.id);
 const skill={...base,weapons:[...skillWeapons[base.id]]};
 if(skill.id==='rain_of_arrows')skill.duration=90;
 if(skill.id==='berserker')skill.duration=60;
 if(skill.id==='vortex_blade')skill.pull=2;
 if(skill.id==='staff_cyclone')skill.pull=1.5;
 if(skill.id==='multi_shot'){skill.projectiles=3;skill.projectileSpread=.24;}
 if(skill.id==='fan_of_knives'){skill.projectiles=5;skill.projectileSpread=.22;}
 const exploding=['explosive_shot','fireball','explosive_kunai'].includes(skill.id);
 const projectile=skill.kind==='projectile'?{collisionRadius:exploding?.3:skill.radius,penetrations:['pierce_arrow','lance','venom_needle'].includes(skill.id)?2:0,turnRate:skill.id==='arcane_missile'?.1:0,explosionRadius:exploding?skill.radius:0}:undefined;
 const zone=skill.kind==='zone'?{mode:skill.duration===0?'burst':'periodic',hits:skill.duration===0?1:Math.ceil(skill.duration/30),interval:30,firstDelay:skill.duration===0?0:29,pullSpeed:0,budget:'per_tick'}:undefined;
 skill.mechanics=skillMechanicsSchema.parse({damageType:'physical',targeting:['shield','heal'].includes(skill.kind)?'self':skill.kind==='zone'?'ground':'enemy',statuses:[],...(projectile?{projectile}:{}),...(zone?{zone}:{}),...overrides[skill.id]}) as SkillMechanics;
 return skill;
});
