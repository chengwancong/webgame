import '../packages/content/open-world/index.ts';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {regionById} from '../packages/content/index.ts';
import {walkable} from '../packages/simulation/navigation.ts';
import {receiptSchema} from '../packages/contracts/index.ts';
import {gatheredInRegion} from '../packages/rules/world-interactions.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn||new URL(dsn).port==='8612')throw Error('必须使用隔离PostgreSQL');
const schema='qa_gather_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema}),app=createApp(pool,{testLogin:true,dungeons:false});
const nodes=worldTables.objects.filter(n=>n.kind==='gather'),node=nodes.find(n=>n.region==='ss-map-wind')!;
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
async function player(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'gather_'+randomUUID().replaceAll('-','').slice(0,18)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,payload?:unknown)=>{const r=await app.inject({method:payload===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:payload as any});return {status:r.statusCode,body:r.json()};};
 const created=await request('character',{name:'采集验收'}),id=created.body.id,lease=(await request('control',{client_id:randomUUID()})).body.lease_id,entry=randomUUID();
 const enter=(attempt_id:string|undefined=entry)=>request('permit',{lease_id:lease,region:node.region,...(attempt_id?{attempt_id}:{}),position:{x:node.x,y:node.y}});
 expect((await enter()).status).toBe(200);
 const saved=async()=>(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;
 const command=async(extra:object={})=>({command_id:randomUUID(),revision:(await saved()).revision,lease_id:lease,region:node.region,node:node.id,position:{x:node.x,y:node.y},mode:'manual',...extra});
 return {id,lease,entry,request,enter,saved,command};
}
it('150个点来自六岛可通行位置，每分区4至8个',()=>{expect(nodes).toHaveLength(150);for(const n of nodes)expect(walkable(regionById(n.region),n,.55),n.id).toBe(true);for(const zone of worldTables.zones.filter(z=>nodes.some(n=>n.region===z.region))){const count=nodes.filter(n=>n.zone===zone.id).length;expect(count).toBeGreaterThanOrEqual(4);expect(count).toBeLessThanOrEqual(8);}});
it('采集成功进回执、熟练经验与本轮快照，同一命令幂等',async()=>{const p=await player(),body=await p.command(),one=await p.request('field/gather',body);expect(one.status,JSON.stringify(one.body)).toBe(200);const receipt=receiptSchema.parse(one.body);expect(receipt.delta.materials?.[node.material!]).toBeGreaterThanOrEqual(2);expect(receipt.delta.professions?.gathering.xp).toBe(15);expect(receipt.snapshot.field?.gathered).toContain(node.id);expect((await p.request('field/gather',body)).body).toEqual(one.body);expect((await pool.query('SELECT count(*)::int n FROM ow_ledger WHERE character=$1',[p.id])).rows[0].n).toBe(1);});
it('距离大于2格拒绝且存档不变',async()=>{const p=await player(),before=await p.saved(),r=await p.request('field/gather',await p.command({position:{x:node.x+2.01,y:node.y}}));expect(r.body.code).toBe('GATHER_FAR');expect(await p.saved()).toEqual(before);});
it('BUG-31 a successful gather snapshot names the region and hides the exhausted node across refresh',async()=>{
 const p=await player(),r=await p.request('field/gather',await p.command());expect(r.status).toBe(200);expect(r.body.snapshot.field.region).toBe(node.region);
 expect(gatheredInRegion(r.body.snapshot,node.region).has(node.id)).toBe(true);
 const refreshed=(await p.request('character')).body;expect(gatheredInRegion(refreshed,node.region).has(node.id)).toBe(true);
 expect((await p.request('field/gather',await p.command())).body.code).toBe('GATHER_DONE');
});
it('离开当前区域后不能远程采集，原区域本轮记录仍保留',async()=>{const p=await player();expect((await p.request('field/gather',await p.command())).status).toBe(200);const state=await p.saved(),moved=await p.request('location',{command_id:randomUUID(),revision:state.revision,lease_id:p.lease,region:'ss-map-port'});expect(moved.status).toBe(200);expect(moved.body.snapshot.field.gathered).toEqual([]);const before=await p.saved();expect(before.field.gathered).toEqual([node.id]);expect((await p.request('field/gather',await p.command())).body.code).toBe('GATHER_PLACE');expect(await p.saved()).toEqual(before);});
it('同轮再次采集拒绝，明确重新进入后可以再采',async()=>{const p=await player();expect((await p.request('field/gather',await p.command())).status).toBe(200);const before=await p.saved(),again=await p.request('field/gather',await p.command({mode:'route'}));expect(again.body.code).toBe('GATHER_DONE');expect(await p.saved()).toEqual(before);expect((await p.enter(randomUUID())).status).toBe(200);expect((await p.saved()).field.gathered).toEqual([]);expect((await p.request('field/gather',await p.command({mode:'route'}))).status).toBe(200);});
it('控制续期、授权续期、构筑同步与读取恢复都不清空',async()=>{const p=await player();expect((await p.request('field/gather',await p.command())).status).toBe(200);await p.request('control/renew',{lease_id:p.lease});await p.enter(p.entry);await p.enter(undefined);const state=await p.saved(),gear=state.gear.find((g:any)=>!Object.values(state.equipment).includes(g.id)),equipped=await p.request('gear/equip',{command_id:randomUUID(),revision:state.revision,lease_id:p.lease,gear_id:gear.id});expect(equipped.status).toBe(200);expect(equipped.body.snapshot.build).toBeGreaterThan(state.build);await p.enter(p.entry);expect((await p.request('character')).body.field.gathered).toEqual([node.id]);expect((await p.saved()).field.gathered).toEqual([node.id]);});
it('副本中与未开放区域均拒绝且不扣改资源',async()=>{
 const p=await player(),state=await p.saved();state.dungeon={instance:randomUUID(),pendingResult:null,returnRegion:node.region};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,p.id]);expect((await p.request('field/gather',await p.command())).body.code).toBe('GATHER_PLACE');expect(await p.saved()).toEqual(state);
 delete state.dungeon;const locked=nodes.find(n=>n.region==='ss-map-mist')!;state.field.region=locked.region;state.lastRegion=locked.region;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,p.id]);expect((await p.request('field/gather',await p.command({region:locked.region,node:locked.id,position:{x:locked.x,y:locked.y}}))).body.code).toBe('GATHER_PLACE');expect(await p.saved()).toEqual(state);
});
