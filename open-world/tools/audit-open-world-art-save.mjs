/** Read-only audit around art publication. Does not start, stop or migrate PostgreSQL. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import pg from 'pg';
const root=resolve(import.meta.dirname,'..'),phase=process.argv[2];if(!['before','after'].includes(phase))throw Error('Expected before / after');
const lines=(await readFile(join(root,'.runtime/dev/data/postmaster.pid'),'utf8')).split(/\r?\n/),port=Number(lines[3]);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid live PostgreSQL port');
const client=new pg.Client({host:'127.0.0.1',port,user:'aw_world',database:'postgres',connectionTimeoutMillis:5000});await client.connect();
try{await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');const snapshot={phase,cluster:(await client.query('select system_identifier::text id from pg_control_system()')).rows[0].id,tables:{}};
 for(const table of ['ow_accounts','ow_characters','ow_receipts','ow_ledger']){const rows=(await client.query(`SELECT to_jsonb(t)::text AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows.map(v=>v.row);snapshot.tables[table]={count:rows.length,sha256:createHash('sha256').update(rows.join('\n')).digest('hex')};}
 await client.query('COMMIT');const out=join(root,'.design/open-world-art-first');await mkdir(out,{recursive:true});await writeFile(join(out,'save-'+phase+'.json'),JSON.stringify(snapshot,null,2)+'\n');if(phase==='after'){const before=JSON.parse(await readFile(join(out,'save-before.json'),'utf8'));snapshot.sameCluster=before.cluster===snapshot.cluster;snapshot.unchanged=JSON.stringify(before.tables)===JSON.stringify(snapshot.tables);await writeFile(join(out,'save-comparison.json'),JSON.stringify(snapshot,null,2)+'\n');}console.log(JSON.stringify(snapshot));
}finally{await client.end();}
