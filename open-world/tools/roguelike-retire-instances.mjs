// Read-only plan by default. --apply requires a verified owned QA identity file,
// an API-stopped assertion, and a fresh durable backup before any update.
// Never edits characters, equipment, wallets, rewards, command receipts or awards.
import {readFileSync,openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {createRequire} from 'node:module';
import {hasRetiredDungeonData} from '../packages/rules/retired-dungeon-data.ts';
const args=process.argv.slice(2),flags=new Map();
for(let i=0;i<args.length;i++){
 const key=args[i];if(!['--owner','--backup','--apply','--api-stopped'].includes(key)||flags.has(key))throw Error('Unknown or repeated maintenance argument');
 if(['--apply','--api-stopped'].includes(key))flags.set(key,true);else{const value=args[++i];if(!value||value.startsWith('--'))throw Error('Missing maintenance argument');flags.set(key,value);}
}
const ownerPath=flags.get('--owner');if(typeof ownerPath!=='string'||!isAbsolute(ownerPath))throw Error('Pass an absolute --owner file path; do not put credentials in command arguments');
const identity=JSON.parse(readFileSync(ownerPath,'utf8'));
if(typeof identity.username!=='string'||!/^qa_[A-Za-z0-9_]{3,29}$/.test(identity.username)||typeof identity.characterId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.characterId)||typeof identity.ownershipSource!=='string'||!identity.ownershipSource)throw Error('Owner file must identify one verified, self-owned qa_ account and character');
const apply=flags.has('--apply'),backupPath=flags.get('--backup');
if(apply&&(!flags.has('--api-stopped')||typeof backupPath!=='string'||!isAbsolute(backupPath)))throw Error('Apply requires --api-stopped and a fresh absolute --backup path');
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('AW_DATABASE_URL must be supplied privately by the execution environment');
const {Pool}=createRequire(new URL('../package.json',import.meta.url))('pg');const pool=new Pool({connectionString:dsn,max:1}),client=await pool.connect();
try{
 await client.query('BEGIN');
 const owner=(await client.query('SELECT c.id,a.username FROM ow_characters c JOIN ow_accounts a ON a.id=c.account WHERE c.id=$1',[identity.characterId])).rows[0];
 if(!owner||owner.username!==identity.username)throw Error('QA ownership assertion did not match the database');
 const rows=(await client.query("SELECT d.* FROM ow_dungeons d WHERE d.id IN (SELECT instance FROM ow_dungeon_members WHERE character=$1) AND d.status IN ('preparing','loading','running') ORDER BY d.created FOR UPDATE",[identity.characterId])).rows;
 const retired=rows.filter(row=>hasRetiredDungeonData(row.data)),ids=retired.map(row=>row.id);
 const members=ids.length?(await client.query('SELECT * FROM ow_dungeon_members WHERE instance=ANY($1::uuid[]) ORDER BY instance,character FOR UPDATE',[ids])).rows:[];
 if(members.some(member=>member.character!==identity.characterId)||retired.some(row=>row.leader!==identity.characterId||row.data.members.some(member=>member.id!==identity.characterId)))throw Error('Refusing to touch an instance that includes another character');
 const summary={mode:apply?'apply':'plan',instances:ids,instanceCount:ids.length,memberCount:members.length,storedConnectedSeats:members.filter(member=>member.data?.connected).length,characterWrites:0,rewardWrites:0};
 if(!apply||!ids.length){await client.query('ROLLBACK');console.log(JSON.stringify(summary));}
 else{
  // The owner must stop the actual API first. Persisted connected flags can be stale
  // after graceful shutdown; this explicit assertion never attempts to stop it itself.
  const backup={schema:'roguelike-retirement-backup-v1',createdAt:new Date().toISOString(),owner:identity,instances:retired,members};
  const fd=openSync(backupPath,'wx',0o600);try{writeFileSync(fd,JSON.stringify(backup));fsyncSync(fd);}finally{closeSync(fd);}
  const at=new Date().toISOString();
  for(const row of retired){
   const data=structuredClone(row.data);data.status='closed';data.outcome='abandoned';data.reason='旧版局内强化实例已停用，原数据已备份';data.endedAt=at;
   for(const member of data.members){member.status='left';member.connected=false;member.ready=false;member.completedAt=at;member.endReason=data.reason;}
   const updated=await client.query('UPDATE ow_dungeons SET status=$2,ended=$3,data=$4 WHERE id=$1',[row.id,'closed',at,data]);if(updated.rowCount!==1)throw Error('Instance changed during retirement');
   for(const member of members.filter(m=>m.instance===row.id)){const detail={...member.data,status:'left',connected:false,ready:false,completedAt:at,endReason:data.reason};await client.query('UPDATE ow_dungeon_members SET active=false,data=$3 WHERE instance=$1 AND character=$2',[row.id,identity.characterId,detail]);}
  }
  await client.query('COMMIT');console.log(JSON.stringify({...summary,backupWritten:true,at}));
 }
}catch(error){await client.query('ROLLBACK').catch(()=>{});console.error('Retired-instance maintenance did not complete: '+(error instanceof Error?error.message:'unknown error'));process.exitCode=1;}
finally{client.release();await pool.end();}
