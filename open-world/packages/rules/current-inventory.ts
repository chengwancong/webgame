/** D13 retirement is a read/eligibility boundary, not a destructive migration.
 * Historical standalone rows stay in storage until separately authorized. */
export function isRetiredHexSlot(slot:string){return slot==='hex1'||slot==='hex2';}
export function currentGearCount(items:readonly {slot:string}[]){return items.reduce((n,item)=>n+(isRetiredHexSlot(item.slot)?0:1),0);}
