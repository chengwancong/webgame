import type {WeaponType} from '../contracts/weapons.ts';
const groups:[WeaponType[],string[]][]=[
 [['sword'],['cut','whirl','rush','dual_strike','blade_fury','execute','leap_strike','vortex_blade','counter_strike','frost_blade','thunder_dash']],
 // 杖术（2026-10-07）：战杖武技，法杖主手可用。
 [['staff'],['staff_strike','staff_sweep','pole_vault','staff_flurry','seismic_staff','staff_cyclone']],
 [['hammer','axe'],['cleave','ground_slam','rampage','berserker','war_cry','blood_rage','stun_strike','magma_slam','venom_cleave','frost_quake']],
 [['bow'],['bolt','multi_shot','pierce_arrow','rain_of_arrows','explosive_shot','snipe','poison_arrow','volley','dark_arrow','fire_arrow','thunder_arrow','night_volley']],
 // 法术（2026-10-07 分系）：任何主手可用；法杖／魔杖只决定法术亲和与流派连携。
 [[],['ember','chain','lance','meteor','fireball','frost_bolt','lightning_bolt','barrage','frost','nova','miasma']],
 [['hidden'],['throwing_knife','fan_of_knives','venom_needle','shadow_step','blade_flurry','explosive_kunai','assassinate','death_lotus','toxic_bomb','shadow_blade','night_veil']],
 [[],['arcane_missile','gravity_well','silence','petrify','slow_field','fear','root','blind','vortex','time_stop','static_field','dark_grasp']],
 [[],['ward','mend','haste','regen','blink','barrier','cleanse','phase_shift','second_wind','guardian_angel']],
];
export const skillWeapons:Record<string,WeaponType[]>={};
for(const [weapons,ids]of groups)for(const id of ids){if(skillWeapons[id])throw Error('Duplicate skill weapon binding '+id);skillWeapons[id]=weapons;}

/** 武器亲和独立 [×]：主手倾向系别（武技／法术）的技能获得此乘区。
 * 2026-10-07 TTK 推导：怪物仍按无亲和基线定标，对口构筑击杀时间＝目标/k；最紧下限是第1章首领 60 秒 ≥ 50 秒 → k ≤ 1.2，
 * 再留模型 ±5% 误差 → k = 1.2/1.05 ≈ 1.14。 */
export const weaponAffinityPower=1.14;
