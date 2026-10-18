import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Client} from 'pg';
const stage=process.argv[2];if(!['before','after'].includes(stage))throw Error('Specify before or after');
const lines=(await readFile('.runtime/dev/data/postmaster.pid','utf8')).split('\n'),db=new Client({host:'127.0.0.1',port:Number(lines[3]),user:'aw_world',database:'postgres'});
await db.connect();let snapshot;try{const cluster=(await db.query('SELECT system_identifier FROM pg_control_system()')).rows[0].system_identifier,tables={};for(const table of ['ow_accounts','ow_characters','ow_receipts','ow_ledger']){const rows=(await db.query(`SELECT row_to_json(t)::text row FROM ${table} t ORDER BY row_to_json(t)::text`)).rows;tables[table]={count:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};}snapshot={cluster,tables};}finally{await db.end();}
const folder=resolve('../docs/reviews/open-world/vfx-v2-20261001');await mkdir(folder,{recursive:true});await writeFile(resolve(folder,'persistence-'+stage+'.json'),JSON.stringify(snapshot,null,2)+'\n');console.log(JSON.stringify({stage,counts:Object.fromEntries(Object.entries(snapshot.tables).map(([k,v])=>[k,v.count]))}));
if(stage==='after'){const before=JSON.parse(await readFile(resolve(folder,'persistence-before.json'),'utf8'));console.log(JSON.stringify({unchanged:JSON.stringify(before)===JSON.stringify(snapshot),sameCluster:before.cluster===snapshot.cluster}));}
