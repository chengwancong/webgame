import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {Client} from 'pg';
const root=resolve(import.meta.dirname,'../../..');
const before=JSON.parse(await readFile(resolve(import.meta.dirname,'before.json'),'utf8'));
const lines=(await readFile(resolve(root,'.runtime/dev/data/postmaster.pid'),'utf8')).split('\n');
const db=new Client({host:'127.0.0.1',port:Number(lines[3]),user:'aw_world',database:'postgres'});
const after={date:'2026-10-04',stage:'final-independent',tables:{},scope:'read-only row digests; no account identifiers, passwords, tokens or raw character states exported'};
await db.connect();
try{
 await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 after.cluster=(await db.query('SELECT system_identifier FROM pg_control_system()')).rows[0].system_identifier;
 for(const table of ['ow_accounts','ow_characters','ow_receipts','ow_ledger']){
  const rowDigests=(await db.query(`SELECT md5(row_to_json(t)::text) AS digest FROM ${table} t ORDER BY digest`)).rows.map(r=>r.digest);
  const current=new Set(rowDigests),missing=before.tables[table].rowDigests.filter(d=>!current.has(d));
  after.tables[table]={count:rowDigests.length,sha256OfDigests:createHash('sha256').update(JSON.stringify(rowDigests)).digest('hex'),rowDigests,initialCount:before.tables[table].count,initialIdenticalRows:before.tables[table].rowDigests.length-missing.length,changedOrMissingInitialDigests:missing};
 }
 await db.query('COMMIT');
}finally{await db.end();}
after.sameCluster=after.cluster===before.cluster;
after.initialImmutableRowsPreserved=['ow_accounts','ow_receipts','ow_ledger'].every(t=>after.tables[t].changedOrMissingInitialDigests.length===0);
after.characterCountRetained=after.tables.ow_characters.count>=before.tables.ow_characters.count;
after.characterDigestMeaning='Characters can change through committed gameplay commands; count/digest checks alone do not prove character identity retention. See full before/after identity+receipt audit from publication, source reload and service survival.';
after.summaryOk=after.sameCluster&&after.initialImmutableRowsPreserved&&after.characterCountRetained;
await writeFile(resolve(import.meta.dirname,'after.json'),JSON.stringify(after,null,2)+'\n');
console.log(JSON.stringify({sameCluster:after.sameCluster,initialImmutableRowsPreserved:after.initialImmutableRowsPreserved,characterCountRetained:after.characterCountRetained,counts:Object.fromEntries(Object.entries(after.tables).map(([k,v])=>[k,{before:v.initialCount,after:v.count,initialIdenticalRows:v.initialIdenticalRows,changedOrMissing:v.changedOrMissingInitialDigests.length}])),summaryOk:after.summaryOk}));
if(!after.summaryOk)process.exitCode=1;
