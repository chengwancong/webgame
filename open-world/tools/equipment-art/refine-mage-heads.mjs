import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),art=join(root,'assets/equipment-remake-20261003'),file=join(art,'production.json'),plan=JSON.parse(await readFile(file,'utf8'));
const shapes={
 staff:'one TALL CONICAL TRAVELLING MAGE HAT with a soft slightly BENT SINGLE POINT and a broad short rolled brim, one small RHOMBUS clasp at the front. Clearly a pointed wizard cap, no round steel helmet dome, no long knight cheek guards, no forked crown. Standard is muted cyan/ivory cloth with a brown band; omega uses faceted sage rune-stone plates forming the conical hat shape; primal uses ivory bone panels, rootwood brim and tan wrapping. One simple cone and band, no antlers, no ears, no person.',
 hidden:'one LOW ASYMMETRIC STEALTH HOOD with a rounded folded crown, a deep oblique empty face opening and ONE broad offset side flap. Low dark cloth/leather standard, low matte rune-stone folded hood construction for omega, low bone/rootwood and tan wrapping for primal. No steel helmet, no pointed wizard hat, no upright crest, no person or face.',
 wand:'one SOFT ROUND BUD HOOD, one uncomplicated rounded dome with TWO broad overlapping rounded petal flaps closing around a readable empty face cavity, one small leaf clasp. Standard muted leaf green/ivory cloth, omega matte sage stone forming rounded petals, primal ivory bone/rootwood petals and tan wraps. No pointed crown, no steel helmet, no long cheek guards, no person or face.'
};
const rejected=[];
for(const item of plan.items.filter(i=>i.tier===1&&i.slot==='helmet'&&shapes[i.direction])){
 item.prompt='EXACT BASIC CLASS HEADGEAR SHAPE: '+shapes[item.direction]+'\n'+item.prompt;
 const p=join(art,'records',item.id+'.json');if(existsSync(p)){const r=JSON.parse(await readFile(p,'utf8'));r.status='rejected-mage-headgear-repeats-knight';r.reviewNote='Basic long-staff headgear reads as armoured knight helmet. Rebuild a clearly conical travelling mage hat.';await writeFile(p,JSON.stringify(r,null,2));rejected.push(item.id);}
}
plan.designRevision=11;await writeFile(file,JSON.stringify(plan,null,2));console.log(JSON.stringify({designRevision:11,rejected}));
