import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import pg from 'pg';
import {verifyPersistence} from './persistence-audit.mjs';
const root=resolve(import.meta.dirname,'..'),folder=join(root,'docs/reviews/open-world-m2-m4/W11'),data=join(root,'.runtime/dev/data'),lines=(await readFile(join(data,'postmaster.pid'),'utf8')).split(/\r?\n/);
if(resolve(lines[1])!==data)throw Error('Unexpected live cluster');
const client=new pg.Client({host:'127.0.0.1',port:Number(lines[3]),user:'aw_world',database:'postgres',connectionTimeoutMillis:5000});await client.connect();
try{
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const current={cluster:(await client.query('select system_identifier::text id from pg_control_system()')).rows[0].id,tables:{},migrations:[]};
 for(const table of ['ow_accounts','ow_characters','ow_receipts','ow_ledger'])current.tables[table]=(await client.query(`select to_jsonb(t) row from ${table} t`)).rows.map(r=>r.row);
 await client.query('COMMIT');const old=JSON.parse(await readFile(join(folder,'publication-save-before.json'),'utf8')),before={cluster:old.cluster,tables:Object.fromEntries(Object.entries(old.tables).map(([k,v])=>[k,v.rows.map(JSON.parse)])),migrations:[]};
 const audit=verifyPersistence(before,current),health=await(await fetch('http://127.0.0.1:8612/api/health')).json(),contentVersions=(await(await fetch('http://127.0.0.1:8612/api/content')).json()).versions;
 const result={at:new Date().toISOString(),passed:true,scope:'Read-only post-GUI audit; new test account/character and legitimate GUI receipts are audited additions, not data loss.',counts:Object.fromEntries(Object.entries(current.tables).map(([k,v])=>[k,v.length])),audit,health,contentVersions};
 if(JSON.stringify(health.versions)!==JSON.stringify(contentVersions))throw Error('Actual API version mismatch');
 await writeFile(join(folder,'delivery-save-audit.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await client.end();}
