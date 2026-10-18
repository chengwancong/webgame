import {Pool} from 'pg';
import {readFile,writeFile} from 'node:fs/promises';
const out='docs/reviews/playability-20261008/evidence',session=JSON.parse(await readFile(out+'/session.json','utf8'));
const services=[{phase:'new',dsn:session.dsn},...JSON.parse(await readFile(out+'/sample-services.json','utf8')),...JSON.parse(await readFile(out+'/sample-services-endfresh.json','utf8'))];
const chosen=process.argv[2],rows=[];
for(const service of services.filter(s=>!chosen||s.phase===chosen)){
 const uri=new URL(service.dsn),owned=new URL(session.dsn);if(uri.hostname!=='127.0.0.1'||uri.port!==owned.port||!(service.dsn===session.dsn||uri.pathname.startsWith('/playability_')))throw Error('Refusing database outside this owned isolated cluster');
 const pool=new Pool({connectionString:service.dsn,max:1});try{
  const characters=(await pool.query('SELECT id,state FROM ow_characters ORDER BY id')).rows;
  const counts=(await pool.query('SELECT (SELECT count(*) FROM ow_accounts) AS accounts,(SELECT count(*) FROM ow_characters) AS characters,(SELECT count(*) FROM ow_kills) AS kills,(SELECT count(*) FROM ow_receipts) AS receipts,(SELECT count(*) FROM ow_ledger) AS ledger')).rows[0];
  const runs=(await pool.query('SELECT id,created,status,data FROM ow_dungeons ORDER BY created,id')).rows.map(r=>{const d=r.data;return {id:r.id,created:r.created,status:r.status,outcome:d.outcome,reason:d.reason,definition:{id:d.definition.id,name:d.definition.name,numericStage:d.definition.numericStage,level:d.definition.level,policy:d.definition.policy,stages:d.definition.stages},worldTier:d.worldTier,worldLine:d.world_line,versions:d.versions,tick:d.tick,tickRate:d.tickRate,stage:d.stage,startedAt:d.startedAt,endedAt:d.endedAt,keyProgress:d.keyProgress,diagnostics:d.diagnostics,measurement:d.measurement,openedChests:d.openedChests,members:d.members?.map(m=>({id:m.id,frozen:m.frozen,earned:m.earned,active:m.active}))};});
  rows.push({phase:service.phase,at:new Date().toISOString(),counts,characters,runs});
 }finally{await pool.end();}
}
await writeFile(out+'/pg-audit-'+(chosen??'final')+'.json',JSON.stringify(rows,null,2));console.log(rows.map(r=>({phase:r.phase,counts:r.counts,runs:r.runs.map(d=>({id:d.definition.id,stage:d.definition.numericStage,status:d.status,reason:d.reason}))})));
