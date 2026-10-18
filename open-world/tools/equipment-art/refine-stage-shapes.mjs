import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),art=join(root,'assets/equipment-remake-20261003');
const file=join(art,'production.json'),plan=JSON.parse(await readFile(file,'utf8'));
const swordT2={
 weapon:'a broad shoulder-shaped straight sword blade and a CHUNKY U-SHAPED guard with TWO thick upturned curved arms. The U guard spans at least half the blade length in width. Guard arms turn UP beside the blade, with two obvious open gaps. This intermediate guard is curved, simpler than complete T3 angular swept-back wings, and clearly different from the plain short T1 crossbar.',
 armor:'a LONGER sleeveless armoured tunic with two broad side breast panels, a high collar, moderate shoulders and a SINGLE STRAIGHT FULL-LENGTH TABARD below the belt. Overall garment is taller than wide. The long unsplit rectangular tabard defines this intermediate silhouette. It is neither a short split-skirt basic knight coat nor a broad many-layer complete armour.',
 helmet:'one enclosed helmet with a BROAD SOLID FRONT VISOR and a single narrow horizontal eye slot, broad rectangular cheek guard, medium central ridge. The face opening is CLOSED by the visor; no large hollow black open face arch. This T2 contour is the enclosed guard between open simple T1 and open tall-crested T3.',
 boots:'one compact pair of LOW ANKLE BOOTS, with wide HORIZONTAL rolled cuffs and two large side buckles, slanted narrow steel toe. Shaft height above foot is roughly half the foot length. No tall V-cut shaft. The low rolled-cuff silhouette is distinct from mid-height T1 and tall flared-shin T3.',
 necklace:'a complete necklace with a long vertical DOUBLE-V pendant: two broad V-shaped material pieces, clearly one above the other with an open gap between them. The pendant hangs noticeably lower than the compact basic T1 rhombus. Exactly one small central core, no row of tiny gems.'
};
for(const item of plan.items){
 if(item.slot==='armor'&&item.direction!=='sword')item.references=item.references.filter(p=>!p.endsWith('gear-coat.png'));
 if(item.direction==='sword'&&item.tier===2&&swordT2[item.slot]){
  item.prompt='EXACT REQUIRED INTERMEDIATE SHAPE: '+swordT2[item.slot]+'\n'+item.prompt;
  item.prompt+='\nThe exact intermediate shape described FIRST overrides generic references and generic stage layering. Preserve the series construction: steel/leather for standard, right-angle matte rune-stone modules for omega, ivory bone and rootwood for primal. The references establish rendering consistency; never copy their outer contour.';
  if(item.slot==='armor')item.references=item.references.filter(p=>!p.endsWith('gear-coat.png'));
 }
 if(item.tier===3&&item.slot==='boots'&&['sword','hammer','axe'].includes(item.direction)){
  item.prompt='EXACT COMPLETE BOOT SHAPE: a pair of HIGH SHIN BOOTS with a substantial tall shaft and a boldly outward FLARED TWO-WING CUFF at the top, using the requested family shapes and series materials. Shaft height above foot is at least the foot length. Keep the family toe shape. This is a visibly tall complete greave, not a basic mid-height shoe with more trim.\n'+item.prompt;
 }
}
plan.designRevision=6;await writeFile(file,JSON.stringify(plan,null,2));
const rejected=[];
for(const series of ['standard','omega','primal'])for(const slot of Object.keys(swordT2))rejected.push(`gear-${series}-sword-t2-${slot}`);
for(const series of ['standard','omega','primal'])rejected.push(`gear-${series}-sword-t3-boots`);
rejected.push('gear-standard-hammer-t3-boots');
for(const id of rejected){const p=join(art,'records',id+'.json');if(!existsSync(p))continue;const r=JSON.parse(await readFile(p,'utf8'));r.status='rejected-insufficient-stage-shape-differentiation';r.reviewNote='Small-size overview reveals too similar an outline to the adjacent stage. Rebuild the main shape instead of adding trim.';await writeFile(p,JSON.stringify(r,null,2));}
console.log(JSON.stringify({designRevision:6,rejected}));
