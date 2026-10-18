// P0 mechanics. Durations: 30 Hz ticks; distances: navigation cells.
import {statusEffectSchema,type DamageType,type StatusEffect} from '../contracts/skill-mechanics.ts';
import eliteSource from './elite-affixes.json';
import {islandMonsterSkills,islandBossProfiles,islandSkillPlan} from './island-enemy-combat.ts';
import islandBindings from './island-enemy-bindings.json';
import islandTemplates from './monsters.json';

// 怪物技能定义
export type MonsterSkillDef = {
  id: string;
  name: string;
  kind: 'projectile'|'zone'|'melee'|'buff'|'summon'|'teleport';
  windup: number;      // 施法前摇（ticks）
  cooldown: number;    // 冷却时间（ticks）
  damage?: number;     // 伤害倍率
  radius?: number;     // 范围
  duration?: number;   // 持续时间
  delay?: number;      // 延迟触发
  slow?: boolean;      // 是否减速
  effect?: string;     // 特殊效果
  damageType?:DamageType;
  statuses?:StatusEffect[];
  buff?:{range:number;duration:number;strength:number;removeWithSource:boolean};
  teleportDistance?:number;
  /** 玩家语言的一句行为说明，≤20 字（docs/ui-copy-voice.md §4）。没填按类型取通用提示。 */
  hint?:string;
};

// 普通怪物技能库
export const monsterSkills: Record<string, MonsterSkillDef> = {
  // 第4章：冰封雪域
  frost_bite: { id: 'frost_bite', name: '冰冻撕咬', kind: 'melee', windup: 15, cooldown: 120, damage: 1.2, slow: true, hint: '贴身咬中后会拖慢你' },
  ice_arrow: { id: 'ice_arrow', name: '寒冰箭', kind: 'projectile', windup: 20, cooldown: 90, damage: 1.0, hint: '远处飞来，命中会拖慢你' },
  ice_spike: { id: 'ice_spike', name: '冰锥术', kind: 'zone', windup: 30, cooldown: 150, damage: 1.3, radius: 2, duration: 1, delay: 25, hint: '地面亮起后从下面扎出' },
  frost_stomp: { id: 'frost_stomp', name: '冰霜践踏', kind: 'zone', windup: 30, cooldown: 180, damage: 1.5, radius: 3, duration: 1, delay: 20, slow: true, hint: '踩地前会先亮一大圈' },
  
  // 第5章：暗影深渊
  backstab: { id: 'backstab', name: '背刺', kind: 'melee', windup: 10, cooldown: 120, damage: 1.8, effect: 'dash', hint: '它会绕到你身后出手' },
  bone_spear: { id: 'bone_spear', name: '白骨之矛', kind: 'projectile', windup: 25, cooldown: 120, damage: 1.2, hint: '直线飞来，侧身就能躲' },
  death_explosion: { id: 'death_explosion', name: '死亡爆炸', kind: 'zone', windup: 0, cooldown: 0, damage: 1.5, radius: 3, duration: 1, delay: 0, effect: 'on_death', hint: '它倒下时会炸开一圈' },
  summon_undead: { id: 'summon_undead', name: '召唤亡灵', kind: 'summon', windup: 40, cooldown: 240, effect: 'summon_2', hint: '它会喊来亡灵，先清小的' },
  
  // 第6章：龙骨荒漠
  flame_breath: { id: 'flame_breath', name: '火焰吐息', kind: 'zone', windup: 25, cooldown: 150, damage: 1.4, radius: 4, duration: 60, delay: 15, hint: '正面扇形，会烧着掉血' },
  shield_bash: { id: 'shield_bash', name: '盾击', kind: 'melee', windup: 20, cooldown: 150, damage: 1.3, effect: 'stun', hint: '举盾撞过来，会撞晕你' },
  dragon_blessing: { id: 'dragon_blessing', name: '龙之祝福', kind: 'buff', windup: 30, cooldown: 300, effect: 'buff_nearby', hint: '它给同伴加力，先打断' },

  // 野外精英词缀：以自身为中心的扩张预警（grind-feel §2.4）
  frost_nova: { id: 'frost_nova', name: '冰冻新星', kind: 'zone', windup: 20, cooldown: 240, damage: 1.0, radius: 4, duration: 1, delay: 30, effect: 'self_centered', hint: '以它为中心炸开，快离开' },
  elite_fire_trail:{id:'elite_fire_trail',name:'火焰足迹',kind:'zone',windup:0,cooldown:eliteSource.fire_trail.every,damage:eliteSource.fire_trail.damage,radius:eliteSource.fire_trail.radius,duration:eliteSource.fire_trail.duration,delay:eliteSource.fire_trail.delay,effect:'self_centered',damageType:'fire',hint:'它走过的地方会烧起来'},
  elite_teleport:{id:'elite_teleport',name:'传送',kind:'teleport',windup:24,cooldown:210,radius:1.6,teleportDistance:3,damageType:'arcane',hint:'它会突然消失换个位置'},
};

