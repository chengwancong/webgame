/**
 * Equipped gear → MiniFantasy hero kit (Claude, 2026-10-16). Presentation only: the server resolves the
 * main hand's gameplay type and the armor's family/series/tier; this table picks the matching native
 * body class, rarity skin and held weapon. Axe/hammer use the registered extension art on the hand bone.
 */
import type {AppearanceKit} from '../../../packages/contracts/appearance.ts';
import type {WeaponType} from '../../../packages/contracts/weapons.ts';
import type {WardrobeAction} from './wardrobe-renderer.ts';

type Series='standard'|'primal'|'omega';
export type NativeKitMotion={name:string;impactTime?:number;loop?:boolean};
export type NativeKit={
  /** stable identity for caching and render keys */ key:string;
  body:string;right?:string;left?:string;
  /** extension weapon id (assets/mini-hero/extensions) held on RIGHTHAND */ ext?:string;
  weapon:WeaponType|null;actions:Record<WardrobeAction,NativeKitMotion>;
  /** where projectiles leave: the blade tip, the staff/scepter orb, or the hand */ muzzle:'tip'|'orb'|'hand';
};

/** Outfit class per gameplay family: 剑→骑士, 斧锤→战士, 暗器→盗贼, 弓→弓手, 法杖/魔杖→法师. */
export const nativeBodyClass:Record<WeaponType,string>={sword:'knight',hammer:'warrior',axe:'warrior',hidden:'rogue',bow:'archer',staff:'wizard',wand:'wizard'};
/** series × tier → MiniFantasy rarity and variant; all nine grades are distinct and rise with tier. */
export const nativeGrades:Record<Series,[string,number][]>={
  standard:[['Common',1],['Rare',1],['Epic',2]],
  primal:[['Uncommon',1],['Rare',2],['Legendary',1]],
  omega:[['Uncommon',2],['Epic',1],['Legendary',2]],
};
const heldSkin:Partial<Record<WeaponType,string>>={sword:'Sword_OneHand',staff:'Staff',wand:'Scepter',bow:'Bow',hidden:'Dagger'};

const base={idle:{name:'Wait1',loop:true},move:{name:'Run1',loop:true},hurt:{name:'Damage1'},death:{name:'Die'}};
/** Native attack clips and their measured release frames (60fps source). */
const strikes:Record<WeaponType|'none',[NativeKitMotion,NativeKitMotion]>={
  sword:[{name:'Attack_OneHand1',impactTime:.35},{name:'Attack_OneHand2',impactTime:.4}],
  hammer:[{name:'Attack_TwoHand1',impactTime:25/60},{name:'Attack_TwoHand2',impactTime:26/60}],
  axe:[{name:'Attack_TwoHand1',impactTime:25/60},{name:'Attack_TwoHand2',impactTime:26/60}],
  staff:[{name:'Spell1',impactTime:20/60},{name:'Spell1',impactTime:20/60}],
  wand:[{name:'Spell1',impactTime:20/60},{name:'Spell1',impactTime:20/60}],
  hidden:[{name:'Attack_DualHand1',impactTime:21/60},{name:'Attack_DualHand2',impactTime:22/60}],
  bow:[{name:'Shoot1',impactTime:23/60},{name:'Shoot1',impactTime:23/60}],
  none:[{name:'Attack_OneHand1',impactTime:.35},{name:'Attack_OneHand2',impactTime:.4}],
};

export function nativeKit(kit:AppearanceKit):NativeKit{
  const weapon=kit.weapon,armor=kit.armor;
  // No armor: a plain outfit of the weapon's class; no weapon either: the starter knight.
  const [rarity,variant]=armor?nativeGrades[armor.series][armor.tier-1]:['Common',1];
  const body=`BODY/${nativeBodyClass[armor?.family??weapon?.type??'sword']}_${rarity.toLowerCase()}${variant}`;
  const type=weapon?.type??null,[attack,skill]=strikes[type??'none'];
  const out:NativeKit={key:'',body,weapon:type,actions:{...base,attack,skill,projectile:attack},muzzle:'hand'};
  if(weapon){
    const [r,v]=nativeGrades[weapon.series][weapon.tier-1],held=heldSkin[weapon.type];
    if(held){out.right=`RIGHTHAND/${held}_${r}${v}`;if(weapon.type==='hidden')out.left=`LEFTHAND/${held}_${r}${v}`;}
    else out.ext=`${weapon.type}_${weapon.series}_t${weapon.tier}`;
    out.muzzle=weapon.type==='sword'?'tip':weapon.type==='staff'||weapon.type==='wand'?'orb':'hand';
  }
  out.key=[out.body,out.right??'',out.left??'',out.ext??''].join('|');
  return out;
}
