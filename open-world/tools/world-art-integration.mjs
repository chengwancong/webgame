import {readFile} from 'node:fs/promises';
/** Acceptance is recovered from actual published batches, not from resource
 * registration. Builders may run repeatedly without resetting that decision. */
export async function applyWorldArtIntegration(manifest,root){
 const batches=manifest.scope==='wind-island-art-foundation'?[4]:[5,6,7,8,9],evidence=[];
 for(const n of batches){const base=root+'/docs/reviews/open-world-m2-m4/W'+n;try{const smoke=JSON.parse(await readFile(base+'/production-smoke.json','utf8')),regression=JSON.parse(await readFile(base+'/regression.json','utf8'));if(!smoke.passed||!regression.passed)return manifest;evidence.push({batch:'W'+n,smoke:'docs/reviews/open-world-m2-m4/W'+n+'/production-smoke.json',regression:'docs/reviews/open-world-m2-m4/W'+n+'/regression.json',usage:'docs/reviews/open-world-m2-m4/W'+n+'/resource-usage.json'});}catch(error){if(error.code==='ENOENT')return manifest;throw error;}}
 if(manifest.pending.length)return manifest;
 manifest.gameplayIntegrated=true;manifest.status='production-gameplay-integrated';manifest.gameplayAcceptance={evidence,unusedVariantPolicy:'See each batch resource-usage report for explicit unused variant reasons.'};return manifest;
}
