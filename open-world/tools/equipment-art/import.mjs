// Produces an isolated art package. It never edits the live UI manifest or gameplay data.
import {readFile, writeFile, mkdir, rename, readdir, rm, rmdir} from 'node:fs/promises';
import {resolve, dirname, join, basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {argumentsFor, loadManifest, selectedItems, inspectPng, hash} from './common.mjs';

const args = argumentsFor(['manifest','out','only-set','source-dir','help']);
if (args.help || !args.manifest || !args.out) {
  console.log('node tools/equipment-art/import.mjs --manifest production.json --out NEW_ART_PACKAGE [--source-dir ORIGINALS] [--only-set set-id,set-id]\nThe output directory must be absent or empty. Originals are retained; no live resource mapping is changed.');
  if (!args.help) process.exitCode = 1;
} else {
  const data = await loadManifest(args.manifest), items = selectedItems(data,args['only-set']), out = resolve(args.out);
  let existing;
  try { existing = await readdir(out); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing?.length) throw Error(`Output is not empty; choose a new package path to preserve previous artwork: ${out}`);
  await mkdir(dirname(out), {recursive:true});
  const stage = join(dirname(out), `.${basename(out)}-stage-${randomUUID()}`);
  await mkdir(join(stage,'originals'), {recursive:true}); await mkdir(join(stage,'icons'));
  const records = [], pixelsSeen = new Map(), normalizedSeen = new Map(), warnings = [];
  try {
    for (const item of items) {
      if ((!item.source || typeof item.source !== 'string') && !args['source-dir']) throw Error(`Missing individual source PNG for ${item.id}; set source or provide --source-dir`);
      const source = args['source-dir'] ? resolve(args['source-dir'],`${item.id}.png`) : resolve(data.base,item.source), original = await readFile(source), before = await inspectPng(original,item.id);
      if (pixelsSeen.has(before.pixelSha256)) throw Error(`Duplicate source artwork: ${item.id} and ${pixelsSeen.get(before.pixelSha256)}`);
      pixelsSeen.set(before.pixelSha256,item.id);
      const content = await sharp(original).extract(before.bounds).resize(208,208,{fit:'inside',kernel:'lanczos3'}).png().toBuffer();
      const normalized = await sharp({create:{width:256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:content,gravity:'centre'}]).png().toBuffer();
      const after = await inspectPng(normalized,item.id,{production:true});
      if (normalizedSeen.has(after.pixelSha256)) throw Error(`Duplicate normalized artwork: ${item.id} and ${normalizedSeen.get(after.pixelSha256)}`);
      normalizedSeen.set(after.pixelSha256,item.id);
      const file = `icons/${item.id}.png`, originalFile = `originals/${item.id}.png`;
      await writeFile(join(stage,file),normalized); await writeFile(join(stage,originalFile),original);
      if (before.touchesSourceEdge) warnings.push({id:item.id,message:'Original touches an image edge; visually check for clipped artwork.'});
      records.push({...item,productionStatus:'imported-awaiting-visual-review',source:originalFile,file,originalSource:source,original:before,production:after});
    }
    const document = {schema:'abyss-walker-equipment-art-package-v1',createdAt:new Date().toISOString(),style:data.manifest.style ?? 'approved hand-drawn signs',sourceManifest:data.manifestPath,sourceManifestSha256:hash(await readFile(data.manifestPath)),normalization:'Alpha-bounds crop; proportional Lanczos resize inside 208×208; centered on a transparent 256×256 canvas.',expectedCount:records.length,expectedSetCount:new Set(records.map(item=>item.setId)).size,slots:data.manifest.slots ?? data.slots,items:records,warnings};
    for (const key of ['directions','series','tiers']) if (data.manifest[key]) document[key] = data.manifest[key].filter(value => records.some(item => String(item[key === 'directions' ? 'direction' : key === 'tiers' ? 'tier' : key]).replace(/^T/,'') === String(typeof value === 'object' ? value.id : value).replace(/^T/,'')));
    // Subset batches may not form the Cartesian product of all dimensions.
    if (args['only-set']) {delete document.directions; delete document.series; delete document.tiers;}
    await writeFile(join(stage,'manifest.json'),JSON.stringify(document,null,2)+'\n');
    await writeFile(join(stage,'ui-source-entries.json'),JSON.stringify({note:'Candidate entries only. Copy the icons folder into the approved UI source subfolder and prefix file paths before merging into ui-source.json.',assets:records.map(item=>({id:item.id,kind:'gear',file:item.file,size:[256,256]}))},null,2)+'\n');
    if (existing) await rmdir(out); // Fails safely if another process added a file after the empty check.
    await rename(stage,out);
    console.log(JSON.stringify({ok:true,icons:records.length,sets:document.expectedSetCount,output:out,warnings},null,2));
  } catch (error) {
    // stage is a freshly created UUID child of the explicitly resolved output parent.
    if (dirname(stage) !== dirname(out) || !basename(stage).startsWith(`.${basename(out)}-stage-`)) throw error;
    await rm(stage,{recursive:true,force:true});
    throw error;
  }
}
