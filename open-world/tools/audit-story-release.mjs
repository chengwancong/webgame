import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {persistenceSnapshot,persistenceSummary,verifyPersistence} from './persistence-audit.mjs';
const stage=process.argv[2];if(!['before','after'].includes(stage))throw Error('Specify before or after');
const privateFile=resolve('.runtime/story-release-before.json'),folder=resolve('../docs/reviews/open-world/story-campaign-20261003');await mkdir(folder,{recursive:true});const snapshot=await persistenceSnapshot();
if(stage==='before')await writeFile(privateFile,JSON.stringify(snapshot));
const summary=persistenceSummary(snapshot),verification=stage==='after'?verifyPersistence(JSON.parse(await readFile(privateFile,'utf8')),snapshot):undefined;await writeFile(resolve(folder,'persistence-'+stage+'.json'),JSON.stringify({summary,verification},null,2));console.log(JSON.stringify({stage,verification,counts:Object.fromEntries(Object.entries(summary.tables).map(([name,data])=>[name,data.count]))}));
