/** Retired checkpoints and receipts may be kept as backups, but must not resume or
 * enter the new public contract. This check never changes the supplied record. */
export function hasRetiredDungeonData(value:unknown):boolean{
 if(!value||typeof value!=='object')return false;
 const saved=value as Record<string,any>,has=(object:unknown,key:string)=>!!object&&typeof object==='object'&&Object.hasOwn(object,key);
 return has(saved,'augments')||['augmentExtra','augmentPolicy','augmentCatalog'].some(key=>has(saved.privateRules,key))||has(saved.definition?.policy,'augments')||has(saved.definition?.hub,'augmentRounds')||has(saved.self,'augments')||(Array.isArray(saved.members)&&saved.members.some((member:unknown)=>has(member,'augments')));
}
