import {sourceVersion} from '../../../../tools/source-version.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const out='docs/reviews/playability-20261008/evidence';
const session=JSON.parse(await readFile(out+'/session.json','utf8'));
const data={at:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source:await sourceVersion({diagnostics:true}),distIndexSha256:createHash('sha256').update(await readFile('apps/web/dist/index.html')).digest('hex'),officialHealth:await(await fetch('http://127.0.0.1:8612/api/health')).json(),isolatedHealth:await(await fetch(session.url+'/api/health')).json(),contentVersions:(await(await fetch(session.url+'/api/content')).json()).versions};
await writeFile(out+'/runtime-baseline.json',JSON.stringify(data,null,2));
console.log(JSON.stringify({head:data.head,source:data.source.sha256,isolated:data.isolatedHealth,contentVersions:data.contentVersions}));
