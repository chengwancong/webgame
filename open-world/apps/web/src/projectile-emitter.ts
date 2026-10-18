import type {SocketName} from './effect-attachments.ts';

type Emitter={socket:SocketName;action:'projectile'|'skill'};
const arrow:Emitter={socket:'muzzle',action:'projectile'};
// Spells leave the held focus: the kit muzzle is the staff/wand orb (sword tip, bare hand otherwise), 2026-10-16.
const spell:Emitter={socket:'muzzle',action:'skill'};
const thrown:Emitter={socket:'hand',action:'skill'};
const emitters:Record<string,Emitter>={
 bolt:arrow,multi_shot:arrow,pierce_arrow:arrow,explosive_shot:arrow,
 poison_arrow:arrow,volley:arrow,snipe:arrow,fire_arrow:arrow,thunder_arrow:arrow,night_volley:arrow,
 lance:spell,arcane_missile:spell,frost_bolt:spell,lightning_bolt:spell,
 fireball:spell,dark_arrow:arrow,chain:spell,petrify:spell,dark_grasp:spell,
 // 暗器：手掷，没有弓弦或枪口挂点。
 throwing_knife:thrown,fan_of_knives:thrown,venom_needle:thrown,explosive_kunai:thrown,
};

/** Visual emission and source motion share one mapping, independent of equipped art. */
export function skillEmitter(skillId:string):Emitter|undefined{return emitters[skillId];}
