/**
 * 技能系统工程化设计
 * 
 * 设计目标：
 * 1. 分离数据与逻辑
 * 2. 支持技能组合与效果叠加
 * 3. 便于策划配置和平衡调整
 * 4. 支持技能升级和变体
 */

// ============ 基础类型定义 ============

export type SkillCategory = 'melee' | 'ranged' | 'control' | 'support' | 'summon' | 'aura' | 'utility';

export type TargetingType = 
  | 'self'          // 自身
  | 'single'        // 单体敌人
  | 'point'         // 指定地点
  | 'direction'     // 指定方向
  | 'area'          // 自身周围
  | 'nearest'       // 最近的敌人
  | 'weakest'       // 生命最低的敌人
  | 'strongest';    // 生命最高的敌人

export type DeliveryMethod = 
  | 'instant'       // 立即生效
  | 'projectile'    // 投射物
  | 'dash'          // 冲刺/位移
  | 'channel'       // 持续引导
  | 'summon'        // 召唤物
  | 'aura';         // 光环（被动）

export type DamageType = 'physical' | 'fire' | 'cold' | 'lightning' | 'poison' | 'chaos' | 'holy' | 'shadow';

// ============ 技能效果系统 ============

/**
 * 技能效果模块
 * 可组合的效果单元，一个技能可以有多个效果
 */
export interface SkillEffect {
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'summon' | 'teleport' | 'shield' | 'resource';
  
  // 伤害效果
  damage?: {
    base: number;              // 基础伤害
    scaling: number;           // 攻击力加成系数 (伤害 = base + attack * scaling)
    type: DamageType;
    canCrit?: boolean;         // 是否能暴击
    areaRadius?: number;       // 范围伤害半径
    pierce?: boolean;          // 是否穿透
  };
  
  // 治疗效果
  heal?: {
    base: number;
    scaling: number;           // 按最大生命值百分比
    overTime?: boolean;        // 是否持续治疗
  };
  
  // 增益效果
  buff?: {
    stats: Partial<StatModifiers>;
    duration: number;          // 持续时间（帧）
  };
  
  // 减益效果
  debuff?: {
    stats: Partial<StatModifiers>;
    duration: number;
    type: 'slow' | 'stun' | 'silence' | 'root' | 'fear' | 'blind' | 'burn' | 'poison' | 'bleed' | 'freeze';
  };
  
  // 召唤效果
  summon?: {
    unitType: string;          // 召唤物类型
    count: number;             // 数量
    duration: number;          // 持续时间
    inheritStats: number;      // 继承主人属性的比例
  };
  
  // 传送效果
  teleport?: {
    range: number;
    blink?: boolean;           // 是否无敌闪烁
  };
  
  // 护盾效果
  shield?: {
    amount: number;
    duration: number;
    absorbType?: 'all' | 'physical' | 'magical';
  };
  
  // 资源效果（能量等）
  resource?: {
    type: 'mana' | 'health';
    amount: number;            // 正数恢复，负数消耗
    percentage?: boolean;      // 是否按百分比
  };
}

/**
 * 属性修改器
 */
export interface StatModifiers {
  hp?: number;                // 最大生命修改
  mana?: number;              // 最大能量修改
  attack: number;              // 攻击力加成（可以是固定值或百分比）
  armor: number;               // 护甲加成
  speed: number;               // 移动速度加成
  attackSpeed: number;         // 攻击速度加成
  critChance: number;          // 暴击率
  critMultiplier: number;      // 暴击倍率
  cooldownReduction: number;   // 冷却缩减
  manaRegen: number;           // 能量恢复
  lifeSteal: number;           // 生命偷取
  damageMultiplier: number;    // 伤害倍率
  damageReduction: number;     // 伤害减免
}

// ============ 技能条件系统 ============

/**
 * 技能触发条件
 */
export interface SkillCondition {
  type: 'health' | 'mana' | 'enemy_count' | 'distance' | 'combo' | 'buff_active';
  
  health?: {
    operator: '>' | '<' | '>=';
    threshold: number;         // 百分比 0-1
  };
  
  mana?: {
    minimum: number;
  };
  
  enemy_count?: {
    operator: '>=' | '<=';
    count: number;
    range?: number;            // 检测范围
  };
  
  distance?: {
    operator: '>' | '<';
    value: number;
  };
}