// Explicit combat metadata, separate from presentation colors.
const monsterDamageTypes:Record<string,DamageType>={frost_bite:'physical',ice_arrow:'cold',ice_spike:'cold',frost_stomp:'cold',backstab:'physical',bone_spear:'physical',death_explosion:'shadow',summon_undead:'shadow',flame_breath:'fire',shield_bash:'physical',dragon_blessing:'arcane',frost_nova:'cold'};
for(const skill of Object.values(monsterSkills))skill.damageType??=monsterDamageTypes[skill.id];
monsterSkills.frost_bite.statuses=[statusEffectSchema.parse({kind:'slow',duration:60,strength:.3,scope:'hit',cleanse:true})];
monsterSkills.shield_bash.statuses=[statusEffectSchema.parse({kind:'stun',duration:30,strength:1,scope:'hit',cleanse:true})];
monsterSkills.frost_nova.statuses=[statusEffectSchema.parse({kind:'slow',duration:90,strength:.35,scope:'hit',cleanse:true})];
monsterSkills.dragon_blessing.buff={range:5,duration:150,strength:.2,removeWithSource:true};

Object.assign(monsterSkills,islandMonsterSkills);

// BOSS技能定义（多阶段）
export type BossSkillDef = {
  id: string;
  name: string;
  kind: 'projectile'|'zone'|'beam'|'summon'|'trap'|'ultimate';
  phase: number;       // 解锁阶段（1=100-70%, 2=70-40%, 3=40-0%）
  windup: number;
  cooldown: number;
  damage?: number;
  radius?: number;
  duration?: number;
  delay?: number;
  slow?: boolean;
  interruptible?: boolean;  // 是否可打断
  warning?: 'ground'|'countdown'|'screen_shake'|'charge_bar';  // 预警类型
  /** 玩家语言的一句行为说明，≤20 字（docs/ui-copy-voice.md §4）。没填按类型取通用提示。 */
  hint?:string;
  damageType?:DamageType;
};

