import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {poolFor,migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import {currentCampPlayer} from './fixtures/current-camp-driver.ts';
import {tideNightKills} from '../packages/content/starsea/index.ts';
import type {Snapshot,Spawn} from '../packages/contracts/index.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Real PostgreSQL required');
const pool=poolFor(dsn),app=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{await migrate(pool);await app.ready();});afterAll(async()=>{await app.close();await pool.end();});
async function player(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'se_'+randomUUID().replaceAll('-','').slice(0,24)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown)=>{const r=await app.inject({url:'/api/'+path,method:body===undefined?'GET':'POST',headers:{cookie},payload:body as any});return {status:r.statusCode,body:r.json()};};
 const s=(await request('character',{name:'星潮验收'})).body as Snapshot,lease=(await request('control',{client_id:randomUUID()})).body.lease_id as string;
 return {request,s,lease};
}
it('collects a life crystal once through the quest endpoint and raises max HP',async()=>{
 const p=await player(),before=(await p.request('character')).body as Snapshot;
 const body={command_id:randomUUID(),revision:before.revision,lease_id:p.lease,op:'relic',region:'ss-map-wind',target:'life-wind-1'},done=await p.request('quest',body);
 expect(done.status).toBe(200);const after=done.body.snapshot as Snapshot;
 expect(after.starsea!.crystals).toEqual(['life-wind-1']);expect(after.stats.hp).toBeGreaterThan(before.stats.hp);
 expect(after.starseaView!.relics.find(r=>r.id==='relic:life-wind-1')!.done).toBe(true);
 expect((await p.request('quest',body)).body).toEqual(done.body);
 const again=await p.request('quest',{...body,command_id:randomUUID(),revision:after.revision});expect(again.status).not.toBe(200);
 const core=await p.request('quest',{...body,command_id:randomUUID(),revision:after.revision,target:'core-wind'});expect(core.status).not.toBe(200);
 expect(((await p.request('character')).body as Snapshot).stats.hp).toBe(after.stats.hp);
});
it('a zone tide night joins the live permit and its actually killed invader drops rare or better',async()=>{
 const p=await currentCampPlayer(app,pool);await pool.query("UPDATE ow_characters SET state=jsonb_set(state,'{starsea,tide}',$1::jsonb) WHERE id=$2",[JSON.stringify({[p.camp.zone]:tideNightKills-1}),p.id]);const cycle=await p.current(),first=await p.kill(cycle.spawns);expect(first.result.status,JSON.stringify(first.result.body)).toBe(200);const night=first.result.body.snapshot.starsea.night;expect(night.spawns.some((s:Spawn)=>s.elite)).toBe(true);const stored=(await pool.query('SELECT data FROM ow_permits WHERE id=$1',[p.permit.id])).rows[0].data.spawns.map((m:Spawn)=>m.id);for(const invader of night.spawns)expect(stored).toContain(invader.id);const second=await p.kill([night.spawns[0]]);expect(second.result.status,JSON.stringify(second.result.body)).toBe(200);expect(second.result.body.rewards.length).toBeGreaterThanOrEqual(1);expect(second.result.body.rewards.every((r:any)=>['rare','legendary'].includes(r.gear.quality))).toBe(true);expect(second.result.body.snapshot.starsea.night.killed).toEqual([night.spawns[0].id]);
},30000);
