// numeric-spine S7：同步最终整数投影；比例/速度专用夹具避开最小生命和防作弊固定下限。
import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {poolFor,migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import type {Snapshot} from '../packages/contracts/index.ts';
import {growthCards,growthMark} from '../apps/web/src/growth-cards.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Real PostgreSQL required');
const pool=poolFor(dsn),app=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{await migrate(pool);await app.ready();});afterAll(async()=>{await app.close();await pool.end();});
async function player(){const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'ws_'+randomUUID().replaceAll('-','').slice(0,22)}}),cookie=String(login.headers['set-cookie']).split(';')[0];const request=async(path:string,body?:unknown)=>{const r=await app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});return {status:r.statusCode,body:r.json()};};let s=(await request('character',{name:'绑定与主线'})).body as Snapshot;const lease=(await request('control',{client_id:randomUUID()})).body.lease_id;const write=async(path:string,body:object)=>{const result=await request(path,{command_id:randomUUID(),revision:s.revision,lease_id:lease,...body});if(result.status===200)s=result.body.snapshot;return result;};return {request,write,lease,get s(){return s;},reload:async()=>{s=(await request('character')).body;return s;}};}
it('new sword character, server equip denial, per-weapon bar restoration and persisted location',async()=>{
 const p=await player();expect(p.s.skills).toEqual(['cut']);// 开场后只有武器基础招，其余一个一个给（progression-goal-plan §11.3）
 expect(p.s.stats.weapon).toBe('sword');const bow=p.s.gear.find(g=>g.base==='bow')!,sword=p.s.equipment.weapon;
 expect((await p.write('skills',{skills:['bolt','ward']})).body.code).toBe('SKILL_INACTIVE');
 expect((await p.write('gear/equip',{gear_id:bow.id})).status).toBe(200);expect(p.s.skills).toEqual([]);expect(p.s.skillRanks.cut).toBe(1);
 expect((await p.write('skills',{skills:['cut']})).body.code).toBe('SKILL_WEAPON');expect((await p.write('gear/equip',{gear_id:sword})).status).toBe(200);expect(p.s.skills).toEqual(['cut']);
 expect((await p.write('location',{region:'ss-map-port'})).status).toBe(200);expect((await p.reload()).lastRegion).toBe('ss-map-port');expect((await p.write('location',{region:'ss-map-ember'})).body.code).toBe('LOCKED');
 const permit=await p.request('permit',{lease_id:p.lease,region:'ss-map-wind'});expect(permit.status).toBe(200);expect((await p.reload()).lastRegion).toBe('ss-map-wind');
});
it('engine defense runs on the client: clears faster than the build allows are refused, failed engine retries',async()=>{
 const p=await player();const stored=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.s.id])).rows[0].state;stored.starsea.quests={'ss-c01-t03':{step:0,attempt:0,acceptedAt:0}};stored.starsea.tracked='ss-c01-t03';await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[stored,p.s.id]);await p.reload();
 const permit=(await p.request('permit',{lease_id:p.lease,region:'ss-map-wind'})).body;expect((await p.write('quest',{op:'start',region:'ss-map-wind',retry:true})).body.code).toBe('STARSEA_STEP');
 const started=await p.write('quest',{op:'interact',target:'object:engine',region:'ss-map-wind'});expect(started.status).toBe(200);expect(p.s.starsea?.wave?.spawns).toHaveLength(3);expect(p.s.starsea?.wave?.startedAt).toBeGreaterThan(0);expect(p.s.starsea?.wave?.minClearMs).toBe(1386);// 按当前构筑推的理想最快清场：这里只有斩击（未做落点求生，旋风斩还没找回）
 expect((await p.request('quest/defense',{lease_id:p.lease,x:0,y:0,mode:'manual'})).status).toBe(404);
 expect((await p.write('quest',{op:'defense-finish',task:'ss-c01-t03',region:'ss-map-wind'})).body.code).toBe('STARSEA_DEFENSE');
 const backdate=async(ms:number)=>{const st=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.s.id])).rows[0].state;st.starsea.wave.startedAt-=ms;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[st,p.s.id]);await p.reload();};
 // 引擎在本地被毁：修复重来换一批新的袭击者，旧的一批不再出现在授权返回里。
 const old=p.s.starsea!.wave!.spawns[0].id,attempt=p.s.starsea!.quests['ss-c01-t03'].attempt;await backdate(5000);expect((await p.write('quest',{op:'start',region:'ss-map-wind',retry:true})).status).toBe(200);expect(p.s.starsea!.quests['ss-c01-t03'].attempt).toBe(attempt+1);
 const raiders=p.s.starsea!.wave!.spawns.map(m=>m.id);expect(raiders).not.toContain(old);const again=(await p.request('permit',{lease_id:p.lease,region:'ss-map-wind'})).body;expect(again.spawns.map((m:any)=>m.id)).not.toContain(old);expect(again.spawns.map((m:any)=>m.id)).toEqual(expect.arrayContaining(raiders));
 const kills={permit_id:permit.id,build:p.s.build,sequence:1,from_tick:0,to_tick:3,kills:raiders.map((id,i)=>({source_id:id,tick:i+1}))};
 // 刚开打就报清场：快过当前构筑的理想最快清场，整份报告被拒，也不能直接完成守护。
 expect((await p.write('combat/report',kills)).body.code).toBe('RATE');expect((await p.write('quest',{op:'defense-finish',task:'ss-c01-t03',region:'ss-map-wind'})).body.code).toBe('STARSEA_DEFENSE');
 await backdate(p.s.starsea!.wave!.minClearMs!+100);expect((await p.write('combat/report',kills)).status).toBe(200);expect(p.s.starsea!.wave!.killed).toHaveLength(3);
 // 验收 D4：护身印在守住引擎的同一条回执里到手，客户端成长卡片据前后快照弹出「新招式 · 护身印」（progression-goal-plan §11.3）。
 expect(p.s.skills).not.toContain('ward');const mark=growthMark(p.s);
 expect(p.s.starsea!.done).not.toContain('ss-c01-t03');expect((await p.write('quest',{op:'defense-finish',task:'ss-c01-t03',region:'ss-map-wind'})).status).toBe(200);expect(p.s.starsea!.done).toContain('ss-c01-t03');
 expect(p.s.skills).toContain('ward');expect(p.s.skillAccess.find(q=>q.id==='ward')?.activated).toBe(true);
 expect(growthCards(mark,p.s)).toContainEqual({title:'新招式 · 护身印',lines:[{speaker:'',text:expect.stringContaining('护身印到手了')}]});
});
it('runs db12 exactly once, changing only incompatible slots and bar memory',async()=>{
 const p=await player(),s=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.s.id])).rows[0].state;s.skills=['bolt','ward'];s.skillRanks.bolt=4;s.skillBooks.chain=3;s.gold=777;s.material=444;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,p.s.id]);await pool.query('DELETE FROM ow_schema WHERE version=12');await migrate(pool);const after=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.s.id])).rows[0].state;
 expect(after.skills).toEqual(['ward']);for(const k of ['gear','equipment','skillRanks','skillBooks','gold','material','level','xp','progress','starsea'])expect(after[k]).toEqual(s[k]);await migrate(pool);expect((await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.s.id])).rows[0].state).toEqual(after);
});