export const chapterBossSkills = {
  // 冰霜女王·艾莎 (Lv20, 8000 HP)
  frost_queen: {
    id: 'frost_queen',
    maxHp: 8000,
    phases: [
      { hp: 1.0, phase: 1 },
      { hp: 0.7, phase: 2 },
      { hp: 0.4, phase: 3 }
    ],
    skills: [
      // 形态1技能
      { id: 'ice_lance', name: '冰枪突刺', kind: 'projectile' as const, phase: 1, windup: 20, cooldown: 120, damage: 1.2, warning: 'ground' as const, hint: '一条冰枪直射过来，侧身' },
      { id: 'blizzard', name: '暴风雪', kind: 'zone' as const, phase: 1, windup: 90, cooldown: 240, damage: 1.0, radius: 6, duration: 150, delay: 0, slow: true, warning: 'ground' as const, hint: '大片雪盖住你，快走开' },
      // 形态2技能
      { id: 'ice_prison', name: '寒冰牢笼', kind: 'trap' as const, phase: 2, windup: 30, cooldown: 180, damage: 0, radius: 2, duration: 90, warning: 'ground' as const, hint: '被关住就出不来，别踩' },
      // 形态3技能
      { id: 'ice_burst', name: '冰刺爆发', kind: 'zone' as const, phase: 3, windup: 90, cooldown: 300, damage: 2.5, radius: 5, duration: 1, delay: 0, warning: 'ground' as const, hint: '红圈亮完后整片扎起' }
    ]
  },
  
  // 深渊之主·莫格斯 (Lv25, 15000 HP)
  abyss_lord: {
    id: 'abyss_lord',
    maxHp: 15000,
    phases: [
      { hp: 1.0, phase: 1 },
      { hp: 0.7, phase: 2 },
      { hp: 0.4, phase: 3 }
    ],
    skills: [
      // 形态1技能
      { id: 'void_bolt', name: '虚空弹', kind: 'projectile' as const, phase: 1, windup: 15, cooldown: 90, damage: 0.8, hint: '暗影弹连发，别站原地' },
      { id: 'ritual', name: '黑暗仪式', kind: 'summon' as const, phase: 1, windup: 150, cooldown: 240, interruptible: true, warning: 'charge_bar' as const, hint: '蓄力走满会出事，打断它' },
      // 形态2技能
      { id: 'void_zone', name: '虚空领域', kind: 'zone' as const, phase: 2, windup: 30, cooldown: 180, damage: 0.6, radius: 4, duration: 180, delay: 0, warning: 'ground' as const, hint: '地上会留一片暗影，绕开' },
      // 形态3技能
      { id: 'death_mark', name: '死亡印记', kind: 'trap' as const, phase: 3, windup: 60, cooldown: 240, damage: 3, radius: 3, duration: 150, delay: 150, warning: 'countdown' as const, hint: '倒计时走完会炸，快离开' }
    ],
    interruptRatio: 0.025,  // 黑暗仪式打断所需伤害比例
    summons: 6
  },
  
  // 远古龙王·巴哈姆特 (Lv30, 30000 HP)
  ancient_dragon_king: {
    id: 'ancient_dragon_king',
    maxHp: 30000,
    phases: [
      { hp: 1.0, phase: 1, name: '地面形态' },
      { hp: 0.8, phase: 2, name: '飞行形态' },
      { hp: 0.6, phase: 3, name: '狂怒形态' },
      { hp: 0.3, phase: 4, name: '灭世形态' }
    ],
    skills: [
      // 形态1：地面阶段
      { id: 'claw_swipe', name: '龙爪横扫', kind: 'zone' as const, phase: 1, windup: 45, cooldown: 90, damage: 1.0, radius: 3, duration: 1, delay: 0, warning: 'ground' as const, hint: '前爪会横扫一圈，退开' },
      { id: 'flame_breath', name: '烈焰吐息', kind: 'zone' as const, phase: 1, windup: 75, cooldown: 150, damage: 1.2, radius: 5, duration: 60, delay: 0, warning: 'ground' as const, hint: '正面扇形烧过来，别站前' },
      { id: 'tail_slam', name: '尾击重踏', kind: 'zone' as const, phase: 1, windup: 40, cooldown: 180, damage: 1.5, radius: 5, duration: 1, delay: 0, warning: 'ground' as const, hint: '尾巴砸地，红圈里会挨打' },
      // 形态2：飞行阶段
      { id: 'dive_bomb', name: '俯冲轰炸', kind: 'zone' as const, phase: 2, windup: 60, cooldown: 240, damage: 2.0, radius: 6, duration: 1, delay: 0, warning: 'ground' as const, hint: '它会从空中砸下，看影子' },
      { id: 'fire_rain', name: '火焰雨', kind: 'zone' as const, phase: 2, windup: 90, cooldown: 300, damage: 1.3, radius: 7, duration: 150, delay: 0, warning: 'ground' as const, hint: '天上会落火雨，别站着' },
      // 形态3：狂怒阶段
      { id: 'summon_whelps', name: '召唤幼龙', kind: 'summon' as const, phase: 3, windup: 40, cooldown: 360, damage: 0, hint: '它会叫来幼龙，先清掉' },
      { id: 'dragon_roar', name: '龙王咆哮', kind: 'zone' as const, phase: 3, windup: 120, cooldown: 300, damage: 3.0, radius: 9, duration: 1, delay: 0, warning: 'ground' as const, hint: '张口蓄力后全场炸开' },
      // 形态4：灭世阶段
      { id: 'ultimate', name: '毁灭吐息', kind: 'beam' as const, phase: 4, windup: 150, cooldown: 600, damage: 4, warning: 'countdown' as const, hint: '直线吐息扫全场，往侧后' }
    ],
    halfWidth: 2,
    reach: 80,
    whelps:{count:4,hpRatio:.02,attackRatio:.35}
  }
} as const;
type IslandBossProfile={id:string;maxHp:number;phases:readonly {hp:number;phase:number}[];skills:readonly BossSkillDef[]};
for(const [id,binding]of Object.entries(islandBindings.masters)){
 const template=islandTemplates.templates.find(t=>t.id===id)!,base=(chapterBossSkills as Record<string,IslandBossProfile>)[template.bossKey??''];
 const island=islandSkillPlan.islands.find(i=>i.bosses.some(s=>s.id===binding.extra))!,themed=island.bosses.find(s=>s.id===binding.extra)!;
 const skill:BossSkillDef={...themed,kind:themed.kind as BossSkillDef['kind'],phase:1,damage:islandMonsterSkills[themed.id].damage,warning:'ground',interruptible:true,damageType:themed.damageType as DamageType,hint:islandMonsterSkills[themed.id].hint};
 islandBossProfiles[binding.profile]={id:binding.profile,maxHp:template.base.hp,phases:base?[...base.phases]:[{hp:1,phase:1}],skills:[...(base?.skills??[]),skill]};
}
Object.assign(chapterBossSkills,islandBossProfiles);


