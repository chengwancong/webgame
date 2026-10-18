import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),art=join(root,'assets/equipment-remake-20261003'),file=join(art,'production.json'),plan=JSON.parse(await readFile(file,'utf8'));
const shapes={
 weapon:'one single SOLID BARREL-HEAD HEAVY MALLET. One broad cylindrical or octagonal DRUM spans horizontally at the end of the short grip; two thick flat end caps on ONE uninterrupted central head. The head is connected by a sturdy collar. NO two separated cheek masses, no open crossbar, no holes through the central head. It is an unmistakably SINGLE DRUM mallet silhouette, distinct from basic double blocks and complete open paired blocks. Build the drum in practical iron/brass for standard, matte octagonal rune-stone for omega, large blunt bone plates over rootwood for primal.',
 armor:'one LONG SLEEVELESS heavy cuirass vest with an OVAL SHIELD-SHAPED LOWER PANEL extending to thigh length, one large CIRCULAR chest boss and two modest horizontal shoulder caps. Garment height is about 1.25 times full shoulder width. The long rounded lower plate and absent sleeves define this intermediate outline; never copy the short squat barrel waist of T1/T3. Use the requested series materials; standard has amber/tan lining.'
};
const rejected=[];
for(const item of plan.items.filter(i=>i.direction==='hammer'&&i.tier===2&&shapes[i.slot])){
 item.prompt='EXACT OVERRIDING T2 HAMMER SHAPE: '+shapes[item.slot]+'\n'+item.prompt;
 item.prompt+='\nThe overriding object shape described FIRST has priority over all generic main-body and stage descriptions. The endpoints are STYLE references only; copying either outline fails this redesign.';
 const p=join(art,'records',item.id+'.json');if(existsSync(p)){const r=JSON.parse(await readFile(p,'utf8'));r.status='rejected-insufficient-t2-hammer-distinction';r.reviewNote='T2 repeats the complete paired hammer / short barrel armour. Use single drum mallet and long oval cuirass.';await writeFile(p,JSON.stringify(r,null,2));rejected.push(item.id);}
}
plan.designRevision=8;await writeFile(file,JSON.stringify(plan,null,2));console.log(JSON.stringify({designRevision:8,rejected}));
