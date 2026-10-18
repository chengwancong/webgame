// 本地验收检查点（packages/rules/dev-checkpoints.ts、/api/dev/checkpoint）：只给 qa_ 测试号、只在新角色上、任务按正常完成流程走。
import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {poolFor,migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import type {Snapshot} from '../packages/contracts/index.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Real PostgreSQL required');
const pool=poolFor(dsn),app=createApp(pool,{testLogin:true,dungeons:false,devCheckpoints:true}),plain=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{await migrate(pool);await app.ready();await plain.ready();});afterAll(async()=>{await app.close();await plain.close();await pool.end();});
async function player(prefix:string,server=app){
 const login=await server.inject({method:'POST',url:'/api/session/login',payload:{username:prefix+randomUUID().replaceAll('-','').slice(0,20)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown)=>{const r=await server.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});return {status:r.statusCode,body:r.json()};};
 let s=(await request('character',{name:'检查点'})).body as Snapshot;const lease=(await request('control',{client_id:randomUUID()})).body.lease_id;
 const jump=async(checkpoint:string,weapon:string)=>{const r=await request('dev/checkpoint',{command_id:randomUUID(),revision:s.revision,lease_id:lease,checkpoint,weapon});if(r.status===200)s=r.body.snapshot;return r;};
 return {jump,get s(){return s;}};
}
it('salvage checkpoint: hidden kit, 落点求生 and 港口登记 done through the normal completion path, 抢救船台 accepted',async()=>{
 const p=await player('qa_');expect(p.s.starsea!.prologue?.done).toBe(false);
 const r=await p.jump('salvage','hidden');expect(r.status,JSON.stringify(r.body)).toBe(200);
 expect(p.s.starsea!.prologue).toMatchObject({done:true,weapon:'hidden'});expect(p.s.stats.weapon).toBe('hidden');
 expect(p.s.starsea!.done).toEqual(expect.arrayContaining(['ss-c01-t01','ss-c01-n01','ss-c01-t02']));expect(Object.keys(p.s.starsea!.quests)).toContain('ss-c01-t03');
 expect(p.s.skills).toEqual(['throwing_knife','fan_of_knives']);expect(p.s.skills).not.toContain('ward');
 expect(r.body.delta.xp).toBeGreaterThan(0);
 // 只能用在还没打开场的新角色上：第二次跳被拒，存档不变。
 const again=await p.jump('port-road','hidden');expect(again.body.code).toBe('DEV_CHECKPOINT');expect(p.s.starsea!.done).not.toContain('ss-c01-t03');
});
it('port-road checkpoint: 抢救船台 done, 护身印 granted, 4th slot still waits for the route choice',async()=>{
 const p=await player('qa_');const r=await p.jump('port-road','sword');expect(r.status,JSON.stringify(r.body)).toBe(200);
 expect(p.s.starsea!.done).toContain('ss-c01-t03');expect(p.s.skills).toEqual(['cut','whirl','ward']);expect(p.s.skillRecovery?.slots).toBe(3);
});
it('refuses accounts without the qa_ prefix and is absent unless enabled',async()=>{
 const p=await player('pl_');const r=await p.jump('landing','sword');expect(r.status).toBe(403);expect(r.body.code).toBe('DEV_CHECKPOINT');expect(p.s.starsea!.prologue?.done).toBe(false);
 const q=await player('qa_',plain);expect((await q.jump('landing','sword')).status).toBe(404);
 expect(()=>createApp(pool,{production:true,devCheckpoints:true})).toThrow();
});