// ============ 技能定义 ============

/**
 * 完整的技能定义
 */
export interface SkillDefinition {
  // 基础信息
  id: string;
  name: string;
  description: string;
  icon: string;
  category: SkillCategory;
  
  // 解锁条件
  unlock: {
    level: number;
    prerequisite?: string[];   // 前置技能ID
    quest?: string;            // 任务解锁
  };
  
  // 目标与施放
  targeting: {
    type: TargetingType;
    range: number;             // 施放距离
    requireTarget?: boolean;   // 是否必须有目标
  };
  
  delivery: {
    method: DeliveryMethod;
    speed?: number;            // 投射物速度
    projectileCount?: number;  // 投射物数量
    spreadAngle?: number;      // 扇形角度
  };
  
  // 消耗与冷却
  cost: {
    mana: number;
    health?: number;           // 可选的生命消耗
    charges?: number;          // 充能系统
  };
  
  cooldown: {
    base: number;              // 基础冷却（帧）
    charges?: number;          // 最大充能数
    chargeRecovery?: number;   // 充能恢复时间
  };
  
  // 施放过程
  cast: {
    windup: number;            // 前摇
    backswing?: number;        // 后摇
    canMove?: boolean;         // 施放时是否可移动
    canCancel?: boolean;       // 是否可打断
  };
  
  // 效果列表
  effects: SkillEffect[];
  
  // 触发条件
  conditions?: SkillCondition[];
  
  // 持续时间
  duration?: number;
  
  // 升级成长
  scaling: {
    perLevel: {
      damage?: number;         // 每级伤害增长（百分比）
      cooldown?: number;       // 每级冷却减少
      range?: number;          // 每级距离增长
      duration?: number;       // 每级持续增长
    };
    maxLevel: number;
  };
  
  // 协同效果
  synergies?: {
    skillId: string;
    bonus: string;             // 描述协同效果
  }[];
  
  // AI使用偏好
  aiHints?: {
    priority: number;          // 0-100，优先级
    useWhen?: 'low_health' | 'many_enemies' | 'single_target' | 'always';
    minEnemies?: number;       // 最少敌人数量才使用
  };
  
  // 特殊标签
  tags?: string[];             // 如 'aoe', 'cc', 'mobility', 'defensive'
}

// ============ 技能数据库结构 ============

/**
 * 技能数据库的组织方式
 */
export interface SkillDatabase {
  // 按分类索引
  byCategory: Record<SkillCategory, SkillDefinition[]>;
  
  // 按ID索引
  byId: Record<string, SkillDefinition>;
  
  // 按解锁等级索引
  byLevel: Record<number, SkillDefinition[]>;
  
  // 技能树结构
  trees: SkillTree[];
}

/**
 * 技能树定义
 */
export interface SkillTree {
  id: string;
  name: string;
  description: string;
  icon: string;
  
  // 技能树专精效果
  masteryBonus: {
    pointsRequired: number;
    bonus: Partial<StatModifiers>;
    description: string;
  }[];
  
  // 树中的技能节点
  nodes: SkillTreeNode[];
}

export interface SkillTreeNode {
  skillId: string;
  position: { x: number; y: number };  // UI中的位置
  tier: number;                        // 层级
  connections: string[];               // 连接的节点ID
  requiredPoints?: number;             // 需要在此树中投入的点数
}

// ============ 运行时技能实例 ============

/**
 * 玩家已掌握的技能实例
 */
export interface SkillInstance {
  definitionId: string;
  level: number;                // 当前等级
  experience: number;           // 当前经验
  equipped: boolean;            // 是否装配
  slotIndex?: number;           // 装配槽位 0-3
  
  // 运行时状态
  cooldownRemaining: number;
  charges: number;              // 剩余充能
  
  // 自定义修改器（装备、天赋影响）
  modifiers?: Partial<{
    damageBonus: number;
    cooldownReduction: number;
    rangeBonus: number;
    costReduction: number;
  }>;
}

// ============ 技能配置工具导出格式 ============

export interface SkillExportFormat {
  version: string;
  lastModified: string;
  skills: SkillDefinition[];
  trees: SkillTree[];
  metadata: {
    totalSkills: number;
    categoryCounts: Record<SkillCategory, number>;
    levelRange: { min: number; max: number };
  };
}
