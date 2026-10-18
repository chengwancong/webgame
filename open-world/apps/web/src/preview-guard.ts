// One guard for late successes and late failures. Callers must not update the
// open panel unless this returns true.
export type PreviewToken={seq:number;gearId:string;revision:number;generation:number};
export type PreviewDom={seq:string;gear:string;revision:string;generation:string}|null;

let generation=1;
let seq=0;

export function invalidatePreviews(){generation+=1;seq+=1;}
export function beginPreview(gearId:string,revision:number):PreviewToken{seq+=1;return {seq,gearId,revision,generation};}
export function previewStillCurrent(token:PreviewToken){return token.seq===seq&&token.generation===generation;}
export function previewDomMatches(token:PreviewToken,dom:PreviewDom){
  return previewStillCurrent(token)&&!!dom&&dom.seq===String(token.seq)&&dom.gear===token.gearId&&dom.revision===String(token.revision)&&dom.generation===String(token.generation);
}
