export type HitStamp={tick:number;source:string};
export type HitWindows=Record<string,HitStamp[]>;
/** Bounded per-rule rolling window. Threshold attempts consume the window like nth. */
export function recordWindowHit(state:HitWindows,id:string,tick:number,source:string,every:number,window:number,distinctSources=false){
 const recent=(state[id]??[]).filter(h=>tick-h.tick<=window&&(!distinctSources||h.source!==source));
 recent.push({tick,source});
 const reached=recent.length>=every;
 state[id]=reached?[]:recent.slice(-every);
 return reached;
}
/** Old checkpoints omit this optional state. Reject future/unsorted/oversized injected histories. */
export function validateHitWindows(value:unknown,tick:number){
 if(value===undefined)return;
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid hit window checkpoint');
 for(const entries of Object.values(value)){
  if(!Array.isArray(entries)||entries.length>128)throw Error('Invalid hit window history');
  let previous=-1;
  for(const h of entries){
   if(!h||typeof h!=='object'||Object.keys(h).some(k=>!['tick','source'].includes(k))||!Number.isInteger(h.tick)||h.tick<0||h.tick>tick||h.tick<previous||typeof h.source!=='string'||!h.source.length)throw Error('Invalid hit window entry');
   previous=h.tick;
  }
 }
}
