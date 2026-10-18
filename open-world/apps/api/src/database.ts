import {ensureStarsea} from '../../../packages/rules/starsea.ts';
import {migrateWeaponSkills} from '../../../packages/rules/weapon-skills.ts';
import {Pool,type PoolClient} from 'pg';
import {ensureAppearance} from '../../../packages/rules/appearance.ts';
import type {CharacterState} from '../../../packages/contracts/index.ts';
import {normalizeSkillLoadout,migrateSkillActivation} from '../../../packages/rules/index.ts';
import {ensureProgression,assignGearAspect} from '../../../packages/rules/deep-progression.ts';
import {ensureChallengeProgress} from '../../../packages/rules/progression-challenges.ts';
import {migrateTaskJournal} from './task-journal.ts';
import {migrateCraftProgression} from '../../../packages/rules/crafting-migration.ts';
// Windows 上每个新连接都要创建一个 postgres.exe 后端进程。机器繁忙时（浏览器验收、临时数据库测试、
// 数值网格、杀毒扫描新进程）创建进程曾超过 10 秒，续租／登录随之超时并丢失控制权。常驻服务保持少量
// 常热连接：正常游玩并发为 1–3，偶发 6，常热 4 条覆盖日常请求；超出部分空闲 5 分钟后才回收。
export const WARM_POOL={min:4,idleTimeoutMillis:300000};
export function poolFor(dsn:string,{warm=false}:{warm?:boolean}={}){
 // 超时保证坏连接不会让请求永远挂起：取连接 10 秒、单条查询 20 秒、事务内空闲 30 秒由数据库回收。
 const pool=new Pool({connectionString:dsn,max:12,connectionTimeoutMillis:10000,query_timeout:20000,idle_in_transaction_session_timeout:30000,keepAlive:true,...(warm?WARM_POOL:{})});
 // pg removes the broken idle connection; query failures still reach their caller.
 pool.on('error',error=>console.error('Database idle connection disconnected',error.message));
 return pool;
}
// 启动时预先建立常热连接；断开的连接在空闲时补回，不留到下一次请求高峰再临时创建后端进程。
export function keepWarm(pool:Pool,everyMs=30000){
 // connect() 优先借出空闲连接，因此同时借出 min 条才会新建缺少的后端。
 const fill=async()=>{const min=pool.options.min??0;if(pool.totalCount>=min||pool.waitingCount||pool.ending)return;
  const clients=await Promise.allSettled(Array.from({length:min},()=>pool.connect()));
  for(const c of clients)if(c.status==='fulfilled')c.value.release();};
 const timer=setInterval(()=>void fill().catch(()=>{}),everyMs);timer.unref();
 return {fill,ready:fill().catch(()=>{}),stop:()=>clearInterval(timer)};
}
export async function migrate(pool:Pool){await transaction(pool,async c=>{
 // Serialize schema creation as well as data repair across startup processes.
 await c.query('SELECT pg_advisory_xact_lock(8611004)');
 await c.query(`
CREATE TABLE IF NOT EXISTS ow_schema(version integer PRIMARY KEY);
INSERT INTO ow_schema VALUES(3) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS ow_accounts(id uuid PRIMARY KEY,username text UNIQUE NOT NULL,password text NOT NULL);
CREATE TABLE IF NOT EXISTS ow_sessions(token_hash text PRIMARY KEY,account uuid REFERENCES ow_accounts(id),expires timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS ow_characters(id uuid PRIMARY KEY,account uuid UNIQUE REFERENCES ow_accounts(id),state jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS ow_controls(character uuid PRIMARY KEY REFERENCES ow_characters(id),lease uuid NOT NULL,session text NOT NULL,expires timestamptz NOT NULL);
ALTER TABLE ow_controls ADD COLUMN IF NOT EXISTS client_id text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS ow_permits(id uuid PRIMARY KEY,character uuid REFERENCES ow_characters(id),region text NOT NULL,cycle integer NOT NULL,build integer NOT NULL,created timestamptz NOT NULL,expires timestamptz NOT NULL,sequence integer NOT NULL DEFAULT 0,tick integer NOT NULL DEFAULT 0,data jsonb NOT NULL,UNIQUE(character,region,cycle));
ALTER TABLE ow_permits ADD COLUMN IF NOT EXISTS private_data jsonb NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS ow_kills(character uuid REFERENCES ow_characters(id),source text NOT NULL,PRIMARY KEY(character,source));
ALTER TABLE ow_kills ADD COLUMN IF NOT EXISTS killed_at timestamptz;
INSERT INTO ow_schema VALUES(13) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS ow_rewards(id uuid PRIMARY KEY,character uuid REFERENCES ow_characters(id),source text NOT NULL,claimed boolean NOT NULL DEFAULT false,data jsonb NOT NULL,UNIQUE(character,source));
CREATE TABLE IF NOT EXISTS ow_receipts(character uuid REFERENCES ow_characters(id),command uuid NOT NULL,fingerprint text NOT NULL,receipt jsonb NOT NULL,PRIMARY KEY(character,command));
CREATE TABLE IF NOT EXISTS ow_ledger(id bigserial PRIMARY KEY,character uuid REFERENCES ow_characters(id),command uuid NOT NULL,delta jsonb NOT NULL,created timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS ow_starsea_defenses(character uuid PRIMARY KEY REFERENCES ow_characters(id),data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS ow_camp_cycles(character uuid REFERENCES ow_characters(id),region text NOT NULL,camp text NOT NULL,cycle integer NOT NULL CHECK(cycle>0),data jsonb NOT NULL,created timestamptz NOT NULL DEFAULT now(),cleared_at timestamptz,PRIMARY KEY(character,region,camp,cycle));
CREATE TABLE IF NOT EXISTS ow_field_sessions(character uuid REFERENCES ow_characters(id),region text NOT NULL,tick integer NOT NULL CHECK(tick>=0),checkpoint jsonb NOT NULL,updated timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(character,region));
INSERT INTO ow_schema VALUES(14) ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS ow_rewards_pending ON ow_rewards(character) WHERE NOT claimed;
`);
  // Run this correction once; row locks exclude simultaneous character writes.
  if(!(await c.query('SELECT 1 FROM ow_schema WHERE version=4')).rowCount){
  const characters=await c.query('SELECT id,state FROM ow_characters FOR UPDATE');
  for(const row of characters.rows){const s:CharacterState=row.state;if(normalizeSkillLoadout(s)){
   await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,row.id]);
   await c.query('UPDATE ow_permits SET build=$1 WHERE character=$2',[s.build,row.id]);
  }}
  await c.query('INSERT INTO ow_schema VALUES(4)');
  }
  if(!(await c.query('SELECT 1 FROM ow_schema WHERE version=5')).rowCount){
   const characters=await c.query('SELECT id,state FROM ow_characters FOR UPDATE');
   for(const row of characters.rows){const s:CharacterState=row.state;if(s.gear.some(g=>g.rank>0)){s.revision++;s.build++;await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,row.id]);}}
   await c.query('INSERT INTO ow_schema VALUES(5)');
  }
  if(!(await c.query('SELECT 1 FROM ow_schema WHERE version=6')).rowCount){
   const characters=await c.query('SELECT id,state FROM ow_characters FOR UPDATE');
   for(const row of characters.rows){const s:CharacterState=row.state;migrateSkillActivation(s);await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,row.id]);}
   // New activation rules need fresh permits; historical receipts remain intact.
   await c.query("UPDATE ow_permits SET expires=now()-interval '31 seconds' WHERE data->>'rules'<>'ow-4'");
   await c.query('INSERT INTO ow_schema VALUES(6)');
  }
  if(!(await c.query('SELECT 1 FROM ow_schema WHERE version=7')).rowCount){
   // Reconstruct regional progress from confirmed sources, never global kill totals.
   const rows=await c.query(`SELECT p.character,p.region,count(DISTINCT k.source)::integer kills,
     count(DISTINCT k.source) FILTER (WHERE (m->>'elite')::boolean)::integer elites
     FROM ow_permits p CROSS JOIN LATERAL jsonb_array_elements(p.data->'spawns') m
     JOIN ow_kills k ON k.character=p.character AND k.source=m->>'id'
     WHERE p.region NOT LIKE '%-boss' GROUP BY p.character,p.region`);
   const characters=await c.query('SELECT id,state FROM ow_characters FOR UPDATE');
   for(const row of characters.rows){const s:CharacterState=row.state;s.progress.regionKills={};s.progress.regionElites={};
    for(const confirmed of rows.rows.filter(v=>v.character===s.id)){s.progress.regionKills[confirmed.region]=confirmed.kills;s.progress.regionElites[confirmed.region]=confirmed.elites;}
    s.revision++;await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,row.id]);
   }
   await c.query('INSERT INTO ow_schema VALUES(7)');
  }
  if(!(await c.query('SELECT 1 FROM ow_schema WHERE version=8')).rowCount){
   // Additive migration: preserve wallets, gear identities, activation and receipts.
   const characters=await c.query('SELECT id,state FROM ow_characters FOR UPDATE');
   for(const row of characters.rows){const s:CharacterState=row.state;const before=JSON.stringify(s);for(const gear of s.gear)assignGearAspect(gear);ensureProgression(s);
    ensureChallengeProgress(s);
    if(JSON.stringify(s)!==before){s.revision++;s.build++;await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,row.id]);}
   }
   const pending=await c.query('SELECT id,data FROM ow_rewards WHERE NOT claimed FOR UPDATE');
   for(const row of pending.rows){const data=row.data,before=JSON.stringify(data);if(data.gear)assignGearAspect(data.gear);if(JSON.stringify(data)!==before)await c.query('UPDATE ow_rewards SET data=$1 WHERE id=$2',[data,row.id]);}
   await c.query(`CREATE TABLE IF NOT EXISTS ow_challenge_runs(id uuid PRIMARY KEY,character uuid REFERENCES ow_characters(id),command uuid NOT NULL,data jsonb NOT NULL,created timestamptz NOT NULL DEFAULT now(),UNIQUE(character,command));
    CREATE INDEX IF NOT EXISTS ow_challenge_rank ON ow_challenge_runs((data->>'tier'),created) WHERE (data->>'won')='true';
    CREATE TABLE IF NOT EXISTS ow_raid_lobbies(id uuid PRIMARY KEY,leader uuid REFERENCES ow_characters(id),raid text NOT NULL,created timestamptz NOT NULL DEFAULT now(),expires timestamptz NOT NULL,data jsonb NOT NULL);`);
   // Old battle authorizations cannot settle under the new progression rules.
   await c.query("UPDATE ow_permits SET expires=now()-interval '31 seconds'");
   await c.query('INSERT INTO ow_schema VALUES(8)');
  }
  if(!(await c.query('SELECT 1 FROM ow_schema WHERE version=9')).rowCount){
   // Add cosmetic ownership without modifying combat builds, permits or wallets.
   const characters=await c.query('SELECT id,state FROM ow_characters FOR UPDATE');
   for(const row of characters.rows){const s:CharacterState=row.state;const before=JSON.stringify(s);ensureAppearance(s);if(JSON.stringify(s)!==before){s.revision++;await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,row.id]);}}
   await c.query('INSERT INTO ow_schema VALUES(9)');
  }
  if(!(await c.query('SELECT 1 FROM ow_schema WHERE version=10')).rowCount){
   const characters=await c.query('SELECT id,state FROM ow_characters FOR UPDATE');
   for(const row of characters.rows){
    const evidence=await c.query(`SELECT r.receipt,l.created FROM ow_receipts r LEFT JOIN ow_ledger l ON l.character=r.character AND l.command=r.command WHERE r.character=$1 ORDER BY (r.receipt->>'revision')::bigint,l.created`,[row.id]);
    migrateTaskJournal(row.state,evidence.rows);
    await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[row.state,row.id]);
   }
   await c.query('INSERT INTO ow_schema VALUES(10)');
  }
  await c.query(`CREATE TABLE IF NOT EXISTS ow_field_activities(character uuid REFERENCES ow_characters(id),target text NOT NULL,instance uuid NOT NULL UNIQUE,status text NOT NULL,data jsonb NOT NULL,updated timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(character,target));INSERT INTO ow_schema VALUES(16) ON CONFLICT DO NOTHING;`);
  await c.query(`CREATE TABLE IF NOT EXISTS ow_dungeons(id uuid PRIMARY KEY,leader uuid REFERENCES ow_characters(id),status text NOT NULL,created timestamptz NOT NULL DEFAULT now(),ended timestamptz,data jsonb NOT NULL);
   CREATE TABLE IF NOT EXISTS ow_dungeon_members(instance uuid REFERENCES ow_dungeons(id),character uuid REFERENCES ow_characters(id),active boolean NOT NULL,data jsonb NOT NULL,PRIMARY KEY(instance,character));
   CREATE UNIQUE INDEX IF NOT EXISTS ow_dungeon_one_active ON ow_dungeon_members(character) WHERE active;
   CREATE TABLE IF NOT EXISTS ow_dungeon_commands(character uuid REFERENCES ow_characters(id),command uuid NOT NULL,fingerprint text NOT NULL,response jsonb NOT NULL,PRIMARY KEY(character,command));
   CREATE TABLE IF NOT EXISTS ow_dungeon_ticks(instance uuid REFERENCES ow_dungeons(id),tick bigint NOT NULL,inputs jsonb NOT NULL,created timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(instance,tick));
   ALTER TABLE ow_dungeon_ticks ADD COLUMN IF NOT EXISTS events jsonb NOT NULL DEFAULT '[]';
   CREATE TABLE IF NOT EXISTS ow_dungeon_awards(instance uuid REFERENCES ow_dungeons(id),character uuid REFERENCES ow_characters(id),source text NOT NULL,receipt jsonb NOT NULL,created timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(instance,character,source));
   CREATE TABLE IF NOT EXISTS ow_dungeon_completions(character uuid REFERENCES ow_characters(id),dungeon text NOT NULL,instance uuid REFERENCES ow_dungeons(id),created timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(character,dungeon));
   INSERT INTO ow_schema VALUES(11) ON CONFLICT DO NOTHING;`);
  if(!(await c.query('SELECT 1 FROM ow_schema WHERE version=12')).rowCount){const rows=await c.query('SELECT id,state FROM ow_characters FOR UPDATE');for(const row of rows.rows){migrateWeaponSkills(row.state);await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[row.state,row.id]);}await c.query('INSERT INTO ow_schema VALUES(12)');}
  if(!(await c.query('SELECT 1 FROM ow_schema WHERE version=15')).rowCount){
   await c.query('CREATE TABLE IF NOT EXISTS ow_quest_migrations(character uuid PRIMARY KEY REFERENCES ow_characters(id),before_state jsonb NOT NULL,after_state jsonb NOT NULL,created timestamptz NOT NULL DEFAULT now())');
   const rows=await c.query('SELECT id,state FROM ow_characters FOR UPDATE');for(const row of rows.rows){const before=structuredClone(row.state);if(ensureStarsea(row.state)){await c.query('INSERT INTO ow_quest_migrations(character,before_state,after_state) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[row.id,before.starsea,row.state.starsea]);await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[row.state,row.id]);}}
   await c.query('INSERT INTO ow_schema VALUES(15)');
  }
  if(!(await c.query('SELECT 1 FROM ow_schema WHERE version=17')).rowCount){
   const rows=await c.query('SELECT id,state FROM ow_characters FOR UPDATE');
   for(const row of rows.rows){migrateCraftProgression(row.state);row.state.field??={gathered:[]};await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[row.state,row.id]);}
   await c.query('INSERT INTO ow_schema VALUES(17)');
  }
 });
}
// 连接在借出期间断开（socket 错误或回滚失败）：记录并销毁该连接，不能放回连接池给后续请求复用，
// 也不能让借出连接上的 error 事件成为未捕获异常拖垮服务。
export async function transaction<T>(pool:Pool,fn:(c:PoolClient)=>Promise<T>){const c=await pool.connect();let broken:Error|undefined;const onError=(e:Error)=>{broken??=e;};c.on('error',onError);try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){try{await c.query('ROLLBACK');}catch(rollback){broken=rollback instanceof Error?rollback:Error(String(rollback));}throw e;}finally{c.off('error',onError);c.release(broken);}}
