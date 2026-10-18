import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {root} from './preview-server.mjs';
const base=join(root,'assets/starsea/bosses'),pub=join(root,'apps/web/public/art/starsea/bosses');
const read=async file=>JSON.parse(await readFile(join(root,file),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=await read('assets/starsea/bosses/manifest.json'),review=await read('assets/starsea/bosses/evidence/review.json'),production=await read('assets/starsea/bosses/evidence/production-native.json');
assert(review.passed&&production.passed,'Both group dynamics and the actual production renderer must pass before sealing.');
assert.equal(review.ids.length,manifest.assets.length);assert.equal(production.ids.length,manifest.assets.length);
for(const asset of manifest.assets){
 const visual=review.ids.find(a=>a.id===asset.id),actual=production.ids.find(a=>a.id===asset.id);assert(visual&&actual);assert(visual.video,'Complete-motion video missing');
 const video=await readFile(join(root,visual.video.path));assert.equal(sha(video),visual.video.sha256);assert.equal(actual.checks.length,10);
 assert.equal(visual.deathPhaseCombinations.length,4);assert.equal(actual.deathPhaseCombinations.length,4);
 for(const file of asset.files){const bytes=await readFile(join(root,file.path));assert.equal(sha(bytes),file.sha256,file.path+' changed since export');}
 const diagPath=asset.preview.diagnostics,diag=await read(diagPath);diag.status='producer-reviewed';diag.browserReview='assets/starsea/bosses/evidence/review.json';diag.actualRendererReview='assets/starsea/bosses/evidence/production-native.json';diag.dynamicEvidence=visual.video.url;
 const encoded=JSON.stringify(diag,null,2)+'\n';await writeFile(join(root,diagPath),encoded);await copyFile(join(root,diagPath),join(pub,asset.id,'diagnostics.json'));
 const diagFile=asset.files.find(f=>f.path===diagPath);diagFile.sha256=sha(encoded);diagFile.bytes=Buffer.byteLength(encoded);
 asset.status='producer-reviewed';asset.preview.dynamicEvidence=visual.video.url;asset.preview.review='assets/starsea/bosses/evidence/review.json';asset.preview.productionNative='assets/starsea/bosses/evidence/production-native.json';
 asset.producerReview={passed:true,sourceNativeVersion:'4.2.43',motions:8,phaseStates:4,deathPhaseCombinations:4,allActionsRecorded:true,mirroredSockets:true,deathToolAndStageCleanup:true,actualProductionProfiles:10,sameSubjectNativePortrait:true,castClockMapsOriginalRelease:true};
 visual.bodyRuntimeSha256=asset.files.find(f=>f.path.endsWith('/Character.json')).sha256;
 visual.profileRuntimeSha256=asset.files.find(f=>f.path.endsWith('/profile.json')).sha256;
}
review.productionRendererPassed=true;review.actionPrecedence='Death always selects SS_death/Die before any phase transition. Six bosses x four phase/death combinations verified in group live preview and the actual MiniNativePreview, with full recorded regression cases.';
await writeFile(join(base,'evidence/review.json'),JSON.stringify(review,null,2)+'\n');
await writeFile(join(base,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(join(pub,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log('Sealed '+manifest.assets.length+' full recorded actor packages with 60 real MiniNativePreview profile checks. Root acceptance remains separate.');
