import type {WardrobeAction} from './wardrobe-renderer.ts';
export const physicalActions:Record<string,{weapon:string;action:WardrobeAction}>={};
const add=(weapon:string,action:WardrobeAction,ids:string)=>{for(const id of ids.split(' '))physicalActions[id]={weapon,action};};
// Weapon strikes use the source swing (unit_attack); unit_skill is a raised-weapon hold reserved for shouts and buffs.
add('sword','attack','cut dual_strike execute counter_strike frost_blade blade_fury whirl rush leap_strike vortex_blade thunder_dash');
add('axe','attack','rampage cleave ground_slam stun_strike magma_slam venom_cleave frost_quake');add('axe','skill','berserker war_cry blood_rage');
add('staff','attack','staff_strike staff_flurry staff_sweep pole_vault seismic_staff staff_cyclone');
add('hidden','projectile','throwing_knife fan_of_knives venom_needle explosive_kunai');add('hidden','attack','blade_flurry assassinate shadow_blade death_lotus');add('hidden','skill','shadow_step');
add('bow','projectile','bolt multi_shot volley pierce_arrow snipe rain_of_arrows explosive_shot');
export function physicalAction(id:string,fallback:WardrobeAction){return physicalActions[id]?.action??fallback;}
export function physicalMotionFamily(id:string,family:string){return physicalActions[id]?.weapon==='staff'&&family==='magic'?'spear' as const:undefined;}
/** D4: native MiniFantasy has no spear animation; use its own two-hand physical
 * motion without replacing the native skin, attachments or weapon image. */
export function nativeStaffMotion<T>(normal:T,family:string,motionFamily:string|undefined,action:WardrobeAction,twoHand:Partial<Record<WardrobeAction,T>>|undefined){return family==='magic'&&motionFamily==='spear'?(twoHand?.[action==='attack'?'attack':'skill']??normal):normal;}
