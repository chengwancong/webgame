/** Read-only current-development-store audit. Never starts, restores or clears a database. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {verifyPersistence} from './persistence-audit.mjs';
const root=resolve(import.meta.dirname,'..'),batch=process.argv[2],phase=process.argv[3];
if(!/^W(?:[0-9]|10|11)$/.test(batch??'')||!['before','after'].includes(phase))throw Error('Expected batch and before/after');
const data=join(root,'.runtime/dev/data'),lines=(await readFile(join(data,'postmaster.pid'),'utf8')).split(/\r?\n/);
if(resolve(lines[1])!==data)throw Error('Live database identity differs');
const client=new pg.Client({host:'127.0.0.1',port:Number(lines[3]),user:'aw_world',database:'postgres',connectionTimeoutMillis:5000});await client.connect();
const out=join(root,'docs/reviews/open-world-m2-m4',batch);await mkdir(out,{recursive:true});
try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const snapshot={phase,at:new Date().toISOString(),cluster:(await client.query('select system_identifier::text id from pg_control_system()')).rows[0].id,tables:{}};
 for(const table of ['ow_accounts','ow_characters','ow_receipts','ow_ledger']){const rows=(await client.query(`select to_jsonb(t)::text row from ${table} t order by to_jsonb(t)::text`)).rows.map(r=>r.row);snapshot.tables[table]={count:rows.length,sha256:createHash('sha256').update(rows.join('\n')).digest('hex'),rows};}
 await client.query('COMMIT');await writeFile(join(out,'publication-save-'+phase+'.json'),JSON.stringify(snapshot,null,2)+'\n');
 let comparison;if(phase==='after'){const before=JSON.parse(await readFile(join(out,'publication-save-before.json'),'utf8'));comparison={sameCluster:before.cluster===snapshot.cluster,tables:{}};for(const [table,old]of Object.entries(before.tables)){const current=snapshot.tables[table],set=new Set(current.rows);comparison.tables[table]={before:old.count,after:current.count,unchanged:old.sha256===current.sha256,missingOriginalRows:old.rows.filter(row=>!set.has(row)).length};}const adapt=s=>({cluster:s.cluster,tables:Object.fromEntries(Object.entries(s.tables).map(([k,v])=>[k,v.rows.map(JSON.parse)])),migrations:[]});comparison.receiptAudit=verifyPersistence(adapt(before),adapt(snapshot));comparison.passed=true;await writeFile(join(out,'publication-save-comparison.json'),JSON.stringify(comparison,null,2)+'\n');}
 console.log(JSON.stringify({phase,counts:Object.fromEntries(Object.entries(snapshot.tables).map(([k,v])=>[k,v.count])),comparison}));
}finally{await client.end();}
