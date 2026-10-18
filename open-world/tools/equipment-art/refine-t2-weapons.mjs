import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),art=join(root,'assets/equipment-remake-20261003'),file=join(art,'production.json'),plan=JSON.parse(await readFile(file,'utf8'));
const shapes={
 axe:'one axe with a SINGLE BROAD FAN/LEAF-SHAPED HEAD, a smoothly rounded outward cutting edge and ONE LARGE TRIANGULAR SEE-THROUGH HOLE near the root. The blade is a dense broad rounded triangular fan with a hole, not the basic C-shaped moon blade and not a complete double-headed axe. One straight medium shaft, short wrapped grip. Preserve the axe swept-edge identity and series construction.',
 staff:'one LONG magical staff, wooden/stone/bone shaft occupies at least two thirds of full length, topped by ONE BIG CURLED C-HOOK supporting one restrained rhombus crystal inside the hook. A clearly asymmetric open curved hook head, not a basic two-prong fork and not a complete three-arm crown. Long staff never a short bulb wand.',
 hidden:'one functional THREE-BLADED throwing star with THREE broad STRAIGHT TRIANGULAR FAN BLADES arranged around a large TRIANGULAR central finger hole. Broad straight blades, three distinct tips and readable open centre, not the basic curved blade star and not complete hooked/bifurcated blades. No handle.',
 wand:'one SHORT wand with chunky short grip and a LARGE DOUBLE-LOBED CUP HEAD: TWO broad rounded open petal cups curl sideways around one restrained round core. Head occupies half the full length. Two-lobed open double cup, not a single basic closed bud and not a complete three-lobed bloom. Never draw a long staff.'
};
const rejected=[];
for(const item of plan.items.filter(i=>i.tier===2&&i.slot==='weapon'&&shapes[i.direction])){
 item.prompt='EXACT PRIMARY INTERMEDIATE WEAPON SHAPE: '+shapes[item.direction]+'\n'+item.prompt;
 const p=join(art,'records',item.id+'.json');if(existsSync(p)){const r=JSON.parse(await readFile(p,'utf8'));r.status='rejected-t2-weapon-too-close-to-basic';r.reviewNote='Intermediate single head repeats basic contour. Use an independently specified fan/hook/triangle/double-cup shape.';await writeFile(p,JSON.stringify(r,null,2));rejected.push(item.id);}
}
const id='gear-standard-hammer-t2-armor',p=join(art,'records',id+'.json'),r=JSON.parse(await readFile(p,'utf8'));r.status='rejected-old-endpoint-references';r.reviewNote='Generated before concise shape-only T2 requests. Rebuild long oval lower plate from current concise request.';await writeFile(p,JSON.stringify(r,null,2));rejected.push(id);
plan.designRevision=10;await writeFile(file,JSON.stringify(plan,null,2));console.log(JSON.stringify({designRevision:10,rejected}));
