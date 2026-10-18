const warned=new Set<string>();
export function warnMissingPresentation(kind:'vfx'|'sound',key:string){const dev=(import.meta as ImportMeta&{env?:{DEV?:boolean}}).env?.DEV??false;if(!dev||warned.has(kind+':'+key))return;warned.add(kind+':'+key);console.warn('['+kind+'] Missing registered presentation: '+key);}
