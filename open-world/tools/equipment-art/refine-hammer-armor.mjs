import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),art=join(root,'assets/equipment-remake-20261003');
const file=join(art,'production.json'),plan=JSON.parse(await readFile(file,'utf8'));
const subject='one SHORT, VERY WIDE barrel-shaped heavy vest: overall shoulders width 1.35 times garment height, straight horizontal hem, wide rounded slab shoulders and one dominant CIRCULAR chest pressure boss. The central chest disk occupies roughly one third of torso width. This must be a broad squat tank vest, never a tapered pointed knight breastplate';
for(const item of plan.items.filter(i=>i.direction==='hammer'&&i.slot==='armor')){
 item.prompt=item.prompt.replace(/a short broad reinforced vest with a boxy breast, rounded block shoulders and central pressure strip/g,subject);
 item.prompt='CRITICAL HAMMER ARMOUR IDENTITY: '+subject+'. No V breastplate, central vertical strip, pointed chest or split pointed skirt.\n'+item.prompt;
 item.prompt+='\nStage contour for this vest: T1 has one squat body with low single-layer rounded shoulders; T2 has two wide horizontal shoulder/body layers; T3 has three chunky horizontal bands and broad outward slab shoulders. Keep the central circular boss visible. Series material still takes priority: steel/amber cloth for standard, matte rune-stone for omega, bone and rootwood for primal. Standard lining is AMBER/TAN, not blue. No faceted gem required.';
 item.references=item.references.filter(p=>!p.endsWith('gear-coat.png'));
}
plan.designRevision=5;await writeFile(file,JSON.stringify(plan,null,2));
const rejected=['gear-standard-hammer-t1-armor','gear-standard-hammer-t3-armor','gear-omega-hammer-t1-armor'];
for(const id of rejected){const p=join(art,'records',id+'.json');if(!existsSync(p))continue;const r=JSON.parse(await readFile(p,'utf8'));r.status='rejected-insufficient-hammer-family-differentiation';r.reviewNote='Torso repeats tapered knight armour / vertical strip, lacks dominant circular boss and broad squat silhouette.';await writeFile(p,JSON.stringify(r,null,2));}
console.log(JSON.stringify({designRevision:5,rejected,updatedHammerArmor:9}));
