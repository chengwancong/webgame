import {readFile,writeFile} from 'node:fs/promises';
const n=Number(process.argv[2]),island=['wind','mist','forge','frost','rift','dragon'][n-1],folder='docs/reviews/open-world-m2-m4/W'+(n+3);if(!island)throw Error('Chapter1–6 required');
const content=JSON.parse(await readFile('packages/content/dungeons.json','utf8')),changes=[];
for(let d=1;d<=3;d++){const report=JSON.parse(await readFile(folder+'/wall-'+d+'.json','utf8')),definition=content.definitions.find(x=>x.id==='field-'+island+'-'+d),samples=report.scenarios.find(s=>s.requestedRho===1).samples;
 const rates=samples.filter(s=>s.death&&s.seconds>0&&s.incomingDamage>0).map(s=>s.incomingDamage/s.seconds).sort((a,b)=>a-b);if(!rates.length)continue;
 const measured=rates[Math.floor(rates.length/2)],target=report.reference.build.stats.hp/30,before=definition.policy.enemyScale.attack,after=before*target/measured;
 definition.policy.enemyScale.attack=after;changes.push({dungeon:definition.id,source:'Actual rho1 approach/death samples from the declared landing. Damage is post-mitigation; use the design30s survival target.',measuredPostMitigationDps:measured,targetPostMitigationDps:target,declaredAttackBefore:before,declaredAttackAfter:after,playerChanged:false});
}
await writeFile('packages/content/dungeons.json',JSON.stringify(content,null,2)+'\n');await writeFile(folder+'/wall-opening-pressure-correction.json',JSON.stringify({chapter:n,changes,limits:['One correction of new encounter declarations from actual opening failure, not player scaling or a successful result injection.','All original deaths remain in the evidence. New instances alone use the updated declared attack difficulty.']},null,2)+'\n');console.log(JSON.stringify({chapter:n,changes}));