export const chapterDamageTypes:Record<string,DamageType>={ice_lance:'cold',blizzard:'cold',ice_prison:'cold',ice_burst:'cold',void_bolt:'shadow',ritual:'shadow',void_zone:'shadow',death_mark:'shadow',claw_swipe:'physical',flame_breath:'fire',tail_slam:'physical',dive_bomb:'physical',fire_rain:'fire',summon_whelps:'fire',dragon_roar:'physical',ultimate:'fire'};

export type BossSkillId = string;


export type BossCast = {
  id: number;
  owner: string;
  skill: BossSkillId;
  position: {x: number; y: number};
  target: {x: number; y: number};
  started: number;
  ends: number;
  damage: number;        // 对可打断技能累计的伤害
  interrupted: boolean;
  resolved: boolean;
  expires: number;
  phase: number;         // 当前阶段
};

// 预警UI数据
export type WarningDisplay = {
  id: number;
  type: 'ground_circle'|'countdown'|'charge_bar'|'screen_shake';
  position?: {x: number; y: number};
  radius?: number;
  countdown?: number;      // 倒计时剩余秒数
  chargeProgress?: number; // 蓄力进度 0-1
  color?: 'red'|'blue'|'purple'|'orange';
  expires: number;
  skillName?: string;
  canInterrupt?: boolean;
};

export function inBeam(origin: {x: number; y: number}, target: {x: number; y: number}, point: {x: number; y: number}, halfWidth = chapterBossSkills.ancient_dragon_king.halfWidth, reach = chapterBossSkills.ancient_dragon_king.reach) {
  const length = Math.hypot(target.x - origin.x, target.y - origin.y) || 1;
  const dx = (target.x - origin.x) / length, dy = (target.y - origin.y) / length;
  const px = point.x - origin.x, py = point.y - origin.y;
  const along = px * dx + py * dy;
  return along >= 0 && along <= reach && Math.abs(px * dy - py * dx) <= halfWidth;
}

// 获取BOSS当前阶段
export function getBossPhase(bossId: string, hpRatio: number): number {
  const boss = getBossDefinition(bossId);
  if (!boss || !('phases' in boss)) return 1;
  
  for (let i = boss.phases.length - 1; i >= 0; i--) {
    if (hpRatio <= boss.phases[i].hp) {
      return boss.phases[i].phase;
    }
  }
  return 1;
}

// 获取当前阶段可用技能
export function getAvailableSkills(bossId: string, phase: number): BossSkillDef[] {
  const boss = getBossDefinition(bossId);
  if (!boss || !('skills' in boss)) return [];
  
  return boss.skills.filter(s => s.phase <= phase);
}
// The published actor ID is dragon_king; the original skill definition used
// ancient_dragon_king. Resolve aliases once for casts, phases and prediction.
export function getBossDefinition(id:string){return chapterBossSkills[(id==='dragon_king'?'ancient_dragon_king':id) as keyof typeof chapterBossSkills];}
