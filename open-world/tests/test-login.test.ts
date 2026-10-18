import {it,expect,afterAll,beforeAll} from 'vitest';
import {randomUUID} from 'node:crypto';
import {poolFor,migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
const pool=poolFor(process.env.AW_DATABASE_URL!);
const app=createApp(pool,{campaign:'legacy',testLogin:true,dungeons:false}),normal=createApp(pool,{campaign:'legacy',dungeons:false});
beforeAll(()=>migrate(pool));afterAll(async()=>{await app.close();await normal.close();await pool.end();});
it('account-only login creates once under concurrency and restores the same character',async()=>{
 const username='test_'+randomUUID().replaceAll('-','').slice(0,20);
 const login=()=>app.inject({method:'POST',url:'/api/session/login',payload:{username}});
 const responses=await Promise.all([login(),login(),login()]);responses.forEach(r=>expect(r.statusCode).toBe(200));
 expect((await pool.query('SELECT id FROM ow_accounts WHERE username=$1',[username])).rowCount).toBe(1);
 const cookie=String(responses[0].headers['set-cookie']).split(';')[0];
 const created=await app.inject({method:'POST',url:'/api/character',headers:{cookie},payload:{name:'内网测试'}});
 await app.inject({method:'POST',url:'/api/logout',headers:{cookie},payload:{}});
 const again=await login();const restored=await app.inject({url:'/api/character',headers:{cookie:String(again.headers['set-cookie']).split(';')[0]}});
 expect(restored.json()).toEqual(created.json());
 expect((await app.inject('/api/health')).json().auth_mode).toBe('account-only');
});
it('keeps existing password accounts and rejects invalid input and production opt-in',async()=>{
 const username='old_'+randomUUID().replaceAll('-','').slice(0,20);
 expect((await normal.inject({method:'POST',url:'/api/session/register',payload:{username,password:'original-password'}})).statusCode).toBe(200);
 const before=(await pool.query('SELECT password FROM ow_accounts WHERE username=$1',[username])).rows[0].password;
 expect((await app.inject({method:'POST',url:'/api/session/login',payload:{username}})).statusCode).toBe(200);
 expect((await pool.query('SELECT password FROM ow_accounts WHERE username=$1',[username])).rows[0].password).toBe(before);
 expect((await normal.inject({method:'POST',url:'/api/session/login',payload:{username}})).statusCode).toBe(400);
 expect((await app.inject({method:'POST',url:'/api/session/login',payload:{username:'!'}})).statusCode).toBe(400);
 expect(()=>createApp(pool,{production:true,testLogin:true})).toThrow();
});
