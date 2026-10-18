import {afterAll,it,expect} from 'vitest';
import {poolFor,transaction,keepWarm,WARM_POOL} from '../apps/api/src/database.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Real PostgreSQL required');
const pool=poolFor(dsn),admin=poolFor(dsn),warmPool=poolFor(dsn,{warm:true}),warm=keepWarm(warmPool,60000);
afterAll(async()=>{warm.stop();await pool.end();await admin.end();await warmPool.end();});

// 数据库后端在事务中途断开（Windows 资源紧张时实际出现过）：该请求失败，
// 但损坏的连接不能回到连接池，后续超过连接池容量的请求都必须正常完成，不能挂起。
it('a backend killed mid-transaction fails only that request and the pool keeps serving',async()=>{
 const killed=transaction(pool,async c=>{
  const pid=(await c.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  await admin.query('SELECT pg_terminate_backend($1)',[pid]);
  await c.query('SELECT 1');
 });
 await expect(killed).rejects.toThrow();
 const started=Date.now();
 for(let i=0;i<20;i++)expect((await transaction(pool,async c=>(await c.query('SELECT $1::int n',[i])).rows[0].n))).toBe(i);
 expect(Date.now()-started).toBeLessThan(10000);
},30000);

// Windows 每个新连接都要新建 postgres.exe 进程，机器繁忙时可超过 10 秒。常驻服务预先保持常热连接：
// 日常并发请求只复用这些后端；后端被断开后由补足逻辑在空闲时补回，而不是留给下一次请求高峰。
it('the resident warm pool serves normal bursts on prewarmed backends and refills after a disconnect',async()=>{
 await warm.ready;
 expect(warmPool.totalCount).toBe(WARM_POOL.min);
 const owned=async()=>{const clients=await Promise.all(Array.from({length:WARM_POOL.min},()=>warmPool.connect()));const ids=await Promise.all(clients.map(async c=>(await c.query('SELECT pg_backend_pid() pid')).rows[0].pid));clients.forEach(c=>c.release());return ids;};
 const prewarmed=await owned();
 for(let burst=0;burst<5;burst++){
  const used=await Promise.all(Array.from({length:3},()=>transaction(warmPool,async c=>(await c.query('SELECT pg_backend_pid() pid')).rows[0].pid)));
  for(const pid of used)expect(prewarmed).toContain(pid);
 }
 expect(warmPool.totalCount).toBe(WARM_POOL.min);
 await admin.query('SELECT pg_terminate_backend($1)',[prewarmed[0]]);
 for(let i=0;i<50&&warmPool.totalCount===WARM_POOL.min;i++)await new Promise(r=>setTimeout(r,100));
 expect(warmPool.totalCount).toBe(WARM_POOL.min-1);
 await warm.fill();
 expect(warmPool.totalCount).toBe(WARM_POOL.min);
 expect(warmPool.idleCount).toBe(WARM_POOL.min);
},30000);
