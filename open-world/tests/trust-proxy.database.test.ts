import {afterAll,it,expect} from 'vitest';
import {poolFor} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';

if(!process.env.AW_DATABASE_URL)throw Error('Real PostgreSQL required');
const pool=poolFor(process.env.AW_DATABASE_URL),app=createApp(pool,{dungeons:false});
app.get('/test/client-ip',async req=>({ip:req.ip}));
afterAll(async()=>{await app.close();await pool.end();});
it('uses the client address forwarded by the compose proxy',async()=>{
 const r=await app.inject({url:'/test/client-ip',remoteAddress:'172.18.0.4',headers:{'x-forwarded-for':'203.0.113.7'}});
 expect(r.json().ip).toBe('203.0.113.7');
});
it('ignores forged forwarded headers from an untrusted direct peer',async()=>{
 const r=await app.inject({url:'/test/client-ip',remoteAddress:'198.51.100.8',headers:{'x-forwarded-for':'203.0.113.7'}});
 expect(r.json().ip).toBe('198.51.100.8');
});
it('stops at the first untrusted hop instead of the spoofed leftmost address',async()=>{
 const r=await app.inject({url:'/test/client-ip',remoteAddress:'172.18.0.4',headers:{'x-forwarded-for':'192.0.2.9, 198.51.100.8'}});
 expect(r.json().ip).toBe('198.51.100.8');
});
