import {Skin,type SkeletonData} from '@esotericsoftware/spine-webgl';
export const nativeSkinSlots={top:['top','arm_L','arm_R','cloak','lining','neck'],legs:['leg_L','leg_R'],face:['head'],hair:['hair','hair_B'],right:['RIGHTHAND'],left:['LEFTHAND','shield_L']} as const;
export type NativeSkinRoles=Partial<Record<keyof typeof nativeSkinSlots,string|null>>;
/** Copies only each role's authored slots and required bones/constraints. */
export function composeNativeSkin(data:SkeletonData,roles:NativeSkinRoles){
 const composite=new Skin('mini-role-combination');
 for(const role of Object.keys(nativeSkinSlots) as (keyof NativeSkinRoles)[]){
  const name=roles[role];if(!name)continue;const source=data.findSkin(name);if(!source)throw Error('Native skin missing: '+name);
  const allowed=new Set<string>(nativeSkinSlots[role]);
  for(const entry of source.getAttachments())if(allowed.has(data.slots[entry.slotIndex].name))composite.setAttachment(entry.slotIndex,entry.name,entry.attachment);
  for(const bone of source.bones)if(!composite.bones.includes(bone))composite.bones.push(bone);
  for(const constraint of source.constraints)if(!composite.constraints.includes(constraint))composite.constraints.push(constraint);
 }
 return composite;
}
