import {readFile,writeFile} from 'node:fs/promises';
import {wallAcceptance} from './wall-acceptance.ts';
const paths=process.argv.slice(2);if(!paths.length)throw Error('Existing real World wall reports required');
for(const path of paths){const report=JSON.parse(await readFile(path,'utf8'));
 report.speedComparison=wallAcceptance(report.scenarios);
 report.acceptanceUpdate={source:'2026-10-07 user validation verdict; existing raw World samples unchanged.',wall:'Declared rho and actual victory, invalid samples retained. No hardcoded70-second assertion.',speed:'Compare actual paired rho1 and rho1.2 samples; controlled enemy HP comparison, not actual key acquisition evidence.'};
 await writeFile(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({path,wallPassed:report.scenarios.filter(s=>s.threshold!==null).every(s=>s.passes),speedComparison:report.speedComparison}));}
