export function upgradeSpine21(input:Record<string,any>):{raw:Record<string,any>;changes:string[];mode:string};
export function physicalSlotAllowed(id:string,name:string):boolean;
export function attachmentSequence(raw:Record<string,any>,id:string):{name:string;duration:number;regionAt(t:number):string|null};
