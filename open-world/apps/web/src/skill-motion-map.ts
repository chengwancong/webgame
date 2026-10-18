/**
 * Skill → authored motion (Claude, 2026-10-15). Presentation only: windup/release ticks, damage and
 * reach stay owned by the simulation; the renderer maps a motion's impact pose onto the real windup.
 * Skills without an entry keep the weapon's native attack (e.g. the basic cut / bolt).
 */
export const skillMotionNames:Record<string,string>={
  // 剑
  whirl:'Skill_Whirl',rush:'Skill_DashThrust',dual_strike:'Skill_DoubleSlash',blade_fury:'Skill_BladeStorm',execute:'Skill_Execute',
  leap_strike:'Skill_LeapSlam',vortex_blade:'Skill_VortexSpin',counter_strike:'Skill_Counter',frost_blade:'Skill_RisingSlash',thunder_dash:'Skill_ThunderDash',
  // 锤／斧
  cleave:'Skill_HeavyCleave',ground_slam:'Skill_GroundSmash',rampage:'Skill_HeavySpin',berserker:'Skill_HeavyChop',war_cry:'Skill_WarCry',
  blood_rage:'Skill_PowerUp',stun_strike:'Skill_Bash',magma_slam:'Skill_GroundSmash',venom_cleave:'Skill_HeavyCleave',frost_quake:'Skill_QuakeSlam',
  // 杖术
  staff_strike:'Skill_StaffThrust',staff_sweep:'Skill_StaffSweep',pole_vault:'Skill_PoleVault',staff_flurry:'Skill_StaffFlurry',seismic_staff:'Skill_StaffSlam',staff_cyclone:'Skill_StaffSpin',
  // 弓
  multi_shot:'Skill_ShotFan',pierce_arrow:'Skill_ChargedShot',rain_of_arrows:'Skill_SkyShot',explosive_shot:'Skill_ChargedShot',snipe:'Skill_Snipe',
  poison_arrow:'Skill_QuickShot',volley:'Skill_ShotFan',dark_arrow:'Skill_ChargedShot',fire_arrow:'Skill_QuickShot',thunder_arrow:'Skill_ChargedShot',night_volley:'Skill_ShotFan',
  // 暗器
  throwing_knife:'Skill_Throw',fan_of_knives:'Skill_FanThrow',venom_needle:'Skill_Flick',shadow_step:'Skill_ShadowStep',blade_flurry:'Skill_DaggerFlurry',
  explosive_kunai:'Skill_OverhandThrow',assassinate:'Skill_Backstab',death_lotus:'Skill_LotusSpin',toxic_bomb:'Skill_Lob',shadow_blade:'Skill_CrossSlash',night_veil:'Skill_Vanish',
  // 元素法术
  ember:'Skill_CastGround',chain:'Skill_CastThrust',lance:'Skill_CastLance',meteor:'Skill_CastSky',fireball:'Skill_CastCharge',frost_bolt:'Skill_CastFlick',
  lightning_bolt:'Skill_CastThrust',barrage:'Skill_CastRapid',frost:'Skill_CastGround',nova:'Skill_CastBurst',miasma:'Skill_CastGround',
  // 控制法术
  arcane_missile:'Skill_CastRapid',gravity_well:'Skill_CastGrip',silence:'Skill_CastBurst',petrify:'Skill_CastGrip',slow_field:'Skill_CastGround',fear:'Skill_CastBurst',
  root:'Skill_CastGround',blind:'Skill_CastFlick',vortex:'Skill_CastSwirl',time_stop:'Skill_CastSky',static_field:'Skill_CastGround',dark_grasp:'Skill_CastGrip',
  // 辅助法术
  ward:'Skill_Guard',mend:'Skill_Bless',haste:'Skill_Empower',regen:'Skill_Bless',blink:'Skill_Blink',barrier:'Skill_Guard',cleanse:'Skill_Bless',
  phase_shift:'Skill_Blink',second_wind:'Skill_Empower',guardian_angel:'Skill_Bless',
};
// 开场回响爆发（prologue.json 的 burst 技能，不在技能目录里）沿用各自基础技能的动作。
const echoBases:Record<string,string>={echo_sword:'blade_fury',echo_staff:'meteor',echo_hidden:'fan_of_knives'};
export const skillMotionName=(skill:string):string|undefined=>skillMotionNames[echoBases[skill]??skill];
